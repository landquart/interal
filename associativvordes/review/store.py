"""Local research review ledger. Immutable fsynced transactions are the authority.

No dependency on production storage, and no membership writer. POSIX flock and
atomic rename require a local filesystem (not an object-store/FUSE mount).
"""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import contextlib
import copy
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import threading

STATUSES = ('ACCEPT_PROPOSED', 'REJECT', 'UNCERTAIN', 'DEFER',
            'NEEDS_IDENTITY_REVIEW', 'NEEDS_SEMANTIC_REVIEW')
RELATIONS = ('direct derivation', 'indirect derivation', 'compound', 'inflection',
             'orthographic variant', 'mixed path', 'unresolved')
VERSION = 'review-ledger-v1'


def canonical(x):
    return json.dumps(x, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def digest(x):
    return hashlib.sha256(x if isinstance(x, bytes) else canonical(x).encode()).hexdigest()


def atomic(path, data):
    path = Path(path)
    temp = path.with_name('.pending-' + secrets.token_hex(12))
    try:
        with open(temp, 'xb') as f:
            os.chmod(temp, 0o600)
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp, path)
        fd = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
    finally:
        temp.unlink(missing_ok=True)


class Conflict(ValueError):
    pass


class Ledger:
    def __init__(self, root):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        for name in ('snapshots', 'events', 'exports', 'progress'):
            (self.root / name).mkdir(exist_ok=True, mode=0o700)
        self.mutex = threading.RLock()
        self.events = []
        self.current = {}
        self.revisions = {}
        self.requests = {}
        self.questions = {}
        self.snapshot = None
        self.head = None
        self.loaded = 0
        self.lock_depth = 0
        with self.lock():
            self.sync()

    @contextlib.contextmanager
    def lock(self):
        with self.mutex:
            if self.lock_depth:
                self.lock_depth += 1
                try:
                    yield
                finally:
                    self.lock_depth -= 1
            else:
                with open(self.root / 'LOCK', 'a') as f:
                    fcntl.flock(f, fcntl.LOCK_EX)
                    self.lock_depth = 1
                    try:
                        yield
                    finally:
                        self.lock_depth = 0
                        fcntl.flock(f, fcntl.LOCK_UN)

    def sync(self):
        # Every complete numbered file is authoritative. Orphan pending files are
        # never replayed. A missing/corrupt committed transaction fails closed.
        paths = sorted((self.root / 'events').glob('[0-9]*.json'))
        if len(paths) < self.loaded:
            raise ValueError('ledger was truncated')
        for i, path in enumerate(paths[self.loaded:], self.loaded + 1):
            t = json.loads(path.read_bytes())
            proof = t.pop('sha256')
            if path.name != f'{i:010d}.json' or t['previous'] != self.head or digest(t) != proof:
                raise ValueError('broken ledger chain: ' + path.name)
            t['sha256'] = proof
            self.events.append(t)
            self.head = proof
            self.loaded = i
            self.requests[(t['actor'], t['request_id'])] = t
            for d in t['decisions']:
                key = (d['question_id'], t['actor'])
                self.current[key] = d
                self.revisions[key] = d['revision']
        anchor = self.root/'HEAD'
        if anchor.exists():
            known = json.loads(anchor.read_bytes())
            if known['sequence'] > len(self.events) or (known['sequence'] and self.events[known['sequence']-1]['sha256'] != known['sha256']):
                raise ValueError('committed ledger tail was lost or changed')
        pointer = self.root / 'CURRENT'
        if pointer.exists():
            snap = pointer.read_text().strip()
            if not re.fullmatch('[a-f0-9]{64}', snap):
                raise ValueError('invalid snapshot pointer')
            if snap != self.snapshot:
                folder = self.root / 'snapshots' / snap
                manifest = json.loads((folder / 'MANIFEST.json').read_bytes())
                raw = (folder / 'questions.ndjson').read_bytes()
                if digest(manifest) != snap or digest(raw) != manifest['outputs']['questions.ndjson']:
                    raise ValueError('snapshot checksum mismatch')
                qs = [json.loads(line) for line in raw.splitlines() if line]
                if len({q['id'] for q in qs}) != len(qs):
                    raise ValueError('duplicate question IDs')
                self.questions = {q['id']: q for q in qs}
                self.snapshot = snap
                self.manifest = manifest

    def import_queue(self, directory, source_rows=None):
        directory = Path(directory)
        manifest = json.loads((directory / 'MANIFEST.json').read_bytes())
        raw = (directory / 'questions.ndjson').read_bytes()
        if digest(raw) != manifest['outputs']['questions.ndjson']:
            raise ValueError('queue hash mismatch')
        qs = [json.loads(line) for line in raw.splitlines() if line]
        if len(qs) != manifest['counts']['questions'] or len({q['id'] for q in qs}) != len(qs):
            raise ValueError('queue count/IDs mismatch')
        for q in qs:
            if not all(q.get(k) for k in ('id', 'family', 'language', 'lemma', 'lexeme_alternatives')):
                raise ValueError('question lacks native identity')
        attachment = None
        if source_rows is not None or manifest.get('schema') == 'v5-review-projection/1':
            import base64
            source_rows = source_rows if source_rows is not None else (directory/'source-rows.json').read_bytes()
            if digest(source_rows) != manifest['outputs'].get('source-rows.json'):
                raise ValueError('source rows checksum')
            rows = json.loads(source_rows)
            wanted = {e['id']: e for q in qs for e in q.get('evidence_refs', [])}
            if set(rows) != set(wanted):raise ValueError('source evidence closure')
            for identifier,row in rows.items():
                evidence = wanted[identifier]
                if row.get('record_id') != identifier:raise ValueError('source row identity mismatch')
                raw_row = base64.b64decode(row['original_line_base64'], validate=True)
                if row['raw_locator'] != evidence['raw_locator'] or digest(raw_row) != evidence['raw_locator']['raw_sha256']:
                    raise ValueError('raw row differs from question evidence')
                if row.get('raw_text') != raw_row.decode('utf-8') or any(row.get(k) != evidence.get(k) for k in ('revision','artifact')):
                    raise ValueError('source row metadata mismatch')
            attachment = canonical(rows).encode()
        if manifest.get('version_contract'):
            from associativvordes.v5_contract.versions import validate
            validate(manifest['version_contract'])
        snap = digest(manifest)
        with self.lock():
            prior=getattr(self,'manifest',{}).get('version_contract')
            if prior or manifest.get('version_contract'):
                from associativvordes.v5_contract.versions import require
                require(not self.questions or prior==manifest.get('version_contract'),'review ledger requires a fresh namespace for a new version')
            if attachment is not None:
                row_folder = self.root/'source-rows';row_folder.mkdir(exist_ok=True)
                atomic(row_folder/(digest(attachment)+'.json'), attachment)
            folder = self.root / 'snapshots' / snap
            folder.mkdir(exist_ok=True)
            atomic(folder / 'questions.ndjson', raw)
            atomic(folder / 'MANIFEST.json', canonical(manifest).encode())
            directory_fd = os.open(self.root/'snapshots', os.O_RDONLY | os.O_DIRECTORY)
            try: os.fsync(directory_fd)
            finally: os.close(directory_fd)
            atomic(self.root / 'CURRENT', snap.encode())
            self.sync()
        return {'snapshot': snap, 'questions': len(qs), 'membership_writes': 0}

    def state(self, qid, actor):
        return self.current.get((qid, actor))

    def revision(self, qid, actor):
        return self.revisions.get((qid, actor), 0)

    def history(self, qid, actor=None):
        return [dict(d, actor=t['actor'], timestamp=t['timestamp'], transaction=t['sha256'])
                for t in self.events if actor is None or t['actor'] == actor
                for d in t['decisions'] if d['question_id'] == qid]

    def pair(self, qid, accounts):
        primary = [d for (q, a), d in self.current.items() if q == qid and
                   accounts.get(a) == 'reviewer' and d['status'] is not None]
        blind = [d for (q, a), d in self.current.items() if q == qid and
                 accounts.get(a) == 'blind' and d['status'] is not None]
        return primary, blind

    def card(self, qid, actor, role, accounts):
        q = copy.deepcopy(self.questions[qid])
        if role == 'blind':
            # Allowlist at the server boundary; no algorithm output, legacy
            # verdict, proposed base/path, score, grouping, or competing-family hint.
            q = {k: q[k] for k in ('id', 'family', 'language', 'lemma', 'pos',
                 'pos_status', 'sense_status', 'lexeme_alternatives', 'frequency', 'evidence_refs') if k in q}
        from associativvordes.review.source_rows import lookup as source_rows
        raw_rows = source_rows(self, q)
        own = self.state(qid, actor)
        primary, blind = self.pair(qid, accounts)
        both = bool(primary and blind)
        return {'question': q, 'source_rows': raw_rows, 'snapshot': self.snapshot,
                'own': own, 'revision': self.revision(qid, actor),
                'history': self.history(qid, None if role == 'arbiter' and both else actor),
                'comparison': {'primary': primary, 'blind': blind,
                  'disagreement': len({(d['status'], d['lexeme_id'], d['relation']) for d in primary + blind}) > 1}
                  if role == 'arbiter' and both else None,
                'source_changed': bool(own and own['snapshot'] != self.snapshot),
                'establishes_membership': False}

    def listing(self, actor, role, accounts, filters):
        rows = []
        for qid, q in self.questions.items():
            d = self.state(qid, actor)
            status = d['status'] if d else None
            if filters.get('language') and q['language'] != filters['language']: continue
            if filters.get('family') and q['family'] != filters['family']: continue
            if filters.get('search') and filters['search'].casefold() not in q['lemma'].casefold(): continue
            if filters.get('status') == 'OPEN' and status is not None: continue
            if filters.get('status') in STATUSES and status != filters['status']: continue
            if role != 'blind':
                if filters.get('category') and filters['category'] not in q.get('categories', []): continue
                if filters.get('group') and group_key(q) != filters['group']: continue
                if filters.get('independent') == 'yes' and len(q.get('independence', {}).get('independent_groups', [])) < 2: continue
                if filters.get('doubtful') == 'yes' and not (q.get('uncertainty_reasons') or 'IDENTITY_UNRESOLVED' in q.get('categories', []) or status in ('UNCERTAIN', 'NEEDS_IDENTITY_REVIEW', 'NEEDS_SEMANTIC_REVIEW')): continue
                if filters.get('disagreement') == 'yes':
                    p, b = self.pair(qid, accounts)
                    if role != 'arbiter' or not p or not b or len({(x['status'], x['lexeme_id'], x['relation']) for x in p+b}) < 2: continue
            rows.append({'id': qid, 'lemma': q['lemma'], 'language': q['language'], 'family': q['family'],
                         'status': status, **({'group': group_key(q), 'categories': q.get('categories', [])} if role != 'blind' else {})})
        rows.sort(key=lambda r: (r.get('group', '') if filters.get('grouped') == 'yes' and role != 'blind' else '', r['id']))
        total = len(rows)
        offset = max(0, int(filters.get('offset', 0)))
        limit = min(100, max(1, int(filters.get('limit', 50))))
        done = sum(bool(self.state(q, actor) and self.state(q, actor)['status']) for q in self.questions)
        return {'total': total, 'items': rows[offset:offset+limit], 'progress': {'done': done, 'total': len(self.questions)},
                'languages': sorted({q['language'] for q in self.questions.values()}),
                'families': sorted({q['family'] for q in self.questions.values()})}

    def decide(self, actor, role, accounts, request_id, items, snapshot, undo=False, arbitration=False):
        if not re.fullmatch(r'[a-zA-Z0-9_-]{8,100}', request_id): raise ValueError('invalid request ID')
        if not items or len(items) > 100: raise ValueError('1..100 decisions required')
        if len({i['question_id'] for i in items}) != len(items): raise ValueError('duplicate batch item')
        request_hash = digest([role, items, snapshot, undo, arbitration])
        with self.lock():
            self.sync()
            old_request = self.requests.get((actor, request_id))
            if old_request:
                if old_request['request_hash'] != request_hash: raise Conflict('request ID reused with different content')
                return old_request
            if snapshot != self.snapshot: raise Conflict('sources changed; reopen card')
            decisions = []
            version_contract=self.manifest.get('version_contract')
            if version_contract:
                from associativvordes.v5_contract.versions import validate
                validate(version_contract)
            for item in items:
                qid = item['question_id']
                q = self.questions[qid]
                revision = self.revision(qid, actor)
                if item['expected_revision'] != revision: raise Conflict('decision changed; reopen card')
                old = self.state(qid, actor)
                if not item.get('reason', '').strip() or len(item['reason']) > 8000: raise ValueError('reason required (max 8000 characters)')
                if role == 'arbiter':
                    p, b = self.pair(qid, accounts)
                    if not arbitration or not p or not b: raise ValueError('two independent reviews required before arbitration')
                    pair_hash = digest(p+b)
                    if item.get('pair_hash') != pair_hash: raise Conflict('reviews changed; reopen comparison')
                elif arbitration: raise ValueError('arbiter role required')
                if undo:
                    if not old or old['status'] is None: raise ValueError('no active decision to undo')
                    previous = self.history(qid, actor)
                    # Restore the immediately previous effective record; undo is a
                    # compensating event, never deletion of the mistaken record.
                    value = previous[-2] if len(previous) > 1 else None
                    status = value['status'] if value else None
                    lexeme = value['lexeme_id'] if value else old['lexeme_id']
                    relation = value['relation'] if value else old['relation']
                else:
                    status, lexeme, relation = item['status'], item['lexeme_id'], item['relation']
                    if status not in STATUSES or relation not in RELATIONS: raise ValueError('invalid status/relation')
                    if lexeme not in {x['id'] for x in q['lexeme_alternatives']}: raise ValueError('select concrete native lexeme')
                normative_evaluation=None
                if version_contract:
                    from associativvordes.v5_contract.policy import review,hypothesis
                    if not undo and status in ('ACCEPT_PROPOSED','REJECT'):
                        normative_evaluation=review(q,item,version_contract)
                    else:normative_evaluation=hypothesis({'question_id':qid,'status':status},version_contract)
                decisions.append({'question_id': qid, 'family_id': q['family'], 'language': q['language'],
                    'lexeme_id': lexeme, 'lemma': q['lemma'], 'status': status, 'reason': item['reason'].strip(),
                    'relation': relation, 'previous_status': old['status'] if old else None,
                    'revision': revision+1, 'snapshot': self.snapshot,
                    'input_fingerprint': q.get('input_fingerprint', digest(q)),
                    'source_versions': sorted({(e.get('source', ''), e.get('revision', 'unknown')) for e in q.get('evidence_refs', [])}),
                    'evidence_refs': q.get('evidence_refs', []), 'algorithm_versions': self.manifest.get('identity', {}).get('code', {}),
                    'review_version': VERSION, 'review_code': {name: digest((Path(__file__).parent/name).read_bytes()) for name in ('store.py', 'server.py', 'app.js', 'source_rows.py')}, 'action': 'undo' if undo else 'arbitrate' if arbitration else 'decide',
                    'arbitration_basis': pair_hash if role == 'arbiter' else None,
                    'establishes_membership': False})
                if version_contract:
                    decisions[-1]['normative_evaluation']=normative_evaluation
                    decisions[-1]['normative_decision']=copy.deepcopy(item.get('normative_decision'))
            t = {'sequence': self.loaded+1, 'previous': self.head, 'actor': actor, 'role': role,
                 'timestamp': datetime.now(timezone.utc).isoformat(), 'request_id': request_id,
                 'request_hash': request_hash, 'decisions': decisions, 'version': VERSION}
            t['sha256'] = digest(t)
            atomic(self.root / 'events' / f'{t["sequence"]:010d}.json', canonical(t).encode())
            self.sync()
            atomic(self.root/'HEAD', canonical({'sequence': self.loaded, 'sha256': self.head}).encode())
            return self.requests[(actor, request_id)]

    def export(self):
        with self.lock():
            self.sync()
            content = {'version': VERSION, 'head': self.head, 'snapshot': self.snapshot, 'events': self.events,
                       'membership_writes': 0, 'contains_pseudonymous_reviewers': True}
            data = canonical(content).encode()
            name = digest(data)
            target = self.root / 'exports' / (name + '.json')
            atomic(target, data)
            return target

    def overlay(self, accounts):
        # A read-only research overlay. A refreshed graph cannot convert proposal
        # approval into an accepted membership. Stale approvals are marked explicitly.
        result = []
        for (qid, actor), d in sorted(self.current.items()):
            if d['status'] == 'ACCEPT_PROPOSED':
                result.append(dict(d, actor=actor, source_changed=d['snapshot'] != self.snapshot,
                    current_question_present=qid in self.questions, layer='research_proposal',
                    arbitration_stale=d['action'] == 'arbitrate' and d['arbitration_basis'] != digest(sum(self.pair(qid, accounts), []))))
        return result

    def progress(self, actor, value=None):
        with self.lock():
            path = self.root / 'progress' / (digest(actor) + '.json')
            if value is not None: atomic(path, canonical(value).encode())
            return json.loads(path.read_bytes()) if path.exists() else {}


