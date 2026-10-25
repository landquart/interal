#!/usr/bin/env python3
"""Whole-corpus diagnostics on disk, transactional bucket checkpoints and exact IDs."""

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
import uuid
import argparse,fcntl,gzip,hashlib,importlib.util,itertools,json,os,resource,sqlite3,subprocess,sys,time,zlib
from collections import Counter
from pathlib import Path
from associativvordes.v5_diagnostics.classify import POLICY,canonical,digest,member,family,rank,normal
ROOT=Path(__file__).resolve().parents[2]
pass
from associativvordes.v5_adapter.common import atomic,filehash,connect,read,sha
from associativvordes.v5_adapter.adapter import Adapter
from associativvordes.v5_adapter.bridge import history_reader
SCHEMA='v5-global-diagnostics/1'
pass
from associativvordes.research_integrity import code_lock as research_code_lock
def code_lock():return research_code_lock()|{'associativvordes/v5_diagnostics/policy.json':filehash(Path(__file__).with_name('policy.json'))}
def setup(db):
 db.executescript('''CREATE TABLE IF NOT EXISTS state(key TEXT PRIMARY KEY,value TEXT);
 CREATE TABLE IF NOT EXISTS checkpoints(bucket TEXT PRIMARY KEY,receipt TEXT);
 CREATE TABLE IF NOT EXISTS history(id TEXT PRIMARY KEY,family TEXT,language TEXT,outcome TEXT,authority TEXT,scope TEXT);
 CREATE INDEX IF NOT EXISTS history_family ON history(family);
 CREATE TABLE IF NOT EXISTS history_ids(family TEXT,language TEXT,lemma TEXT,decision TEXT,PRIMARY KEY(family,language,lemma,decision)) WITHOUT ROWID;
 CREATE TABLE IF NOT EXISTS families(id TEXT PRIMARY KEY,bucket TEXT,category TEXT,n INTEGER,languages INTEGER,base TEXT,fingerprint TEXT,body TEXT);
 CREATE TABLE IF NOT EXISTS members(family TEXT,language TEXT,lemma TEXT,ordinal INTEGER,types TEXT,flags TEXT,source_record_sha256 TEXT,PRIMARY KEY(family,language,lemma)) WITHOUT ROWID;
 CREATE TABLE IF NOT EXISTS alias_targets(alias TEXT,family TEXT,bucket TEXT,PRIMARY KEY(alias,family)) WITHOUT ROWID;
 CREATE TABLE IF NOT EXISTS flags(flag TEXT,family TEXT,PRIMARY KEY(flag,family)) WITHOUT ROWID;
 CREATE TABLE IF NOT EXISTS patterns(kind TEXT,key TEXT,body TEXT,PRIMARY KEY(kind,key)) WITHOUT ROWID;
 CREATE TABLE IF NOT EXISTS priority(family TEXT PRIMARY KEY,band TEXT,score INTEGER,body TEXT);
 ''')
def build_history(db,h):
 if db.execute("SELECT 1 FROM state WHERE key='history'").fetchone():return
 with db:
  for d in h.decisions:
   s=d['scope'];fid=s.get('family_id');lang=s.get('language');outcome=d.get('historical_outcome',d['decision'])
   db.execute('INSERT INTO history VALUES(?,?,?,?,?,?)',(d['id'],fid,lang,outcome,d['authority'],canonical(s).decode()))
   if s['domain']=='membership':
    db.executemany('INSERT INTO history_ids VALUES(?,?,?,?)',((fid,lang,lid,d['id']) for lid in sorted(h.ids(d))))
  db.execute('INSERT INTO state VALUES(?,?)',('history',h.digest))
