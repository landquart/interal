#!/usr/bin/env python3
"""Content-addressed research archive and real cold restore, outside the repository."""
import argparse,hashlib,json,os,pathlib,shutil,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
def digest(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()
def canonical(x):return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
def safe_name(s):
 p=pathlib.PurePosixPath(s)
 if p.is_absolute() or '..' in p.parts or not p.parts:raise ValueError('unsafe archive path')
 return str(p)
p=argparse.ArgumentParser();p.add_argument('--config',required=True);p.add_argument('--output',required=True);p.add_argument('--restore',required=True);p.add_argument('--receipt',required=True);a=p.parse_args()
out=pathlib.Path(a.output).resolve();restore=pathlib.Path(a.restore).resolve()
if out.is_relative_to(ROOT) or restore.is_relative_to(ROOT) or out.exists() or restore.exists():raise ValueError('fresh separate output/restore paths required')
files={}
for entry in json.loads(pathlib.Path(a.config).read_text())['entries']:
 source=pathlib.Path(entry['source']).resolve();prefix=safe_name(entry['prefix'])
 for f in sorted(source.rglob('*')) if source.is_dir() else [source]:
  if not f.is_file():continue
  if f.is_symlink() or '.partial' in f.parts or '.partial' in f.name:raise ValueError('unpublished or linked input')
  name=safe_name(prefix+'/'+f.relative_to(source).as_posix()) if source.is_dir() else prefix
  if name in files:raise ValueError('duplicate archive name')
  files[name]=f
inventory=[dict(path=n,bytes=f.stat().st_size,sha256=digest(f)) for n,f in sorted(files.items())];payload=canonical(dict(schema='v5-morphology-research-archive/1',files=inventory))+b'\n'
partial=out.with_name(out.name+'.partial');partial.unlink(missing_ok=True)
with zipfile.ZipFile(partial,'w',allowZip64=True) as z:
 for name,f in sorted(files.items()):
  info=zipfile.ZipInfo(name,date_time=(2026,10,23,0,0,0));info.external_attr=0o100444<<16;info.compress_type=zipfile.ZIP_STORED if name.endswith(('.gz','.zip')) else zipfile.ZIP_DEFLATED
  with f.open('rb') as src,z.open(info,'w',force_zip64=True) as dst:shutil.copyfileobj(src,dst,1048576)
 info=zipfile.ZipInfo('ARCHIVE-CONTENTS.json',date_time=(2026,10,23,0,0,0));info.external_attr=0o100444<<16;z.writestr(info,payload)
with partial.open('rb') as f:os.fsync(f.fileno())
os.replace(partial,out)
stage=restore.with_name(restore.name+'.partial')
if stage.exists():raise ValueError('unexamined previous restore partial')
stage.mkdir(parents=True)
with zipfile.ZipFile(out) as z:
 if z.read('ARCHIVE-CONTENTS.json')!=payload:raise ValueError('archive inventory')
 if set(z.namelist())!={r['path'] for r in inventory}|{'ARCHIVE-CONTENTS.json'}:raise ValueError('archive closure')
 for r in inventory:
  target=stage/r['path'];target.parent.mkdir(parents=True,exist_ok=True)
  with z.open(r['path']) as src,target.open('xb') as dst:shutil.copyfileobj(src,dst,1048576)
  if target.stat().st_size!=r['bytes'] or digest(target)!=r['sha256']:raise ValueError('cold restore checksum')
  target.chmod(0o444)
 (stage/'ARCHIVE-CONTENTS.json').write_bytes(payload)
os.replace(stage,restore)
receipt=dict(status='PASS',archive_filename=out.name,archive_sha256=digest(out),archive_bytes=out.stat().st_size,restored_files=len(inventory),restored_bytes=sum(r['bytes'] for r in inventory),inventory_sha256=hashlib.sha256(payload).hexdigest(),all_restored_hashes_exact=True,scope='Real ZIP extraction into a fresh directory; every file size and SHA checked',immutability='Content addressed receipts and read-only restored files; no WORM guarantee')
pathlib.Path(a.receipt).write_bytes(canonical(receipt)+b'\n');print(canonical(receipt).decode())
