#!/usr/bin/env python3
"""Index audited checkpoints as they become available, with a bounded disk cache."""
import argparse
import fcntl
import json
from pathlib import Path
import time
from certify_corpus import atomic_json
from morphology_import import hash_file, dumps
from scale_index import Index, build


def watch(release,registry_path,destination,cache_kib=65536,follow=False):
    release,registry_path,destination=map(Path,(release,registry_path,destination))
    if not 4096<=cache_kib<=262144: raise ValueError('explicit cache budget required')
    destination.mkdir(parents=True,exist_ok=True); start=time.monotonic(); results={}
    registry=json.loads(registry_path.read_text())
    with open(destination/'.index-lock','a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        index=Index(destination/'index.sqlite')
        index.db.executescript('PRAGMA journal_mode=WAL; PRAGMA cache_size=-'+str(cache_kib)+'; PRAGMA wal_autocheckpoint=4000;')
        try:
            while True:
                state=json.loads((release/'CHECKPOINT.json').read_text())
                if state['identity']['registry_sha256']!=hash_file(registry_path): raise ValueError('registry mismatch')
                for name,p in sorted(state['partitions'].items()):
                    if name in results: continue
                    t=time.monotonic(); result=index.ingest(name,release/'snapshots'/name/p['build_id'],registry)
                    results[name]=dict(result,elapsed_seconds=round(time.monotonic()-t,3))
                    atomic_json(destination/'WATCH-PROGRESS.json',dict(cache_kib=cache_kib,journal_mode='WAL',partitions=results))
                    print(dumps({name:results[name]}),flush=True)
                if state['status']=='PASS': break
                if not follow: raise ValueError('release incomplete; use --follow to wait for audited partitions')
                if time.monotonic()-start>7200: raise TimeoutError('certification did not finish within two hours')
                time.sleep(2)
        finally:
            index.db.execute('PRAGMA wal_checkpoint(TRUNCATE)'); index.close()
    receipt=build(release,registry_path,destination)
    receipt.update(watch_elapsed_seconds=round(time.monotonic()-start,3),watch_partitions=results,
                   storage_policy=dict(cache_kib=cache_kib,journal_mode='WAL',synchronous='FULL'))
    atomic_json(destination/'WATCH.json',receipt); return receipt


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ['release','registry','destination']: p.add_argument('--'+name,required=True,type=Path)
    p.add_argument('--cache-kib',type=int,default=65536); p.add_argument('--follow',action='store_true')
    a=p.parse_args(); print(dumps(watch(a.release,a.registry,a.destination,a.cache_kib,a.follow)))
