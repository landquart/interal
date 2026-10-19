#!/usr/bin/env python3
"""Full source verification in isolated storage; publish receipts, never corpora.

Accepts only the committed registry/partition plan. No family or production writes.
Each completed receipt is saved immediately, including when later work fails.
"""
import argparse
import json
from pathlib import Path
import platform
import shutil
import sqlite3
import time
import unicodedata
import zlib
from morphology_import import run,hash_file,validate_lock
from fetch_sources import fetch
from audit_import import audit
from build_catalog import make_catalog

ROOT=Path(__file__).resolve().parents[2]

def write(path,value):
    path.write_text(json.dumps(value,ensure_ascii=False,sort_keys=True,indent=2)+'\n')

def validate(raw,output,receipts,acquire=False,partition=None):
    paths=[Path(x).resolve() for x in (raw,output,receipts)]
    if any(p.is_relative_to(ROOT) for p in paths):raise ValueError('verification outputs must be outside checkout')
    raw,output,receipts=paths
    if receipts.exists() and any(receipts.iterdir()):raise FileExistsError('use a fresh receipt release')
    receipts.mkdir(parents=True,exist_ok=True)
    sources=ROOT/'data/morphology-evidence/sources';plan=json.loads((sources/'BUILD-PARTITIONS.json').read_text())
    if partition is not None:
        selected=[p for p in plan['partitions'] if p['name']==partition]
        if len(selected)!=1:raise ValueError('unknown pinned partition')
    else:selected=plan['partitions']
    input_lock=sources/selected[0]['lock'] if partition is not None else sources/'source-lock.json'
    runtime={'python':platform.python_version(),'sqlite':sqlite3.sqlite_version,'unicode':unicodedata.unidata_version,'zlib':zlib.ZLIB_VERSION}
    receipt={'schema':'full-morphology-validation/1','status':'running','runtime':runtime,
             'verifier_code_sha256':{n:hash_file(Path(__file__).with_name(n)) for n in ['validate_sources.py','morphology_import.py','fetch_sources.py','audit_import.py','build_catalog.py']},
             'source_lock_sha256':hash_file(sources/'source-lock.json'),'partitions':[],
             'membership_writes':0,'production_writes':0,'scope':partition or 'full_corpus',
             'input_lock_sha256':hash_file(input_lock),'full_corpus_certified':False}
    started=time.perf_counter()
    write(receipts/'SUMMARY.json',receipt)
    try:
        if acquire:fetch(input_lock,raw)
        registry=json.loads(input_lock.read_text());validate_lock(registry,raw)
        write(receipts/'INPUTS.json',{'artifacts':[{k:a[k] for k in ['id','sha256','bytes','revision','license']} for a in registry['artifacts']], 'all_input_checksums_verified':True})
        rebuilt=[]
        for part in selected:
            lock=sources/part['lock'];snapshot=run(lock,raw,output/part['name'])
            result=audit(lock,raw,snapshot);manifest=json.loads((snapshot/'manifest.json').read_text())
            name=part['name'].rsplit('-v',1)[0]
            expected=json.loads((ROOT/'audit/associative-external-preparation/import-validation'/(name+'-manifest.json')).read_text())
            if manifest['reports']!=expected['reports']:raise ValueError('partition counts/coverage differ: '+name)
            # Uncompressed logical products must agree on every runtime. Compressed
            # bytes must agree when the compressor/runtime policy is identical.
            for key,value in expected['outputs'].items():
                if not key.endswith('.gz') or manifest['policy']==expected['policy']:
                    if manifest['outputs'].get(key)!=value:raise ValueError('published output mismatch: '+name+'/'+key)
            result.update(manifest_sha256=hash_file(snapshot/'manifest.json'),matches_published_reports=True,
                          exact_published_build=snapshot.name==part['build_id'],outputs=manifest['outputs'])
            write(receipts/(name+'.json'),result);receipt['partitions'].append({'name':part['name'],**result})
            rebuilt.append(dict(part,build_id=snapshot.name));write(receipts/'SUMMARY.json',receipt)
            print(name+' independently audited',flush=True)
        # Keep a new runtime-specific plan in isolated output; never replace pins.
        local_sources=output/'catalog-inputs';local_sources.mkdir(parents=True,exist_ok=True)
        local_plan=local_sources/'PLAN.json'
        for part in rebuilt:
            dest=local_sources/part['lock'];dest.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(sources/part['lock'],dest)
        write(local_plan,dict(plan,partitions=rebuilt))
        if partition is None:
            catalog=make_catalog(sources/'source-lock.json',local_plan,output,output/'catalog')
            write(receipts/'CATALOG.json',json.loads((catalog/'CATALOG.json').read_text()))
        receipt.update(status='PASS',artifacts=len(registry['artifacts']),read=sum(p['counts'].get('read',0) for p in receipt['partitions']),
                       accepted=sum(p['counts'].get('accepted',0) for p in receipt['partitions']),
                       rejected=sum(p['counts'].get('rejected',0) for p in receipt['partitions']))
        if partition is None:
            if (receipt['read'],receipt['accepted'],receipt['rejected'])!=(9404068,9404044,24):raise ValueError('full count mismatch')
            receipt['full_corpus_certified']=True
    except Exception as e:
        receipt.update(status='FAIL',error=type(e).__name__+': '+str(e));raise
    finally:
        receipt['elapsed_seconds']=time.perf_counter()-started;write(receipts/'SUMMARY.json',receipt)
    return receipt

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ['raw-root','output-root','receipts']:p.add_argument('--'+name,required=True,type=Path)
    p.add_argument('--fetch',action='store_true');p.add_argument('--partition');a=p.parse_args();validate(a.raw_root,a.output_root,a.receipts,a.fetch,a.partition)
