"""Two independent qualified humans; arbitration never masquerades as review."""
from datetime import datetime
from associativvordes.family_boundary.core import digest

LABELS={'VALID','INVALID','UNCERTAIN'}
def validate(j,case,roster,role):
    person=roster.get(j.get('actor_id'),{})
    if person.get('kind')!='human' or not person.get('authorization_ref') or case['language'] not in person.get('qualified_languages',[]):raise ValueError('qualified authorized human required')
    if role not in person.get('roles',[]):raise ValueError('wrong human role')
    if j.get('action')!=('arbitrate' if role=='arbiter' else 'independent_review'):raise ValueError('arbitration is not independent review')
    if j.get('case_id')!=case['id'] or j.get('case_sha256')!=case['content_sha256'] or j.get('protocol_sha256')!=case['protocol_sha256']:raise ValueError('exact reviewed scope/code lock')
    if j.get('blind_to_predictions') is not True or role!='arbiter' and j.get('blind_to_other_review') is not True:raise ValueError('blindness attestation')
    if j.get('verdict') not in LABELS or not j.get('reason') or not j.get('sources'):raise ValueError('incomplete human answer')
    date=datetime.fromisoformat(j['reviewed_at'].replace('Z','+00:00'))
    if date.tzinfo is None:raise ValueError('timezone required')
    if j['verdict']!='UNCERTAIN' and (not j.get('pos') or not j.get('sense') or not any(s.get('locator') and s.get('finding') and s.get('publisher') for s in j['sources'])):raise ValueError('independent POS/sense/source evidence required')
    return j

def compile_gold(cases,reviews,arbitrations,roster):
    index={c['id']:c for c in cases};by={};adjs={}
    if len(index)!=len(cases) or any(c['content_sha256']!=digest({k:v for k,v in c.items() if k!='content_sha256'}) for c in cases):raise ValueError('case checksum/duplicate')
    for j in reviews:
        if j.get('case_id') not in index:raise ValueError('unknown review case')
        validate(j,index[j['case_id']],roster,j.get('role'))
        if j.get('role') not in ('A','B'):raise ValueError('two reviewer slots only')
        k=(j['case_id'],j['role'])
        if k in by:raise ValueError('immutable review slot duplicate')
        by[k]=j
    for j in arbitrations:
        if j.get('case_id') not in index or j['case_id'] in adjs:raise ValueError('adjudication identity')
        validate(j,index[j['case_id']],roster,'arbiter');adjs[j['case_id']]=j
    rows=[];pairs=[];logs=[]
    for c in cases:
        a,b=by.get((c['id'],'A')),by.get((c['id'],'B'));gold=None;state='UNANNOTATED'
        refs=[digest(j) for j in (a,b) if j]
        if a or b:state='SINGLE_REVIEW'
        if a and b:
            if a['actor_id']==b['actor_id']:raise ValueError('distinct reviewers required')
            pairs.append((a['verdict'],b['verdict']))
            # Labels alone are insufficient if human sense/POS/relation differ.
            same=all(a.get(k)==b.get(k) for k in ('verdict','pos','sense','relation'))
            audit=int(digest(c['id'])[:8],16)%10==0
            needs=not same or a['verdict']=='UNCERTAIN' or audit
            if needs:
                state='ARBITRATION_REQUIRED';adj=adjs.get(c['id'])
                if adj:
                    if adj['actor_id'] in (a['actor_id'],b['actor_id']) or sorted(adj.get('review_sha256',[]))!=sorted(refs):raise ValueError('independent arbiter bound to original reviews required')
                    state='ADJUDICATED';gold=adj['verdict'];refs.append(digest(adj))
                logs.append(dict(case_id=c['id'],state=state,review_sha256=refs[:2],reason='disagreement_uncertain_or_prespecified_agreement_audit'))
            else:state='DOUBLE_REVIEWED';gold=a['verdict']
        if c['id'] in adjs and state not in ('ADJUDICATED',):raise ValueError('unsolicited arbitration cannot replace independent reviews')
        rows.append(dict(case_id=c['id'],case_sha256=c['content_sha256'],state=state,gold=gold,decision_refs=refs))
    return dict(schema='cleanup-frozen-gold/1',case_set_sha256=digest(cases),roster_sha256=digest(roster),rows=rows,agreement_pairs=pairs,disagreement_log=logs,completed_human_reviews=len(reviews),completed_arbitrations=len(arbitrations),trust='Roster authorization is externally verified by owner, never inferred from self-attestation or model confidence')
