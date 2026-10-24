"""Boundary research primitives; exact IDs, disk access and read-only source pins."""
import gzip,hashlib,json,os,sqlite3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
LANGS=('en','de','fr','es','it','ru')
STATUSES={'DUPLICATE_FAMILY_CANDIDATE','FALSE_MERGE_CANDIDATE','SPLIT_FAMILY_CANDIDATE','WRONG_FAMILY_ASSIGNMENT','ALIAS_COLLISION','OVERLAP_VALID','INSUFFICIENT_EVIDENCE'}
def canonical(x):return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
def digest(x):return hashlib.sha256(canonical(x)).hexdigest()
def sha(path):
 h=hashlib.sha256()
 with Path(path).open('rb') as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()
def read(p):return json.loads(Path(p).read_bytes())
def atomic(p,data):
 p=Path(p);p.parent.mkdir(parents=True,exist_ok=True);tmp=p.with_name(p.name+'.partial')
 with tmp.open('wb') as f:f.write(data);f.flush();os.fsync(f.fileno())
 os.replace(tmp,p)
def save(p,x):atomic(p,canonical(x)+b'\n')
def dbopen(path,ro=False):
 p=Path(path).resolve();d=sqlite3.connect(p.as_uri()+'?mode=ro',uri=True) if ro else sqlite3.connect(p)
 d.executescript('PRAGMA cache_size=-32768;PRAGMA temp_store=FILE;'+('PRAGMA query_only=ON;' if ro else 'PRAGMA synchronous=FULL;'));return d
def group_id(ids):
 if not ids or len(ids)!=len(set(ids)):raise ValueError('exact finite family IDs required')
 return 'boundary:'+digest(sorted(ids))
def fp(tokens):
 h=hashlib.sha256()
 for row in sorted(tokens):h.update(canonical(list(row))+b'\n')
 return h.hexdigest()
def stream(path,rows):
 path=Path(path);tmp=path.with_name(path.name+'.partial');n=0
 with tmp.open('wb') as raw,gzip.GzipFile(fileobj=raw,mode='wb',mtime=0,filename='',compresslevel=6) as z:
  for row in rows:z.write(canonical(row)+b'\n');n+=1
 os.replace(tmp,path);return dict(path=path.name,rows=n,bytes=path.stat().st_size,sha256=sha(path))
def source_lock():return read(ROOT/'audit/associative-v5-structural-cleanup/BEFORE-MANIFEST.json')
def verify_sources():
 pins=[x for x in source_lock()['files'] if x['path'].startswith('current/')]
 for x in pins:
  p=ROOT/x['path'][8:]
  if p.stat().st_size!=x['bytes'] or sha(p)!=x['sha256']:raise ValueError('production input checksum: '+str(p))
 return len(pins)
def checkpoint(db,key,work):
 if db.execute('SELECT 1 FROM state WHERE k=?',(key,)).fetchone():return
 with db:work();db.execute('INSERT INTO state VALUES(?,?)',(key,'complete'))
