"""Finite, signed research releases. No production path or network writer.

POSIX local filesystem only. The operator owns trust.json; classifiers must not
have write access to it, its public keys, this code, or the version store.
"""
import argparse
import base64
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
import subprocess
import tempfile

VERSION = 'controlled-family-release/1'
LANGUAGES = ('de', 'en', 'es', 'fr', 'it', 'ru')
KINDS = ('ADD_MEMBER', 'EXCLUDE_MEMBER', 'CORRECT_RELATION', 'CORRECT_IDENTITY', 'CORRECT_FAMILY')
RELATIONS = ('direct derivation', 'indirect derivation', 'compound', 'inflection',
             'orthographic variant', 'mixed path', 'unresolved')


def canonical(x):
    return json.dumps(x, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()


def digest(x):
    return hashlib.sha256(x if isinstance(x, bytes) else canonical(x)).hexdigest()


def read(path):
    return json.loads(Path(path).read_bytes())


def atomic(path, data):
    path = Path(path)
    tmp = path.with_name('.pending-' + secrets.token_hex(12))
    try:
        with open(tmp, 'xb') as f:
            os.chmod(tmp, 0o600)
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
        fd = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try: os.fsync(fd)
        finally: os.close(fd)
    finally:
        tmp.unlink(missing_ok=True)


def require(ok, reason):
    if not ok: raise ValueError(reason)


def external(path):
    p = Path(path).resolve()
    checkout = Path(__file__).resolve().parents[2]
    require(not p.is_relative_to(checkout), 'state/trust/keys must be outside checkout')
    return p


def signature(payload, key):
    """Explicit offline signing; no key generation and no automatic approval."""
    key = external(key)
    require(key.stat().st_mode & 0o077 == 0, 'private key must have mode 0600')
    with tempfile.TemporaryDirectory() as folder:
        src = Path(folder)/'payload'; src.write_bytes(canonical(payload))
        result = subprocess.run(['openssl', 'pkeyutl', '-sign', '-rawin', '-inkey', str(key),
                                 '-in', str(src)], capture_output=True, check=True)
    return base64.b64encode(result.stdout).decode()


def verify(token, trust, role, expected):
    require(set(token) == {'signer', 'payload', 'signature'}, 'invalid signed envelope')
    signer = trust['principals'].get(token['signer'])
    require(signer and signer['role'] == role and not signer.get('revoked'), 'unauthorized signer')
    require(token['payload'] == expected, 'signature has wrong scope/version/digest')
    pem = signer['public_key_pem']
    # Ed25519 only; reject RSA/ECDSA substitution and malformed keys.
    with tempfile.TemporaryDirectory() as folder:
        root = Path(folder)
        (root/'key').write_text(pem)
        (root/'payload').write_bytes(canonical(expected))
        (root/'sig').write_bytes(base64.b64decode(token['signature'], validate=True))
        info = subprocess.run(['openssl', 'pkey', '-pubin', '-in', str(root/'key'), '-text', '-noout'],
                              capture_output=True, check=True).stdout
        require(b'ED25519' in info, 'Ed25519 key required')
        r = subprocess.run(['openssl', 'pkeyutl', '-verify', '-rawin', '-pubin', '-inkey', str(root/'key'),
                            '-in', str(root/'payload'), '-sigfile', str(root/'sig')], capture_output=True)
        require(r.returncode == 0, 'invalid signature')
    return token['signer']


def key(row):
    return (row['family_id'], row['language'], row['lemma_id'])


def validate_state(state):
    require(state['schema'] == VERSION, 'unsupported state schema')
    data = state['data']
    families = {f['id'] for f in data['catalog']['families']}
    require(len(families) == len(data['catalog']['families']), 'duplicate canonical family')
    heads = {h['id']: h for h in data['heads']}
    require(len(heads) == len(data['heads']), 'duplicate head')
    members = data['memberships']
    require(len({key(m) for m in members}) == len(members), 'duplicate finite membership')
    for row in members:
        require(row['family_id'] in families, 'unknown canonical family')
        require(row['language'] in LANGUAGES, 'unsupported language')
        require(row['head_id'] in heads, 'missing lexical head')
        require(heads[row['head_id']]['language'] == row['language'], 'cross-language head')
        require(row.get('lemma_id') and row.get('word'), 'missing concrete lexeme')
        require(row.get('relation', 'unresolved') in RELATIONS, 'invalid relation')
    for row in data['links']:
        require(row['family_id'] in families and row['head_id'] in heads, 'broken link')
        require(heads[row['head_id']]['language'] == row['language'], 'cross-language link')
    return {'families': len(families), 'heads': len(heads), 'memberships': len(members),
            'languages': sorted({m['language'] for m in members})}


def context(state, snapshot_hash, source_hash, algorithm_hash, ledger_head, files=None):
    return dict(base=digest(state), snapshot=snapshot_hash, sources=source_hash,
                algorithm=algorithm_hash, review_head=ledger_head, files=files or {})


def check_input_files(inputs):
    files = inputs.get('files', {})
    for name in ('snapshot', 'sources', 'algorithm', 'controller', 'registry', 'index', 'aux', 'project'):
        require(name in files, 'missing frozen input binding: '+name)
        item = files[name]; hasher = hashlib.sha256()
        with open(item['path'], 'rb') as stream:
            for block in iter(lambda: stream.read(1024*1024), b''): hasher.update(block)
        require(hasher.hexdigest() == item['sha256'], 'current input file changed: '+name)
        if name in ('snapshot', 'sources', 'algorithm'):
            require(inputs[name] == item['sha256'], 'inconsistent input binding: '+name)
    require(files['controller']['sha256'] == digest(Path(__file__).read_bytes()), 'controller code changed')


def verdict_payload(operation, inputs):
    return dict(schema=VERSION, purpose='confirm-exact-operation', operation=digest(operation),
                inputs=inputs, disposition='CONFIRMED')


def transform(state, operations):
    """Finite exact records only; histories and non-membership objects unchanged."""
    validate_state(state)
    result = copy.deepcopy(state)
    data = result['data']; members = {key(m): m for m in data['memberships']}
    touched = set()
    for op in operations:
        require(set(op) == {'id', 'kind', 'question_id', 'candidate_id', 'before', 'after',
                            'evidence_refs', 'reason', 'supersedes'}, 'invalid operation fields')
        require(op['kind'] in KINDS, 'disputed cases/new bases are not applicable')
        require(op['reason'].strip() and op['evidence_refs'], 'reason and evidence required')
        require(op['question_id'] and op['candidate_id'], 'candidate identity required')
        before, after = op['before'], op['after']
        require(before is not None or after is not None, 'empty operation')
        identity = key(before or after)
        require(identity not in touched, 'multiple operations on one scoped membership')
        touched.add(identity)
        negatives = []
        for row in data.get('corrections', []) + data.get('manual_decisions', []) + data.get('edges', []):
            if after and row.get('family_id') == after['family_id'] and row.get('status') in (
                    'excluded', 'rejected', 'blocked_from_runtime') and row.get('language', after['language']) == after['language'] and (
                    row.get('lemma_id') == after['lemma_id'] or
                    after['lemma_id'] in row.get('lemma_ids', []) or
                    row.get('head_id') == after['head_id'] or
                    row.get('word') == after['word']): negatives.append(digest(row))
        require(set(negatives) <= set(op['supersedes']), 'negative decision needs explicit scoped supersession')
        if before is None:
            require(op['kind'] == 'ADD_MEMBER' and key(after) not in members, 'addition already exists')
        else:
            require(members.get(key(before)) == before, 'stale before record')
        if after is None:
            require(op['kind'] == 'EXCLUDE_MEMBER', 'deletion requires exclusion verdict')
        elif before is not None:
            allowed = {'CORRECT_RELATION': {'relation'},
                       'CORRECT_IDENTITY': {'lemma_id', 'word', 'head_id'},
                       'CORRECT_FAMILY': {'family_id', 'head_id'}}.get(op['kind'])
            require(allowed is not None, 'invalid update kind')
            changed = {k for k in set(before)|set(after) if before.get(k) != after.get(k)}
            require(changed and changed <= allowed, 'operation changes unrelated fields')
            require(key(after) == key(before) or key(after) not in members, 'target already exists')
        # Every effective removal/update is compensating history, never deletion of old verdicts.
        if before is not None: del members[key(before)]
        if after is not None:
            require(after.get('relation', 'unresolved') != 'inflection' or op['kind'] != 'ADD_MEMBER',
                    'inflection cannot create an independent derivative')
            members[key(after)] = copy.deepcopy(after)
        result['history'].append(dict(operation=copy.deepcopy(op), previous=digest(state)))
    if operations: data['memberships'] = sorted(members.values(), key=key)
    validate_state(result)
    return result


def check_verdicts(plan, trust, ledger, view=None):
    """Current human ledger witnesses plus separately signed operation verdicts."""
    from review_bridge import witnesses
    view = witnesses(ledger) if view is None else view
    require(view['head'] == plan['inputs']['review_head'], 'manual decisions changed')
    for op in plan['operations']:
        tokens = plan['verdicts'].get(op['id'], [])
        expected = verdict_payload(op, plan['inputs'])
        seen = set(); roles = set(); public_keys = set()
        # Corrections moving between families need current independent reviews in both scopes.
        scopes = {key(x)[:2] for x in (op['before'], op['after']) if x}
        for token in tokens:
            role = trust['principals'].get(token.get('signer'), {}).get('role')
            require(role in ('reviewer', 'blind'), 'independent reviewer/blind roles required')
            actor = verify(token, trust, role, expected)
            require(actor not in seen, 'repeated reviewer is not independent')
            seen.add(actor); roles.add(role)
            pem = trust['principals'][actor]['public_key_pem']
            public_key = base64.b64decode(''.join(pem.strip().splitlines()[1:-1]), validate=True)
            require(public_key not in public_keys, 'same signing key is not independent')
            public_keys.add(public_key)
            expected_status = 'REJECT' if op['kind'] == 'EXCLUDE_MEMBER' else 'ACCEPT_PROPOSED'
            for family, language in scopes:
                qid = op['question_id'].get(family) if isinstance(op['question_id'], dict) else op['question_id']
                d = view['current'].get((qid, actor))
                require(d and d['family_id'] == family and d['language'] == language,
                        'verdict lacks exact family/language review scope')
                require(d['status'] == expected_status and d['lexeme_id'] == op['candidate_id'],
                        'missing current concrete human verdict')
                require(d['snapshot'] == view['snapshot'] and d['action'] != 'undo', 'stale/undone review')
        require(roles == {'reviewer', 'blind'} and len(seen) >= 2, 'two independent human reviews required')
    return {'head': view['head'], 'snapshot': view['snapshot'], 'transactions': view['transactions']}


def preview(state, operations, inputs, verdicts=None):
    require(inputs['base'] == digest(state), 'wrong release base')
    require(len({o['id'] for o in operations}) == len(operations), 'duplicate operation ID')
    after = transform(state, operations)
    counts = {k: sum(o['kind'] == k for o in operations) for k in KINDS}
    scope = sorted({x['family_id'] for o in operations for x in (o['before'], o['after']) if x})
    return dict(schema=VERSION, inputs=inputs, operations=operations, verdicts=verdicts or {},
                after=digest(after), summary=dict(counts=counts, families=scope,
                    superseded_decisions=[r for o in operations for r in o['supersedes']],
                    unresolved='all unselected questions remain in review'),
                production_writes=0)


def evidence_gate(plan, current, checks, trust):
    require(plan['inputs'] == current, 'stale snapshot/source/algorithm/review/base')
    check_input_files(current)
    require(checks['plan'] == digest(plan), 'checks belong to another plan')
    require(checks['base'] == plan['inputs']['base'] and checks['after'] == plan['after'], 'wrong before/after')
    for name in ('snapshot_integrity', 'source_versions_and_licenses', 'independent_quality',
                 'no_unresolved_conflicts', 'regressions', 'canonical_families', 'aliases', 'lexical_heads',
                 'negative_history', 'frequency_links', 'model_independence', 'six_languages',
                 'formulas_unchanged', 'calculator_before_after', 'restoration'):
        require(checks['checks'].get(name) == 'PASS', 'mandatory check not passed: '+name)
    require(checks.get('evidence_files'), 'verifiable check artifacts required')
    for path, expected in checks['evidence_files'].items():
        require(digest(Path(path).read_bytes()) == expected, 'check artifact changed')
    for name in ('quality_file', 'calculator_file'):
        require(checks.get(name) in checks['evidence_files'], 'missing bound evidence: '+name)
    quality = read(checks['quality_file'])
    require(quality.get('usable_independent_gold', 0) > 0 and quality.get('thresholds_passed') is True and
            quality.get('semantic_application_allowed') is True, 'independent quality thresholds not passed')
    calculator = read(checks['calculator_file'])
    require(calculator.get('complete') is True and calculator.get('before_state_sha256') == plan['inputs']['base'] and
            calculator.get('after_state_sha256') == plan['after'], 'calculator is incomplete or belongs to another state')
    require(checks.get('calculator_complete') is True, 'incomplete calculator observations')
    # Only a designated independent verifier can attest the bound evidence set.
    verify(checks['attestation'], trust, 'verifier', dict(purpose='verified-checks',
        checks=digest({k: v for k, v in checks.items() if k != 'attestation'}), schema=VERSION))


class Store:
    def __init__(self, root):
        self.root = external(root)
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        (self.root/'versions').mkdir(exist_ok=True, mode=0o700)

    @contextlib.contextmanager
    def lock(self):
        with open(self.root/'LOCK', 'a') as f:
            fcntl.flock(f, fcntl.LOCK_EX)
            yield
            fcntl.flock(f, fcntl.LOCK_UN)

    def current(self):
        pointer = read(self.root/'CURRENT')
        version = self.version(pointer['version'])
        require(digest(version) == pointer['version'], 'corrupt current version')
        return pointer['version'], version

    def version(self, ident):
        require(re.fullmatch('[0-9a-f]{64}', ident), 'invalid version ID')
        value = read(self.root/'versions'/(ident+'.json'))
        require(digest(value) == ident, 'version checksum mismatch')
        validate_state(value['state'])
        return value

    def commit(self, value, fault=None):
        name = digest(value); path = self.root/'versions'/(name+'.json')
        if path.exists(): require(read(path) == value, 'version collision')
        else: atomic(path, canonical(value))
        if fault: fault('before_pointer')
        atomic(self.root/'CURRENT', canonical({'version': name}))
        if fault: fault('after_pointer')
        return name

    def initialize(self, state):
        validate_state(state)
        with self.lock():
            require(not (self.root/'CURRENT').exists(), 'already initialized')
            return self.commit(dict(schema=VERSION, parent=None, state=state, transition='BASELINE',
                                    release=None, approvals=[]))

    def apply(self, plan, current, checks, approval, trust, ledger, fault=None):
        from review_bridge import locked_witnesses
        with self.lock(), locked_witnesses(ledger) as view:
            parent, old = self.current()
            # Retry after committed write: return the same version, but never roll a later state back.
            release_id = digest(plan)
            if old['transition'] == 'APPLY' and old['release'] == release_id:
                return {'version': parent, 'idempotent': True}
            require(digest(old['state']) == plan['inputs']['base'], 'compare-and-swap base changed')
            require(plan['operations'], 'empty preview is not an applicable release')
            evidence_gate(plan, current, checks, trust)
            provenance = check_verdicts(plan, trust, ledger, view)
            verify(approval, trust, 'owner', dict(schema=VERSION, purpose='approve-release',
                release=release_id, checks=digest(checks), store=str(self.root), parent=parent))
            after = transform(old['state'], plan['operations'])
            require(digest(after) == plan['after'], 'after state mismatch')
            value = dict(schema=VERSION, parent=parent, state=after, transition='APPLY', release=release_id,
                         plan=plan, checks=checks, approvals=[approval], previous_version_backup=parent)
            value['human_history'] = provenance
            require(sum(Path(p).stat().st_size for p in checks['evidence_files']) <= 128*1024**2,
                    'release evidence archive budget exceeded')
            value['evidence_archive'] = {sha: base64.b64encode(Path(p).read_bytes()).decode()
                                        for p, sha in checks['evidence_files'].items()}
            require(all(digest(base64.b64decode(raw)) == sha for sha, raw in value['evidence_archive'].items()),
                    'evidence changed during publication')
            ident = self.commit(value, fault)
            return {'version': ident, 'idempotent': False, 'previous_version_backup': parent}

    def rollback(self, target, expected_current, approval, trust, fault=None):
        with self.lock():
            parent, old = self.current()
            require(parent == expected_current, 'rollback current version changed')
            # Only an ancestor of this chain can be restored.
            cursor = old
            while cursor['parent'] and cursor['parent'] != target:
                cursor = self.version(cursor['parent'])
            require(cursor['parent'] == target, 'rollback target is not an ancestor')
            verify(approval, trust, 'owner', dict(schema=VERSION, purpose='approve-rollback',
                current=parent, target=target, store=str(self.root)))
            restored = copy.deepcopy(self.version(target)['state'])
            restored['history'] = copy.deepcopy(old['state']['history']) + [
                dict(action='ROLLBACK', from_version=parent, restored_version=target)]
            return self.commit(dict(schema=VERSION, parent=parent, state=restored, transition='ROLLBACK',
                                    release=None, approvals=[approval], restored_version=target), fault)

    def verify_chain(self):
        with self.lock():
            ident, value = self.current(); seen = set(); previous_history = None
            while True:
                require(ident not in seen, 'version cycle'); seen.add(ident)
                history = value['state']['history']
                if previous_history is not None:
                    require(previous_history[:len(history)] == history, 'history was removed')
                previous_history = history
                if value['parent'] is None: break
                ident = value['parent']; value = self.version(ident)
            return dict(status='PASS', committed_versions=len(seen), history_preserved=True,
                        orphan_versions_ignored=len(list((self.root/'versions').glob('*.json')))-len(seen))

    def audit(self, trust):
        """Separate replay of committed transitions and their signed provenance."""
        self.verify_chain()
        with self.lock():
            ident, value = self.current(); applied = 0; rolled_back = 0
            while value['parent']:
                parent = self.version(value['parent'])
                if value['transition'] == 'APPLY':
                    plan = value['plan']; checks = value['checks']; approval = value['approvals'][0]
                    require(digest(plan) == value['release'], 'release identity changed')
                    require(plan['inputs']['base'] == digest(parent['state']), 'wrong historical base')
                    require(transform(parent['state'], plan['operations']) == value['state'], 'applied delta differs')
                    require(plan['after'] == digest(value['state']), 'wrong historical after digest')
                    verify(approval, trust, 'owner', dict(schema=VERSION, purpose='approve-release',
                        release=value['release'], checks=digest(checks), store=approval['payload']['store'], parent=value['parent']))
                    verify(checks['attestation'], trust, 'verifier', dict(purpose='verified-checks',
                        checks=digest({k: v for k, v in checks.items() if k != 'attestation'}), schema=VERSION))
                    for sha in checks['evidence_files'].values():
                        require(digest(base64.b64decode(value['evidence_archive'][sha])) == sha, 'lost archived evidence')
                    history = value['human_history']; head = None; current = {}
                    for i, event in enumerate(history['transactions'], 1):
                        require(event['sequence'] == i and event['previous'] == head and
                            digest({k: v for k, v in event.items() if k != 'sha256'}) == event['sha256'], 'broken human history')
                        head = event['sha256']
                        for d in event['decisions']: current[(d['question_id'], event['actor'])] = d
                    require(head == history['head'], 'lost human history tail')
                    check_verdicts(plan, trust, None, dict(history, current=current))
                    applied += 1
                elif value['transition'] == 'ROLLBACK':
                    target = value['restored_version']; approval = value['approvals'][0]
                    verify(approval, trust, 'owner', dict(schema=VERSION, purpose='approve-rollback',
                        current=value['parent'], target=target, store=approval['payload']['store']))
                    ancestor = parent
                    while ancestor['parent'] and ancestor['parent'] != target:
                        ancestor = self.version(ancestor['parent'])
                    require(ancestor['parent'] == target, 'rollback target is not an ancestor')
                    expected = copy.deepcopy(self.version(target)['state'])
                    expected['history'] = copy.deepcopy(parent['state']['history']) + [
                        dict(action='ROLLBACK', from_version=value['parent'], restored_version=target)]
                    require(value['state'] == expected, 'rollback data/history differs')
                    rolled_back += 1
                else: raise ValueError('unknown committed transition')
                ident = value['parent']; value = parent
            return dict(status='PASS', applied_releases=applied, rollbacks=rolled_back,
                        semantic_quality_estimate=None, production_writes=0)

    def backup(self, destination):
        import zipfile
        with self.lock():
            ident, value = self.current(); files = {'CURRENT': canonical({'version': ident})}
            while True:
                files['versions/'+ident+'.json'] = canonical(value)
                if value['parent'] is None: break
                ident = value['parent']; value = self.version(ident)
            proofs = {name: digest(data) for name, data in files.items()}
            destination = external(destination)
            require(not destination.exists(), 'backup already exists')
            with open(destination, 'xb') as out:
                os.chmod(destination, 0o600)
                with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
                    for name, data in sorted(files.items()): archive.writestr(name, data)
                    archive.writestr('CHECKSUMS.json', canonical(proofs))
                out.flush(); os.fsync(out.fileno())
            return {'sha256': digest(destination.read_bytes()), 'files': len(files)}


def restore(archive, destination, expected_sha256):
    import zipfile
    archive = Path(archive)
    require(digest(archive.read_bytes()) == expected_sha256, 'backup checksum mismatch')
    target = external(destination)
    require(not target.exists() or not any(target.iterdir()), 'restore destination must be empty')
    with zipfile.ZipFile(archive) as z:
        require(len(z.namelist()) == len(set(z.namelist())), 'duplicate backup entry')
        proofs = json.loads(z.read('CHECKSUMS.json'))
        require(set(z.namelist()) == set(proofs)|{'CHECKSUMS.json'}, 'unexpected backup entries')
        require(sum(i.file_size for i in z.infolist()) < 2*1024**3, 'backup exceeds restore budget')
        for name, sha in proofs.items():
            require(name == 'CURRENT' or re.fullmatch(r'versions/[a-f0-9]{64}\.json', name), 'unsafe backup path')
            require(digest(z.read(name)) == sha, 'corrupt backup entry')
        target.mkdir(parents=True, exist_ok=True, mode=0o700); (target/'versions').mkdir()
        for name in sorted(set(proofs)-{'CURRENT'}): atomic(target/name, z.read(name))
        # Validate the complete chain in an unpublished staging pointer first.
        atomic(target/'CURRENT', z.read('CURRENT'))
    return Store(target).verify_chain()


def main():
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest='command', required=True)
    def command(name, names):
        c = sub.add_parser(name)
        for n in names: c.add_argument('--'+n, required=True)
    command('init', ('store', 'state'))
    command('preview', ('state', 'operations', 'inputs', 'verdicts', 'output'))
    command('sign', ('payload', 'private-key', 'signer', 'output'))
    command('apply', ('store', 'plan', 'current-inputs', 'checks', 'approval', 'trust', 'review-ledger'))
    command('rollback', ('store', 'target', 'expected-current', 'approval', 'trust'))
    command('verify', ('store',))
    command('audit', ('store', 'trust'))
    command('backup', ('store', 'output'))
    command('restore', ('archive', 'store', 'expected-sha256'))
    a = p.parse_args()
    if a.command == 'init': result = Store(a.store).initialize(read(a.state))
    elif a.command == 'preview':
        result = preview(read(a.state), read(a.operations), read(a.inputs), read(a.verdicts))
        atomic(Path(a.output), canonical(result))
    elif a.command == 'sign':
        value = read(a.payload)
        result = {'signer': a.signer, 'payload': value, 'signature': signature(value, a.private_key)}
        atomic(Path(a.output), canonical(result))
        result = {'output': a.output, 'payload_sha256': digest(value)}
    elif a.command == 'apply': result = Store(a.store).apply(read(a.plan), read(a.current_inputs),
        read(a.checks), read(a.approval), read(external(a.trust)), a.review_ledger)
    elif a.command == 'rollback': result = Store(a.store).rollback(a.target, a.expected_current,
        read(a.approval), read(external(a.trust)))
    elif a.command == 'audit': result = Store(a.store).audit(read(external(a.trust)))
    elif a.command == 'backup': result = Store(a.store).backup(a.output)
    elif a.command == 'restore': result = restore(a.archive, a.store, a.expected_sha256)
    else: result = Store(a.store).verify_chain()
    print(canonical(result).decode())


if __name__ == '__main__': main()
