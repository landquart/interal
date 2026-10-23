#!/usr/bin/env python3
"""Finite mechanism cohorts, complete priority queues and independent replay receipts."""
import argparse,gzip,hashlib,json,os,sys,time,zipfile
from collections import Counter
from pathlib import Path
from query import open_registry,filehash
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from classify import canonical,digest

def save(p,x):
 p=Path(p);p.parent.mkdir(parents=True,exist_ok=True);t=p.with_suffix(p.suffix+'.partial');t.write_bytes(canonical(x)+b'\n');os.replace(t,p)
def finalize(first,replay):
 start=time.monotonic();out=Path(first);db,m=open_registry(out);other,rm=open_registry(replay)
 try:
  if m['identity']!=rm['identity'] or m['logical_tables']!=rm['logical_tables']:raise ValueError('independent replay differs')
  if (out/'SUMMARY.json').read_bytes()!=(Path(replay)/'SUMMARY.json').read_bytes():raise ValueError('summary replay differs')
  coverage=json.loads((out/'COVERAGE.json').read_bytes())
  save(out/'REPLAY-RECEIPT.json',dict(schema='v5-diagnostics-independent-replay/1',status='PASS',fresh_replay=True,logical_tables_equal=True,summary_bytes_equal=True,coverage_bytes_equal=(out/'COVERAGE.json').read_bytes()==(Path(replay)/'COVERAGE.json').read_bytes(),first_version=m['version'],replay_version=rm['version'],first_database_sha256=m['database_sha256'],replay_database_sha256=rm['database_sha256'],logical_tables=m['logical_tables']))
  folder=out/'PRIORITY-QUEUES';folder.mkdir(exist_ok=True);outputs={};total=0
  for band in ['PRIORITY_1','PRIORITY_2','PRIORITY_3','PRIORITY_4']:
   path=folder/(band+'.ndjson.gz');n=0;nm=0
   with path.open('wb') as raw,gzip.GzipFile(fileobj=raw,mode='wb',mtime=0,filename='',compresslevel=6) as z:
    for fid,size,score in db.execute('SELECT p.family,f.n,p.score FROM priority p JOIN families f ON f.id=p.family WHERE p.band=? ORDER BY p.score DESC,p.family',(band,)):
     z.write(canonical(dict(family_id=fid,memberships=size,investigation_score=score))+b'\n');n+=1;nm+=size
   outputs[path.name]=dict(families=n,memberships=nm,sha256=filehash(path),bytes=path.stat().st_size);total+=n
  if total!=coverage['counts']['families']:raise ValueError('priority queue coverage')
  # Disjoint cohorts by formation source + observed relation-type signature + base length bin.
  cohort_query="""SELECT category,json_extract(body,'$.formation_source') AS source,
  (SELECT group_concat(key,',') FROM json_each(f.body,'$.relation_type_counts')) AS types,
  CASE WHEN length(base)<=3 THEN 'SHORT' ELSE 'LONG' END AS base_bin,COUNT(*),SUM(n)
  FROM families f GROUP BY category,source,types,base_bin ORDER BY category,source,types,base_bin"""
  cohorts=[]
  for category,source,types,basebin,n,nm in db.execute(cohort_query):
   scope=dict(category=category,formation_source=source,observed_type_signature=types or '',base_bin=basebin)
   cohorts.append(dict(id='cohort:'+digest(scope),scope=scope,families=n,memberships=nm,review_unit='mechanism investigation; no blanket membership verdict'))
  save(out/'MECHANISM-COHORTS.json',dict(schema='v5-mechanism-cohorts/1',disjoint_partition=True,cohorts=cohorts,families=sum(x['families'] for x in cohorts),memberships=sum(x['memberships'] for x in cohorts)))
  qm=dict(schema='v5-diagnostic-priority-queues/1',registry_manifest_version=m['version'],outputs=outputs,disjoint_by_priority_band=True,queue_role='research drill-down indexes, not independent LLM jobs',primary_review_units='MECHANISM-COHORTS.json',human_or_model_decisions_created=0,production_writes=0)
  save(folder/'MANIFEST.json',qm)
  kinds={}
  for kind,n in db.execute('SELECT kind,COUNT(*) FROM patterns GROUP BY kind ORDER BY kind'):
   # Every complete pattern and its affected family IDs are retained, never a top-N substitute.
   path=out/(kind+'.ndjson.gz')
   with path.open('wb') as raw,gzip.GzipFile(fileobj=raw,mode='wb',mtime=0,filename='',compresslevel=6) as z:
    for key,body in db.execute('SELECT key,body FROM patterns WHERE kind=? ORDER BY key',(kind,)):z.write(canonical(dict(key=key,**json.loads(body)))+b'\n')
   kinds[kind]=dict(groups=n,path=path.name,sha256=filehash(path),bytes=path.stat().st_size)
  save(out/'PATTERN-MANIFEST.json',dict(schema='v5-complete-patterns/1',patterns=kinds,registry_manifest_version=m['version']))
  direct_flags={flag:dict(families_with_direct_flag=n,memberships_with_direct_flag=nm) for flag,n,nm in db.execute("SELECT j.key,COUNT(*),SUM(j.value) FROM families f,json_each(f.body,'$.member_flag_counts') j GROUP BY j.key ORDER BY j.key")}
  ending_links=db.execute("SELECT COALESCE(SUM(json_extract(body,'$.ending_proxy.ending_members')),0) FROM families WHERE id IN (SELECT family FROM flags WHERE flag='ENDING_PREFIX_DIVERSITY_PROXY')").fetchone()[0]
  save(out/'DIRECT-MEMBER-FLAGS.json',dict(schema='v5-direct-membership-flags/1',flags=direct_flags,ending_condition_matching_memberships=ending_links,overlapping_flags_not_additive=True))
  source_distribution=[dict(source=source,families=n,memberships=nm) for source,n,nm in db.execute("SELECT json_extract(body,'$.formation_source'),COUNT(*),SUM(n) FROM families GROUP BY 1 ORDER BY 1")]
  legacy_distribution=[dict(label=label,families=n,memberships=nm) for label,n,nm in db.execute("SELECT json_extract(body,'$.legacy_review_status'),COUNT(*),SUM(n) FROM families GROUP BY 1 ORDER BY 1")]
  save(out/'PROVENANCE-DISTRIBUTION.json',dict(schema='v5-provenance-distribution/1',formation_sources=source_distribution,legacy_review_labels=legacy_distribution,labels_are_not_linguistic_verdicts=True))
  top_patterns={}
  for kind in ['EXACT_DUPLICATE_MEMBER_SET','SHARED_LEGACY_IDENTITY','ALIAS_FANOUT']:
   top_patterns[kind]=[dict(key=key,**json.loads(body)) for key,body in db.execute("SELECT key,body FROM patterns WHERE kind=? ORDER BY COALESCE(json_extract(body,'$.membership_edges'),json_extract(body,'$.targets')) DESC,key LIMIT 25",(kind,))]
  save(out/'LARGEST-PATTERNS.json',top_patterns)
  lexical_distribution={str(k):n for k,n in db.execute('SELECT k,COUNT(*) FROM (SELECT COUNT(*) k FROM members GROUP BY language,lemma) GROUP BY k ORDER BY k')}
  family_size_distribution={str(k):n for k,n in db.execute('SELECT n,COUNT(*) FROM families GROUP BY n ORDER BY n')}
  duplicate_sizes={str(k):dict(groups=n,membership_edges=nm) for k,n,nm in db.execute("SELECT json_extract(body,'$.members_per_family'),COUNT(*),SUM(json_extract(body,'$.membership_edges')) FROM patterns WHERE kind='EXACT_DUPLICATE_MEMBER_SET' GROUP BY 1 ORDER BY 1")}
  save(out/'LEXICAL-COVERAGE.json',dict(schema='v5-lexical-diagnostic-coverage/1',distinct_language_lemma_ids=sum(lexical_distribution.values()),families_per_legacy_lemma_distribution=lexical_distribution,family_size_distribution=family_size_distribution,exact_duplicate_set_size_distribution=duplicate_sizes,identity_status='legacy IDs preserved; senses unresolved'))
  largest=[]
  for fid,n,body,rating in db.execute('SELECT f.id,f.n,f.body,p.body FROM families f JOIN priority p ON p.family=f.id ORDER BY f.n DESC,f.id LIMIT 50'):
   f=json.loads(body);largest.append(dict(id=fid,memberships=n,canonical=f['canonical'],primary_category=f['primary_category'],language_counts=f['language_counts'],priority=json.loads(rating),flags=[x[0] for x in db.execute('SELECT flag FROM flags WHERE family=? ORDER BY flag',(fid,))]))
  save(out/'LARGEST-FAMILIES.json',largest)
  missing_legacy=db.execute("SELECT COUNT(*),COALESCE(SUM(n),0) FROM families WHERE id IN (SELECT family FROM flags WHERE flag IN ('ENDING_PREFIX_DIVERSITY_PROXY','EXACT_DUPLICATE_MEMBER_SET','ALIAS_FANOUT','LARGE_FAMILY','SURFACE_ONLY_LINK_CLAIM')) AND id NOT IN (SELECT family FROM flags WHERE flag='LEGACY_REVIEW_REQUIRED')").fetchone()
  save(out/'REVIEW-ECONOMY.json',dict(schema='v5-diagnostic-review-economy/1',individual_membership_observations=coverage['counts']['memberships'],disjoint_mechanism_cohorts=len(cohorts),maximum_initial_task_aggregation_reduction=coverage['counts']['memberships']-len(cohorts),interpretation='Upper bound on initial investigation task aggregation only; not measured review time, certified batch corrections or waived lexical/sense checks.',measured_human_time_saved=None,authorized_automatic_corrections=0,signals_outside_legacy_review_required=dict(families=missing_legacy[0],memberships_in_affected_families=missing_legacy[1]),unobservable_patterns=dict(allomorph_overgeneralization='NOT_TESTABLE_WITHOUT_FINITE_CORRESPONDENCE_BINDINGS',transitive_homonym_chain='NOT_TESTABLE_WITHOUT_SENSE_IDENTITIES_AND_DIRECTED_PATHS',unrelated_stems_with_common_ending='PREFIX_DIVERSITY_PROXY_ONLY; RELATEDNESS_UNKNOWN')))
  outputs={str(p.relative_to(out)):dict(sha256=filehash(p),bytes=p.stat().st_size) for p in sorted(out.rglob('*')) if p.is_file() and p.name not in {'LOCK','registry.sqlite','ARTIFACTS.json'} and not p.name.endswith('.partial')}
  save(out/'ARTIFACTS.json',dict(schema='v5-diagnostic-artifacts/1',registry_database=dict(path='registry.sqlite',sha256=m['database_sha256'],bytes=(out/'registry.sqlite').stat().st_size),outputs=outputs,version=digest(outputs),finalize_seconds=time.monotonic()-start))
 finally:db.close();other.close()
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--first',required=True);p.add_argument('--replay',required=True);a=p.parse_args();finalize(a.first,a.replay)