def ingest(db,projection,receipt,crash=0):
 b=receipt['identity']['bucket'];source=connect(projection/receipt['database'],True)
 source_f=source.execute('SELECT id,body FROM families ORDER BY id');source_m=iter(source.execute('SELECT family,language,lemma,ordinal,body FROM members ORDER BY family,language,lemma'))
 current=next(source_m,None);famids=hashlib.sha256();memberids=hashlib.sha256();n=0;nf=0;negatives=0;unknown_types=0
 with db:
  for fid,packed in source_f:
   f=json.loads(zlib.decompress(packed));counts=Counter();types=Counter();sources=Counter();mf=Counter();ending_counts=Counter();prefixes=set();base=normal(f.get('canonical',''));fp=hashlib.sha256();rows=[]
   historical=list(db.execute('SELECT id FROM history WHERE family=? ORDER BY id',(fid,)));constraints=[x[0] for x in historical]
   finite={}
   if constraints:
    for lang,lid,did,outcome in db.execute('SELECT x.language,x.lemma,x.decision,h.outcome FROM history_ids x JOIN history h ON h.id=x.decision WHERE x.family=?',(fid,)):
     finite.setdefault((lang,lid),[]).append((did,outcome))
   while current is not None and current[0]==fid:
    _,lang,lid,ordinal,body=current;r=json.loads(zlib.decompress(body));view=member(r);counts[lang]+=1;types.update(view['types']);sources.update(view['sources']);flags=view['flags'][:]
    if any(o in {'EXCLUDE','REMOVE','CONFIRMED_NONMEMBER'} for _,o in finite.get((lang,lid),[])):flags.append('HISTORICAL_EXCLUSION_OVERLAP');negatives+=1
    mf.update(flags);unknown_types+=int(not view['types']);identity=canonical([fid,lang,lid]);memberids.update(identity+b'\n');fp.update(canonical([lang,lid])+b'\n')
    rows.append((fid,lang,lid,ordinal,canonical(view['types']).decode(),canonical(flags).decode(),sha(canonical(r))))
    if base and len(base)<=POLICY['ending_proxy']['max_base_length']:
     word=normal(r.get('search_form',r.get('normalized',r.get('word',''))))
     if word.endswith(base) and len(word)>len(base):ending_counts[lang]+=1;prefixes.add((lang,word[:-len(base)]))
    n+=1
    if crash and n>=crash:os._exit(75)
    if len(rows)>=1000:db.executemany('INSERT INTO members VALUES(?,?,?,?,?,?,?)',rows);rows=[]
    current=next(source_m,None)
   if rows:db.executemany('INSERT INTO members VALUES(?,?,?,?,?,?,?)',rows)
   total=sum(counts.values());ep=POLICY['ending_proxy'];ec=sum(ending_counts.values())
   ending=dict(ending_members=ec,distinct_language_prefixes=len(prefixes),language_counts=dict(sorted(ending_counts.items())),linguistic_relatedness='UNKNOWN') if total>=ep['min_members'] and len(prefixes)>=ep['min_distinct_prefixes'] and ec*100>=total*ep['min_percent'] else None
   data=family(f,counts,types,sources,mf,ending,constraints)
   db.execute('INSERT INTO families VALUES(?,?,?,?,?,?,?,?)',(fid,b,data['primary_category'],total,len(counts),base,fp.hexdigest(),canonical(data).decode()))
   db.executemany('INSERT INTO flags VALUES(?,?)',((flag,fid) for flag in data['flags']))
   famids.update(canonical(fid)+b'\n');nf+=1
  if current is not None:raise ValueError('orphan membership')
  aliases=0
  for alias,body in source.execute('SELECT alias,body FROM aliases ORDER BY alias'):
   targets=json.loads(zlib.decompress(body));db.executemany('INSERT INTO alias_targets VALUES(?,?,?)',((alias,fid,b) for fid in targets));aliases+=1
  record=dict(bucket=b,families=nf,memberships=n,aliases=aliases,family_ids_sha256=famids.hexdigest(),membership_ids_sha256=memberids.hexdigest(),unknown_relation_memberships=unknown_types,historical_exclusion_overlap=negatives,projection_database_sha256=receipt['database_sha256'])
  db.execute('INSERT INTO checkpoints VALUES(?,?)',(b,canonical(record).decode()))
 source.close();return record

