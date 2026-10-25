"""Authenticated human observations and descriptive calibration, not writer rights.

Trust dictionaries come from a separately verified coordinator, never answers.
They bind exact packet/response/identity hashes. Real people are not synthesized
by filling a roster. Invalid scientific interpretations remain observable.
"""
from datetime import datetime
import collections,json,math,statistics,hashlib
from pathlib import Path
from ..identity_mapping.model import canonical,digest
LANGUAGES=('en','de','fr','es','it','ru')
VERDICTS={'VALID','INVALID','UNCERTAIN'}
HERE=Path(__file__).parent
def scientific_contract():
    files={}
    for base in [HERE,HERE.parent/'normative']:
        for p in sorted(base.rglob('*')):
            if p.is_file() and '__pycache__' not in p.parts and not p.name.startswith('test_') and '.test.' not in p.name and p.suffix in {'.py','.mjs','.json','.md'}:
                files[str(p.relative_to(HERE.parent))]=hashlib.sha256(p.read_bytes()).hexdigest()
    return dict(protocol_sha256=digest(json.loads((HERE/'protocol.json').read_bytes())),instructions_sha256=hashlib.sha256((HERE/'INSTRUCTIONS.md').read_bytes()).hexdigest(),scientific_implementation_sha256=digest(files))
COMPARE=('verdict','lexeme','language','pos','sense','normative_root','national_correspondence','morphological_relation')
FIELDS={'schema','study_sha256','protocol_sha256','question_id','question_sha256','actor_id','role','action','lexeme','language','pos','sense','normative_root','national_correspondence','morphological_relation','verdict','grounds','sources','rule_issues','started_at','completed_at','active_seconds','blind_to_predictions','blind_to_other_review','exposure_report'}

def require(value,reason):
    if not value:raise ValueError(reason)

def date(value):
    require(isinstance(value,str),'timestamp required');d=datetime.fromisoformat(value.replace('Z','+00:00'));require(d.tzinfo is not None,'timezone required');return d

def approved(trust,kind,payload):
    r=trust.get(kind,{}).get(digest(payload),{})
    return r.get('status')=='VERIFIED' and r.get('payload_sha256')==digest(payload) and bool(r.get('verification_ref'))

def person(actor,language,role,roster,trust):
    p=roster.get(actor)
    require(isinstance(p,dict) and p.get('kind')=='human','real verified human required')
    require(p.get('person_key') and p.get('authorization_ref') and p.get('competence_refs') and p.get('identity_verification_ref') and p.get('conflicts_review_ref'),'verified identity/authorization/language/morphology competence/conflict review required')
    require(language in p.get('qualified_languages',[]) and role in p.get('roles',[]),'qualified language/role required')
    require(approved(trust,'person_verifications',p),'self-declared roster cannot establish a human')
    return p

