#!/usr/bin/env python3
"""Compare two fresh complete releases and audit the global evidence union."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse
import json
from pathlib import Path
import resource
import time
from associativvordes.importers.certify_corpus import atomic_json, audit_catalog, verified, ROOT


def compare(first,replay,plan,receipt):
    first,replay=Path(first).resolve(),Path(replay).resolve()
    if first==replay: raise ValueError('independent release roots required')
    started=time.monotonic()
    a,b=[json.loads((p/'CHECKPOINT.json').read_text()) for p in [first,replay]]
    if a['status']!='PASS' or b['status']!='PASS' or a['identity']!=b['identity']:
        raise ValueError('incomplete or mismatched release identity')
    if a['catalog']!=b['catalog'] or a['counts']!=b['counts']: raise ValueError('catalogs/counts differ')
    for root in [first,replay]:
        invocation=json.loads((root/'LAST-RUN.json').read_text())
        if invocation['reused']: raise ValueError('fresh independent replay required; preserve initial receipts before reuse timing')
        verified(root/'catalog'/a['catalog']['build_id'],'CATALOG.json')
    if set(a['partitions'])!=set(b['partitions']): raise ValueError('partition inventory differs')
    for name,p in a['partitions'].items():
        other=b['partitions'][name]
        for field in ['build_id','manifest_sha256','outputs','reports','counts']:
            if p[field]!=other[field]: raise ValueError('partition differs: '+name+'/'+field)
        for root in [first,replay]:
            verified(root/'snapshots'/name/p['build_id'],'manifest.json',p['manifest_sha256'])
    expected=json.loads((ROOT/'audit/associative-external-preparation/import-validation/GLOBAL-CATALOG.json').read_text())
    if a['catalog']!=expected: raise ValueError('catalog differs from earlier pinned full result')
    result=dict(status='PASS',independent_roots=2,reused_partitions=0,partitions=len(a['partitions']),
        all_output_bytes_identical=True,catalog_matches_published=True,catalog_build_id=a['catalog']['build_id'],
        counts=a['counts'],catalog_audit=audit_catalog(first,plan),elapsed_seconds=round(time.monotonic()-started,3),
        max_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
    atomic_json(receipt,result); return result


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['first','replay','receipt']: p.add_argument('--'+n,required=True,type=Path)
    p.add_argument('--plan',type=Path,default=ROOT/'data/morphology-evidence/sources/BUILD-PARTITIONS.json')
    a=p.parse_args(); print(json.dumps(compare(a.first,a.replay,a.plan,a.receipt),sort_keys=True))
