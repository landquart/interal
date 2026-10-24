"""Complete disk overlap graph and finite detection cohorts; no family union API."""
import argparse,fcntl,resource,time
from collections import Counter
from .core import *

def install(d):
 d.executescript('''CREATE TABLE IF NOT EXISTS overlaps(a INTEGER,b INTEGER,n INTEGER,PRIMARY KEY(a,b)) WITHOUT ROWID;
 CREATE TABLE IF NOT EXISTS groups(id TEXT PRIMARY KEY,ids TEXT);
 CREATE TABLE IF NOT EXISTS group_families(g TEXT,f INTEGER,PRIMARY KEY(g,f)) WITHOUT ROWID;
 CREATE INDEX IF NOT EXISTS grouped_family ON group_families(f,g);
 CREATE TABLE IF NOT EXISTS signals(g TEXT,kind TEXT,key TEXT,PRIMARY KEY(g,kind,key)) WITHOUT ROWID;
 CREATE TABLE IF NOT EXISTS profiles(f INTEGER PRIMARY KEY,body TEXT);
 CREATE TABLE IF NOT EXISTS v6_heads(id TEXT PRIMARY KEY,kind TEXT,body TEXT);
 CREATE TABLE IF NOT EXISTS v6_edges(id INTEGER PRIMARY KEY,head TEXT,target_family TEXT,status TEXT,body TEXT);
 CREATE INDEX IF NOT EXISTS v6_edge_head ON v6_edges(head);
 CREATE TABLE IF NOT EXISTS v6_links(id TEXT PRIMARY KEY,f INTEGER,head TEXT,target_family TEXT,status TEXT,body TEXT);
 CREATE INDEX IF NOT EXISTS v6_source_family ON v6_links(f,status,head);
 CREATE TABLE IF NOT EXISTS v6_catalog(id TEXT PRIMARY KEY,body TEXT);''')
def cohort(d,numbers,kind,key):
 numbers=sorted(set(numbers));ids=[d.execute('SELECT fid FROM families WHERE f=?',(n,)).fetchone()[0] for n in numbers];g=group_id(ids)
 d.execute('INSERT OR IGNORE INTO groups VALUES(?,?)',(g,canonical(sorted(ids)).decode()));d.executemany('INSERT OR IGNORE INTO group_families VALUES(?,?)',((g,n) for n in numbers));d.execute('INSERT OR IGNORE INTO signals VALUES(?,?,?)',(g,kind,str(key)))
