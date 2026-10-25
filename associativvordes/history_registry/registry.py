"""Read-only, fail-closed historical constraints. Never grants a production change."""
import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import zlib

SCHEMA = 'interal-history/1'
OPERATIONS = {'delete', 'restore', 'merge', 'change_membership', 'change_alias'}
AUTHORITIES = {'CONFIRMED_MANUAL', 'BOUNDED_OPERATION', 'ENGINEERING_CHECK',
               'RESEARCH_HYPOTHESIS', 'OWNER_ACCEPTED_AT_RISK', 'INDEPENDENT_GOLD', 'UNDETERMINED'}


def canonical(x):
    return json.dumps(x, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()


def sha(x):
    return hashlib.sha256(x).hexdigest()


def git(repo, *args):
    return subprocess.check_output(['git', '-C', str(repo), *args])


def atomic(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(dir=path.parent, prefix='.partial-')
    try:
        with os.fdopen(fd, 'wb') as f:
            f.write(data); f.flush(); os.fsync(f.fileno())
        os.replace(temp, path)
        directory = os.open(path.parent, os.O_RDONLY)
        try: os.fsync(directory)
        finally: os.close(directory)
    finally:
        if os.path.exists(temp): os.unlink(temp)


def document(data, path):
    if path.endswith('.gz'):
        data = gzip.decompress(data); path = path[:-3]
    if path.endswith(('.jsonl', '.ndjson')):
        return [json.loads(line) for line in data.splitlines() if line.strip()]
    return json.loads(data)


def walk(x, pointer=''):
    if isinstance(x, dict):
        yield pointer, x
        for k, v in x.items():
            yield from walk(v, pointer+'/'+str(k).replace('~','~0').replace('/','~1'))
    elif isinstance(x, list):
        for i, v in enumerate(x): yield from walk(v, pointer+'/'+str(i))


def validate(d):
    required = {'id', 'source', 'date', 'operation', 'scope', 'previous_status', 'decision',
                'explanation', 'evidence_refs', 'authority', 'data_version', 'supersedes',
                'evidence_status', 'lexical_identity_status', 'sense_status', 'relation_status',
                'association_status'}
    if not required <= d.keys(): raise ValueError('missing decision fields')
    if d['authority'] not in AUTHORITIES: raise ValueError('authority')
    if d['decision'] not in {'CONFIRMED_MEMBER', 'CONFIRMED_NONMEMBER', 'UNRESOLVED', 'CONFLICT'}:
        raise ValueError('decision')
    if not d['source'].get('commit') or not d['source'].get('sha256'): raise ValueError('source lock')
    if d['scope']['domain'] not in {'membership', 'alias', 'observation'}: raise ValueError('domain')
    # Imports do not confer new authority or interpret opaque supersession claims.
    if d['supersedes']: raise ValueError('explicit supersession adjudication is not implemented; HISTORY_CONFLICT')
    if d['scope']['domain'] != 'observation' and not d['scope'].get('family_id'):
        raise ValueError('family identity')
    return d


def import_decisions(records):
    """Idempotent identical IDs; conflicting payloads are never last-write-wins."""
    found = {}
    for raw in records:
        d = validate(raw)
        if d['id'] in found and canonical(found[d['id']]) != canonical(d):
            raise ValueError('HISTORY_CONFLICT: decision ID reused')
        found[d['id']] = d
    return [found[k] for k in sorted(found)]


class History:
    def __init__(self, repo, snapshot, expected_sha256, source_root=None):
        self.repo = Path(repo)
        self.source_root = Path(source_root) if source_root else None
        data = Path(snapshot).read_bytes()
        if sha(data) != expected_sha256: raise ValueError('history snapshot checksum')
        self.digest=expected_sha256
        self.snapshot = json.loads(data)
        if self.snapshot.get('schema') != SCHEMA: raise ValueError('history schema')
        if self.snapshot.get('coverage_complete') and (self.snapshot.get('conflicts') or self.snapshot.get('observations')):
            raise ValueError('coverage flag cannot bypass unresolved history')
        self.decisions = import_decisions(self.snapshot['decisions'])
        self.sources = {s['blob']: s for s in self.snapshot['sources']}
        self.cache = {}

    def blob(self, blob):
        if blob not in self.sources: raise ValueError('unlocked historical source')
        b = (self.source_root / blob).read_bytes() if self.source_root else git(self.repo, 'cat-file', 'blob', blob)
        s = self.sources[blob]
        if len(b) != s['bytes'] or sha(b) != s['sha256']: raise ValueError('corrupt historical source')
        return b

    def verify(self):
        for blob in self.sources: self.blob(blob)
        return len(self.sources)

    def ids(self, d):
        s = d['scope']
        if 'lemma_ids' in s: return set(s['lemma_ids'])
        sel = s.get('selector')
        if not sel: return set()
        key = d['id']
        if key not in self.cache:
            sets = []
            for side in ('before', 'after'):
                blob = sel.get(side)
                x = document(self.blob(blob), 'bucket.json.gz') if blob else {}
                sets.append({r['lemma_id'] for r in x.get(s['family_id'], [])})
            selected = sets[0] - sets[1] if sel['direction'] == 'removed' else sets[1] - sets[0]
            if len(selected) != sel['count']: raise ValueError('historical finite set count')
            if sha(canonical(sorted(selected))) != sel['ids_sha256']: raise ValueError('historical finite set hash')
            self.cache[key] = selected
        return self.cache[key]

    def observations(self):
        """Lossless source views; recorded statuses do not become authoritative verdicts."""
        for entry in self.snapshot.get('observations', []):
            blob = entry['source_blob']; source = self.sources[blob]
            data = document(self.blob(blob), source['path'])
            count = 0; digest_entries = []
            for pointer, x in walk(data):
                if not any(k in x for k in ('decision','verdict','status','rejected_memberships','retained','keep','quarantined_families','supersedes')): continue
                if not any(k in x for k in ('family_id','canonical_family_id','head_id','lemma_id','lemma_ids','affected_lemma_ids','records','decisions','rejected_memberships','retained','keep','alias','scope')): continue
                oid='observation:'+sha(canonical([blob,pointer]))
                envelope=dict(id=oid,source_blob=blob,pointer=pointer,payload_sha256=sha(canonical(x)),
                    classification='UNINTERPRETED_SOURCE_OBSERVATION')
                digest_entries.append(envelope);count+=1
                # An observation is a source claim, never an imported final verdict.
                yield dict(envelope,raw=x,source=dict(commit=source['commit'],
                    sha256=source['sha256'],blob=blob,path=source['path'],pointer=pointer),
                    date=source.get('date'),operation=x.get('action',x.get('decision_kind','source_observation')),
                    scope=dict(domain='observation',family_id=x.get('family_id',x.get('canonical_family_id')),
                        language=x.get('language'),lemma_id=x.get('lemma_id'),lemma_ids=x.get('lemma_ids'),
                        pos=None,sense_id=None,raw_scope=x.get('scope')),
                    authority='UNDETERMINED',authority_claim=x.get('authority'),decision='UNRESOLVED',
                    previous_status=x.get('previous_status',x.get('old_status')),
                    recorded_decision=x.get('decision',x.get('verdict',x.get('status'))),
                    explanation=x.get('reason',x.get('rationale','Historical source observation; exact raw scope retained')),
                    evidence_refs=(x.get('evidence_refs',x.get('evidence',[])) if isinstance(x.get('evidence_refs',x.get('evidence',[])),list) else [x.get('evidence_refs',x.get('evidence'))]),
                    data_version=source['commit'],supersedes=[],declared_supersession=x.get('supersedes'),
                    evidence_status='locked_source_claim',lexical_identity_status='unresolved',
                    sense_status='unresolved',relation_status='source_claim_only',association_status='not_evaluated')
            if count != entry['count'] or sha(canonical(digest_entries)) != entry['entries_sha256']:
                raise ValueError('historical observation index mismatch')

    def check(self, proposal):
        """Return constraints only. CLEAR never authorizes a change or asserts truth."""
        try:
            if proposal.get('operation') not in OPERATIONS: raise ValueError('unknown operation')
            if not proposal.get('family_id'): raise ValueError('canonical family ID required')
            if proposal['operation'] == 'merge':
                raise ValueError('merge requires separate finite source and destination checks; no family-ID equivalence inferred')
            domain = 'alias' if proposal['operation'] == 'change_alias' else 'membership'
            if domain == 'membership' and (not proposal.get('language') or not proposal.get('lemma_ids')):
                raise ValueError('finite language and lemma IDs required (including merge)')
            if domain == 'alias' and not proposal.get('alias'): raise ValueError('alias required')
            hits = []
            for d in self.decisions:
                s = d['scope']
                if s['domain'] != domain or s.get('family_id') != proposal['family_id']: continue
                if domain == 'alias':
                    if s.get('alias') != proposal['alias']: continue
                else:
                    if s.get('language') != proposal['language']: continue
                    if not set(proposal['lemma_ids']) & self.ids(d): continue
                    # Null scope = historical unresolved lexical row. It does not assert
                    # rejection of each sense; the overlap requires adjudication.
                    if any(s.get(k) is not None and proposal.get(k) is not None and
                           s[k] != proposal[k] for k in ('pos', 'sense_id')): continue
                hits.append(d)
            # Preserve exact applicable constraints even while broader history
            # requires review. A coverage hold never becomes a blanket negative.
            if not self.snapshot['coverage_complete']:
                return dict(status='HISTORY_UNAVAILABLE',allowed=False,reasons=['UNMAPPED_HISTORY'],
                    snapshot_sha256=self.digest,conflict_count=len(self.snapshot['conflicts']),
                    decision_ids=[d['id'] for d in hits],
                    historical_outcomes=[dict(id=d['id'],outcome=d.get('historical_outcome',d['decision']),
                        authority=d['authority'],scope=d['scope']) for d in hits])
            self.verify()
            statuses = {d['decision'] for d in hits}
            conflict = 'CONFLICT' in statuses or {'CONFIRMED_MEMBER', 'CONFIRMED_NONMEMBER'} <= statuses
            if conflict: result = 'HISTORY_CONFLICT'
            elif 'UNRESOLVED' in statuses: result = 'HISTORY_HOLD'
            elif hits: result = 'HISTORY_REVIEW_REQUIRED'
            else: result = 'CLEAR'
            # Even a compatible previous decision needs its exact dependency/grant
            # checked by the caller. No ID equivalence or automatic supersession.
            return dict(status=result, allowed=result == 'CLEAR', decision_ids=[d['id'] for d in hits])
        except (ValueError, KeyError, OSError, subprocess.SubprocessError, zlib.error, TypeError, AttributeError) as e:
            return dict(status='HISTORY_UNAVAILABLE', allowed=False, reasons=[str(e)])


def check(repo, snapshot, expected_sha256, proposal):
    try: return History(repo, snapshot, expected_sha256).check(proposal)
    except (ValueError, KeyError, OSError, subprocess.SubprocessError, zlib.error, TypeError, AttributeError) as e:
        return dict(status='HISTORY_UNAVAILABLE', allowed=False, reasons=[str(e)])


def active_check(proposal, repo=None):
    repo = Path(repo) if repo else Path(__file__).resolve().parents[2]
    root = repo / 'audit' / 'associative-history-registry'
    try:
        current = json.loads((root / 'CURRENT.json').read_bytes())
        if current.get('schema') != SCHEMA: raise ValueError('history pointer schema')
        name = Path(current['snapshot'])
        if name.is_absolute() or '..' in name.parts: raise ValueError('unsafe snapshot path')
        return check(repo, root / name, current['sha256'], proposal)
    except (OSError, ValueError, KeyError, TypeError) as e:
        return dict(status='HISTORY_UNAVAILABLE', allowed=False, reasons=[str(e)])


def restore(repo, snapshot, expected_sha256, output):
    """Independent exact blob restore, staging directory published only after verification."""
    h = History(repo, snapshot, expected_sha256)
    output = Path(output)
    if output.exists(): raise ValueError('restore destination exists')
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(dir=output.parent, prefix='.history-restore-'))
    try:
        for blob in sorted(h.sources): atomic(staging / 'objects' / blob, h.blob(blob))
        atomic(staging / 'REGISTRY.json', Path(snapshot).read_bytes())
        atomic(staging / 'RECEIPT.json', canonical(dict(snapshot_sha256=expected_sha256,
                   verified_sources=len(h.sources), schema=SCHEMA)) + b'\n')
        os.rename(staging, output)
    except BaseException:
        import shutil
        shutil.rmtree(staging)
        raise


def main():
    p = argparse.ArgumentParser(); p.add_argument('command', choices=['check', 'verify', 'restore'])
    p.add_argument('--repo', default='.'); p.add_argument('--snapshot', required=True)
    p.add_argument('--sha256', required=True); p.add_argument('--objects'); p.add_argument('--proposal'); p.add_argument('--output')
    a = p.parse_args()
    if a.command == 'check':
        result = check(a.repo, a.snapshot, a.sha256, json.loads(Path(a.proposal).read_text()))
        print(json.dumps(result, ensure_ascii=False)); return 0 if result['allowed'] else 2
    if a.command == 'verify': print(History(a.repo, a.snapshot, a.sha256, a.objects).verify())
    else: restore(a.repo, a.snapshot, a.sha256, a.output)
    return 0


if __name__ == '__main__': raise SystemExit(main())
