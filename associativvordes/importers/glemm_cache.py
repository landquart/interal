#!/usr/bin/env python3
"""Portable, deterministic GLeMM cache. Restore only against a trusted local lock."""

# Installed writer boundary; isolated restored tools retain self-contained replay.
from pathlib import Path as _HistoryFencePath
import sys as _history_fence_sys
_history_fence_root=next((p for p in _HistoryFencePath(__file__).resolve().parents if (p/'associativvordes/mutation_guard.py').is_file()),None)
if _history_fence_root is not None:
    _history_fence_sys.path.insert(0,str(_history_fence_root))
    from associativvordes.mutation_guard import install as _install_history_fence
    _install_history_fence()
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse
import json
import os
from pathlib import Path
import shutil
import stat
import tempfile
import zipfile
from associativvordes.importers.morphology_import import checked_path, hash_file, validate_lock

ROOT=Path(__file__).resolve().parents[2]
SOURCES=ROOT/'data/morphology-evidence/sources'
LOCK=SOURCES/'locks/glemm.json'
ATTRIBUTION=('GLeMM-LICENSE.txt','GLeMM-Readme.md','GLeMM-output-Readme.md')

def external(path):
    path=Path(path).resolve()
    if path.is_relative_to(ROOT):raise ValueError('cache must remain outside repository')
    return path

def contract(lock_path):
    lock_path=Path(lock_path);lock=json.loads(lock_path.read_text('utf-8'))
    paths=[a['path'] for a in lock['artifacts']]
    if not paths or len(set(paths))!=len(paths):raise ValueError('empty/duplicate cache paths')
    for a in lock['artifacts']:
        if a['source']!='GLeMM' or a.get('container') or not a['path'].startswith('GLeMM/'):
            raise ValueError('only pinned GLeMM files supported')
        checked_path(Path('/cache-root'),a['path'])
    metadata={'source-lock.json':lock_path.read_bytes()}
    metadata.update({n:(SOURCES/n).read_bytes() for n in ATTRIBUTION})
    return lock,metadata

def info(name):
    z=zipfile.ZipInfo(name,date_time=(1980,1,1,0,0,0));z.create_system=3
    z.external_attr=(stat.S_IFREG|0o644)<<16;z.compress_type=zipfile.ZIP_STORED
    return z

def pack(raw,archive,lock_path=LOCK):
    raw,archive=external(raw),external(archive);lock,metadata=contract(lock_path)
    validate_lock(lock,raw)
    if archive.exists():raise FileExistsError(archive)
    archive.parent.mkdir(parents=True,exist_ok=True)
    fd,tmp=tempfile.mkstemp(prefix='.glemm-cache-',dir=archive.parent);os.close(fd)
    try:
        with zipfile.ZipFile(tmp,'w') as z:
            for name in sorted(metadata):z.writestr(info(name),metadata[name])
            for a in sorted(lock['artifacts'],key=lambda a:a['path']):
                with checked_path(raw,a['path']).open('rb') as src,z.open(info(a['path']),'w') as dest:
                    shutil.copyfileobj(src,dest,length=1024*1024)
        # A completed archive must itself pass the restore verifier before publication.
        with tempfile.TemporaryDirectory(dir=archive.parent) as d:restore(tmp,d,lock_path)
        os.replace(tmp,archive)
    finally:Path(tmp).unlink(missing_ok=True)
    return {'schema':'glemm-offline-cache/1','bytes':archive.stat().st_size,
            'sha256':hash_file(archive),'artifacts':len(lock['artifacts']),
            'source_lock_sha256':hash_file(lock_path),'original_bytes':True}

def restore(archive,raw,lock_path=LOCK):
    archive,raw=external(archive),external(raw);lock,metadata=contract(lock_path)
    raw.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(archive) as z:
        names=[i.filename for i in z.infolist()]
        expected=set(metadata)|{a['path'] for a in lock['artifacts']}
        if len(names)!=len(set(names)) or set(names)!=expected:raise ValueError('unexpected/missing/duplicate cache entries')
        for name,body in metadata.items():
            if z.getinfo(name).file_size!=len(body) or z.read(name)!=body:
                raise ValueError('cache metadata differs from trusted local lock/attribution: '+name)
        with tempfile.TemporaryDirectory(prefix='.glemm-restore-',dir=raw) as d:
            staging=Path(d)
            for a in lock['artifacts']:
                i=z.getinfo(a['path'])
                if i.file_size!=a['bytes'] or stat.S_IFMT(i.external_attr>>16) not in (0,stat.S_IFREG):
                    raise ValueError('unsafe cache entry/size: '+a['path'])
                p=checked_path(staging,a['path']);p.parent.mkdir(parents=True,exist_ok=True)
                with z.open(i) as src,p.open('wb') as dest:shutil.copyfileobj(src,dest,length=1024*1024)
            validate_lock(lock,staging)
            if (raw/'GLeMM').exists():validate_lock(lock,raw)
            else:os.replace(staging/'GLeMM',raw/'GLeMM')
    return {'status':'verified_cache','artifacts':len(lock['artifacts']),
            'source_lock_sha256':hash_file(lock_path)}

def import_upstream(archive,raw,lock_path=LOCK):
    """Read only the locked files from a downloaded upstream GitLab directory ZIP."""
    archive,raw=external(archive),external(raw);lock,_=contract(lock_path)
    raw.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(archive) as z,tempfile.TemporaryDirectory(prefix='.glemm-upstream-',dir=raw) as d:
        staged=Path(d)
        for a in lock['artifacts']:
            wanted='GLeMM_2.0/output/'+a['path'].removeprefix('GLeMM/')
            matches=[i for i in z.infolist() if i.filename==wanted or i.filename.endswith('/'+wanted)]
            if len(matches)!=1:raise ValueError('missing/ambiguous upstream entry: '+wanted)
            i=matches[0]
            if i.file_size!=a['bytes'] or stat.S_IFMT(i.external_attr>>16) not in (0,stat.S_IFREG):
                raise ValueError('unsafe upstream entry/size: '+wanted)
            p=checked_path(staged,a['path']);p.parent.mkdir(parents=True,exist_ok=True)
            with z.open(i) as src,p.open('wb') as dest:shutil.copyfileobj(src,dest,length=1024*1024)
        validate_lock(lock,staged)
        if (raw/'GLeMM').exists():validate_lock(lock,raw)
        else:os.replace(staged/'GLeMM',raw/'GLeMM')
    return {'status':'verified_upstream_archive','artifacts':len(lock['artifacts']),
            'source_lock_sha256':hash_file(lock_path)}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('action',choices=['pack','restore','import-upstream'])
    p.add_argument('--raw-root',required=True,type=Path);p.add_argument('--archive',required=True,type=Path)
    p.add_argument('--lock',type=Path,default=LOCK);a=p.parse_args()
    action={'pack':lambda:pack(a.raw_root,a.archive,a.lock),'restore':lambda:restore(a.archive,a.raw_root,a.lock),
            'import-upstream':lambda:import_upstream(a.archive,a.raw_root,a.lock)}
    result=action[a.action]()
    print(json.dumps(result,sort_keys=True))