def check_response(r,q,study_hash,protocol_hash,roster,assignments,trust,arbiter=False):
    expected=FIELDS|({'review_sha256'} if arbiter else set())
    require(isinstance(r,dict) and set(r)==expected,'closed complete response schema required')
    require(r['schema']=='interal-human-calibration-response/1','incompatible response schema')
    require(r['study_sha256']==study_hash and r['protocol_sha256']==protocol_hash and r['question_id']==q['question_id'] and r['question_sha256']==q['question_sha256'],'exact study/protocol/question required')
    require(r['lexeme']==q['lexeme'] and r['language']==q['language'],'question lexical scope mismatch')
    role='arbiter' if arbiter else r['role'];require(role in {'A','B','arbiter'} and (arbiter or role in {'A','B'}),'independent slots A/B required')
    require(r['role']==role and r['action']==('arbitrate' if arbiter else 'independent_review'),'arbitration cannot replace initial response')
    p=person(r['actor_id'],q['language'],role,roster,trust)
    assignment=next((a for a in assignments if a.get('language')==q['language'] and a.get('role')==role),None)
    require(assignment is not None and assignment.get('actor_id')==r['actor_id'] and assignment.get('study_sha256')==study_hash and approved(trust,'assignment_verifications',assignment),'verified frozen assignment required')
    require(approved(trust,'submission_verifications',r),'authenticated exact human submission required')
    delivery=dict(study_sha256=study_hash,actor_id=r['actor_id'],role=role,question_id=q['question_id'],question_sha256=q['question_sha256'])
    require(approved(trust,'delivery_verifications',delivery),'separate blind packet delivery receipt required')
    require(r['blind_to_predictions'] is True and (arbiter or r['blind_to_other_review'] is True),'blinding attestation required')
    require(r['verdict'] in VERDICTS and isinstance(r['grounds'],str) and bool(r['grounds'].strip()),'verdict and independent grounds required')
    require(isinstance(r['sources'],list) and isinstance(r['rule_issues'],list),'sources and instruction issues must be arrays')
    require(all(isinstance(x,str) and x.strip() for x in r['rule_issues']),'instruction issue text required')
    for source in r['sources']:
        require(isinstance(source,dict) and all(isinstance(source.get(k),str) and source[k].strip() for k in ('publisher','version','locator','finding')) and bool(source.get('url') or source.get('archive_ref')),'documentary source/entry/finding required')
    start,end=date(r['started_at']),date(r['completed_at']);require(end>=start,'reversed review times')
    seconds=r['active_seconds'];require(type(seconds) in (int,float) and math.isfinite(seconds) and 0<=seconds<=(end-start).total_seconds(),'invalid active time')
    issues=[]
    if r['exposure_report']:issues.append('BLINDING_EXPOSURE')
    if r['verdict']!='UNCERTAIN':
        if not all(r[k] for k in ('pos','sense','normative_root','national_correspondence','morphological_relation')):issues.append('RESOLVED_VERDICT_WITH_INCOMPLETE_SCIENTIFIC_SCOPE')
        if not r['sources']:issues.append('RESOLVED_VERDICT_WITHOUT_DOCUMENTARY_EVIDENCE')
    return p,issues

def agreement(pairs):
    n=len(pairs);matrix={a:{b:0 for b in sorted(VERDICTS)} for a in sorted(VERDICTS)}
    for a,b in pairs:matrix[a][b]+=1
    raw=sum(a==b for a,b in pairs)/n if n else None
    expected=sum(sum(matrix[a].values())*sum(matrix[b][a] for b in matrix) for a in matrix)/(n*n) if n else None
    k=(raw-expected)/(1-expected) if expected is not None and expected<1 else None
    return dict(pairs=n,confusion=matrix,raw_agreement=raw,cohens_kappa=k,kappa_undefined_reason='No paired responses or degenerate marginals' if k is None else None)

def time_summary(values):
    return dict(n=len(values),mean_seconds=statistics.mean(values) if values else None,median_seconds=statistics.median(values) if values else None,measurement='self-reported active seconds, bounded by reported wall duration')

