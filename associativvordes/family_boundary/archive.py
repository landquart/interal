"""Stream immutable research backups, verified cold restore and durable volumes."""
import argparse,os,shutil,tempfile,zipfile
from .core import *

def restore(archive,destination,expected=None):
 archive=Path(archive);dest=Path(destination).resolve()
 if dest.exists() or dest.is_relative_to(ROOT):raise ValueError('fresh research restore destination required')
 if expected and sha(archive)!=expected:raise ValueError('archive checksum')
 dest.parent.mkdir(parents=True,exist_ok=True);stage=Path(tempfile.mkdtemp(dir=dest.parent,prefix='boundary-restore-'))
 try:
  with zipfile.ZipFile(archive) as z:
   m=json.loads(z.read('ARCHIVE-CONTENTS.json'));names=[r['path'] for r in m['files']]
   if len(names)!=len(set(names)) or sorted(z.namelist())!=sorted(names+['ARCHIVE-CONTENTS.json']):raise ValueError('archive inventory')
   for r in m['files']:
    path=(stage/r['path']).resolve()
    if not path.is_relative_to(stage) or path==stage:raise ValueError('archive path escape')
    if z.getinfo(r['path']).file_size!=r['bytes']:raise ValueError('entry size')
    path.parent.mkdir(parents=True,exist_ok=True)
    with z.open(r['path']) as source,path.open('xb') as target:shutil.copyfileobj(source,target,1048576)
    if sha(path)!=r['sha256']:raise ValueError('restored file checksum')
   save(stage/'ARCHIVE-CONTENTS.json',m)
  database=stage/'release/index.sqlite'
  if database.exists():
   d=dbopen(database,True)
   if d.execute('PRAGMA quick_check').fetchone()[0]!='ok':raise ValueError('restored SQLite integrity')
   d.close()
  os.rename(stage,dest)
 except BaseException:shutil.rmtree(stage);raise
 return dict(status='PASS',files_verified=len(names),all_restored_hashes_exact=True,archive_sha256=sha(archive),archive_bytes=archive.stat().st_size,production_writes=0)

def pack(archive,release,contexts,independent,replay):
 archive=Path(archive).resolve()
 if archive.is_relative_to(ROOT):raise ValueError('research archive outside checkout')
 if archive.exists():raise ValueError('fresh immutable archive required')
 entries=[]
 for label,root in [('release',release),('contexts',contexts),('independent',independent),('REPLAY-RECEIPT.json',replay)]:
  root=Path(root).resolve()
  for path in sorted(root.rglob('*')) if root.is_dir() else [root]:
   if path.name.startswith('.') or path.name=='LOCK':continue
   if path.is_symlink():raise ValueError('symlink input')
   if not path.is_file():continue
   if path.name.endswith(('.partial','-journal','-wal','-shm')):raise ValueError('unfinished database/artifact')
   name=str(Path(label)/path.relative_to(root)) if root.is_dir() else label;entries.append((name,path,dict(path=name,bytes=path.stat().st_size,sha256=sha(path))))
 tmp=archive.with_name(archive.name+'.partial')
 with zipfile.ZipFile(tmp,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=1,allowZip64=True) as z:
  for name,path,r in entries:
   z.write(path,name)
   if sha(path)!=r['sha256']:raise ValueError('source changed while packing')
  z.writestr('ARCHIVE-CONTENTS.json',canonical(dict(schema='boundary-backup/2',files=[r for _,_,r in entries])))
 os.replace(tmp,archive);return dict(status='PASS',files=len(entries),bytes=archive.stat().st_size,sha256=sha(archive))

def split(archive,folder):
 archive=Path(archive);folder=Path(folder).resolve()
 if folder.is_relative_to(ROOT):raise ValueError('research volumes outside checkout')
 folder.mkdir(parents=True,exist_ok=False);parts=[]
 with archive.open('rb') as source:
  n=0
  while True:
   first=source.read(1048576)
   if not first:break
   n+=1;path=folder/(archive.name+'.part-'+str(n).zfill(4))
   with path.open('xb') as target:
    target.write(first)
    for i in range(255):
     b=source.read(1048576)
     if not b:break
     target.write(b)
   parts.append(dict(filename=path.name,bytes=path.stat().st_size,sha256=sha(path)))
 m=dict(schema='boundary-archive-parts/2',archive_name=archive.name,archive_bytes=archive.stat().st_size,archive_sha256=sha(archive),parts=parts);save(folder/'BUNDLE-PARTS.json',m);return m

def join(manifest,output):
 manifest=Path(manifest);m=read(manifest);output=Path(output).resolve()
 if output.is_relative_to(ROOT):raise ValueError('research archive outside checkout')
 if output.exists():raise ValueError('fresh assembled output required')
 names=[r['filename'] for r in m['parts']]
 if len(names)!=len(set(names)):raise ValueError('duplicate part')
 tmp=output.with_name(output.name+'.partial')
 with tmp.open('xb') as target:
  for r in m['parts']:
   if Path(r['filename']).name!=r['filename']:raise ValueError('part path escape')
   path=manifest.parent/r['filename']
   if path.stat().st_size!=r['bytes'] or sha(path)!=r['sha256']:raise ValueError('part checksum')
   with path.open('rb') as source:shutil.copyfileobj(source,target,1048576)
 if tmp.stat().st_size!=m['archive_bytes'] or sha(tmp)!=m['archive_sha256']:raise ValueError('assembled archive checksum')
 os.replace(tmp,output);return dict(status='PASS',archive_sha256=m['archive_sha256'])
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('mode',choices=['pack','restore','split','join']);p.add_argument('--archive');p.add_argument('--release');p.add_argument('--contexts');p.add_argument('--independent');p.add_argument('--replay');p.add_argument('--destination');p.add_argument('--manifest');p.add_argument('--expected');a=p.parse_args()
 if a.mode=='pack':r=pack(a.archive,a.release,a.contexts,a.independent,a.replay)
 elif a.mode=='restore':r=restore(a.archive,a.destination,a.expected)
 elif a.mode=='split':r=split(a.archive,a.destination)
 else:r=join(a.manifest,a.destination)
 print(json.dumps(r))
