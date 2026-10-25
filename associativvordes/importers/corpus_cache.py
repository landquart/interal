#!/usr/bin/env python3
"""Private offline originals cache; per-resource license obligations still apply."""
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
from associativvordes.importers.glemm_cache import external, info, SOURCES


def contract(lock):
    lock=Path(lock); registry=json.loads(lock.read_text())
    metadata={'source-lock.json':lock.read_bytes()}
    if lock.resolve()==(SOURCES/'source-lock.json').resolve():
        for path in sorted(SOURCES.rglob('*')):
            if path.is_file() and not any(p.startswith('.') for p in path.relative_to(SOURCES).parts):
                metadata['metadata/'+path.relative_to(SOURCES).as_posix()]=path.read_bytes()
    paths=[a['path'] for a in registry['artifacts']]
    if len(paths)!=len(set(paths)): raise ValueError('duplicate source paths')
    return registry,metadata


def restore(archive,raw,lock=SOURCES/'source-lock.json'):
    archive,raw=external(archive),external(raw); registry,metadata=contract(lock)
    if raw.exists() and any(raw.iterdir()): raise FileExistsError('fresh restore directory required')
    raw.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(archive) as z,tempfile.TemporaryDirectory(dir=raw.parent) as temporary:
        staging=Path(temporary)/'raw'; staging.mkdir()
        names=z.namelist(); expected=set(metadata)|{'raw/'+a['path'] for a in registry['artifacts']}
        if len(names)!=len(set(names)) or set(names)!=expected: raise ValueError('unsafe cache entry inventory')
        for name,data in metadata.items():
            if z.getinfo(name).file_size!=len(data) or z.read(name)!=data: raise ValueError('untrusted cache metadata')
        for a in registry['artifacts']:
            entry=z.getinfo('raw/'+a['path'])
            if entry.file_size!=a['bytes'] or stat.S_IFMT(entry.external_attr>>16) not in (0,stat.S_IFREG): raise ValueError('unsafe cache file')
            target=checked_path(staging,a['path']); target.parent.mkdir(parents=True,exist_ok=True)
            with z.open(entry) as source,open(target,'wb') as destination: shutil.copyfileobj(source,destination,1024*1024)
        validate_lock(registry,staging)
        if raw.exists(): raw.rmdir()
        os.replace(staging,raw)
    return dict(status='PASS',artifacts=len(registry['artifacts']))


def pack(raw,archive,lock=SOURCES/'source-lock.json'):
    raw,archive=external(raw),external(archive); registry,metadata=contract(lock); validate_lock(registry,raw)
    if archive.exists(): raise FileExistsError(archive)
    archive.parent.mkdir(parents=True,exist_ok=True)
    fd,name=tempfile.mkstemp(dir=archive.parent); os.close(fd)
    try:
        with zipfile.ZipFile(name,'w') as z:
            for key,data in sorted(metadata.items()):
                entry=info(key); entry.compress_type=zipfile.ZIP_DEFLATED; z.writestr(entry,data)
            for a in sorted(registry['artifacts'],key=lambda a:a['path']):
                entry=info('raw/'+a['path']); entry.compress_type=zipfile.ZIP_DEFLATED
                with open(checked_path(raw,a['path']),'rb') as source,z.open(entry,'w') as target: shutil.copyfileobj(source,target,1024*1024)
        with tempfile.TemporaryDirectory() as directory: restore(name,Path(directory)/'raw',lock)
        os.replace(name,archive)
    finally: Path(name).unlink(missing_ok=True)
    return dict(status='PASS',artifacts=len(registry['artifacts']),sha256=hash_file(archive),bytes=archive.stat().st_size,
                source_lock_sha256=hash_file(lock),rights='private cache; original licenses retained')


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__); p.add_argument('action',choices=['pack','restore'])
    p.add_argument('--archive',required=True,type=Path); p.add_argument('--raw-root',required=True,type=Path)
    a=p.parse_args(); print(json.dumps(pack(a.raw_root,a.archive) if a.action=='pack' else restore(a.archive,a.raw_root),sort_keys=True))
