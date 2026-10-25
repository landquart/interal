#!/usr/bin/env python3
"""Reproduce the published isolated partitions, audit each, then merge claim views."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
from associativvordes.importers.morphology_import import run
from associativvordes.importers.audit_import import audit
from associativvordes.importers.build_catalog import make_catalog


def rebuild(sources,raw_root,output_root,workers=2):
    sources=Path(sources).resolve();root=Path(output_root).resolve()
    plan=json.loads((sources/'BUILD-PARTITIONS.json').read_text())
    def build(part):
        lock=sources/part['lock']
        result=run(lock,raw_root,root/part['name'])
        if result.name!=part['build_id']:
            raise ValueError('build identity differs from pinned plan; check code/runtime/policy: '+part['name'])
        receipt=audit(lock,raw_root,result)
        print(json.dumps({'partition':part['name'],'audit':receipt},sort_keys=True),flush=True)
    with ThreadPoolExecutor(max_workers=workers) as pool:list(pool.map(build,plan['partitions']))
    return make_catalog(sources/'source-lock.json',sources/'BUILD-PARTITIONS.json',root,root/'catalog')


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--sources',default=str(Path(__file__).resolve().parents[2]/'data/morphology-evidence/sources'))
    p.add_argument('--raw-root',required=True);p.add_argument('--output-root',required=True)
    p.add_argument('--workers',type=int,choices=range(1,9),default=2)
    a=p.parse_args();print(rebuild(a.sources,a.raw_root,a.output_root,a.workers))