def cross_family(db):
 if db.execute("SELECT 1 FROM state WHERE key='cross'").fetchone():return
 # Re-entrant stage: a crash rolls back all global flags/patterns, leaving bucket checkpoints intact.
 db.execute('CREATE INDEX IF NOT EXISTS member_identity ON members(language,lemma,family)')
 db.execute('CREATE INDEX IF NOT EXISTS family_fingerprint ON families(fingerprint,n)')
 db.execute('CREATE INDEX IF NOT EXISTS alias_family ON alias_targets(family)')
 with db:
  for fp,n in db.execute('SELECT fingerprint,n FROM families WHERE n>0 GROUP BY fingerprint,n HAVING COUNT(*)>1 ORDER BY fingerprint,n'):
   ids=[x[0] for x in db.execute('SELECT id FROM families WHERE fingerprint=? AND n=? ORDER BY id',(fp,n))]
   # Check actual finite sets too: equal digests alone do not declare duplicate sets.
   first=ids[0]
   for other in ids[1:]:
    sql='SELECT language,lemma FROM members WHERE family=? EXCEPT SELECT language,lemma FROM members WHERE family=? LIMIT 1'
    if db.execute(sql,(first,other)).fetchone() or db.execute(sql,(other,first)).fetchone():raise ValueError('fingerprint collision')
   p=dict(family_ids=ids,members_per_family=n,membership_edges=len(ids)*n,unique_source_lexemes=n,equality_scope='exact legacy language+lemma IDs; not sense or meaning equality')
   db.execute('INSERT INTO patterns VALUES(?,?,?)',('EXACT_DUPLICATE_MEMBER_SET',fp,canonical(p).decode()));db.executemany('INSERT OR IGNORE INTO flags VALUES(?,?)',(('EXACT_DUPLICATE_MEMBER_SET',fid) for fid in ids))
  for lang,lid in db.execute('SELECT language,lemma FROM members GROUP BY language,lemma HAVING COUNT(*)>1 ORDER BY language,lemma'):
   ids=[x[0] for x in db.execute('SELECT family FROM members WHERE language=? AND lemma=? ORDER BY family',(lang,lid))]
   p=dict(language=lang,lemma_id=lid,family_ids=ids,membership_edges=len(ids),sense_identity='UNRESOLVED',mechanism='shared legacy lexical row, not proven homonym transit')
   db.execute('INSERT INTO patterns VALUES(?,?,?)',('SHARED_LEGACY_IDENTITY',lang+':'+lid,canonical(p).decode()));db.executemany('INSERT OR IGNORE INTO flags VALUES(?,?)',(('SHARED_LEGACY_IDENTITY',fid) for fid in ids))
  for alias in (x[0] for x in db.execute('SELECT alias FROM alias_targets GROUP BY alias HAVING COUNT(*)>1 ORDER BY alias')):
   ids=[x[0] for x in db.execute('SELECT family FROM alias_targets WHERE alias=? ORDER BY family',(alias,))]
   p=dict(alias=alias,family_ids=ids,targets=len(ids),equivalence_established=False)
   db.execute('INSERT INTO patterns VALUES(?,?,?)',('ALIAS_FANOUT',alias,canonical(p).decode()));db.executemany('INSERT OR IGNORE INTO flags VALUES(?,?)',(('ALIAS_FANOUT',fid) for fid in ids))
  if db.execute('SELECT 1 FROM alias_targets a LEFT JOIN families f ON a.family=f.id WHERE f.id IS NULL LIMIT 1').fetchone():raise ValueError('orphan alias target')
  for fid,body in db.execute('SELECT id,body FROM families ORDER BY id'):
   f=json.loads(body);flags=[x[0] for x in db.execute('SELECT flag FROM flags WHERE family=? ORDER BY flag',(fid,))];rating=rank(f,flags)
   db.execute('INSERT INTO priority VALUES(?,?,?,?)',(fid,rating['band'],rating['score'],canonical(rating).decode()))
  db.execute('INSERT INTO state VALUES(?,?)',('cross','complete'))

def row_hash(db,table,columns,order):
 h=hashlib.sha256();n=0
 for row in db.execute(f'SELECT {columns} FROM {table} ORDER BY {order}'):
  h.update(canonical(list(row))+b'\n');n+=1
 return dict(rows=n,sha256=h.hexdigest())
