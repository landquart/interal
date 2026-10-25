"""Shared serialization and exact v5 identity; no linguistic authority."""

# Installed writer boundary; isolated restored tools retain self-contained replay.
from pathlib import Path as _HistoryFencePath
import sys as _history_fence_sys
_history_fence_root=next((p for p in _HistoryFencePath(__file__).resolve().parents if (p/'associativvordes/mutation_guard.py').is_file()),None)
if _history_fence_root is not None:
    _history_fence_sys.path.insert(0,str(_history_fence_root))
    from associativvordes.mutation_guard import install as _install_history_fence
    _install_history_fence()
import hashlib,json,os,sqlite3,unicodedata
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
LANGS=('en','de','fr','es','it','ru')
SCHEMA='v5-research-adapter/1'
CATEGORIES={'STRUCTURAL_DEFECT','SURFACE_ONLY_FAMILY','MORPHOLOGY_CONFLICT','SENSE_IDENTITY_UNRESOLVED','ALLOMORPH_REVIEW','FAMILY_BOUNDARY_CONFLICT','HISTORY_CONFLICT','EVIDENCE_MISSING'}
def canonical(x):return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
def sha(x):return hashlib.sha256(x).hexdigest()
def hashes(p):
 p=Path(p);n=p.stat().st_size;h=hashlib.sha256();g=hashlib.sha1(b'blob '+str(n).encode()+b'\0')
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b);g.update(b)
 return dict(sha256=h.hexdigest(),git_blob=g.hexdigest(),bytes=n)
def filehash(p):return hashes(p)['sha256']
def read(p):return json.loads(Path(p).read_bytes())
def lookup(s):return unicodedata.normalize('NFC',s).casefold()
def bucket(s):
 h=2166136261
 for c in s:h=((h^ord(c))*16777619)&0xffffffff
 return f'{h%256:02x}'
def family_view(fid):return 'family:legacy-v5:'+sha(fid.encode())
def qid(fid,lang,lemma):return 'candidate:'+sha(canonical([family_view(fid),lang,lemma]))
def atomic(path,data):
 p=Path(path);p.parent.mkdir(parents=True,exist_ok=True);t=p.with_name(p.name+'.partial-'+str(os.getpid()))
 try:
  with t.open('wb') as f:f.write(data);f.flush();os.fsync(f.fileno())
  os.replace(t,p);fd=os.open(p.parent,os.O_RDONLY);os.fsync(fd);os.close(fd)
 finally:t.unlink(missing_ok=True)
def connect(p,ro=False):
 db=sqlite3.connect(Path(p).resolve().as_uri()+'?mode=ro',uri=True) if ro else sqlite3.connect(p)
 db.executescript('PRAGMA cache_size=-8192;PRAGMA temp_store=FILE;'+('PRAGMA query_only=ON;' if ro else 'PRAGMA synchronous=FULL;'))
 return db
