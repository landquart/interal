"""Review admission only; never production authority or inferred family identity."""
from .core import group_id,digest,STATUSES

def may_review(p,history=None,correspondence=None,receipt=None):
 result=dict(allowed=False,status='INSUFFICIENT_EVIDENCE',production_operation='NONE')
 try:
  ids=p['family_ids']
  if p['id']!=group_id(ids) or p.get('status') not in STATUSES:raise ValueError('exact scope/status missing')
  if p.get('redirect_target') is not None and p['redirect_target'] not in ids or p.get('create_canonical_root'):raise ValueError('no new canonical roots')
  if not p.get('exact_membership_scope_sha256') or not p.get('sense_partition_receipt') or not p.get('relation_evidence_refs'):raise ValueError('fingerprint/shared ancestor is not boundary proof')
  if p.get('history_remap_old_ids')!=sorted(ids):raise ValueError('old ID constraints lost')
  for checker in [history,correspondence]:
   if checker is None:raise ValueError('guard unavailable')
   r=checker(p)
   if r.get('allowed') is not True or r.get('status')!='CLEAR':raise ValueError('historical/correspondence hold')
  h=digest(p);r=receipt(h) if receipt else None
  if not isinstance(r,dict) or r.get('payload_sha256')!=h or r.get('status')!='APPROVED' or r.get('authority') not in {'CONFIRMED_MANUAL','INDEPENDENT_GOLD'}:raise ValueError('independent exact authority missing')
  return dict(result,allowed=True,status='ELIGIBLE_FOR_FURTHER_REVIEW',proof_sha256=h)
 except (ValueError,KeyError,TypeError,AttributeError,OSError) as e:return dict(result,reason=str(e))

def check_original_scopes(scopes,history):
 if not history:return dict(allowed=False,status='HISTORY_UNAVAILABLE',checks=[])
 checks=[]
 for s in scopes:
  if not s.get('family_id') or not s.get('language') or not s.get('lemma_ids'):return dict(allowed=False,status='EXACT_OLD_SCOPE_MISSING',checks=checks)
  try:r=history(dict(s))
  except (ValueError,OSError,KeyError):return dict(allowed=False,status='HISTORY_UNAVAILABLE',checks=checks)
  checks.append(dict(original_scope=s,result=r))
  if r.get('allowed') is not True:return dict(allowed=False,status='HISTORY_HOLD',checks=checks)
 return dict(allowed=bool(checks),status='CLEAR' if checks else 'EXACT_OLD_SCOPE_MISSING',checks=checks)

def simulate(sets,aliases,target=None):
 ids=sorted(sets);group_id(ids)
 if target is not None and target not in ids:raise ValueError('new canonical root forbidden')
 sets={k:{tuple(t) for t in v} for k,v in sets.items()}
 if any(len(t)!=3 for v in sets.values() for t in v):raise ValueError('language/lemma/sense triples required')
 union=set().union(*sets.values());before=sum(map(len,sets.values()))
 return dict(family_ids=ids,status='COUNTERFACTUAL_ONLY',legacy_edges_before=before,legacy_token_union=len(union),possible_legacy_id_collapse=before-len(union),semantic_membership_delta='UNKNOWN',source_lemma_delta=0,actual_membership_delta=0,actual_alias_delta=0,actual_redirects=[],alias_union=sorted({a for k in ids for a in aliases.get(k,[])}),language_union=sorted({t[0] for t in union}),association_metrics={k:'UNKNOWN' for k in ['Di','Pr','Sh','SWOW','A','F','P','FAv','FAa']},calculator_effect='UNKNOWN',production_operation='NONE')
