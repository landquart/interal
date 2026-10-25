"""Verify an explicit archive/part plan in a fresh, isolated restore directory.

Downloads are acquired by authenticated connectors outside this module. No old
report is treated as a current observation. Each member is physically restored,
rehashes exactly, and (for SQLite) passes integrity_check. Only that temporary
member is then removed to bound disk usage. This is sequential cold recovery,
not a claim that the complete research environment has run end to end.
"""
import argparse,bisect,hashlib,io,json,os,sqlite3,stat,tarfile,tempfile,zipfile
from pathlib import Path,PurePosixPath
SCHEMA='interal-source-cold-restore/1'
CHUNK=1024*1024
SOURCE_ROOT=Path(__file__).resolve().parents[2]

def hash_stream(f):
 h=hashlib.sha256();n=0
 while b:=f.read(CHUNK):h.update(b);n+=len(b)
 return n,h.hexdigest()
def hash_file(p):
 with Path(p).open('rb') as f:return hash_stream(f)[1]
def safe(name):
 p=PurePosixPath(name)
 if not name or '\\' in name or p.is_absolute() or '..' in p.parts or '\x00' in name:raise ValueError('unsafe archive member')
 return str(p)
class Concat(io.RawIOBase):
 def __init__(self,files):
  self.files=files;self.offsets=[0];self.pos=0
  for f in files:f.seek(0,2);self.offsets.append(self.offsets[-1]+f.tell())
 def readable(self):return True
 def seekable(self):return True
 def tell(self):return self.pos
 def seek(self,n,whence=0):
  p=n if whence==0 else self.pos+n if whence==1 else self.offsets[-1]+n
  if p<0:raise ValueError('negative seek')
  self.pos=p;return p
 def read(self,n=-1):
  left=max(0,self.offsets[-1]-self.pos);left=left if n<0 else min(n,left);chunks=[]
  while left:
   i=bisect.bisect_right(self.offsets,self.pos)-1;f=self.files[i];f.seek(self.pos-self.offsets[i]);b=f.read(min(left,self.offsets[i+1]-self.pos))
   if not b:raise EOFError('short part')
   chunks.append(b);left-=len(b);self.pos+=len(b)
  return b''.join(chunks)

def member(name,src,size,cold,seen,expected=None):
 name=safe(name)
 if name in seen:raise ValueError('duplicate normalized member')
 seen.add(name);fd,tmp=tempfile.mkstemp(dir=cold,prefix='recovered-');p=Path(tmp)
 try:
  h=hashlib.sha256();n=0
  with os.fdopen(fd,'wb') as dst:
   while b:=src.read(CHUNK):dst.write(b);h.update(b);n+=len(b)
   dst.flush();os.fsync(dst.fileno())
  sha=hash_file(p)
  if n!=size or sha!=h.hexdigest():raise ValueError('physical restore mismatch')
  if expected and (n!=expected['bytes'] or sha!=expected['sha256']):raise ValueError('locked member mismatch: '+name)
  schema='opaque-bytes';integrity=None
  with p.open('rb') as f:header=f.read(16)
  if header==b'SQLite format 3\x00':
   schema='SQLite3';db=sqlite3.connect(p.as_uri()+'?mode=ro&immutable=1',uri=True)
   try:
    if db.execute('PRAGMA integrity_check').fetchall()!=[('ok',)]:raise ValueError('SQLite integrity failure')
    integrity='ok'
   finally:db.close()
  elif name.endswith('.json'):
   with p.open() as f:obj=json.load(f)
   schema=str(obj.get('schema',obj.get('schema_version','JSON'))) if isinstance(obj,dict) else 'JSON-array'
  elif name.endswith(('.ndjson','.jsonl')):schema='NDJSON'
  elif name.endswith(('.gz','.bz2')):schema='compressed-source'
  git_blob=None
  if '/objects/' in name and len(name.rsplit('/',1)[-1])==40:
   g=hashlib.sha1(b'blob '+str(n).encode()+b'\0')
   with p.open('rb') as f:
    while b:=f.read(CHUNK):g.update(b)
   if g.hexdigest()!=name.rsplit('/',1)[-1]:raise ValueError('historical Git blob bytes mismatch')
   git_blob=g.hexdigest()
  return dict(path=name,bytes=n,sha256=sha,schema=schema,sqlite_integrity=integrity,git_blob_sha1=git_blob,physical_restore=True)
 finally:p.unlink(missing_ok=True) # Only the exact temporary file created above.

