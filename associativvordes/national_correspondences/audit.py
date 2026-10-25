"""Read every stage 05–07 proposed-change manifest, including archived v1.

No linguistic verdicts or production writes. Nonempty/ambiguous plans are held.
"""

# Installed writer boundary; isolated restored tools retain self-contained replay.
from pathlib import Path as _HistoryFencePath
import sys as _history_fence_sys
_history_fence_root=next((p for p in _HistoryFencePath(__file__).resolve().parents if (p/'associativvordes/mutation_guard.py').is_file()),None)
if _history_fence_root is not None:
    _history_fence_sys.path.insert(0,str(_history_fence_root))
    from associativvordes.mutation_guard import install as _install_history_fence
    _install_history_fence()
import argparse
from collections import Counter
import json
import os
from pathlib import Path
import sqlite3
import tempfile
from .registry import Registry, canonical, filehash, read

STAGES = ('associative-v5-structural-cleanup', 'associative-v5-surface-cleanup', 'associative-v5-morphology-cleanup')
REQUIRED = {
 'associative-v5-structural-cleanup/SAFE-FIXES.ndjson',
 'associative-v5-surface-cleanup/PROPOSED-EXCLUSIONS.ndjson',
 'associative-v5-morphology-cleanup/PROPOSED-MEMBERSHIP-EXCLUSIONS.ndjson',
 'associative-v5-morphology-cleanup/VERIFIED-RELATION-CORRECTIONS.ndjson',
 'associative-v5-morphology-cleanup/semantic-review-v2/PROPOSED-MEMBERSHIP-EXCLUSIONS.ndjson',
 'associative-v5-morphology-cleanup/semantic-review-v2/VERIFIED-RELATION-CORRECTIONS.ndjson',
}


def atomic(path, data):
    temporary = path.with_name(path.name + '.partial')
    with open(temporary, 'wb') as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    temporary.replace(path)


