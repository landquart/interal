#!/usr/bin/env python3
"""Export the same pinned GLeMM bytes through its official Git transport."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from glemm_cache import contract,external,LOCK
from morphology_import import checked_path,hash_file,validate_lock

OFFICIAL='https://src.koda.cnrs.fr/nabil.hathout.1/glemm.git'

def export(lock_path,raw,repository=OFFICIAL):
    raw=external(raw);lock,_=contract(lock_path)
    revisions={a['revision'] for a in lock['artifacts']}
    if len(revisions)!=1 or not re.fullmatch('[0-9a-f]{40}',next(iter(revisions))):raise ValueError('one exact Git commit required')
    revision=next(iter(revisions));raw.mkdir(parents=True,exist_ok=True)
    missing=[]
    for a in lock['artifacts']:
        p=checked_path(raw,a['path'])
        if p.exists():
            if p.stat().st_size!=a['bytes'] or hash_file(p)!=a['sha256']:raise ValueError('existing raw cache checksum mismatch')
        else:missing.append(a)
    if not missing:
        validate_lock(lock,raw);return {'status':'verified_cache','artifacts':len(lock['artifacts'])}
    with tempfile.TemporaryDirectory(prefix='.glemm-git-',dir=raw) as d:
        work=Path(d);repo=work/'repo';repo.mkdir()
        def git(*args,input=None):
            try:
                return subprocess.run(['git','-C',str(repo),'-c','protocol.version=2',*args],
                    input=input,text=True,capture_output=True,check=True,timeout=900).stdout.strip()
            except subprocess.CalledProcessError as e:
                raise RuntimeError('official Git '+args[0]+' failed: '+e.stderr.strip()) from e
        git('init','-q');git('remote','add','origin',repository)
        git('fetch','--depth=1','--filter=blob:none','origin',revision)
        if git('rev-parse','FETCH_HEAD')!=revision:raise ValueError('upstream commit mismatch')
        blobs=[]
        for a in missing:
            upstream='GLeMM_2.0/output/'+a['path'].removeprefix('GLeMM/')
            object_id=git('rev-parse',revision+':'+upstream)
            if not re.fullmatch('[0-9a-f]{40}',object_id):raise ValueError('invalid upstream blob')
            blobs.append((a,object_id))
        # One Git pack requests only the required blobs, avoiding all repository history/data.
        git('fetch','--no-tags','--no-write-fetch-head','--stdin','origin',input='\n'.join(b for _,b in blobs)+'\n')
        staged=work/'raw';staged.mkdir()
        for a,blob in blobs:
            p=checked_path(staged,a['path']);p.parent.mkdir(parents=True,exist_ok=True)
            with p.open('wb') as out:
                subprocess.run(['git','-C',str(repo),'cat-file','blob',blob],stdout=out,check=True,timeout=60)
            if p.stat().st_size!=a['bytes'] or hash_file(p)!=a['sha256']:raise ValueError('Git export checksum/size mismatch: '+a['id'])
        for a,_ in blobs:
            dest=checked_path(raw,a['path']);dest.parent.mkdir(parents=True,exist_ok=True)
            os.replace(checked_path(staged,a['path']),dest)
    validate_lock(lock,raw)
    return {'status':'verified_git_export','repository':repository,'revision':revision,
            'artifacts':len(lock['artifacts']),'exported':len(missing),'source_lock_sha256':hash_file(lock_path)}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--lock',type=Path,default=LOCK)
    p.add_argument('--raw-root',type=Path,required=True);p.add_argument('--receipt',type=Path);a=p.parse_args()
    receipt=external(a.receipt) if a.receipt else None
    result={'status':'FAIL','repository':OFFICIAL,'source_lock_sha256':hash_file(a.lock)}
    try:
        result=export(a.lock,a.raw_root);print(json.dumps(result,sort_keys=True))
    except Exception as e:
        result['error']=type(e).__name__+': '+str(e);raise
    finally:
        if receipt:
            receipt.parent.mkdir(parents=True,exist_ok=True)
            receipt.write_text(json.dumps(result,sort_keys=True,indent=2)+'\n')
