"""Reviewable aggregate receipts from the complete immutable research registry."""
import argparse
from .core import *
def report(index,output,contexts=None):
 index=Path(index);out=Path(output);out.mkdir(parents=True,exist_ok=True);d=dbopen(index/'index.sqlite',True);s=read(index/'SUMMARY.json');m=read(index/'MANIFEST.json')
 for source,target in [('INDEX-MANIFEST.json','FULL-CENSUS.json'),('MANIFEST.json','RELEASE-MANIFEST.json'),('SUMMARY.json','SUMMARY.json'),('INDEX-RESOURCE.json','INDEX-RESOURCE.json'),('ANALYSIS-RESOURCE.json','ANALYSIS-RESOURCE.json')]:atomic(out/target,(index/source).read_bytes())
 signals=[]
 for kind,n in d.execute('SELECT kind,COUNT(*) FROM signals GROUP BY kind ORDER BY kind'):
  unique=d.execute('SELECT COUNT(*),SUM(n) FROM families WHERE f IN (SELECT f FROM group_families WHERE g IN (SELECT g FROM signals WHERE kind=?))',(kind,)).fetchone();signals.append(dict(signal=kind,observations=n,distinct_groups=d.execute('SELECT COUNT(DISTINCT g) FROM signals WHERE kind=?',(kind,)).fetchone()[0],distinct_families=unique[0],memberships_in_distinct_families=unique[1],overlaps_other_signals=True))
 save(out/'SIGNAL-COVERAGE.json',dict(signals=signals,counts_are_not_additive=True));save(out/'CATEGORY-STATISTICS.json',{k:s['statuses'].get(k,0) for k in sorted(STATUSES)})
 largest=[]
 for fid,n,l,fp,meta in d.execute('SELECT fid,n,langs,ids_hash,meta FROM families ORDER BY n DESC,fid LIMIT 50'):
  raw=json.loads(meta);largest.append(dict(family_id=fid,memberships=n,language_counts=json.loads(l),canonical=raw.get('canonical'),formation_source=raw.get('source'),etymon_keys=raw.get('etymon_keys',[]),member_ids_sha256=fp,semantic_status='INSUFFICIENT_EVIDENCE',production_operation='NONE'))
 save(out/'LARGEST-FAMILIES.json',largest)
 groups=[]
 for g,n,packed in d.execute('SELECT g.id,SUM(f.n),g.ids FROM groups g JOIN group_families gf ON gf.g=g.id JOIN families f ON f.f=gf.f GROUP BY g.id ORDER BY SUM(f.n) DESC,g.id LIMIT 25'):groups.append(dict(id=g,family_ids=json.loads(packed),membership_edges_in_group=n,signals=[dict(kind=k,key=v) for k,v in d.execute('SELECT kind,key FROM signals WHERE g=? ORDER BY kind,key',(g,))],semantic_status='INSUFFICIENT_EVIDENCE'))
 save(out/'LARGEST-GROUPS.json',groups);origin={};exceptions=[]
 for fid,meta in d.execute("SELECT fid,meta FROM families WHERE fid LIKE 'ety:%' ORDER BY fid"):
  keys=json.loads(meta).get('etymon_keys',[]);matches=[k for k in keys if fid=='ety:'+hashlib.sha1(k.encode()).hexdigest()[:12]];status='GENERATOR_KEY_MATCH' if matches else 'STABLE_ID_DIFFERS_FROM_CURRENT_KEY';origin[status]=origin.get(status,0)+1
  if not matches:exceptions.append(dict(family_id=fid,current_keys=keys,status=status,operation='PRESERVE_ID_REVIEW_HISTORY'))
 save(out/'ID-ORIGIN-CHECK.json',dict(generator_formula='ety: + first12hex(SHA1(exact original etymon key))',surface_formula='surface: + language + : + discovered normalized component',seed_origin='explicit seed/manual family IDs',counts=origin,exceptions=exceptions,recalculated_ids_applied=0))
 c=dict(schema='boundary-coverage/2',families=s['counts']['families'],memberships=s['counts']['memberships'],aliases=s['counts']['aliases'],all_buckets=256,all_nonzero_legacy_pairs=s['nonzero_legacy_family_pairs'],candidate_groups=s['candidate_groups'],distinct_candidate_families=s['distinct_candidate_families'],memberships_in_distinct_candidate_families=s['memberships_in_distinct_candidate_families'],families_outside_candidate_groups=s['counts']['families']-s['distinct_candidate_families'],memberships_outside_candidate_groups=s['counts']['memberships']-s['memberships_in_distinct_candidate_families'],outside_scope_status='NO_DETECTED_SIGNAL_NOT_SEMANTIC_CLEARANCE',sense_overlap_status='UNKNOWN_WITHOUT_BINDING',semantic_gold=0,production_writes=0);save(out/'COVERAGE.json',c)
 if contexts:atomic(out/'DETAILED-CONTEXT-MANIFEST.json',(Path(contexts)/'MANIFEST.json').read_bytes())
 for name in ['SPLIT-MERGE-PROPOSALS.ndjson','WRONG-ASSIGNMENT-PROPOSALS.ndjson','CONFIRMED-VALID-OVERLAPS.ndjson']:atomic(out/name,(index/name).read_bytes())
 d.close();return c
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--index',required=True);p.add_argument('--output',required=True);p.add_argument('--contexts');a=p.parse_args();print(json.dumps(report(a.index,a.output,a.contexts)))