def audit(repo, output):
    repo, output = Path(repo).resolve(), Path(output).resolve()
    protected = repo / 'associativvordes/family-index-v5'
    if output == protected or output.is_relative_to(protected):
        raise ValueError('production output forbidden')
    output.mkdir(parents=True, exist_ok=True)
    registry = Registry(repo / 'audit/associative-national-correspondences')
    manifests = sorted(p for stage in STAGES for p in (repo / 'audit' / stage).rglob('*.ndjson') if p.name == 'SAFE-FIXES.ndjson' or 'PROPOSED' in p.name or p.name == 'VERIFIED-RELATION-CORRECTIONS.ndjson')
    relative = {p.relative_to(repo / 'audit').as_posix() for p in manifests}
    if not REQUIRED <= relative:
        raise ValueError('missing required proposal manifests: ' + str(sorted(REQUIRED - relative)))
    atomic(output / 'OUTPUT-STATE.json', canonical(dict(status='INCOMPLETE', registry_sha256=registry.sha256)) + b'\n')
    counts = Counter(); inputs = []; states = Counter()
    # Disk de-duplication avoids counting archived/current copies as independent scopes.
    with tempfile.TemporaryDirectory(prefix='interal-correspondence-audit-') as scratch:
        db = sqlite3.connect(Path(scratch) / 'scopes.sqlite')
        db.execute('CREATE TABLE scopes (identity TEXT PRIMARY KEY)')
        blocked = output / 'BLOCKED-OPERATIONS.ndjson.partial'
        with open(blocked, 'wb') as out:
            for path in manifests:
                before = filehash(path); n = 0
                with open(path, 'rb') as stream:
                    for ordinal, line in enumerate(stream, 1):
                        if not line.strip():
                            continue
                        n += 1; counts['physical_proposal_rows'] += 1
                        try:
                            proposal = json.loads(line)
                            if not isinstance(proposal, dict):
                                raise ValueError('object required')
                            # A family-level/split/type-only operation is not a finite
                            # exclusion proof. Do not silently treat its sample as full scope.
                            if proposal.get('operation') in {'REJECT_ENTIRE_FAMILY', 'REMOVE_EXACT_MEMBERSHIPS', 'merge'} or 'affected_memberships' in proposal:
                                check = dict(allowed=False, status='FULL_FINITE_SCOPE_REVIEW_REQUIRED', matches=[])
                                counts['unknown_membership_scopes'] += 1
                            else:
                                check = registry.check(proposal)
                                keys = ('family_id', 'language', 'lemma_id', 'source_version', 'pos', 'sense_id')
                                if all(proposal.get(k) for k in keys[:4]):
                                    identity = canonical({k: proposal.get(k) for k in keys}).decode()
                                    counts['unique_exact_membership_scopes'] += db.execute('INSERT OR IGNORE INTO scopes VALUES (?)', (identity,)).rowcount
                                else:
                                    counts['unknown_membership_scopes'] += 1
                        except (ValueError, TypeError) as exc:
                            check = dict(allowed=False, status='MALFORMED_PROPOSAL', reason=str(exc), matches=[])
                            counts['unknown_membership_scopes'] += 1
                        states[check['status']] += 1
                        counts['blocked_proposal_rows'] += int(not check['allowed'])
                        counts['documentary_match_rows'] += int(bool(check.get('matches')))
                        out.write(canonical(dict(input=path.relative_to(repo).as_posix(), line=ordinal, result=check)) + b'\n')
                if before != filehash(path):
                    raise ValueError('proposal changed while reading')
                inputs.append(dict(path=path.relative_to(repo).as_posix(), bytes=path.stat().st_size, sha256=before, rows=n, role='HISTORICAL_V1' if path.parent.name == 'associative-v5-morphology-cleanup' else 'STAGE_PROPOSAL'))
            out.flush(); os.fsync(out.fileno())
        blocked.replace(output / 'BLOCKED-OPERATIONS.ndjson')
        db.close()
    data_path = repo / 'audit/associative-v5-structural-cleanup/DATA-CHANGE-PROPOSAL.json'
    data = read(data_path)
    if data.get('status') != 'NO_DATA_PATCH_NEEDED' or data.get('changed_objects') != [] or data.get('prepared_safe_operations') != 0 or data.get('membership_removals') != 0 or data.get('membership_additions') != 0:
        raise ValueError('structural data proposal changed; explicit finite-scope review required')
    inputs.append(dict(path=data_path.relative_to(repo).as_posix(), bytes=data_path.stat().st_size, sha256=filehash(data_path), status=data['status'], role='STRUCTURAL_DATA_PLAN'))
    report = dict(schema='interal-correspondence-proposal-audit/1', registry_sha256=registry.sha256, inputs=inputs,
        all_discovered_proposal_manifests_read=True, corpus_memberships_revalidated=False,
        physical_proposal_rows=counts['physical_proposal_rows'], unique_exact_membership_scopes=counts['unique_exact_membership_scopes'], unknown_membership_scopes=counts['unknown_membership_scopes'], blocked_proposal_rows=counts['blocked_proposal_rows'], documentary_match_rows=counts['documentary_match_rows'],
        actual_rescued_memberships=0 if not counts['physical_proposal_rows'] else None,
        automatic_release_authorized=False, confirmed_new_memberships=0, statuses=dict(states),
        empty_proposal_set=counts['physical_proposal_rows'] == 0, blocked_output_sha256=filehash(output / 'BLOCKED-OPERATIONS.ndjson'))
    atomic(output / 'EXCLUSION-COVERAGE.json', canonical(report) + b'\n')
    atomic(output / 'OUTPUT-STATE.json', canonical(dict(status='COMPLETE', coverage_sha256=filehash(output / 'EXCLUSION-COVERAGE.json'), blocked_sha256=report['blocked_output_sha256'])) + b'\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(__doc__)
    parser.add_argument('--repo', default='.')
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    result = audit(args.repo, args.output)
    print(json.dumps(dict(inputs=len(result['inputs']), proposals=result['physical_proposal_rows'], blocked=result['blocked_proposal_rows'])))
