"""Sense-specific proof envelopes; dictionary facts and LLM suggestions are not gold."""
import hashlib
import json
STATUSES={'MEMBERSHIP_CONFIRMED','MEMBERSHIP_REJECT_PROPOSED','SENSE_SPLIT_REQUIRED','RELATION_CORRECTION_PROPOSED','HISTORICAL_BUT_SEMANTICALLY_UNRESOLVED','INSUFFICIENT_EVIDENCE'}
FINAL={'MEMBERSHIP_CONFIRMED','MEMBERSHIP_REJECT_PROPOSED','RELATION_CORRECTION_PROPOSED'}

def canonical(x):return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
def digest(x):return hashlib.sha256(canonical(x)).hexdigest()
def case_id(scope,sense):
    return 'semantic-question:'+digest([scope,sense])

def validate_case(case):
    scope=case['scope'];sense=case['dictionary_sense']
    if any(not scope.get(k) for k in ('family_id','language','lemma_id','word','source_version')):raise ValueError('missing exact legacy scope')
    if scope['language']!=sense['language'] or scope['word']!=sense['lemma']:raise ValueError('dictionary search form mismatch')
    if not sense['pos'] or not sense['publisher_sense_locator'] or not sense['source_refs']:raise ValueError('documentary sense provenance missing')
    if case['id']!=case_id(scope,sense['id']):raise ValueError('unstable sense-specific ID')
    if case['production_application_authorized'] is not False:raise ValueError('no production capability')

def triage(case,alternatives):
    validate_case(case)
    if len({s['id'] for s in alternatives})>1:return 'SENSE_SPLIT_REQUIRED'
    relation=case['dictionary_sense']['family_relation'].get(case['scope']['family_id'])
    if relation in {'HISTORICAL_SEMANTIC_BRIDGE_REVIEW','HISTORICAL_DIRECT_GENA_CLAIM_CONFLICT','INFLECTION_RELATION_REVIEW','RELATED_PATH_UNRESOLVED'}:
        return 'HISTORICAL_BUT_SEMANTICALLY_UNRESOLVED'
    return 'INSUFFICIENT_EVIDENCE'

def adjudicate(case,requested,verify_receipt=None,history_checker=None,correspondence_checker=None):
    result=dict(status='INSUFFICIENT_EVIDENCE',membership_operation='NONE',production_application_authorized=False)
    try:
        validate_case(case)
        if requested not in FINAL:raise ValueError('unsupported final proposal status')
        binding=case.get('corpus_binding',{})
        for key in ('family_id','language','lemma_id','word','source_version'):
            if binding.get(key)!=case['scope'][key]:raise ValueError('binding scope mismatch')
        if binding.get('dictionary_sense_id')!=case['dictionary_sense']['id'] or binding.get('pos')!=case['dictionary_sense']['pos'] or not binding.get('corpus_sense_id'):
            raise ValueError('exact corpus sense/POS not independently bound')
        if not case.get('all_alternative_paths_reviewed') or not case.get('family_target_meaning_ref'):
            raise ValueError('root target/alternative analyses unresolved')
        if not history_checker:raise ValueError('history unavailable')
        h=history_checker(case)
        if not (h.get('allowed') and h.get('status')=='CLEAR'):raise ValueError('historical hold')
        if requested=='MEMBERSHIP_REJECT_PROPOSED':
            if not correspondence_checker:raise ValueError('correspondence guard unavailable')
            protection=correspondence_checker(case)
            if not (protection.get('allowed') and protection.get('status')=='CLEAR'):raise ValueError('national correspondence or identity hold')
            if not case.get('positive_contradiction_refs'):raise ValueError('no evidence is not rejection')
        payload=dict(case=case,requested_status=requested)
        hsh=digest(payload);receipt=verify_receipt(hsh) if verify_receipt else None
        if not isinstance(receipt,dict) or receipt.get('payload_sha256')!=hsh or receipt.get('authority') not in {'CONFIRMED_MANUAL','INDEPENDENT_GOLD'} or receipt.get('status')!='APPROVED':
            raise ValueError('no exact independent authority receipt')
        return dict(result,status=requested,proof_sha256=hsh)
    except (ValueError,KeyError,TypeError,AttributeError,OSError) as error:
        return dict(result,reason=str(error))

def export_cases(cases):
    seen=set();result=[]
    for case in cases:
        validate_case(case)
        if case['id'] in seen:raise ValueError('duplicate semantic question')
        seen.add(case['id']);result.append(case)
    return b''.join(canonical(c)+b'\n' for c in sorted(result,key=lambda c:c['id']))

def restore_cases(data):
    cases=[json.loads(line) for line in data.splitlines() if line.strip()]
    if export_cases(cases)!=data:raise ValueError('noncanonical or corrupted sense export')
    return cases
