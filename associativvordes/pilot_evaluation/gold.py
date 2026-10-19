"""Explicit human annotation contract. Automatic/imported labels never become gold."""
import json
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'evidence_graph'))
from graph import canonical,sha,file_hash,json_rows

RELATIONS={'direct','indirect','compound','allomorph','homonym','orthographic_variant','substring_only','semantic_distant','unrelated','inflection','uncertain'}
DECISIONS={'yes','no','uncertain'}

def new_release_directory(path):
    path=Path(path)
    if path.exists() and any(path.iterdir()):raise FileExistsError('immutable pilot release already exists; use a fresh directory, never overwrite judgments')
    path.mkdir(parents=True,exist_ok=True)
    return path

def case_hash(case):return sha({k:v for k,v in case.items() if k!='content_sha256'})
def validate_cases(cases):
    ids=set()
    for c in cases:
        if c['id'] in ids or c['content_sha256']!=case_hash(c):raise ValueError('duplicate/tampered case')
        if c['language'] not in {'en','de','fr','es','it','ru'} or not c['family'].startswith('family:') or not c['target']['lemma'] or not c['target']['lexeme_id']:raise ValueError('case identity')
        if not c['provenance'] or c['gold_status']!='unannotated':raise ValueError('cases contain no gold labels')
        ids.add(c['id'])
    return {c['id']:c for c in cases}

def validate_judgment(j,c,roster):
    person=roster.get(j.get('annotator_id'))
    if not person or person.get('kind')!='human' or not person.get('authorized_by') or not person.get('authorization_ref'):raise ValueError('human authorization missing')
    if j.get('blind_to_test_predictions') is not True or j.get('independent_review') is not True:raise ValueError('independent blinded human attestation required')
    if j.get('mode')!='human' or j.get('case_content_sha256')!=c['content_sha256'] or j.get('case_id')!=c['id']:raise ValueError('judgment scope/mode')
    if j.get('decision') not in DECISIONS or j.get('relation') not in RELATIONS:raise ValueError('judgment labels')
    if not j.get('reason','').strip() or not j.get('reviewed_at') or not j.get('evidence'):raise ValueError('manual rationale/evidence missing')
    if j['decision']!='uncertain':
        if not j.get('sense','').strip() or not j.get('pos') or not any(e.get('kind') in {'dictionary','grammar','independent_manual_document'} and e.get('locator') and e.get('finding') for e in j['evidence']):raise ValueError('independent sense/analysis evidence missing')
    if not isinstance(j.get('phenomena',[]),list) or set(j.get('phenomena',[]))-RELATIONS:raise ValueError('secondary phenomena')
    if j.get('boundaries') is not None:
        b=j['boundaries']
        if not isinstance(b,list) or any(type(i)!=int or not 0<i<len(c['target']['lemma']) for i in b) or b!=sorted(set(b)):raise ValueError('codepoint boundaries')
    if j.get('correct_families') is not None and (not isinstance(j['correct_families'],list) or any(not f.startswith('family:') for f in j['correct_families'])):raise ValueError('family identities')
    if j.get('decision')=='no' and c['family'] in (j.get('correct_families') or []):raise ValueError('contradictory family labels')
    if j.get('decision')=='yes' and j.get('correct_families') is not None and c['family'] not in j['correct_families']:raise ValueError('positive membership absent from correct families')
    if j.get('decision')=='yes' and j.get('relation') in {'substring_only','homonym','unrelated'}:raise ValueError('contradictory relation/membership')
    return j

def label(j):return {k:j.get(k) for k in ['decision','relation','phenomena','sense','pos','boundaries','correct_families','independent_model_id']}

def compile_gold(cases,judgments,roster,adjudications=()):
    index=validate_cases(cases);bycase={};adjs={}
    for a in adjudications:
        if a['case_id'] in adjs:raise ValueError('duplicate adjudication')
        adjs[a['case_id']]=a
    if set(adjs)-set(index):raise ValueError('unknown adjudication case')
    for j in judgments:
        if j.get('case_id') not in index:raise ValueError('unknown judgment case')
        validate_judgment(j,index[j['case_id']],roster)
        slot=bycase.setdefault(j['case_id'],{})
        if j['annotator_id'] in slot:raise ValueError('multiple active judgments by one person; use a new annotation release')
        slot[j['annotator_id']]=j
    rows=[];counts={'unannotated':0,'single_review':0,'disagreement':0,'adjudicated':0,'resolved':0,'uncertain':0};agreements=[]
    for c in cases:
        js=list(bycase.get(c['id'],{}).values());chosen=None;state='unannotated';required=2 if c['double_review'] else 1
        if js:
            distinct={canonical(label(j)) for j in js}
            if len(js)<required:state='single_review'
            elif len(distinct)==1:chosen=js[0];state='resolved'
            else:
                state='disagreement';a=adjs.get(c['id'])
                if a:
                    validate_judgment(a,c,roster)
                    if a['annotator_id'] in bycase[c['id']] or sorted(a.get('disputed_judgment_sha256',[]))!=sorted(sha(j) for j in js):raise ValueError('adjudication requires independent third person and exact judgments')
                    chosen=a;state='adjudicated'
            if len(js)>=2:agreements.append({'case_id':c['id'],'raters':[j['annotator_id'] for j in js],'decisions':[j['decision'] for j in js],'relations':[j['relation'] for j in js]})
        counts[state]+=1
        if chosen and chosen['decision']=='uncertain':counts['uncertain']+=1
        rows.append({'case_id':c['id'],'case_content_sha256':c['content_sha256'],'state':state,'label':label(chosen) if chosen else None,
          'judgment_refs':[sha(j) for j in js],'adjudication_ref':sha(chosen) if state=='adjudicated' else None})
    body={'schema':'pilot-gold/1','case_set_sha256':sha(cases),'roster_sha256':sha(roster),'counts':counts,'rows':rows,'agreement_observations':agreements,'trust_boundary':'roster/actor authorization must be verified by project owner; not inferred from an algorithm label'}
    return dict(body,content_sha256=sha(body))

def assignments(cases):
    """Blinded tasks contain no predicted decisions or resource confidence."""
    return [{'case_id':c['id'],'case_content_sha256':c['content_sha256'],'family':c['family'],'language':c['language'],
      'target':c['target'],'required_independent_reviews':2 if c['double_review'] else 1,'decision':None,'relation':None,'phenomena':[],
      'sense':None,'pos':None,'boundaries':None,'correct_families':None,'independent_model_id':None,
      'annotator_id':None,'mode':'human','blind_to_test_predictions':None,'independent_review':None,'reviewed_at':None,'reason':None,'evidence':[]} for c in cases]
