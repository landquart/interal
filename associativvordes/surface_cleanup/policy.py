"""Surface signals are hypotheses; authority and finite scope are separate gates."""
import hashlib,json
OPERATIONS={'REJECT_ENTIRE_FAMILY','REMOVE_EXACT_MEMBERSHIPS','SPLIT_REQUIRED','RETAIN_WITH_REVIEW','INSUFFICIENT_EVIDENCE'}
VERSION='v5-surface-proof/1'
def canonical(x):return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
def scope_hash(ids):return hashlib.sha256(canonical(sorted(ids))).hexdigest()
def signals(f,configured):
    flags=[];base=f.get('canonical','');n=f['support']
    if len(base)<=3:flags.append('SHORT_FRAGMENT_EXPOSURE')
    if f['id'] in configured:flags.append('CONFIGURED_TAIL_EXPOSURE')
    if f.get('source')=='surface_singleton' and n>1:flags.append('MULTI_MEMBER_HEURISTIC_SURFACE')
    return flags
def decide(f,flags,claim_types,history_ids=()):
    # No negative authority is manufactured from a family label, absence of
    # evidence, suffix matching, confidence, sample or a generator's claim.
    competing=bool(set(claim_types)-{'compound_morphology','morphological_parse','surface_identity'})
    historical=f.get('source')!='surface_singleton' or bool(f.get('relation_evidence'))
    disposition='RETAIN_WITH_REVIEW' if historical or competing or history_ids else 'INSUFFICIENT_EVIDENCE'
    return dict(operation=disposition,candidate=bool(flags),flags=sorted(flags),
        semantic_membership_status='UNRESOLVED',relation_evidence_status='STORED_CLAIMS_ONLY',
        independent_morphological_paths='UNKNOWN_NOT_DISPROVED',historical_correspondences='UNKNOWN_NOT_DISPROVED',
        competing_analyses='POSSIBLE_UNRESOLVED',positive_decisions='PRESERVED_NOT_OVERRIDDEN',
        sense_identity='LEGACY_UNRESOLVED',automatic_exclusion=False,history_decision_ids=sorted(history_ids))
def authorize(operation,actual_ids,proposed_ids,proof,history_result,trusted_verifier=None):
    """Rejection proof gate. This module cannot create trusted proof receipts."""
    if operation not in OPERATIONS:raise ValueError('unsupported operation')
    if operation not in {'REJECT_ENTIRE_FAMILY','REMOVE_EXACT_MEMBERSHIPS'}:return False
    if not proposed_ids or len(set(proposed_ids))!=len(proposed_ids):return False
    if operation=='REJECT_ENTIRE_FAMILY' and set(actual_ids)!=set(proposed_ids):return False
    if not set(proposed_ids)<=set(actual_ids):return False
    # Trusted existing review/authority adapters must supply a verified receipt.
    # An inline model confidence or a historical engineering delta is insufficient.
    return bool(callable(trusted_verifier) and trusted_verifier(proof) is True
        and history_result.get('allowed') and history_result.get('status')=='CLEAR'
        and proof.get('verified_existing_review_receipt') is True
        and proof.get('authority') in {'INDEPENDENT_GOLD','CONFIRMED_MANUAL'}
        and proof.get('independent_source_adapter_verified') is True
        and proof.get('all_native_identity_and_sense_bindings_verified') is True
        and proof.get('all_competing_paths_adjudicated') is True
        and proof.get('negative_scope_sha256')==scope_hash(proposed_ids)
        and proof.get('source_version_matches') is True)