def analyze(questions,reviews,arbitrations,roster,assignments,protocol,study_hash,trust=None):
    trust=trust or {};ph=digest(protocol);index={q['question_id']:q for q in questions}
    require(len(index)==len(questions),'duplicate questions')
    contract=scientific_contract()
    for q in questions:
        require(q['question_sha256']==digest({k:v for k,v in q.items() if k!='question_sha256'}),'question checksum mismatch')
        require(q.get('protocol_sha256')==ph and q.get('instructions_sha256')==contract['instructions_sha256'],'question instruction/protocol version mismatch')
    require(len({(a.get('language'),a.get('role')) for a in assignments})==len(assignments),'duplicate role assignment')
    slots={};people={};issues={};adjs={}
    for r in reviews:
        require(r.get('question_id') in index,'unknown initial response question');key=(r['question_id'],r.get('role'));require(key not in slots,'immutable initial slot already occupied')
        p,i=check_response(r,index[r['question_id']],study_hash,ph,roster,assignments,trust);slots[key]=r;people[key]=p['person_key'];issues[key]=i
    for r in arbitrations:
        require(r.get('question_id') in index and r['question_id'] not in adjs,'unknown/duplicate arbitration')
        p,i=check_response(r,index[r['question_id']],study_hash,ph,roster,assignments,trust,True);adjs[r['question_id']]=(r,p['person_key'],i)
    groups={k:[] for k in ('overall',)+LANGUAGES};durations={k:[] for k in groups};scientific={k:collections.Counter() for k in groups};cats=collections.Counter();gold=[];ledger=[];pending=0;paired=0;issues_total=0
    for q in questions:
        qid=q['question_id'];a,b=slots.get((qid,'A')),slots.get((qid,'B'));lang=q['language'];state='UNANNOTATED';value=None;refs=[]
        for role,r in [('A',a),('B',b)]:
            if r:
                refs.append(digest(r));durations['overall'].append(r['active_seconds']);durations[lang].append(r['active_seconds']);issues_total+=len(r['rule_issues'])+len(issues[(qid,role)])
        if a or b:state='SINGLE_REVIEW'
        if a and b:
            paired+=1;require(people[(qid,'A')]!=people[(qid,'B')],'two accounts of the same person are not independent')
            for key in ('overall',lang):
                groups[key].append((a['verdict'],b['verdict']))
                for field in COMPARE:scientific[key][field]+=a[field]!=b[field]
            differences=[f for f in COMPARE if a[f]!=b[f]]
            audit=int(digest([protocol['arbitration']['agreement_audit_seed'],qid]),16)%10==0
            scientific_issues=issues[(qid,'A')]+issues[(qid,'B')]
            needs=bool(differences or scientific_issues or a['verdict']=='UNCERTAIN' or audit or a['rule_issues'] or b['rule_issues'])
            cats.update(differences)
            if needs:
                state='ARBITRATION_REQUIRED';pending+=1
                adj=adjs.get(qid)
                if adj:
                    r,pk,adj_issues=adj;require(pk not in {people[(qid,'A')],people[(qid,'B')]},'third independent expert required')
                    require(sorted(r['review_sha256'])==sorted(refs),'arbitration must reference both exact original responses')
                    require(date(r['started_at'])>=max(date(a['completed_at']),date(b['completed_at'])),'arbitration precedes frozen initial responses')
                    issues_total+=len(r['rule_issues'])+len(adj_issues)
                    if not adj_issues:state='ADJUDICATED';value=r['verdict'];pending-=1;refs.append(digest(r))
                ledger.append(dict(question_id=qid,state=state,dimensions=differences,uncertainty=a['verdict']=='UNCERTAIN' or b['verdict']=='UNCERTAIN',prespecified_agreement_audit=audit,initial_review_sha256=refs[:2],arbitration_sha256=refs[2] if len(refs)>2 else None))
            else:state='DOUBLE_REVIEWED';value=a['verdict']
        require(qid not in adjs or state in {'ADJUDICATED','ARBITRATION_REQUIRED'} and a and b,'arbitration cannot substitute for two initial reviews')
        if value is not None:gold.append(dict(question_id=qid,question_sha256=q['question_sha256'],verdict=value,state=state,response_sha256=refs,scientific_answer={f:(adjs[qid][0] if state=='ADJUDICATED' else a)[f] for f in COMPARE},production_application_authorized=False))
    metrics={key:dict(**agreement(values),dimension_disagreements=dict(scientific[key]),timing=time_summary(durations[key])) for key,values in groups.items()}
    reasons=[]
    expected=protocol['cases_per_language']*len(protocol['languages']);counts=collections.Counter(q['language'] for q in questions)
    if len(questions)!=expected or any(counts[l]!=protocol['cases_per_language'] for l in protocol['languages']):reasons.append('FIXED_PER_LANGUAGE_VOLUME_NOT_MET')
    if len(reviews)!=2*expected or paired!=expected:reasons.append('TWO_AUTHENTICATED_HUMAN_RESPONSES_REQUIRED_FOR_EVERY_CASE')
    if pending:reasons.append('ARBITRATIONS_PENDING')
    if len(gold)!=expected:reasons.append('INCOMPLETE_HUMAN_GOLD')
    thresholds=protocol['calibration_gates']
    for group,m in metrics.items():
        if m['raw_agreement'] is None or m['cohens_kappa'] is None or m['raw_agreement']<thresholds['raw_agreement_minimum'] or m['cohens_kappa']<thresholds['cohens_kappa_minimum']:reasons.append('AGREEMENT_NOT_ESTABLISHED:'+group)
    for lang in protocol['languages']:
        labels={g['verdict'] for g in gold if index[g['question_id']]['language']==lang}
        if not {'VALID','INVALID'}.issubset(labels):reasons.append('RESOLVED_POSITIVE_AND_NEGATIVE_COVERAGE_NOT_ESTABLISHED:'+lang)
    if issues_total:reasons.append('INSTRUCTION_OR_SCIENTIFIC_DEFECTS_REQUIRE_REVISED_PROTOCOL_AND_NEW_ROUND')
    for key in protocol['release_prerequisites']:
        attestation=dict(study_sha256=study_hash,protocol_sha256=ph,prerequisite=key)
        if not approved(trust,'study_verifications',attestation):reasons.append('UNVERIFIED_PREFLIGHT:'+key)
    if any(q.get('release_status')!='RELEASED' for q in questions):reasons.append('PROVISIONAL_PACKETS_NOT_RELEASED')
    signoff=dict(study_sha256=study_hash,protocol_sha256=ph,review_set_sha256=digest(reviews),arbitration_set_sha256=digest(arbitrations),instructions_final=True)
    if not approved(trust,'protocol_signoffs',signoff):reasons.append('INDEPENDENT_FINAL_PROTOCOL_SIGNOFF_MISSING')
    return dict(schema='interal-human-calibration-analysis/1',status='PASS_CALIBRATION_ONLY' if not reasons else 'BLOCKED',study_sha256=study_hash,protocol_sha256=ph,instructions_sha256=contract['instructions_sha256'],scientific_implementation_sha256=contract['scientific_implementation_sha256'],registered_roster_entries=len(roster),accepted_human_reviews=len(reviews),accepted_arbitrations=len(arbitrations),paired_cases=paired,human_gold=gold,arbitration_ledger=ledger,pending_arbitrations=pending,metrics=metrics,disagreement_dimensions=dict(cats),instruction_issue_count=issues_total,arbiter_timing=time_summary([r['active_seconds'] for r,_,_ in adjs.values()]),blockers=reasons,main_annotation_allowed=not reasons,production_application_authorized=False)

def require_main_annotation(analysis,trust=None):
    """A separately verified calibration can open collection, never production."""
    trust=trust or {}
    require(isinstance(analysis,dict) and analysis.get('schema')=='interal-human-calibration-analysis/1' and analysis.get('status')=='PASS_CALIBRATION_ONLY' and analysis.get('main_annotation_allowed') is True and analysis.get('blockers')==[],'BLOCKED: completed independent human calibration required')
    contract=scientific_contract()
    require(all(analysis.get(k)==v for k,v in contract.items()),'BLOCKED: stale calibration protocol, instructions, normative rules or implementation')
    proof=dict(study_sha256=analysis.get('study_sha256'),protocol_sha256=analysis.get('protocol_sha256'),analysis_sha256=digest(analysis),calibration_complete=True)
    require(approved(trust,'calibration_verifications',proof),'BLOCKED: independent content-bound calibration verification required')
    return dict(collection_allowed=True,production_application_authorized=False,calibration_analysis_sha256=digest(analysis))