def summarize(db,identity):
 counts=dict(families=db.execute('SELECT COUNT(*) FROM families').fetchone()[0],memberships=db.execute('SELECT COUNT(*) FROM members').fetchone()[0],aliases=db.execute('SELECT COUNT(DISTINCT alias) FROM alias_targets').fetchone()[0])
 categories={c:dict(families=0,memberships=0) for c in POLICY['categories']}
 for c,n,m in db.execute('SELECT category,COUNT(*),SUM(n) FROM families GROUP BY category'):categories[c]=dict(families=n,memberships=m)
 flags={}
 for flag,n,m in db.execute('SELECT x.flag,COUNT(*),SUM(f.n) FROM flags x JOIN families f ON f.id=x.family GROUP BY x.flag ORDER BY x.flag'):flags[flag]=dict(families=n,memberships_in_affected_families=m)
 risks={b:dict(families=n,memberships=m) for b,n,m in db.execute('SELECT p.band,COUNT(*),SUM(f.n) FROM priority p JOIN families f ON f.id=p.family GROUP BY p.band ORDER BY p.band')}
 direct={k:dict(groups=n,membership_edges=m) for k,n,m in db.execute("SELECT kind,COUNT(*),SUM(CASE WHEN kind='EXACT_DUPLICATE_MEMBER_SET' OR kind='SHARED_LEGACY_IDENTITY' THEN json_extract(body,'$.membership_edges') ELSE 0 END) FROM patterns GROUP BY kind ORDER BY kind")}
 # Exact union prevents adding overlapping pattern/flag counts.
 problem_flags=['ENDING_PREFIX_DIVERSITY_PROXY','SURFACE_ONLY_LINK_CLAIM','MIXED_DERIVATION_INFLECTION_CLAIMS','ALLOMORPH_SCOPE_UNVERIFIED','EXACT_DUPLICATE_MEMBER_SET','ALIAS_FANOUT','LARGE_FAMILY','HISTORICAL_EXCLUSION_OVERLAP']
 params=','.join('?' for _ in problem_flags)
 union=db.execute(f'SELECT COUNT(*),COALESCE(SUM(n),0) FROM families WHERE id IN (SELECT family FROM flags WHERE flag IN ({params}))',problem_flags).fetchone()
 return dict(schema=SCHEMA,identity=identity,counts=counts,categories=categories,flags=flags,risk_distribution=risks,cross_family_patterns=direct,
  selected_signal_union=dict(flags=problem_flags,families=union[0],memberships_in_affected_families=union[1]),
  languages=dict(db.execute('SELECT language,COUNT(*) FROM members GROUP BY language ORDER BY language')),
  observed_relation_types=dict(db.execute("SELECT value,COUNT(*) FROM members,json_each(types) GROUP BY value ORDER BY value")),
  history=dict(decisions=db.execute('SELECT COUNT(*) FROM history').fetchone()[0],finite_scoped_ids=db.execute('SELECT COUNT(*) FROM history_ids').fetchone()[0],current_matching_edges=db.execute('SELECT COUNT(*) FROM members m WHERE EXISTS(SELECT 1 FROM history_ids h WHERE h.family=m.family AND h.language=m.language AND h.lemma=m.lemma)').fetchone()[0],unmapped_observations='Global coverage hold retained from history registry'),
  semantic=dict(confirmed_memberships=0,confirmed_lexical_identities=0,confirmed_correspondences=0,unresolved_memberships=counts['memberships'],conflicting_semantic_memberships=None,unknown_is_not_nonmember=True),
  production_writes=0,linguistic_certification=False)
def publish(db,out,identity):
 summary=summarize(db,identity);atomic(out/'SUMMARY.json',canonical(summary)+b'\n')
 receipts=[json.loads(r[0]) for r in db.execute('SELECT receipt FROM checkpoints ORDER BY bucket')]
 expected=identity['expected_counts'];actual=summary['counts']
 if actual['families']!=expected['families'] or actual['memberships']!=sum(expected[l] for l in ('en','de','es','fr','it','ru')) or actual['aliases']!=expected['aliases']:raise ValueError('baseline coverage mismatch')
 # Compare exact input/output ID streams per bucket, not only totals.
 for r in receipts:
  b=r['bucket'];hf=hashlib.sha256();hm=hashlib.sha256()
  for row in db.execute('SELECT id FROM families WHERE bucket=? ORDER BY id',(b,)):hf.update(canonical(row[0])+b'\n')
  for row in db.execute('SELECT m.family,m.language,m.lemma FROM members m JOIN families f ON f.id=m.family WHERE f.bucket=? ORDER BY m.family,m.language,m.lemma',(b,)):hm.update(canonical(list(row))+b'\n')
  if hf.hexdigest()!=r['family_ids_sha256'] or hm.hexdigest()!=r['membership_ids_sha256']:raise ValueError('ID coverage mismatch')
 logical={}
 for t,cols,order in [('families','*','id'),('members','*','family,language,lemma'),('flags','*','flag,family'),('patterns','*','kind,key'),('priority','*','family'),('alias_targets','*','alias,family'),('history','*','id'),('history_ids','*','family,language,lemma,decision')]:logical[t]=row_hash(db,t,cols,order)
 coverage=dict(schema='v5-diagnostic-coverage/1',status='PASS',counts=actual,each_family_one_primary_category=sum(v['families'] for v in summary['categories'].values())==actual['families'],each_membership_classified_or_explicitly_unknown=True,exact_id_stream_comparison=True,buckets=receipts,logical_tables=logical,overlapping_flags_not_additive=True,production_writes=0)
 atomic(out/'COVERAGE.json',canonical(coverage)+b'\n')
 manifest=dict(schema=SCHEMA,complete=True,identity=identity,execution=json.loads(db.execute("SELECT value FROM state WHERE key='execution'").fetchone()[0]),outputs={n:filehash(out/n) for n in ['SUMMARY.json','COVERAGE.json']},database='registry.sqlite',database_sha256=filehash(out/'registry.sqlite'),logical_tables=logical,authoritative=False)
 manifest['version']=digest(manifest);atomic(out/'MANIFEST.json',canonical(manifest)+b'\n');return summary