def run(index,prior,v6,stop_after_phase=None):
 out=Path(index).resolve();prior=Path(prior).resolve();v6=Path(v6).resolve();start=time.monotonic()
 with (out/'LOCK').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);m=read(out/'INDEX-MANIFEST.json');policy=read(Path(__file__).with_name('policy.json'));proof=read(v6/'PROOF-CHECKS-MANIFEST.json')
  if proof['baseline_sha256']!=m['identity']['baseline_sha256'] or proof['checks_sha256']!=sha(v6/'SOURCE-PROOF-CHECKS.ndjson') or proof['v6_memberships_sha256']!=sha(v6/'generated/memberships.json.gz'):raise ValueError('stale finite v6 proofs')
  vl=read(v6/'SOURCE-LOCK.json')
  for x in vl['files']:
   if sha(v6/x['path'])!=x['sha256']:raise ValueError('pinned v6 source changed')
  identity=dict(index_version=m['version'],code={n:sha(Path(__file__).with_name(n)) for n in ['analyze.py','guard.py','core.py']},policy_sha256=sha(Path(__file__).with_name('policy.json')),v6_source_lock_sha256=sha(v6/'SOURCE-LOCK.json'),v6_proof_checks_sha256=sha(v6/'PROOF-CHECKS-MANIFEST.json'))
  d=dbopen(out/'index.sqlite');install(d);old=d.execute("SELECT v FROM state WHERE k='analysis_identity'").fetchone()
  if old and json.loads(old[0])!=identity:raise ValueError('analysis code/source checkpoint mismatch')
  with d:d.execute('INSERT OR IGNORE INTO state VALUES(?,?)',('analysis_identity',canonical(identity).decode()))
  checkpoint(d,'overlaps',lambda:d.execute('INSERT INTO overlaps SELECT a.f,b.f,COUNT(*) FROM members a JOIN members b ON a.lang=b.lang AND a.lid=b.lid AND a.f<b.f GROUP BY a.f,b.f'))
  print('full overlap graph complete',flush=True)
  if stop_after_phase=='overlap':d.close();return dict(status='PAUSED_AFTER_ATOMIC_OVERLAP')
  def profiles():
   if sha(prior/'registry.sqlite')!=m['identity']['certified_diagnostic_database_sha256']:raise ValueError('diagnostic source changed')
   d.execute('ATTACH DATABASE ? AS prior',(str(prior/'registry.sqlite'),));d.execute("INSERT INTO profiles SELECT f.f,json_object('source_family_id',p.id,'relation_type_counts',json_extract(p.body,'$.relation_type_counts'),'evidence_source_counts',json_extract(p.body,'$.evidence_source_counts'),'semantic_status','UNRESOLVED','claims_are_not_gold',json('true')) FROM families f JOIN prior.families p ON p.id=f.fid")
  checkpoint(d,'profiles',profiles)
  if any(row[1]=='prior' for row in d.execute('PRAGMA database_list')):d.execute('DETACH DATABASE prior')
  checks=[json.loads(line) for line in (v6/'SOURCE-PROOF-CHECKS.ndjson').read_text().splitlines()];bykey={r['key']:r for r in checks}
  if len(bykey)!=len(checks):raise ValueError('duplicate finite proof locator')
  def v6_context():
   d.executemany('INSERT INTO v6_catalog VALUES(?,?)',((f['id'],canonical(f).decode()) for f in read(v6/'catalog.json')['families']))
   d.executemany('INSERT INTO v6_heads VALUES(?,?,?)',((h['id'],h.get('identity_kind','UNKNOWN'),canonical(h).decode()) for h in json.load(gzip.open(v6/'generated/heads.json.gz'))))
   d.executemany('INSERT INTO v6_edges VALUES(?,?,?,?,?)',((i,e.get('head_id'),e.get('family_id'),e.get('status'),canonical(e).decode()) for i,e in enumerate(json.load(gzip.open(v6/'generated/edges.json.gz')))))
   for i,member in enumerate(json.load(gzip.open(v6/'generated/memberships.json.gz'))):
    for j,p in enumerate(member.get('source_proof') or [{}]):
     source=p.get('source',{});lang=member.get('language');lid=p.get('lemma_id',member.get('lemma_id'));c=bykey[f'{i}:{j}']
     if (c.get('language'),c.get('lemma_id'),c.get('source_family_id'),c.get('head_id'),c.get('target_family_id'))!=(lang,lid,source.get('family_id'),member.get('head_id'),member.get('family_id')):raise ValueError('finite proof scope mismatch')
     found=d.execute('SELECT f.f,m.record_hash FROM families f JOIN members m ON m.f=f.f WHERE f.fid=? AND m.lang=? AND m.lid=?',(source.get('family_id'),lang,lid)).fetchone()
     status=c['status'] if found else 'SOURCE_RECORD_ABSENT';payload=dict(v6_membership=member,proof_ordinal=j,source_commit=vl['commit'],source_identity_status=status,v6_json_stringify_proof=c,current_canonical_record_sha256=found[1] if found else None,hash_contracts_are_distinct=True,productive_head_authority=False)
     d.execute('INSERT INTO v6_links VALUES(?,?,?,?,?,?)',(f'{i}:{j}',found[0] if found else None,member.get('head_id'),member.get('family_id'),status,canonical(payload).decode()))
  checkpoint(d,'v6',v6_context)
  def groups():
   for key,numbers in d.execute('SELECT ids_hash,group_concat(f) FROM families GROUP BY ids_hash,n HAVING COUNT(*)>1 ORDER BY ids_hash,n'):
    nums=[int(x) for x in numbers.split(',')];ref=list(d.execute('SELECT lang,lid FROM members WHERE f=? ORDER BY lang,lid',(nums[0],)));equal=all(list(d.execute('SELECT lang,lid FROM members WHERE f=? ORDER BY lang,lid',(n,)))==ref for n in nums[1:]);cohort(d,nums,'EXACT_MEMBER_IDS' if equal else 'FINGERPRINT_COLLISION',key)
   for a,b,n in d.execute('SELECT o.a,o.b,o.n FROM overlaps o JOIN families a ON a.f=o.a JOIN families b ON b.f=o.b WHERE a.n>=? AND b.n>=? AND ?*o.n>=?*(a.n+b.n-o.n) AND a.ids_hash<>b.ids_hash ORDER BY o.a,o.b',(policy['near_min_members'],policy['near_min_members'],policy['near_denominator'],policy['near_numerator'])):cohort(d,[a,b],'NEAR_MEMBER_IDS',n)
   for kind in ['ETYMON','LEXICAL_HEAD']:
    for key,nums in d.execute('SELECT key,group_concat(f) FROM refs WHERE kind=? GROUP BY key HAVING COUNT(*)>1 ORDER BY key',(kind,)):cohort(d,[int(x) for x in nums.split(',')],'SHARED_'+kind,key)
   for alias,nums in d.execute('SELECT a.alias,group_concat(f.f) FROM aliases a JOIN families f ON f.fid=a.fid GROUP BY a.alias HAVING COUNT(*)>1 ORDER BY a.alias'):cohort(d,[int(x) for x in nums.split(',')],'SHARED_ALIAS',alias)
   for f,n,langs,meta in d.execute('SELECT f,n,langs,meta FROM families ORDER BY f'):
    counts=json.loads(langs);raw=json.loads(meta)
    if n>=policy['large_min_members']:cohort(d,[f],'LARGE_FAMILY',n)
    if n>=policy['skew_min_members'] and counts and 100*max(counts.values())>=policy['skew_percent']*n:cohort(d,[f],'LANGUAGE_SKEW',n)
    if n>=policy['large_min_members'] and len(raw.get('canonical') or '')<=policy['short_base_codepoints']:cohort(d,[f],'SHORT_LARGE_BASE',raw.get('canonical') or '')
   for head,nums in d.execute("SELECT v.head,group_concat(DISTINCT v.f) FROM v6_links v JOIN v6_heads h ON h.id=v.head WHERE v.status='EXACT_FINITE_SOURCE_PROOF' AND h.kind IN ('lexical_head','historically_reviewed_lexical_head') GROUP BY v.head HAVING COUNT(DISTINCT v.f)>1 ORDER BY v.head"):cohort(d,[int(x) for x in nums.split(',')],'SHARED_TYPED_V6_HEAD_FINITE_PROOF',head)
   for f,lang,lid in d.execute("SELECT f,json_extract(body,'$.v6_membership.language'),json_extract(body,'$.v6_membership.lemma_id') FROM v6_links WHERE status='EXACT_FINITE_SOURCE_PROOF' GROUP BY f,2,3 HAVING COUNT(DISTINCT head)>1 ORDER BY f,2,3"):cohort(d,[f],'COMPETING_V6_HEAD_REFERENCES',canonical([lang,lid]).decode())
  checkpoint(d,'groups',groups);print('finite candidate cohorts complete',flush=True)
  if d.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise ValueError('SQLite integrity')
  queries=dict(profiles='SELECT f,body FROM profiles ORDER BY f',v6_catalog='SELECT id,body FROM v6_catalog ORDER BY id',families='SELECT fid,bucket,n,langs,ids_hash,meta FROM families ORDER BY fid',members='SELECT f,lang,lid,ordinal,record_hash FROM members ORDER BY f,lang,lid',aliases='SELECT alias,fid FROM aliases ORDER BY alias,fid',declared_aliases='SELECT alias,fid FROM declared_aliases ORDER BY alias,fid',refs='SELECT kind,key,f FROM refs ORDER BY kind,key,f',overlaps='SELECT a,b,n FROM overlaps ORDER BY a,b',groups='SELECT id,ids FROM groups ORDER BY id',signals='SELECT g,kind,key FROM signals ORDER BY g,kind,key',history='SELECT id,fid,body FROM history ORDER BY id',history_ids='SELECT decision,lang,lid FROM history_ids ORDER BY decision,lang,lid',v6_heads='SELECT id,kind,body FROM v6_heads ORDER BY id',v6_edges='SELECT id,head,target_family,status,body FROM v6_edges ORDER BY id',v6_links='SELECT id,f,head,target_family,status,body FROM v6_links ORDER BY id')
  logical={}
  for table,sql in queries.items():
   h=hashlib.sha256();n=0
   for row in d.execute(sql):h.update(canonical(list(row))+b'\n');n+=1
   logical[table]=dict(rows=n,sha256=h.hexdigest())
  outputs={};outputs['families']=stream(out/'FAMILY-FINGERPRINTS.ndjson.gz',(dict(family_id=fid,bucket=b,n=n,language_counts=json.loads(l),member_ids_sha256=fp,metadata=json.loads(meta)) for fid,b,n,l,fp,meta in d.execute(queries['families'])))
  outputs['overlaps']=stream(out/'ALL-LEGACY-OVERLAPS.ndjson.gz',(dict(family_ids=[a,b],shared_language_lemma_ids=n,sense_overlap='UNKNOWN',retention='PRESERVED_PENDING_SENSE_REVIEW',production_operation='NONE') for a,b,n in d.execute('SELECT fa.fid,fb.fid,o.n FROM overlaps o JOIN families fa ON fa.f=o.a JOIN families fb ON fb.f=o.b ORDER BY o.a,o.b')))
  statuses=Counter();kinds_count=Counter()
  def rows():
   for g,packed in d.execute('SELECT id,ids FROM groups ORDER BY id'):
    ids=json.loads(packed);signals=[dict(kind=k,key=v) for k,v in d.execute('SELECT kind,key FROM signals WHERE g=? ORDER BY kind,key',(g,))];kinds={x['kind'] for x in signals};kinds_count.update(kinds)
    status='DUPLICATE_FAMILY_CANDIDATE' if kinds&{'EXACT_MEMBER_IDS','NEAR_MEMBER_IDS'} else ('ALIAS_COLLISION' if 'SHARED_ALIAS' in kinds else ('FALSE_MERGE_CANDIDATE' if 'SHORT_LARGE_BASE' in kinds else ('SPLIT_FAMILY_CANDIDATE' if 'LARGE_FAMILY' in kinds else 'INSUFFICIENT_EVIDENCE')));statuses[status]+=1
    total=d.execute('SELECT SUM(n) FROM families WHERE f IN (SELECT f FROM group_families WHERE g=?)',(g,)).fetchone()[0];history=[r[0] for r in d.execute('SELECT h.id FROM history h JOIN families f ON f.fid=h.fid JOIN group_families gf ON gf.f=f.f WHERE gf.g=? ORDER BY h.id',(g,))]
    yield dict(id=g,family_ids=ids,status=status,signals=signals,affected_membership_edges=total,exact_scope=dict(index_version=m['version'],family_ids=ids,token_fields=['language','lemma_id'],sense_status='UNRESOLVED'),applicable_history_decision_ids=history,semantic_status='INSUFFICIENT_EVIDENCE',history_status='HISTORY_UNAVAILABLE',national_correspondence_status='EXACT_ROOT_LEXEME_SENSE_BINDING_REQUIRED',review_admission='STRUCTURAL_CANDIDATE_ONLY',production_admission='BLOCKED',production_operation='NONE',alternatives=['KEEP_DISTINCT_WITH_OVERLAP','REVIEW_FINITE_SPLIT_OR_MERGE'],association_metrics='UNKNOWN_NOT_RECALCULATED')
  outputs['groups']=stream(out/'BOUNDARY-GROUPS.ndjson.gz',rows())
  for status in sorted(statuses):
   def selected(wanted=status):
    for line in gzip.open(out/'BOUNDARY-GROUPS.ndjson.gz','rt'):
     r=json.loads(line)
     if r['status']==wanted:yield r
   outputs[status]=stream(out/(status+'.ndjson.gz'),selected())
  for name in ['SPLIT-MERGE-PROPOSALS.ndjson','WRONG-ASSIGNMENT-PROPOSALS.ndjson','CONFIRMED-VALID-OVERLAPS.ndjson']:atomic(out/name,b'');outputs[name]=dict(path=name,rows=0,bytes=0,sha256=sha(out/name))
  unique=d.execute('SELECT COUNT(*),SUM(n) FROM families WHERE f IN (SELECT f FROM group_families)').fetchone();asymmetry={k:d.execute(sql).fetchone()[0] for k,sql in dict(forward_only='SELECT COUNT(*) FROM (SELECT alias,fid FROM aliases EXCEPT SELECT alias,fid FROM declared_aliases)',declared_only='SELECT COUNT(*) FROM (SELECT alias,fid FROM declared_aliases EXCEPT SELECT alias,fid FROM aliases)',orphan_targets='SELECT COUNT(*) FROM aliases a LEFT JOIN families f ON f.fid=a.fid WHERE f.f IS NULL').items()}
  summary=dict(schema='boundary-audit/2',counts=m['counts'],nonzero_legacy_family_pairs=logical['overlaps']['rows'],candidate_groups=logical['groups']['rows'],statuses=dict(statuses),signals=dict(kinds_count),signals_overlap_not_additive=True,distinct_candidate_families=unique[0],memberships_in_distinct_candidate_families=unique[1],alias_integrity=asymmetry,v6_source_commit=vl['commit'],v6_identity_kinds=dict(d.execute('SELECT kind,COUNT(*) FROM v6_heads GROUP BY kind')),v6_edge_statuses=dict(d.execute('SELECT status,COUNT(*) FROM v6_edges GROUP BY status')),v6_finite_alignment=dict(d.execute('SELECT status,COUNT(*) FROM v6_links GROUP BY status')),history_decisions=logical['history']['rows'],history_scope_ids=logical['history_ids']['rows'],history_coverage_complete=False,confirmed_semantic_overlaps=0,concrete_split_merge_proposals=0,source_lemma_delta=0,production_writes=0,association_formulas_changed=False)
  save(out/'SUMMARY.json',summary);d.close();release=dict(schema='boundary-release/2',identity=identity,logical_tables=logical,outputs=outputs,summary_sha256=sha(out/'SUMMARY.json'),database_sha256=sha(out/'index.sqlite'),database_bytes=(out/'index.sqlite').stat().st_size,production_writes=0);release['version']=digest({k:v for k,v in release.items() if k not in {'database_sha256','database_bytes'}});save(out/'MANIFEST.json',release);save(out/'ANALYSIS-RESOURCE.json',dict(elapsed_seconds=time.monotonic()-start,peak_rss_mib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024,output_bytes=sum(p.stat().st_size for p in out.iterdir() if p.is_file())));return summary
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--index',required=True);p.add_argument('--prior',required=True);p.add_argument('--v6',required=True);p.add_argument('--stop-after-phase',choices=['overlap']);a=p.parse_args();print(json.dumps(run(a.index,a.prior,a.v6,a.stop_after_phase)))
