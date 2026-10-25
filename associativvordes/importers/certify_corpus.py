#!/usr/bin/env python3
"""Checkpointed full certification; original pinned importer stays unchanged."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse
from concurrent.futures import ProcessPoolExecutor, as_completed
import fcntl
import heapq
import json
import os
from pathlib import Path
import resource
import tempfile
import time
from itertools import zip_longest
from associativvordes.importers.morphology_import import run, hash_file, validate_lock, dumps, digest
from associativvordes.importers.audit_import import audit
from associativvordes.importers.build_catalog import make_catalog

ROOT = Path(__file__).resolve().parents[2]


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix='.'+path.name, dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            stream.write(dumps(value)+'\n'); stream.flush(); os.fsync(stream.fileno())
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY)
        try: os.fsync(directory)
        finally: os.close(directory)
    finally:
        Path(temporary).unlink(missing_ok=True)


def verified(path, manifest_name, expected=None):
    path = Path(path).resolve()
    if expected and hash_file(path/manifest_name) != expected:
        raise ValueError('manifest checksum mismatch')
    m = json.loads((path/manifest_name).read_text())
    for name, checksum in m['outputs'].items():
        product = (path/name).resolve()
        if product.parent != path or hash_file(product) != checksum:
            raise ValueError('product corruption or path escape: '+name)
    return m


def partition_job(sources, raw, release, part):
    sources, release = Path(sources), Path(release)
    # Mutable databases belong on host-local /tmp, never replicated workspaces.
    tempfile.tempdir = '/tmp'
    started = time.monotonic()
    snapshot = run(sources/part['lock'], raw, release/'snapshots'/part['name'])
    if snapshot.name != part['build_id']: raise ValueError('pinned build differs')
    result = audit(sources/part['lock'], raw, snapshot)
    m = verified(snapshot, 'manifest.json')
    expected = json.loads((ROOT/'audit/associative-external-preparation/import-validation'/
                          (part['name'].rsplit('-v',1)[0]+'-manifest.json')).read_text())
    if m['reports'] != expected['reports'] or m['outputs'] != expected['outputs']:
        raise ValueError('published hashes or counts differ: '+part['name'])
    return dict(result, partition=part['name'], outputs=m['outputs'], reports=m['reports'],
                manifest_sha256=hash_file(snapshot/'manifest.json'),
                build_and_audit_seconds=round(time.monotonic()-started,3),
                output_bytes=sum((snapshot/n).stat().st_size for n in m['outputs']),
                max_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)


def certify(sources, raw, release, workers=2, stop_after=None):
    sources, raw, release = map(lambda p:Path(p).resolve(), (sources,raw,release))
    if raw.is_relative_to(ROOT) or release.is_relative_to(ROOT): raise ValueError('external storage required')
    release.mkdir(parents=True, exist_ok=True)
    with open(release/'.build-lock','a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return _certify(sources,raw,release,workers,stop_after)


def _certify(sources, raw, release, workers, stop_after):
    started = time.monotonic()
    registry = json.loads((sources/'source-lock.json').read_text())
    plan = json.loads((sources/'BUILD-PARTITIONS.json').read_text())
    validate_lock(registry, raw)
    identity = {'registry_sha256':hash_file(sources/'source-lock.json'),
                'plan_sha256':hash_file(sources/'BUILD-PARTITIONS.json'),
                'code':{n:hash_file(Path(__file__).with_name(n)) for n in
                        ['certify_corpus.py','morphology_import.py','audit_import.py','build_catalog.py']}}
    checkpoint = release/'CHECKPOINT.json'
    state = json.loads(checkpoint.read_text()) if checkpoint.exists() else {
        'schema':'full-corpus-certification/1','identity':identity,'partitions':{},'status':'running'}
    if state['identity'] != identity: raise ValueError('release identity changed')
    atomic_json(checkpoint,state)
    atomic_json(release/'INPUTS.json',dict(all_checksums_verified=True,artifacts=registry['artifacts']))
    reused=[]; pending=[]
    for part in plan['partitions']:
        if part['name'] in state['partitions']:
            r=state['partitions'][part['name']]
            verified(release/'snapshots'/part['name']/part['build_id'],'manifest.json',r['manifest_sha256'])
            reused.append(part['name'])
        else: pending.append(part)
    if stop_after is not None: pending=pending[:stop_after]
    errors=[]
    with ProcessPoolExecutor(max_workers=workers,max_tasks_per_child=1) as pool:
        jobs={pool.submit(partition_job,str(sources),str(raw),str(release),p):p for p in pending}
        for future in as_completed(jobs):
            try:
                r=future.result(); state['partitions'][r['partition']]=r
                atomic_json(checkpoint,state)
                print(dumps({'partition':r['partition'],'status':'audited','seconds':r['build_and_audit_seconds']}),flush=True)
            except Exception as exc:
                errors.append({'partition':jobs[future]['name'],'error':repr(exc)})
                atomic_json(release/'ERRORS.json',errors)
    if errors: raise ValueError('partition certification failed: '+dumps(errors))
    invocation={'reused':reused,'built':[p['name'] for p in pending]}
    if len(state['partitions'])==len(plan['partitions']):
        tempfile.tempdir='/tmp'
        catalog=make_catalog(sources/'source-lock.json',sources/'BUILD-PARTITIONS.json',release/'snapshots',release/'catalog')
        state.update(status='PASS',catalog=verified(catalog,'CATALOG.json'),
            counts={k:sum(p['counts'].get(k,0) for p in state['partitions'].values()) for k in ['read','accepted','rejected']})
        atomic_json(checkpoint,state)
    invocation['elapsed_seconds']=round(time.monotonic()-started,3)
    atomic_json(release/'LAST-RUN.json',invocation)
    return state


def rows(path):
    with open(path,encoding='utf-8') as stream:
        for line in stream: yield json.loads(line)


def audit_catalog(release, plan_path):
    release=Path(release); state=json.loads((release/'CHECKPOINT.json').read_text())
    catalog=release/'catalog'/state['catalog']['build_id']; m=verified(catalog,'CATALOG.json')
    plan=json.loads(Path(plan_path).read_text())
    expected=heapq.merge(*(rows(release/'snapshots'/p['name']/p['build_id']/'relation-evidence.ndjson')
                          for p in plan['partitions']),key=lambda r:(r['key'],r['evidence']))
    views=rows(catalog/'normalized-relations.ndjson'); view=next(views,None)
    previous=None; evidence=unique=0; used=False
    for actual,original in zip_longest(rows(catalog/'relation-evidence.ndjson'),expected):
        if actual is None or original is None or actual!=original: raise ValueError('evidence/provenance loss')
        key=(actual['key'],actual['evidence'])
        if previous and key<=previous: raise ValueError('duplicate or unsorted occurrence')
        previous=key
        while view and view['key']<actual['key']:
            if not used or digest(view['view'])!=view['key'] or view['view']['identity_established'] is not False:
                raise ValueError('invalid or unsupported view')
            unique+=1; view=next(views,None); used=False
        if not view or view['key']!=actual['key']: raise ValueError('dangling reference')
        used=True; evidence+=1
    if view:
        if not used or digest(view['view'])!=view['key']: raise ValueError('unsupported final view')
        unique+=1
        if next(views,None): raise ValueError('unsupported trailing views')
    if (unique,evidence)!=(m['unique_normalized_views'],m['evidence_occurrences']): raise ValueError('count mismatch')
    return dict(status='PASS',views=unique,evidence=evidence,lost_occurrences=0,dangling_references=0)


def publish(store, catalog):
    store=Path(store).resolve(); catalog=Path(catalog).resolve()
    if store.is_relative_to(ROOT): raise ValueError('external store required')
    m=verified(catalog,'CATALOG.json')
    if digest(m['identity'])!=m['build_id'] or m['establishes_membership']: raise ValueError('unsafe catalog')
    selected={'path':str(catalog),'build_id':m['build_id'],'manifest_sha256':hash_file(catalog/'CATALOG.json')}
    store.mkdir(parents=True,exist_ok=True)
    with open(store/'.publish-lock','a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        current=store/'CURRENT.json'; old=json.loads(current.read_text()) if current.exists() else None
        if old: verified(old['path'],'CATALOG.json',old['manifest_sha256'])
        atomic_json(store/'versions'/(selected['build_id']+'.json'),selected)
        if old!=selected:
            atomic_json(store/'PREVIOUS.json',old); atomic_json(current,selected)
    return selected


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--sources',type=Path,default=ROOT/'data/morphology-evidence/sources')
    p.add_argument('--raw-root',required=True,type=Path); p.add_argument('--release',required=True,type=Path)
    p.add_argument('--workers',type=int,choices=range(1,5),default=2); p.add_argument('--stop-after',type=int)
    a=p.parse_args(); r=certify(a.sources,a.raw_root,a.release,a.workers,a.stop_after)
    print(dumps({'status':r['status'],'partitions':len(r['partitions'])}))