def run(projection,out,crash=0):
 start=time.monotonic();projection=Path(projection).resolve();out=Path(out).resolve()
 if out.is_relative_to(ROOT) or out==projection or out.is_relative_to(projection):raise ValueError('separate external output required')
 out.mkdir(parents=True,exist_ok=True);frozen=code_lock()
 with (out/'LOCK').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  adapter=Adapter(projection);m=adapter.manifest;adapter.close()
  if not m['complete'] or len(m['shards'])!=256:raise ValueError('full certified projection required')
  h,history_sha=history_reader();identity=dict(projection_version=m['version'],projection_manifest_sha256=filehash(projection/'MANIFEST.json'),source_commit=m['source_commit'],history_snapshot_sha256=history_sha,code=frozen,expected_counts=m['counts'])
  db=connect(out/'registry.sqlite');setup(db)
  instance=db.execute("SELECT value FROM state WHERE key='execution'").fetchone()
  if instance:
   execution=json.loads(instance[0])
   if execution['output']!=str(out):raise ValueError('copied execution is not a fresh run')
  else:
   if db.execute('SELECT 1 FROM checkpoints LIMIT 1').fetchone():raise ValueError('legacy checkpoints lack execution provenance; fresh output required')
   execution=dict(run_id=str(uuid.uuid4()),output=str(out))
   with db:db.execute('INSERT INTO state VALUES(?,?)',('execution',canonical(execution).decode()))
  prior=db.execute("SELECT value FROM state WHERE key='identity'").fetchone()
  if prior and json.loads(prior[0])!=identity:raise ValueError('dependency change requires fresh output')
  with db:db.execute('INSERT OR IGNORE INTO state VALUES(?,?)',('identity',canonical(identity).decode()))
  build_history(db,h);del h
  db.execute('CREATE INDEX IF NOT EXISTS flag_family ON flags(family,flag)')
  db.execute('CREATE INDEX IF NOT EXISTS families_bucket ON families(bucket,id)')
  for receipt in m['shards']:
   b=receipt['identity']['bucket']
   if db.execute('SELECT 1 FROM checkpoints WHERE bucket=?',(b,)).fetchone():continue
   r=ingest(db,projection,receipt,crash);print(json.dumps(dict(bucket=b,families=r['families'],memberships=r['memberships'])),flush=True)
  cross_family(db)
  for r in m['shards']:
   if filehash(projection/r['database'])!=r['database_sha256']:raise ValueError('projection changed during diagnostics')
   for f in r['identity']['files']:
    if filehash(Path(m['source_root'])/f['path'])!=f['sha256']:raise ValueError('production source changed')
  if code_lock()!=frozen:raise ValueError('diagnostic code changed during run')
  if db.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise ValueError('diagnostic registry corruption')
  result=publish(db,out,identity);db.close()
  benchmark=dict(seconds=time.monotonic()-start,max_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,disk_bytes=sum(p.stat().st_size for p in out.iterdir() if p.is_file()),memory_policy='one source family at a time; SQLite 8 MiB cache; disk sorts',production_writes=0)
  atomic(out/'RESOURCE-BENCHMARK.json',canonical(benchmark)+b'\n');return dict(counts=result['counts'],benchmark=benchmark)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--adapter',required=True);p.add_argument('--output',required=True);p.add_argument('--crash-after',type=int,default=0);a=p.parse_args();print(json.dumps(run(a.adapter,a.output,a.crash_after)))