def group_key(q):
    return '|'.join([q['family'], q['language'], str(q.get('pos')), ','.join(sorted(q.get('relation_types', [])))])


def restore(export, target, source_root):
    """Offline restore into an empty directory, including all historical snapshots."""
    target, source_root = Path(target), Path(source_root)
    if target.exists() and any(target.iterdir()): raise ValueError('restore target must be empty')
    payload = json.loads(Path(export).read_bytes())
    if digest(Path(export).read_bytes()) != Path(export).stem: raise ValueError('export filename checksum mismatch')
    ledger = Ledger(target)
    snapshots = {payload['snapshot']} | {d['snapshot'] for t in payload['events'] for d in t['decisions']}
    for snap in snapshots:
        source = source_root / 'snapshots' / snap
        manifest = json.loads((source/'MANIFEST.json').read_bytes())
        if digest(manifest) != snap or digest((source/'questions.ndjson').read_bytes()) != manifest['outputs']['questions.ndjson']:
            raise ValueError('historical snapshot checksum mismatch')
        shutil.copytree(source, target / 'snapshots' / snap)
    for t in payload['events']:
        atomic(target / 'events' / f'{t["sequence"]:010d}.json', canonical(t).encode())
    atomic(target / 'CURRENT', payload['snapshot'].encode())
    atomic(target/'HEAD', canonical({'sequence': len(payload['events']), 'sha256': payload['head']}).encode())
    with ledger.lock(): ledger.sync()
    if ledger.head != payload['head']: raise ValueError('restore head mismatch')
    return ledger

