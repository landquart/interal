"""Immutable per-bucket research projections; transaction checkpoints per language."""
import argparse,fcntl,json,os,resource,subprocess,time,zlib
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from common import *
from stream import pairs
PREFIX='associativvordes/family-index-v5/'
def code_lock():return {p.name:filehash(p) for p in [Path(__file__),Path(__file__).with_name('common.py'),Path(__file__).with_name('stream.py')]}
def git_inventory(repo,commit):
 if len(commit)!=40 or any(c not in '0123456789abcdef' for c in commit):raise ValueError('exact commit required')
 rows=subprocess.check_output(['git','-C',str(repo),'ls-tree','-r',commit,'--',PREFIX],text=True)
 return {p[len(PREFIX):]:m.split()[2] for line in rows.splitlines() for m,p in [line.split('\t',1)]}
def paths(b):return [f'families/{b}.json.gz',f'aliases/{b}.json.gz',*[f'members/{l}/{b}.json.gz' for l in LANGS]]
def shard(task):
 source,out,b,expected,frozen,crash=task;source=Path(source);out=Path(out);started=time.monotonic()
 inputs=[]
 for p in paths(b):
  h=hashes(source/p)
  if h['git_blob']!=expected[p]:raise ValueError('source does not match pinned Git commit: '+p)
  inputs.append(dict(path=p,**h))
 identity=dict(schema=SCHEMA,bucket=b,files=inputs,code=code_lock())
 if identity['code']!=frozen:raise ValueError('code changed during run')
 key=sha(canonical(identity));receipt=out/'receipts'/f'{b}-{key}.json';dbfile=out/'shards'/f'{b}-{key}.sqlite'
 receipt.parent.mkdir(parents=True,exist_ok=True);dbfile.parent.mkdir(parents=True,exist_ok=True)
 with (out/f'.lock-{b}').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX)
  if receipt.exists():
   r=read(receipt)
   if r['identity']!=identity or filehash(dbfile)!=r['database_sha256']:raise ValueError('completed shard corruption')
   return dict(r,reused=True)
  partial=dbfile.with_suffix('.partial');db=connect(partial)
  db.executescript('''CREATE TABLE IF NOT EXISTS checkpoints(name TEXT PRIMARY KEY,n INTEGER);
   CREATE TABLE IF NOT EXISTS families(id TEXT PRIMARY KEY,body BLOB);
   CREATE TABLE IF NOT EXISTS aliases(alias TEXT PRIMARY KEY,body BLOB);
   CREATE TABLE IF NOT EXISTS members(family TEXT,language TEXT,lemma TEXT,word TEXT,ordinal INTEGER,body BLOB,
    PRIMARY KEY(family,language,lemma)) WITHOUT ROWID;''')
  def done(n):return db.execute('SELECT n FROM checkpoints WHERE name=?',(n,)).fetchone()
  processed=0
  try:
   for name in ['families','aliases']:
    if done(name):continue
    n=0
    with db:
     for identifier,body in pairs(source/name/f'{b}.json.gz'):
      if bucket(identifier)!=b:raise ValueError('record in wrong bucket: '+identifier)
      db.execute('INSERT INTO '+name+' VALUES(?,?)',(identifier,zlib.compress(canonical(body),1)));n+=1
     db.execute('INSERT INTO checkpoints VALUES(?,?)',(name,n))
   for lang in LANGS:
    if done(lang):continue
    n=0
    with db:
     for fid,rows in pairs(source/'members'/lang/f'{b}.json.gz'):
      if bucket(fid)!=b:raise ValueError('membership family in wrong bucket: '+fid)
      if not db.execute('SELECT 1 FROM families WHERE id=?',(fid,)).fetchone():raise ValueError('orphaned family '+fid)
      for ordinal,row in enumerate(rows):
       if not isinstance(row.get('lemma_id'),str) or not isinstance(row.get('word'),str):raise ValueError('malformed source row')
       db.execute('INSERT INTO members VALUES(?,?,?,?,?,?)',(fid,lang,row['lemma_id'],row['word'],ordinal,zlib.compress(canonical(row),1)))
       n+=1;processed+=1
       if crash and processed>=crash:os._exit(75)
     db.execute('INSERT INTO checkpoints VALUES(?,?)',(lang,n))
   if any(filehash(source/f['path'])!=f['sha256'] for f in inputs):raise ValueError('source changed during read')
   if db.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise ValueError('database integrity')
   counts=dict(db.execute('SELECT name,n FROM checkpoints'));db.close()
   with partial.open('rb') as f:os.fsync(f.fileno())
   os.replace(partial,dbfile)
   r=dict(identity=identity,database=str(dbfile.relative_to(out)),database_sha256=filehash(dbfile),counts=counts)
   atomic(receipt,canonical(r)+b'\n')
   return dict(r,reused=False,seconds=time.monotonic()-started,max_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
  except BaseException:db.close();raise

def build(source,out,commit,repo=ROOT,workers=1,buckets=None,crash=0):
 source=Path(source).resolve();out=Path(out).resolve();repo=Path(repo).resolve()
 if out.is_relative_to(repo) or out.is_relative_to(source) or source.is_relative_to(out):raise ValueError('separate external output required')
 if not 1<=workers<=8:raise ValueError('1..8 workers required')
 bs=sorted(buckets or [f'{i:02x}' for i in range(256)])
 if len(set(bs))!=len(bs) or any(b not in [f'{i:02x}' for i in range(256)] for b in bs):raise ValueError('bucket scope')
 expected=git_inventory(repo,commit);frozen=code_lock();out.mkdir(parents=True,exist_ok=True);start=time.monotonic()
 tasks=[(str(source),str(out),b,{p:expected[p] for p in paths(b)},frozen,crash) for b in bs];results=[]
 if workers==1:
  for task in tasks:
   r=shard(task);results.append(r);print(json.dumps(dict(bucket=task[2],reused=r['reused'])),flush=True)
 else:
  with ProcessPoolExecutor(max_workers=workers,max_tasks_per_child=1) as pool:
   for r in pool.map(shard,tasks):results.append(r);print(json.dumps(dict(bucket=r['identity']['bucket'],reused=r['reused'])),flush=True)
 totals=Counter()
 for r in results:totals.update(r['counts'])
 # Recheck all source dependencies before publishing a full manifest.
 for r in results:
  for f in r['identity']['files']:
   if filehash(source/f['path'])!=f['sha256']:raise ValueError('global source changed')
 if code_lock()!=frozen:raise ValueError('global code changed')
 m=dict(schema=SCHEMA,source_commit=commit,complete=len(bs)==256,source_root=str(source),
  shards=[{k:r[k] for k in ['identity','database','database_sha256','counts']} for r in results],counts=dict(totals),
  authoritative=False,linguistic_confirmation=False)
 m['version']=sha(canonical({k:v for k,v in m.items() if k!='source_root'}));atomic(out/'MANIFEST.json',canonical(m)+b'\n')
 bench=dict(seconds=time.monotonic()-start,reused=sum(r['reused'] for r in results),workers=workers,
  max_worker_rss_kib=max((r.get('max_rss_kib',0) for r in results),default=0),
  disk_bytes=sum((out/r['database']).stat().st_size for r in results),source_bytes=sum(f['bytes'] for r in results for f in r['identity']['files']))
 atomic(out/'BENCHMARK.json',canonical(bench)+b'\n');return dict(counts=m['counts'],version=m['version'],benchmark=bench)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--output',required=True);p.add_argument('--commit',required=True);p.add_argument('--repo',default=str(ROOT));p.add_argument('--workers',type=int,default=1);p.add_argument('--buckets',nargs='+');p.add_argument('--crash-after',type=int,default=0);a=p.parse_args()
 print(json.dumps(build(a.source,a.output,a.commit,a.repo,a.workers,a.buckets,a.crash_after),sort_keys=True))
