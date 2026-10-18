#!/usr/bin/env python3
"""Fetch only checksum-locked artifacts into an external raw directory."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import tarfile
import tempfile
from urllib.request import urlopen
from morphology_import import checked_path, hash_file, validate_lock


def download(url,dest,expected_hash,expected_bytes):
    if dest.exists():
        if dest.stat().st_size==expected_bytes and hash_file(dest)==expected_hash:
            return
        raise ValueError('existing raw cache checksum mismatch: '+str(dest))
    dest.parent.mkdir(parents=True,exist_ok=True)
    fd,name=tempfile.mkstemp(prefix='.download-',dir=dest.parent)
    try:
        with os.fdopen(fd,'wb') as out,urlopen(url,timeout=90) as response:
            shutil.copyfileobj(response,out,length=1024*1024)
        tmp=Path(name)
        if tmp.stat().st_size!=expected_bytes or hash_file(tmp)!=expected_hash:
            raise ValueError('download checksum/size mismatch: '+url)
        os.replace(tmp,dest)
    finally:
        Path(name).unlink(missing_ok=True)


def fetch(lock_path,raw_root):
    lock=json.loads(Path(lock_path).read_text('utf-8'))
    root=Path(raw_root).resolve()
    repo=Path(__file__).resolve().parents[2]
    if root.is_relative_to(repo):raise ValueError('raw root must be outside repository')
    root.mkdir(parents=True,exist_ok=True)
    for a in lock['artifacts']:
        dest=checked_path(root,a['path'])
        c=a.get('container')
        if not c:
            download(a['url'],dest,a['sha256'],a['bytes'])
        else:
            archive=root/'containers'/c['sha256']
            download(a['url'],archive,c['sha256'],c['bytes'])
            if c.get('md5'):
                h=hashlib.md5()
                with archive.open('rb') as f:
                    for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
                if h.hexdigest()!=c['md5']:raise ValueError('published archive MD5 mismatch')
            if dest.exists():
                if dest.stat().st_size!=a['bytes'] or hash_file(dest)!=a['sha256']:
                    raise ValueError('existing extracted file checksum mismatch')
                continue
            dest.parent.mkdir(parents=True,exist_ok=True)
            fd,name=tempfile.mkstemp(prefix='.extract-',dir=dest.parent)
            try:
                with tarfile.open(archive) as tar:
                    member=tar.getmember(c['member'])
                    if not member.isfile():raise ValueError('container member is not a regular file')
                    with tar.extractfile(member) as source,os.fdopen(fd,'wb') as out:
                        shutil.copyfileobj(source,out,length=1024*1024)
                if Path(name).stat().st_size!=a['bytes'] or hash_file(name)!=a['sha256']:
                    raise ValueError('extracted checksum mismatch')
                os.replace(name,dest)
            finally:
                Path(name).unlink(missing_ok=True)
    validate_lock(lock,root)


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--lock',required=True);p.add_argument('--raw-root',required=True)
    a=p.parse_args();fetch(a.lock,a.raw_root)
