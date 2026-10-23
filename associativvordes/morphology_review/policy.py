"""Relation adjudication v2: typed source availability never establishes a verdict."""
import hashlib,json
TYPES={'direct_derivation','indirect_derivation','inflection','compounding','allomorphy','borrowing','historical_inheritance','prefixation','suffixation','unconfirmed'}
FINAL={'CONFIRMED_RELATION','CONFIRMED_WRONG_RELATION','WRONG_RELATION_TYPE','COMPETING_ANALYSES'}
AUTHORITIES={'CONFIRMED_MANUAL','INDEPENDENT_GOLD'}
def canonical(x):return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
def digest(x):return hashlib.sha256(canonical(x)).hexdigest()
def endpoint(x):
    keys=('id','artifact','revision','language','lemma','pos','sense_id')
    if not isinstance(x,dict) or any(not isinstance(x.get(k),str) or not x[k] for k in keys):raise ValueError('unresolved native endpoint')
    return tuple(x[k] for k in keys)
def validate_steps(p):
    scope=p['scope']
    if any(not scope.get(k) for k in ('family_id','language','lemma_id','pos','sense_id')):raise ValueError('unresolved corpus scope')
    binding=p['native_binding'];head=endpoint(binding['head']);member=endpoint(binding['member'])
    if binding['member']['language']!=scope['language'] or binding['member']['sense_id']!=scope['sense_id'] or binding['member']['pos']!=scope['pos']:raise ValueError('binding scope mismatch')
    steps=p['steps']
    if not steps:raise ValueError('empty path')
    previous=None
    for step in steps:
        left=endpoint(step['from']);right=endpoint(step['to']);kind=step['type']
        if kind not in TYPES-{'unconfirmed','indirect_derivation'}:raise ValueError('unsupported intermediate relation')
        if previous is not None and left!=previous:raise ValueError('native/sense/artifact discontinuity')
        if step['from']['language']!=step['to']['language'] and kind not in {'borrowing','historical_inheritance'}:raise ValueError('unsupported cross-language propagation')
        if step['direction']!='directed':raise ValueError('unknown direction')
        e=step['evidence']
        if not e.get('id') or type(e.get('line')) is not int or e['line']<1 or len(e.get('raw_sha256',''))!=64:raise ValueError('missing exact evidence')
        if p['source_versions'].get(e['artifact'])!=e['artifact_sha256']:raise ValueError('unlocked source version')
        if kind=='compounding':
            if not step.get('segmentation') or not step.get('parts') or not step.get('component_meaning'):raise ValueError('unresolved compound')
            for part in step['parts']:
                endpoint(part['lexeme'])
                if not part.get('role') or not part.get('evidence_ref'):raise ValueError('unresolved component role')
        previous=right
    if endpoint(steps[0]['from'])!=head or previous!=member:raise ValueError('path does not bind head and member')
    if p['relation_type']=='direct_derivation' and (len(steps)!=1 or steps[0]['type']!='direct_derivation'):raise ValueError('not direct derivation')
    if p['relation_type']=='indirect_derivation' and len(steps)<2:raise ValueError('not indirect derivation')
    if p['relation_type'] not in TYPES-{'unconfirmed'}:raise ValueError('unknown relation type')
    if p['requested_status']=='WRONG_RELATION_TYPE' and (not p.get('old_relation_type') or p['old_relation_type']==p['relation_type']):raise ValueError('no type correction')
    if p['requested_status']=='COMPETING_ANALYSES' and (len(p.get('analyses',[]))<2 or not p.get('documented_incompatibility')):raise ValueError('coexisting types are not competing analyses')
    if not p.get('explanation'):raise ValueError('missing proof explanation')

def adjudicate(proposal,verify_receipt=None):
    """Verifier is an independently configured registry adapter, never input booleans.

    Trusted receipt must bind the complete proposal hash, including exact source
    versions, scope, endpoints, evidence, competing analyses and explanation.
    This is a proof-envelope validator, not an automatic linguistic expert.
    """
    result=dict(status='INSUFFICIENT_EVIDENCE',membership_operation='NONE',alternatives_preserved=True)
    try:
        if proposal.get('requested_status') not in FINAL:raise ValueError('no supported requested verdict')
        validate_steps(proposal)
        if verify_receipt is None:raise ValueError('independent authority unavailable')
        payload={k:v for k,v in proposal.items() if k not in ('receipt_refs','model_confidence')};h=digest(payload)
        receipts=[verify_receipt(ref,h) for ref in proposal.get('receipt_refs',[])]
        if not any(isinstance(r,dict) and r.get('payload_sha256')==h and r.get('authority') in AUTHORITIES and r.get('status')=='APPROVED' for r in receipts):raise ValueError('no exact authoritative receipt')
        result.update(status=proposal['requested_status'],proof_sha256=h)
    except (KeyError,ValueError,TypeError,AttributeError,OSError) as e:result['reason']=str(e)
    return result

def unresolved_reasons(mask,rows,history,flags):
    reasons=['NATIVE_LEXEME_UNBOUND','SENSE_UNBOUND','ROOT_COMPONENT_PATH_UNVERIFIED']
    if not rows:reasons.append('SOURCE_ROWS_MISSING_NOT_NEGATIVE')
    if mask.bit_count()>1:reasons.append('COEXISTING_CANDIDATE_TYPES_NOT_VERIFIED_CONFLICT')
    if 'COMPOUND_CLAIM_UNVERIFIED' in flags:reasons.append('COMPOUND_SEGMENTATION_ROLE_MEANING_UNVERIFIED')
    if history:reasons.append('EXACT_HISTORY_OVERLAP')
    return reasons

def guard_application(proposal,history_checker=None):
    if history_checker is None:return dict(allowed=False,status='HISTORY_UNAVAILABLE')
    try:
        result=history_checker(proposal)
        return dict(allowed=bool(result.get('allowed') and result.get('status')=='CLEAR'),status=result.get('status','HISTORY_UNAVAILABLE'))
    except (OSError,ValueError,TypeError,AttributeError):return dict(allowed=False,status='HISTORY_UNAVAILABLE')
