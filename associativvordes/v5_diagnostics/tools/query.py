#!/usr/bin/env python3
"""Read-only, streaming recovery of full affected sets from the immutable registry."""

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
import argparse,hashlib,json,sqlite3,sys
from pathlib import Path
pass
from associativvordes.v5_diagnostics.classify import canonical
ROOT=Path(__file__).resolve().parents[3]
def filehash(p):
 h=hashlib.sha256()
 with Path(p).open('rb') as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()
def open_registry(folder):
 folder=Path(folder);m=json.loads((folder/'MANIFEST.json').read_bytes());db=folder/m['database']
 expected=hashlib.sha256(canonical({k:v for k,v in m.items() if k!='version'})).hexdigest()
 if m['version']!=expected or not m['complete'] or filehash(db)!=m['database_sha256']:raise ValueError('immutable diagnostic input checksum')
 for name,h in m.get('outputs',{}).items():
  p=(folder/name).resolve()
  if p.parent!=folder.resolve() or filehash(p)!=h:raise ValueError('immutable diagnostic output checksum')
 c=sqlite3.connect(db.resolve().as_uri()+'?mode=ro',uri=True);c.executescript('PRAGMA query_only=ON;PRAGMA cache_size=-8192;PRAGMA temp_store=FILE;');return c,m

def query(db,family=None,flag=None,category=None,band=None,pattern=None,members=False,cohort=None):
 where=[];args=[]
 for col,val in [('f.id',family),('f.category',category),('p.band',band)]:
  if val is not None:where.append(col+'=?');args.append(val)
 if flag:where.append('EXISTS(SELECT 1 FROM flags x WHERE x.family=f.id AND x.flag=?)');args.append(flag)
 if cohort:
  where.extend(["f.category=?","json_extract(f.body,'$.formation_source') IS ?","COALESCE((SELECT group_concat(key,',') FROM json_each(f.body,'$.relation_type_counts')),'')=?","(CASE WHEN length(f.base)<=3 THEN 'SHORT' ELSE 'LONG' END)=?"]);args.extend([cohort['category'],cohort['formation_source'],cohort['observed_type_signature'],cohort['base_bin']])
 if pattern:
  kind,key=pattern
  row=db.execute('SELECT body FROM patterns WHERE kind=? AND key=?',(kind,key)).fetchone()
  if row is None:raise ValueError('unknown pattern key')
  ids=json.loads(row[0])['family_ids'];where.append('f.id IN (SELECT value FROM json_each(?))');args.append(json.dumps(ids))
 sql='SELECT f.id,f.bucket,f.body,p.body FROM families f JOIN priority p ON p.family=f.id'+(' WHERE '+' AND '.join(where) if where else '')+' ORDER BY f.id'
 for fid,b,body,rating in db.execute(sql,args):
  f=json.loads(body);f['flags']=[r[0] for r in db.execute('SELECT flag FROM flags WHERE family=? ORDER BY flag',(fid,))];f['investigation_priority']=json.loads(rating)
  f['history_constraints']=[dict(id=r[0],outcome=r[1],authority=r[2],scope=json.loads(r[3])) for r in db.execute('SELECT id,outcome,authority,scope FROM history WHERE family=? ORDER BY id',(fid,))]
  yield dict(record_type='family',**f)
  if members:
   for lang,lid,ordinal,types,flags,recordsha in db.execute('SELECT language,lemma,ordinal,types,flags,source_record_sha256 FROM members WHERE family=? ORDER BY language,lemma',(fid,)):
    yield dict(record_type='membership',family_id=fid,language=lang,lemma_id=lid,ordinal=ordinal,source_bucket=b,source_record_sha256=recordsha,relation_types=json.loads(types),risk_flags=json.loads(flags),semantic_status='UNRESOLVED',lexical_identity_status='legacy_exact_record',sense_status='UNRESOLVED',correspondence_status='UNKNOWN_NOT_EVALUATED')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--registry',required=True);p.add_argument('--family');p.add_argument('--flag');p.add_argument('--category');p.add_argument('--band');p.add_argument('--pattern',nargs=2);p.add_argument('--members',action='store_true');p.add_argument('--cohort');a=p.parse_args();db,_=open_registry(a.registry)
 cohort=None
 if a.cohort:
  folder=Path(a.registry);artifacts=json.loads((folder/'ARTIFACTS.json').read_bytes())
  if filehash(folder/'MECHANISM-COHORTS.json')!=artifacts['outputs']['MECHANISM-COHORTS.json']['sha256']:raise ValueError('cohort manifest checksum')
  cohort=next(x['scope'] for x in json.loads((folder/'MECHANISM-COHORTS.json').read_bytes())['cohorts'] if x['id']==a.cohort)
 try:
  for row in query(db,a.family,a.flag,a.category,a.band,a.pattern,a.members,cohort):print(canonical(row).decode())
 finally:db.close()
