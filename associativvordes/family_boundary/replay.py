"""Full release replay, independent raw source fingerprints and graph conservation."""
import argparse
from collections import Counter
from .core import *
from .guard import group_id
from associativvordes.v5_adapter.common import bucket

def actual_fingerprints(d):
 rows=iter(d.execute('SELECT f,lang,lid FROM members ORDER BY f,lang,lid'));current=next(rows,None);total=0
 for f,expected,n,packed in d.execute('SELECT f,ids_hash,n,langs FROM families ORDER BY f'):
  h=hashlib.sha256();counts=Counter();seen=0
  while current is not None and current[0]==f:
   _,lang,lid=current;h.update(canonical([lang,lid])+b'\n');counts[lang]+=1;seen+=1;total+=1;current=next(rows,None)
  if h.hexdigest()!=expected or seen!=n or dict(counts)!=json.loads(packed):raise ValueError('actual stored membership fingerprint differs')
 if current is not None:raise ValueError('orphan membership')
 return total

def verify(first,replay,independent,receipt):
 first=Path(first);replay=Path(replay);independent=Path(independent);a=read(first/'MANIFEST.json');b=read(replay/'MANIFEST.json');j=read(independent/'MANIFEST.json')
 if a['identity']!=b['identity'] or a['logical_tables']!=b['logical_tables'] or a['outputs']!=b['outputs'] or a['version']!=b['version']:raise ValueError('fresh full replay differs')
 if (first/'SUMMARY.json').read_bytes()!=(replay/'SUMMARY.json').read_bytes():raise ValueError('summary replay differs')
 for root,m in [(first,a),(replay,b)]:
  if sha(root/'index.sqlite')!=m['database_sha256']:raise ValueError('index hash mismatch')
  for o in m['outputs'].values():
   if Path(o['path']).name!=o['path'] or sha(root/o['path'])!=o['sha256']:raise ValueError('artifact hash/path')
 d=dbopen(first/'index.sqlite',True);seen=0
 for part in j['buckets']:
  path=independent/(part['bucket']+'.ndjson.gz')
  if sha(path)!=part['fingerprints_sha256']:raise ValueError('independent source artifact hash')
  for line in gzip.open(path,'rt'):
   r=json.loads(line);found=d.execute('SELECT n,langs,ids_hash,meta FROM families WHERE fid=?',(r['family_id'],)).fetchone()
   if not found:raise ValueError('source family missing')
   n,l,fp,m=found;m=json.loads(m)
   if (n,json.loads(l),fp,m.get('etymon_keys',[]),m.get('source'))!=(r['n'],r['language_counts'],r['member_ids_sha256'],r['etymon_keys'],r['formation_source']):raise ValueError('independent exact source fingerprint mismatch')
   seen+=1
 if seen!=2456543:raise ValueError('incomplete family census')
 actual_members=actual_fingerprints(d)
 if actual_members!=10078319:raise ValueError('actual membership coverage')
 hs={f'{n:02x}':hashlib.sha256() for n in range(256)};edges=0
 for alias,fid in d.execute('SELECT alias,fid FROM aliases ORDER BY alias,fid'):hs[bucket(alias)].update(canonical([alias,fid])+b'\n');edges+=1
 for p in j['buckets']:
  if hs[p['bucket']].hexdigest()!=p['alias_edges_sha256']:raise ValueError('independent aliases mismatch')
 statuses=Counter();n=0;index_version=read(first/'INDEX-MANIFEST.json')['version']
 for line in gzip.open(first/'BOUNDARY-GROUPS.ndjson.gz','rt'):
  r=json.loads(line);n+=1;statuses[r['status']]+=1
  if r['id']!=group_id(r['family_ids']) or r['status'] not in STATUSES or r['exact_scope']['family_ids']!=r['family_ids'] or r['exact_scope']['index_version']!=index_version or r['production_operation']!='NONE' or r['production_admission']!='BLOCKED' or r['semantic_status']!='INSUFFICIENT_EVIDENCE':raise ValueError('scope/admission invariant')
 summary=read(first/'SUMMARY.json')
 if n!=summary['candidate_groups'] or dict(statuses)!=summary['statuses']:raise ValueError('candidate coverage')
 weight=d.execute('SELECT SUM(n) FROM overlaps').fetchone()[0];inverted=d.execute('SELECT SUM(k*(k-1)/2) FROM (SELECT COUNT(*) k FROM members GROUP BY lang,lid)').fetchone()[0]
 if weight!=inverted:raise ValueError('intersection conservation')
 if d.execute('SELECT COUNT(*) FROM overlaps o JOIN families a ON a.f=o.a JOIN families b ON b.f=o.b WHERE o.a>=o.b OR o.n<1 OR o.n>a.n OR o.n>b.n').fetchone()[0]:raise ValueError('intersection bounds')
 exact=d.execute("SELECT COUNT(*) FROM signals WHERE kind='EXACT_MEMBER_IDS'").fetchone()[0];fans=d.execute("SELECT COUNT(*) FROM signals WHERE kind='SHARED_ALIAS'").fetchone()[0]
 old=read(ROOT/'audit/associative-v5-diagnostics/PATTERN-MANIFEST.json')['patterns']
 if (exact,fans)!=(old['EXACT_DUPLICATE_MEMBER_SET']['groups'],old['ALIAS_FANOUT']['groups']):raise ValueError('prior diagnostic discrepancy')
 d.close();result=dict(schema='boundary-independent-replay/2',status='PASS',full_fresh_replay=True,logical_tables_identical=True,all_exports_identical=True,independent_implementation='JavaScript full raw traversal versus Python verified disk-index import',all_source_families_compared=seen,all_source_memberships_fingerprinted=j['memberships'],all_stored_memberships_recomputed=actual_members,all_alias_edges_compared=edges,all_candidate_groups_checked=n,weighted_legacy_intersections=weight,inverted_identity_pair_count=inverted,exact_duplicate_groups=exact,alias_fanout_aliases=fans,release_version=a['version'],linguistic_gold=False,production_writes=0);save(receipt,result);return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--first',required=True);p.add_argument('--replay',required=True);p.add_argument('--independent',required=True);p.add_argument('--receipt',required=True);a=p.parse_args();print(json.dumps(verify(a.first,a.replay,a.independent,a.receipt)))
