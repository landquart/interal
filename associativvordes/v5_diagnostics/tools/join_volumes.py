#!/usr/bin/env python3
"""Reassemble checksum-pinned ZIP volumes using a 1 MiB buffer."""

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
import argparse,hashlib,json,os,zipfile
from pathlib import Path
from associativvordes.v5_diagnostics.tools.query import filehash

def join(manifest,directory,output):
 m=json.loads(Path(manifest).read_bytes());directory=Path(directory);output=Path(output)
 if output.exists():raise ValueError('fresh archive output required')
 pending=output.with_suffix(output.suffix+'.partial');h=hashlib.sha256();total=0
 try:
  with pending.open('xb') as dst:
   for v in m['volumes']:
    if Path(v['file']).name!=v['file']:raise ValueError('volume path')
    p=directory/v['file']
    if p.stat().st_size!=v['bytes'] or filehash(p)!=v['sha256']:raise ValueError('volume checksum')
    vh=hashlib.sha256();n=0
    with zipfile.ZipFile(p) as z:
     if z.namelist()!=['archive.chunk']:raise ValueError('volume inventory')
     with z.open('archive.chunk') as src:
      for b in iter(lambda:src.read(1024*1024),b''):dst.write(b);h.update(b);vh.update(b);n+=len(b);total+=len(b)
    if vh.hexdigest()!=v['chunk_sha256'] or n!=v['chunk_bytes']:raise ValueError('chunk checksum')
   dst.flush();os.fsync(dst.fileno())
  if h.hexdigest()!=m['archive_sha256'] or total!=m['archive_bytes']:raise ValueError('complete archive checksum')
  os.replace(pending,output);return dict(status='PASS',archive_sha256=h.hexdigest(),archive_bytes=total,volumes=len(m['volumes']))
 finally:pending.unlink(missing_ok=True)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--manifest',required=True);p.add_argument('--directory',required=True);p.add_argument('--output',required=True);a=p.parse_args();print(json.dumps(join(a.manifest,a.directory,a.output)))
