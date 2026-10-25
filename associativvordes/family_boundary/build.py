"""Reindex certified diagnostic rows without treating legacy memberships as gold."""
import argparse,fcntl,gzip,json,resource,time
from pathlib import Path
from .core import *

def build(prior,output,stop_after=None):
 out=Path(output).resolve();prior=Path(prior).resolve()
 if out.is_relative_to(ROOT) or out==prior:raise ValueError('separate research directory required')
 out.mkdir(parents=True,exist_ok=True);start=time.monotonic()
 with (out/'LOCK').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  from associativvordes.v5_contract.versions import require_directory
  versioned=require_directory(prior,'diagnostics')
  p=read(prior/'MANIFEST.json');pinned=p
  if p['version']!=pinned['version'] or p['database_sha256']!=pinned['database_sha256'] or sha(prior/p['database'])!=pinned['database_sha256']:raise ValueError('uncertified structural source index')
  sourcefiles=verify_sources();db=dbopen(out/'index.sqlite')
  db.executescript('''CREATE TABLE IF NOT EXISTS state(k TEXT PRIMARY KEY,v TEXT);
  CREATE TABLE IF NOT EXISTS source_families(fid TEXT PRIMARY KEY,bucket TEXT,meta TEXT);
  CREATE TABLE IF NOT EXISTS families(f INTEGER PRIMARY KEY,fid TEXT UNIQUE,bucket TEXT,n INTEGER,langs TEXT,ids_hash TEXT,meta TEXT);
  CREATE TABLE IF NOT EXISTS members(f INTEGER,lang TEXT,lid TEXT,ordinal INTEGER,record_hash TEXT,PRIMARY KEY(f,lang,lid)) WITHOUT ROWID;
  CREATE TABLE IF NOT EXISTS refs(kind TEXT,key TEXT,f INTEGER,PRIMARY KEY(kind,key,f)) WITHOUT ROWID;
  CREATE TABLE IF NOT EXISTS aliases(alias TEXT,fid TEXT,PRIMARY KEY(alias,fid)) WITHOUT ROWID;
  CREATE TABLE IF NOT EXISTS declared_aliases(alias TEXT,fid TEXT,PRIMARY KEY(alias,fid)) WITHOUT ROWID;''')
  identity=dict(schema='boundary-source-index/2',baseline_sha256=sha(ROOT/'audit/associative-v5-structural-cleanup/BEFORE-MANIFEST.json'),version_contract=versioned['version_contract'],certified_diagnostic_version=pinned['version'],certified_diagnostic_database_sha256=pinned['database_sha256'],code={name:sha(Path(__file__).with_name(name)) for name in ['core.py','build.py']})
  existing=db.execute("SELECT v FROM state WHERE k='identity'").fetchone()
  if existing and json.loads(existing[0])!=identity:raise ValueError('source/code checkpoint mismatch')
  with db:db.execute('INSERT OR IGNORE INTO state VALUES(?,?)',('identity',canonical(identity).decode()))
  new=0;root=ROOT/'associativvordes/family-index-v5'
  for b in range(256):
   key='metadata:'+f'{b:02x}'
   if db.execute('SELECT 1 FROM state WHERE k=?',(key,)).fetchone():continue
   def metadata():
    families=json.load(gzip.open(root/'families'/f'{b:02x}.json.gz'))
    for fid,raw in families.items():
     meta=dict(raw,id=fid,target_meaning_status='UNKNOWN_NOT_BOUND',normative_root_id=None,legacy_labels_are_not_gold=True,source_record_sha256=digest(raw),source_path=f'associativvordes/family-index-v5/families/{b:02x}.json.gz')
     db.execute('INSERT INTO source_families VALUES(?,?,?)',(fid,f'{b:02x}',canonical(meta).decode()))
     db.executemany('INSERT INTO declared_aliases VALUES(?,?)',((a,fid) for a in sorted(set(raw.get('aliases',[])))))
   checkpoint(db,key,metadata);new+=1
   if stop_after and new>=stop_after:db.close();return dict(status='PAUSED_AFTER_ATOMIC_BUCKET',new_buckets=new)
  db.execute('ATTACH DATABASE ? AS prior',(str(prior/p['database']),))
  def families():
   db.execute("INSERT INTO families SELECT ROW_NUMBER() OVER (ORDER BY p.id),p.id,s.bucket,p.n,json_extract(p.body,'$.language_counts'),p.fingerprint,s.meta FROM prior.families p JOIN source_families s ON s.fid=p.id ORDER BY p.id")
   for f,meta in db.execute('SELECT f,meta FROM families ORDER BY f'):
    m=json.loads(meta);db.executemany('INSERT INTO refs VALUES(?,?,?)',(('ETYMON',k,f) for k in sorted(set(m.get('etymon_keys',[])))))
   db.execute('CREATE INDEX family_bucket ON families(bucket,fid)')
  checkpoint(db,'families',families)
  checkpoint(db,'drop_staging',lambda:db.execute('DROP TABLE IF EXISTS source_families'))
  for b in range(256):
   def members():db.execute('INSERT INTO members SELECT f.f,p.language,p.lemma,p.ordinal,p.source_record_sha256 FROM families f JOIN prior.members p ON p.family=f.fid WHERE f.bucket=?',(f'{b:02x}',))
   checkpoint(db,'members:'+f'{b:02x}',members)
   if b%32==31:print('member buckets',b+1,flush=True)
  checkpoint(db,'aliases',lambda:db.execute('INSERT INTO aliases SELECT alias,family FROM prior.alias_targets'))
  # Preserve every historical finite restriction and its original family/POS/sense scope.
  db.executescript('CREATE TABLE IF NOT EXISTS history(id TEXT PRIMARY KEY,fid TEXT,body TEXT);CREATE INDEX IF NOT EXISTS history_family ON history(fid);CREATE TABLE IF NOT EXISTS history_ids(decision TEXT,lang TEXT,lid TEXT,PRIMARY KEY(decision,lang,lid)) WITHOUT ROWID;')
  def history():
   hroot=ROOT/'audit/associative-history-registry';current=read(hroot/'CURRENT.json');snapshot=read(hroot/current['snapshot'])
   if sha(hroot/current['snapshot'])!=current['sha256'] or current['sha256']!=pinned['identity']['history_snapshot_sha256']:raise ValueError('history version mismatch')
   for d in snapshot['decisions']:db.execute('INSERT INTO history VALUES(?,?,?)',(d['id'],d['scope'].get('family_id'),canonical(d).decode()))
   db.execute('INSERT INTO history_ids SELECT decision,language,lemma FROM prior.history_ids')
  checkpoint(db,'history',history)
  db.executescript('CREATE INDEX IF NOT EXISTS member_identity ON members(lang,lid,f);CREATE INDEX IF NOT EXISTS family_fingerprint ON families(ids_hash,n);CREATE INDEX IF NOT EXISTS alias_family ON aliases(fid,alias);')
  if db.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise ValueError('index integrity')
  counts=dict(families=db.execute('SELECT COUNT(*) FROM families').fetchone()[0],memberships=db.execute('SELECT COUNT(*) FROM members').fetchone()[0],aliases=db.execute('SELECT COUNT(DISTINCT alias) FROM aliases').fetchone()[0])
  if counts!=dict(families=2456543,memberships=10078319,aliases=1934050):raise ValueError('baseline full census mismatch')
  verify_sources();db.close();m=dict(schema='boundary-source-index/2',identity=identity,counts=counts,production_files=sourcefiles,semantic_gold=False,production_writes=0);m['version']=digest(m);save(out/'INDEX-MANIFEST.json',m)
  save(out/'INDEX-RESOURCE.json',dict(elapsed_seconds=round(time.monotonic()-start,3),peak_rss_mib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024,database_bytes=(out/'index.sqlite').stat().st_size));return counts
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--prior',required=True);p.add_argument('--output',required=True);p.add_argument('--stop-after',type=int);a=p.parse_args();print(json.dumps(build(a.prior,a.output,a.stop_after)))
