#!/usr/bin/env python3
"""Fetch only checksum-locked artifacts into an external raw directory."""

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
import hashlib
import http.client
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
from urllib.request import Request, urlopen
from urllib.parse import urlsplit, quote
from associativvordes.importers.morphology_import import checked_path, hash_file, validate_lock


def acquisition_urls(url):
    """Only the same pinned GLeMM file through its official GitLab API."""
    yield url
    parsed=urlsplit(url);prefix='/nabil.hathout.1/glemm/-/raw/'
    if parsed.scheme=='http':
        yield 'https://'+url[len('http://'):]
    if parsed.scheme=='https' and parsed.netloc=='src.koda.cnrs.fr' and parsed.path.startswith(prefix):
        revision,sep,path=parsed.path[len(prefix):].partition('/')
        if sep and len(revision)==40 and all(c in '0123456789abcdef' for c in revision):
            yield 'https://src.koda.cnrs.fr/api/v4/projects/nabil.hathout.1%2Fglemm/repository/files/'+quote(path,safe='')+'/raw?ref='+revision


def download(url,dest,expected_hash,expected_bytes):
    if dest.exists():
        if dest.stat().st_size==expected_bytes and hash_file(dest)==expected_hash:
            return {'status':'verified_cache','requested_url':url,'used_url':None}
        raise ValueError('existing raw cache checksum mismatch: '+str(dest))
    dest.parent.mkdir(parents=True,exist_ok=True);errors=[]
    for candidate in acquisition_urls(url):
        fd,name=tempfile.mkstemp(prefix='.download-',dir=dest.parent)
        try:
            request=Request(candidate,headers={'User-Agent':'Interal-morphology-source-verification/1.0'})
            with os.fdopen(fd,'wb') as out,urlopen(request,timeout=90) as response:
                shutil.copyfileobj(response,out,length=1024*1024)
            tmp=Path(name)
            if tmp.stat().st_size!=expected_bytes or hash_file(tmp)!=expected_hash:
                raise ValueError('download checksum/size mismatch: '+candidate)
            os.replace(tmp,dest)
            result={'status':'verified_download','requested_url':url,'used_url':candidate}
            print(json.dumps(result,sort_keys=True),flush=True);return result
        except (OSError,http.client.HTTPException) as exc:
            errors.append(candidate+': '+str(exc))
        finally:
            Path(name).unlink(missing_ok=True)
    # Some upstream endpoints close Python's HTTP/1 connection. An available
    # curl client can negotiate HTTP/2; it uses the same URLs, identity and pins.
    curl=shutil.which('curl')
    if curl:
        for candidate in acquisition_urls(url):
            fd,name=tempfile.mkstemp(prefix='.download-',dir=dest.parent);os.close(fd)
            try:
                r=subprocess.run([curl,'--fail','--location','--silent','--show-error',
                    '--connect-timeout','20','--max-time','180',
                    '--output',name,'--url',candidate],
                    capture_output=True,text=True,timeout=190)
                if r.returncode:
                    errors.append(candidate+': curl: '+r.stderr.strip());continue
                tmp=Path(name)
                if tmp.stat().st_size!=expected_bytes or hash_file(tmp)!=expected_hash:
                    raise ValueError('download checksum/size mismatch: '+candidate)
                os.replace(tmp,dest)
                result={'status':'verified_download','requested_url':url,'used_url':candidate,'transport':'curl'}
                print(json.dumps(result,sort_keys=True),flush=True);return result
            except (OSError,subprocess.TimeoutExpired) as exc:errors.append(candidate+': '+str(exc))
            finally:Path(name).unlink(missing_ok=True)
    raise OSError('pinned source unavailable: '+'; '.join(errors))


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