def verify(plan,downloads,cold,output):
 downloads=Path(downloads).resolve();cold=Path(cold).resolve();output=Path(output).resolve()
 if any(p.is_relative_to(SOURCE_ROOT) for p in (downloads,cold,output)):raise ValueError('recovery inputs, temporary files and receipts must remain outside source checkout')
 if cold.exists():raise ValueError('fresh absent cold restore directory required')
 if cold.is_relative_to(downloads) or downloads.is_relative_to(cold):raise ValueError('restore/input overlap')
 cold.mkdir(parents=True);seen=set();parts=[];streams=[];holders=[];rows=[]
 try:
  for r in plan['parts']:
   p=downloads/safe(r['file'])
   if p.is_symlink() or not p.resolve().is_relative_to(downloads):raise ValueError('unsafe part path')
   sha=hash_file(p);n=p.stat().st_size
   if n!=r['bytes'] or sha!=r['sha256']:raise ValueError('archive part mismatch: '+r['file'])
   parts.append(dict(file=r['file'],bytes=n,sha256=sha,library_file_id=r.get('library_file_id')))
   if plan.get('wrapper')=='zip-single-chunk':
    z=zipfile.ZipFile(p);holders.append(z);files=[i for i in z.infolist() if not i.is_dir()]
    if len(files)!=1:raise ValueError('volume must hold one chunk')
    safe(files[0].filename);f=z.open(files[0]);n,h=hash_stream(f);f.seek(0)
    if h!=r['chunk_sha256']:raise ValueError('volume chunk mismatch')
    streams.append(f)
   else:streams.append(p.open('rb'))
  full=Concat(streams);n,sha=hash_stream(full);full.seek(0)
  if sha!=plan['sha256'] or n!=plan['bytes']:raise ValueError('whole archive mismatch')
  if plan['format']=='zip':
   with zipfile.ZipFile(full) as z:
    for i in z.infolist():
     safe(i.filename)
     if i.is_dir():continue
     if stat.S_ISLNK(i.external_attr>>16):raise ValueError('zip symlink')
     with z.open(i) as f:rows.append(member(i.filename,f,i.file_size,cold,seen,plan.get('expected_members',{}).get(i.filename)))
  else:
   with tarfile.open(fileobj=full,mode='r|*') as t:
    for i in t:
     safe(i.name)
     if i.isdir():continue
     if not i.isfile():raise ValueError('nonregular tar member')
     with t.extractfile(i) as f:rows.append(member(i.name,f,i.size,cold,seen,plan.get('expected_members',{}).get(i.name)))
  if not set(plan.get('expected_members',{}))<=seen:raise ValueError('locked members absent')
  result=dict(schema=SCHEMA,status='BYTES_AND_SEQUENTIAL_COLD_RESTORE_VERIFIED',archive=plan['name'],bytes=n,sha256=sha,parts=parts,members=rows,sqlite_databases=sum(x['schema']=='SQLite3' for x in rows),all_sqlite_integrity_ok=True,full_environment_restored_simultaneously=False,pipeline_replayed=False,production_writes=0)
  Path(output).parent.mkdir(parents=True,exist_ok=True);Path(output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');return result
 finally:
  for f in streams:f.close()
  for z in holders:z.close()
def main():
 p=argparse.ArgumentParser();p.add_argument('--plan',required=True);p.add_argument('--downloads',required=True);p.add_argument('--cold-root',required=True);p.add_argument('--output',required=True);a=p.parse_args();r=verify(json.loads(Path(a.plan).read_text()),a.downloads,a.cold_root,a.output);print(json.dumps(dict(archive=r['archive'],status=r['status'],members=len(r['members']),sqlite_databases=r['sqlite_databases'])))
if __name__=='__main__':main()
