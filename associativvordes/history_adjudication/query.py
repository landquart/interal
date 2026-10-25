"""Explain historical constraints without granting any write authority."""
import argparse,hashlib,json
from pathlib import Path
from associativvordes.history_registry.registry import History,canonical

def explain(report_path,expected_sha256,history,proposal):
 raw=Path(report_path).read_bytes()
 if hashlib.sha256(raw).hexdigest()!=expected_sha256:raise ValueError('adjudication registry checksum')
 report=json.loads(raw)
 if report.get('schema')!='interal-history-adjudication/1' or report.get('source_snapshot_sha256')!=history.digest:raise ValueError('incompatible historical registry')
 if report.get('coverage',{}).get('mutation_authorization') is not False:raise ValueError('unsupported authority escalation')
 original={d['id']:d for d in history.decisions}
 if {x['original_decision']['id'] for x in report['previous_constraints']}!=set(original):raise ValueError('historical restrictions omitted')
 for x in report['previous_constraints']:
  if x['original_decision']!=original[x['original_decision']['id']]:raise ValueError('historical scope or authority changed')
 if {x['source']['blob'] for x in report['conflict_resolution_ledger']}!={x['source'] for x in history.snapshot['conflicts']}:raise ValueError('historical problem sources omitted')
 operation=proposal.get('operation');family=proposal.get('family_id');lang=proposal.get('language');lids=proposal.get('lemma_ids')
 if operation not in {'delete','restore','merge','change_membership','change_alias'} or not family:raise ValueError('finite historical operation required')
 if operation=='merge':raise ValueError('independent finite source/destination checks and reviewed identity mapping required')
 if not proposal.get('data_version'):raise ValueError('explicit corpus version required')
 if operation!='change_alias' and (not lang or not isinstance(lids,list) or not lids or not all(isinstance(x,str) and x for x in lids)):raise ValueError('finite language/native IDs required')
 domain='alias' if operation=='change_alias' else 'membership';hits=[]
 for d in history.decisions:
  s=d['scope']
  if s['domain']!=domain or s.get('family_id')!=family:continue
  if domain=='alias':
   if s.get('alias')!=proposal.get('alias'):continue
  else:
   if s.get('language')!=lang or not set(lids)&history.ids(d):continue
   if any(s.get(k) is not None and proposal.get(k) is not None and s[k]!=proposal[k] for k in ['pos','sense_id']):continue
  hits.append(dict(id=d['id'],scope=s,operation=d['operation'],authority=d['authority'],historical_outcome=d.get('historical_outcome'),source=d['source'],data_version=d['data_version'],supersession_chain=d['supersedes'],restoration_requires_new_independent_proof=True))
 for d in report.get('record_update_safeguards',[]):
  s=d['scope']
  if domain=='membership' and s['family_id']==family and s['language']==lang and set(lids)&set(s['lemma_ids']):hits.append(d)
 quarantines=[]
 for entry in report['conflict_resolution_ledger']:
  if entry['resolution']!='QUARANTINED_UNRESOLVED':continue
  scope=entry['scope'];families=scope.get('explicit_family_ids',[]);langs=scope.get('explicit_languages',[])
  global_potential=scope.get('kind')=='GLOBAL_UNKNOWN_POTENTIAL' or scope.get('unbound_quarantined_observations',0)>0 or not families
  # No implicit family-ID or language mapping; an unknown alignment remains held.
  if global_potential or family in families:
   quarantines.append(dict(id=entry['id'],source=entry['source'],potential_scope=scope,scope_kind='UNKNOWN_POTENTIAL' if global_potential else 'EXPLICIT_FAMILY_POTENTIAL',authority='UNVERIFIED',exact_lexical_rejection=False))
 return dict(status='HISTORY_QUARANTINE' if quarantines else 'HISTORY_REVIEW_REQUIRED' if hits else 'HISTORY_SCOPE_CLEAR_NO_AUTHORIZATION',allowed=False,applicable_prior_decisions=hits,applicable_quarantines=quarantines,linguistic_rejection=False,scope_matched_by='native family/language/lemma IDs; known POS/sense; no spelling expansion',data_version=proposal['data_version'],global_semantic_certification=False,reason='Documentary explanation only; no write grant, automatic restoration or implicit supersession')
def main():
 p=argparse.ArgumentParser();p.add_argument('--repo',required=True);p.add_argument('--registry',required=True);p.add_argument('--registry-sha256',required=True);p.add_argument('--restored',required=True);p.add_argument('--proposal',required=True);a=p.parse_args();root=Path(a.restored);raw=(root/'REGISTRY.json').read_bytes();h=History(a.repo,root/'REGISTRY.json',hashlib.sha256(raw).hexdigest(),root/'objects');print(json.dumps(explain(a.registry,a.registry_sha256,h,json.loads(Path(a.proposal).read_text())),ensure_ascii=False))
if __name__=='__main__':main()
