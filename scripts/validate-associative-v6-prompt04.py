#!/usr/bin/env python3
"""Exact nonmutation differential for the queue-organization block."""
import gzip
import hashlib
import json
import subprocess
import sys
from pathlib import Path

BASELINE = '63b8f44539f752cad6e4fc875bba85be39035bb9'
ROOT = Path('audit/associative-family-v6/queue-organization-20261004/generated')
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/tmp/prompt04-exact-differential.json')

def git(*args):
    return subprocess.check_output(['git', *args])

def read(path):
    data = Path(path).read_bytes()
    return json.loads(gzip.decompress(data) if str(path).endswith('.gz') else data)

protected = {}
for path in ['associativvordes/family-index-v5', 'associativvordes/frequency lists', 'audit/associative-family-v5']:
    assert not git('diff', '--name-only', BASELINE, '--', path).strip(), path
    protected[path] = git('rev-parse', BASELINE + ':' + path).decode().strip()

prefix = 'associativvordes/family-index-v6/generated/'
files = git('ls-tree', '-r', '--name-only', BASELINE, '--', prefix).decode().splitlines()
assert len(files) == 274
for path in files:
    assert Path(path).read_bytes() == git('show', BASELINE + ':' + path), path
actual = {str(p) for p in Path(prefix).rglob('*') if p.is_file()}
assert actual == set(files)

report = read(ROOT / 'report.json')
proof = read(ROOT / 'conservation.json.gz')
assert proof['before'] == proof['after']
assert proof['added'] == proof['removed'] == []
assert report['new_memberships'] == report['new_verdicts'] == 0
assert report['before_current_units'] == report['after_current_units'] == 23238
assert report['metrics']['current_membership_candidates'] == 23240
assert report['metrics']['corpus_ids'] == 100670
assert report['metrics']['membership_candidates'] == 102314
assert report['metrics']['route_incidences'] == 133054
assert report['metrics']['packet_route_incidences'] == 181136
assert report['global_packet_unique_corpus_ids'] is None

result = dict(schema_version=6, verdict='pass', baseline_sha=BASELINE,
              protected_tree_sha=protected, original_v6_artifacts_byte_identical=len(files),
              memberships_added=[], memberships_removed=[], memberships_changed=[],
              heads_added=[], heads_removed=[], edges_changed=[],
              exact_set_conservation=proof, current_units_before=23238,
              current_units_after=23238, new_proven_unit_reduction=0,
              metrics=report['metrics'], production_enabled=False,
              implementation_sha256={p: hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in [
                  'scripts/build-associative-v6-queue-organization.mjs',
                  'scripts/audit-associative-v6-queue-organization.mjs',
                  'scripts/lib/associative-v6-queue-organization.mjs',
                  'scripts/validate-associative-v6-prompt04.py']})
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
print(json.dumps(dict(verdict='pass', original_v6_artifacts=274, memberships_added=0,
                     memberships_removed=0, current_units=23238, new_reduction=0)))
