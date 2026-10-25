"""Separate raw-source verifier, independent of the adjudication producer.

Replays source observations and reconstructs each finite removal/addition from
original before/after arrays. Counts come from the historical release manifest,
not from a hard-coded347760 target. This is engineering verification, not gold.
"""
import argparse,collections,gzip,hashlib,json,sqlite3,subprocess
from pathlib import Path

def canonical(x):return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
def digest(b):return hashlib.sha256(b).hexdigest()
def tree(x,p=''):
 if isinstance(x,dict):
  yield p,x
  for k,v in x.items():yield from tree(v,p+'/'+str(k).replace('~','~0').replace('/','~1'))
 elif isinstance(x,list):
  for i,v in enumerate(x):yield from tree(v,p+'/'+str(i))
def run(repo,restored,output):
 repo=Path(repo);root=Path(restored);out=Path(output);old=json.loads((root/'REGISTRY.json').read_bytes());new=json.loads((out/'REGISTRY.json').read_bytes());db=sqlite3.connect((out/'history.sqlite').resolve().as_uri()+'?mode=ro&immutable=1',uri=True)
 assert new['source_snapshot_sha256']==digest((root/'REGISTRY.json').read_bytes())
 sources={x['blob']:x for x in old['sources']};locked={}
 for k,v in sources.items():
  b=(root/'objects'/k).read_bytes();assert len(b)==v['bytes'] and digest(b)==v['sha256'];assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==k
 # Re-read each source; compare individual pointer hashes and complete old indexes.
 seen=0;actual_source_counts={};ambiguous_scope_violations=0
 for obs in old['observations']:
  b=(root/'objects'/obs['source_blob']).read_bytes();p=sources[obs['source_blob']]['path']
  if p.endswith('.gz'):b=gzip.decompress(b);p=p[:-3]
  data=[json.loads(x) for x in b.splitlines() if x.strip()] if p.endswith(('.jsonl','.ndjson')) else json.loads(b)
  h=hashlib.sha256();h.update(b'[');n=0
  for pointer,x in tree(data):
   if not any(k in x for k in ('decision','verdict','status','rejected_memberships','retained','keep','quarantined_families','supersedes')):continue
   if not any(k in x for k in ('family_id','canonical_family_id','head_id','lemma_id','lemma_ids','affected_lemma_ids','records','decisions','rejected_memberships','retained','keep','alias','scope')):continue
   oid='observation:'+digest(canonical([obs['source_blob'],pointer]));env=dict(id=oid,source_blob=obs['source_blob'],pointer=pointer,payload_sha256=digest(canonical(x)),classification='UNINTERPRETED_SOURCE_OBSERVATION')
   if n:h.update(b',')
   h.update(canonical(env));n+=1;seen+=1
   row=db.execute('SELECT source,pointer,payload_sha256,resolution,family,language FROM observations WHERE id=?',(oid,)).fetchone();assert row and row[:3]==(obs['source_blob'],pointer,env['payload_sha256'])
   v=str(x.get('decision',x.get('verdict',x.get('status','')))).lower()
   if v in {'accepted','excluded','rejected','removed','confirmed_member','confirmed_nonmember','unresolved','uncertain','keep','retained','valid','invalid','conflict'} or x.get('supersedes'):assert row[3]=='QUARANTINED_UNRESOLVED'
  h.update(b']');assert n==obs['count'] and h.hexdigest()==obs['entries_sha256'];actual_source_counts[obs['source_blob']]=n
 assert seen==db.execute('SELECT count(*) FROM observations').fetchone()[0]
 assert len(new['conflict_resolution_ledger'])==len(old['conflicts']) and {r['source']['blob'] for r in new['conflict_resolution_ledger']}=={r['source'] for r in old['conflicts']}
 for r in new['conflict_resolution_ledger']:
  if r['source']['blob'] in actual_source_counts:assert r['observation_count']==actual_source_counts[r['source']['blob']]
  if r['resolution']=='RESOLVED_INVALID':assert not db.execute("SELECT 1 FROM observations WHERE source=? AND resolution='QUARANTINED_UNRESOLVED' LIMIT 1",(r['source']['blob'],)).fetchone()
 original={d['id']:d for d in old['decisions']};assert {r['original_decision']['id'] for r in new['previous_constraints']}==set(original)
 for r in new['previous_constraints']:assert r['original_decision']==original[r['original_decision']['id']] and r['linguistic_decision']=='UNRESOLVED'
 # A small SQL EXCEPT index derives finite native sets, rather than calling History.ids.
 cache={};counts=collections.Counter();verified=0
 def decode(k):
  if not k:return {}
  if k not in cache:
   if len(cache)>3:cache.clear()
   cache[k]=json.loads(gzip.decompress((root/'objects'/k).read_bytes()))
  return cache[k]
 for d in old['decisions']:
  scope=d['scope'];sel=scope.get('selector')
  if not sel:continue
  before=decode(sel.get('before')).get(scope['family_id'],[]);after=decode(sel.get('after')).get(scope['family_id'],[])
  temp=sqlite3.connect(':memory:');temp.execute('CREATE TABLE a(id TEXT PRIMARY KEY)');temp.execute('CREATE TABLE b(id TEXT PRIMARY KEY)');temp.executemany('INSERT OR IGNORE INTO a VALUES(?)',((r['lemma_id'],) for r in before));temp.executemany('INSERT OR IGNORE INTO b VALUES(?)',((r['lemma_id'],) for r in after));q='SELECT id FROM a EXCEPT SELECT id FROM b' if sel['direction']=='removed' else 'SELECT id FROM b EXCEPT SELECT id FROM a';derived={r[0] for r in temp.execute(q)};temp.close()
  stored=db.execute('SELECT lemma,body,record_hash FROM events WHERE decision_id=? AND direction=? ORDER BY lemma',(d['id'],sel['direction'])).fetchall();assert {r[0] for r in stored}==derived and len(stored)==len(derived);assert len(derived)==sel['count'] and digest(canonical(sorted(derived)))==sel['ids_sha256'];counts[sel['direction']]+=len(derived);verified+=1
  grouped=collections.defaultdict(list)
  for i,row in enumerate(before if sel['direction']=='removed' else after):
   if row['lemma_id'] in derived:grouped[row['lemma_id']].append(dict(ordinal=i,record=row))
  for lid,body,h in stored:
   x=json.loads(body);assert x['exact_rows']==grouped[lid] and h==digest(canonical(grouped[lid]));assert x['accepted_in_current_registry'] is False
   if sel['direction']=='removed':assert x['historical_status']=='REMOVED'
 release=subprocess.check_output(['git','-C',str(repo),'show',old['roots']['main']+':associativvordes/family-index-v5/repository-provenance.json']);manifest=json.loads(release);expected={k:sum(r.get(field,0) for r in manifest['repository_repairs']) for k,field in [('removed','removed_memberships'),('added','added_memberships')]};assert dict(counts)==expected
 assert db.execute('PRAGMA integrity_check').fetchall()==[('ok',)];db.close()
 result=dict(status='ENGINEERING_REPLAY_VERIFIED_SEMANTIC_CERTIFICATION_BLOCKED',sources_verified=len(sources),problems_accounted_for=len(old['conflicts']),observations_exact=seen,selectors_verified=verified,events=dict(counts),release_manifest_sha256=digest(release),removed_records_automatically_accepted=0,source_scope_claims_not_promoted=True,semantic_certification=False,producer_imported=False)
 (out/'INDEPENDENT-VERIFICATION.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--repo',required=True);p.add_argument('--restored',required=True);p.add_argument('--output',required=True);a=p.parse_args();run(a.repo,a.restored,a.output)
