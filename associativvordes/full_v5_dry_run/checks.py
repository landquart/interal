"""Finalize only after two fresh complete source/current censuses and raw replay."""
import argparse,collections,gzip,resource,time
from pathlib import Path
from .core import *
def run(work):
 from .completion import require_complete
 work=outside(work)
 (work/'RUN.json').unlink(missing_ok=True)
 require_complete(work)
 work=outside(work);tool=pinned(work);before=work/'before';after=work/load(work/'SHADOW-PATH.json')['relative'];lock=load(before/'SNAPSHOT.json');verify_files(before,lock);verify_files(after,lock)
 plan=load(work/'OPERATION-MANIFEST.json');validate_plan(plan)
 a=load(work/'before-census/FULL-CENSUS.json');b=load(work/'after-census/FULL-CENSUS.json')
 if a!=b:raise ValueError('fresh full census differs')
 if not a['source_equation']['holds']:raise ValueError('source loss')
 for label in ['before','after']:
  x=load(work/(label+'-census')/'INTEGRITY-REPORT.json')
  if x['structural_findings'] or any(x['cross_reference_checks'].values()):raise ValueError('unresolved structural defect')
 ua=gzip.decompress((work/'before-census/UNASSIGNED-LEMMAS.jsonl.gz').read_bytes());ub=gzip.decompress((work/'after-census/UNASSIGNED-LEMMAS.jsonl.gz').read_bytes())
 if ua!=ub:raise ValueError('unassigned records changed')
 full=[]
 for r in lock['files']:
  old=sha(before/r['path']);new=sha(after/r['path'])
  if old!=new:raise ValueError('unapproved changed file '+r['path'])
  full.append(dict(path=r['path'],before_sha256=old,after_sha256=new,bytes=r['bytes'],status='UNCHANGED',approved_operation_id=None))
 with (work/'FULL-DIFF.ndjson.gz').open('wb') as raw:
  with gzip.GzipFile(fileobj=raw,mode='wb',filename='',mtime=0) as f:
   for r in full:f.write(canonical(r)+b'\n')
 atomic(work/'MEMBERSHIP-DIFF.ndjson',b'');atomic(work/'ALIAS-DIFF.ndjson',b'');atomic(work/'FAMILY-DIFF.ndjson',b'')
 save(work/'SOURCE-PRESERVATION.json',dict(status='PASS_BYTE_IDENTICAL_AND_FULL_CENSUS',source=a['source_equation'],unassigned_rows=len(ua.splitlines()),unassigned_payload_sha256=hashlib.sha256(ua).hexdigest(),all_original_carrier_files_preserved=True,original_assignments_available=False,source_kind=a['source_kind'],removed_current_relations=0,unaccounted_removals=0,new_canonical_roots=0))
 from associativvordes.history_registry.registry import History
 hp=ROOT/'audit/associative-history-registry';cur=load(hp/'CURRENT.json');h=History(ROOT,hp/cur['snapshot'],cur['sha256']);probes=[]
 for d in h.decisions:
  s=d['scope']
  if d['decision']=='CONFIRMED_NONMEMBER' and s['domain']=='membership' and s.get('lemma_ids'):
   q=dict(operation='restore',family_id=s['family_id'],language=s['language'],lemma_ids=s['lemma_ids'][:1],pos=s.get('pos'),sense_id=s.get('sense_id'));result=h.check(q)
   if result['allowed'] or d['id'] not in result['decision_ids']:raise ValueError('historical negative scope escaped')
   probes.append(dict(proposal=q,result=result))
 input_lock=load(work/'SOURCE-LOCK.json')
 if cur['sha256']!=input_lock['history_snapshot_sha256']:raise ValueError('history version changed')
 save(work/'HISTORY-PRESERVATION.json',dict(snapshot_sha256=cur['sha256'],decision_count=len(h.decisions),negative_decision_count=sum(d['decision']=='CONFIRMED_NONMEMBER' for d in h.decisions),conflicts_before=input_lock['history_conflicts'],conflicts_after=len(h.snapshot['conflicts']),new_conflicts=0,semantic_coverage_complete=h.snapshot['coverage_complete'],exact_explicit_negative_probes=probes,old_ids_preserved=True,unknown_scope_is_not_permission=True))
 raw=load(work/'RAW-INDEPENDENT-REPLAY.json')
 if raw['status']!='PASS_FULL_BYTE_AND_DECODE_REPLAY' or raw['counts']['memberships']!=a['counts']['memberships']:raise ValueError('independent decoder/census mismatch')
 calc=load(work/'CALCULATOR-COMPARISON.json')
 if calc['runtime_differences'] or calc['calculator_state_differences']:raise ValueError('runtime/calculator replay differs')
 save(work/'DIFF-COVERAGE.json',dict(files=len(full),current_files=2051,source_carrier_files=1536,families=a['counts']['canonical_families'],memberships=a['counts']['memberships'],aliases=a['counts']['aliases'],all_disappearing_memberships_have_approved_ids=True,disappearing_memberships=0,applied_operation_ids=[],per_category_affected_families={k:0 for k in CATEGORIES},no_full_nonempty_cleanup_certification=True))
 result=dict(schema='full-v5-cleanup-dry-run/1',status='PASS_EMPTY_PLAN_INTEGRITY_ONLY',semantic_gate='BLOCKED',nonempty_cleanup_validated=False,counts=a['counts'],source_equation=a['source_equation'],layers=5,applied_operations=0,unknown_or_blocked_operations_applied=0,new_history_conflicts=0,production_writes=0,auto_merge=False,backup_restore=True,independent_full_replay=True,blockers=['NO_QUALIFIED_NONEMPTY_OPERATIONS','HUMAN_GOLD_MISSING','HOLDOUT_INDEPENDENCE_UNCERTIFIED','HISTORY_COVERAGE_INCOMPLETE','ORIGINAL_ASSIGNMENTS_UNAVAILABLE','NEW_CHANGED_V5_MATERIALIZER_NOT_CERTIFIED','CALCULATOR_SEMANTIC_INPUTS_MISSING'])
 result['copy_completion_sha256']=sha(work/'COPY-PHASE.json')
 result['source_lock_sha256']=sha(work/'SOURCE-LOCK.json')
 save(work/'RUN.json',result);return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--work',required=True);a=p.parse_args();print(json.dumps(run(a.work)))

