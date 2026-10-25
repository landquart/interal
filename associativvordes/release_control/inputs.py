"""Read verified phase-06 artifacts and native v6 objects, without extending scope."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse
import gzip
import json
from pathlib import Path
import subprocess
import sqlite3
import sys
from associativvordes.release_control.control import VERSION, atomic, canonical, digest, require, validate_state

ROOT = Path(__file__).resolve().parents[2]
REPORT = ROOT/'audit/associative-external-preparation/mass06-dry-run'
pass
from associativvordes.evidence_graph.prepare_registry import COMMIT, FILES


def verify_published(directory=REPORT):
    directory = Path(directory)
    manifest = json.loads((directory/'PUBLISHED-CHECKSUMS.json').read_bytes())
    require(manifest['schema'] == 'mass06-published-checksums/1', 'unsupported published manifest')
    checks = manifest['files']
    # Publisher's manifest is a path -> SHA256 mapping.
    for name, expected in checks.items():
        require(Path(name).name == name, 'unsafe manifest path')
        require(digest((directory/name).read_bytes()) == expected, 'published artifact changed: '+name)
    frozen = json.loads(gzip.decompress((directory/'FROZEN-INPUTS.json.gz').read_bytes()))
    quality = json.loads((directory/'QUALITY-SUMMARY.json').read_bytes())
    return dict(status='PASS', artifacts=len(checks), manifest_sha256=digest(checks),
                archive_sha256=digest((directory/'PACKED-PROPOSALS.json.gz').read_bytes()),
                source_lock=frozen['source_lock'], registry=frozen['registry'],
                quality=quality, semantic_application_allowed=quality['semantic_application_allowed'])


def native_state(repo=ROOT, registry=None, registry_sha256=None):
    data = {}
    names = dict(catalog='catalog.json', heads='generated/heads.json.gz', edges='generated/edges.json.gz',
                 links='generated/lemma-head-links.json.gz', memberships='generated/memberships.json.gz',
                 corrections='generated/correction-verdicts.json.gz', realizations='generated/reflexes.json')
    proofs = {}
    for field, name in names.items():
        path = 'associativvordes/family-index-v6/'+name
        blob = subprocess.check_output(['git', 'show', COMMIT+':'+path], cwd=repo)
        actual = __import__('hashlib').sha1(b'blob '+str(len(blob)).encode()+b'\0'+blob).hexdigest()
        require(actual == FILES[name], 'pinned native input changed')
        proofs[path] = digest(blob)
        data[field] = json.loads(gzip.decompress(blob) if name.endswith('.gz') else blob)
    require(registry is not None and registry_sha256, 'full prior decision registry and pinned checksum required')
    hasher = __import__('hashlib').sha256()
    with open(registry, 'rb') as stream:
        for block in iter(lambda: stream.read(1024*1024), b''): hasher.update(block)
    require(hasher.hexdigest() == registry_sha256, 'prior manual history registry changed')
    db = sqlite3.connect(Path(registry).resolve().as_uri()+'?mode=ro', uri=True)
    try:
        db.row_factory = sqlite3.Row
        data['manual_decisions'] = [dict(dict(r), family_id=r['family'], lemma_id=r['lemma'], head_id=r['head'])
            for r in db.execute('SELECT * FROM decisions ORDER BY id')]
        data['prior_manual_evidence'] = [dict(r) for r in db.execute(
            "SELECT id,body,proof FROM existing WHERE kind='PriorManualEvidence' ORDER BY id")]
        data['family_controls'] = [dict(family_id=r['family'], family_review_status=r['status'], proof=r['proof'])
            for r in db.execute('SELECT * FROM family_controls ORDER BY family')]
    finally: db.close()
    proofs['prior_decision_registry'] = registry_sha256
    # Canonical source objects remain unchanged; exact override decisions live in release history.
    state = dict(schema=VERSION, data=data, history=[], source_commit=COMMIT, source_files=proofs)
    validate_state(state)
    return state


def source_delta(previous, current, dependencies, reviewed):
    """Explicit per-family dependency graph, not global invalidation by source name.

    Keys are immutable source partition IDs; a missing/incomplete dependency map
    blocks scheduling instead of silently missing families or rerunning all.
    """
    changed = sorted(k for k in set(previous)|set(current) if previous.get(k) != current.get(k))
    unknown = [k for k in changed if k not in dependencies or not isinstance(dependencies[k], list) or not dependencies[k]]
    license_review = [k for k in changed if k in current and
        (current[k].get('license_status') != 'VERIFIED' or not current[k].get('license_sha256')
         or not current[k].get('revision') or not current[k].get('sha256'))]
    families = sorted({f for k in changed for f in dependencies.get(k, [])})
    require(all(f.startswith('family:') for f in families), 'noncanonical dependency ID')
    return dict(schema='release07-incremental-plan/1', changed_partitions=changed,
        affected_families=families, blockers=dict(missing_dependency_partitions=unknown,
            license_version_review=license_review), runnable=not (unknown or license_review),
        prior_reviewed_question_ids=sorted(set(reviewed)),
        review_policy='retain-history; changed reviewed questions require re-review, never first-review',
        paid_requests=0, production_writes=0, execute_automatically=False)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output', required=True); p.add_argument('--state-output'); p.add_argument('--registry')
    a = p.parse_args()
    value = verify_published(); atomic(Path(a.output), canonical(value))
    if a.state_output:
        frozen = json.loads(gzip.decompress((REPORT/'FROZEN-INPUTS.json.gz').read_bytes()))
        require(a.registry, '--registry required for full manual history')
        atomic(Path(a.state_output), canonical(native_state(registry=a.registry,
            registry_sha256=frozen['databases']['registry']['sha256'])))
    print(canonical({'integrity': value['status'], 'application_allowed': value['semantic_application_allowed']}).decode())


if __name__ == '__main__': main()
