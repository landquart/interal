#!/usr/bin/env python3
"""Offline-first research preannotation. No production mutation capability."""
import argparse
from collections import Counter,defaultdict,deque
from concurrent.futures import ThreadPoolExecutor,wait,FIRST_COMPLETED
import copy
import gzip
import json
from pathlib import Path
import re
import sys
import time
from contract import canonical,sha,file_hash,card_for,frozen_question,abstention
from storage import Store,atomic,backup,restore
from providers import Client,configuration,forecast,now

REPO=Path(__file__).resolve().parents[2]
def code_version():
    paths=[]
    for d in ('auto_annotation','candidate_search','evidence_graph','importers','review','pilot_evaluation','history_registry'):
        paths.extend(p for p in (REPO/'associativvordes'/d).glob('*.py') if not p.name.startswith('test_'))
    return sha({p.relative_to(REPO).as_posix():file_hash(p) for p in sorted(paths)})

def rows(path):
    opener=gzip.open if str(path).endswith('.gz') else open
    with opener(path,'rt',encoding='utf-8') as f:
        for l in f:
            if l.strip():yield json.loads(l)

def load_input(path,registry=None):
    path=Path(path)
    if path.is_dir():
        m=json.loads((path/'MANIFEST.json').read_text())
        if m.get('schema')!='mass-candidate-release/1' or m.get('version')!=sha({k:v for k,v in m.items() if k!='version'}):
            raise ValueError('mass manifest integrity')
        qpath=path/'questions.ndjson'
        if file_hash(qpath)!=m['outputs']['questions.ndjson']:raise ValueError('questions checksum')
        if not registry:raise ValueError('actual --registry required for mass queue')
        from source import checked
        import sqlite3
        r=checked(registry,Path(registry).parent/'REGISTRY.json')
        if r['database_sha256']!=m['identity']['registry']:raise ValueError('registry dependency mismatch')
        db=sqlite3.connect(Path(registry).resolve().as_uri()+'?mode=ro',uri=True)
        try:known={r[0] for r in db.execute('SELECT family FROM family_fingerprints')}
        finally:db.close()
        if set(m['identity']['families'])-known:raise ValueError('unknown canonical family')
        qs=list(rows(qpath))
        if len(qs)!=m['counts']['questions']:raise ValueError('question count')
        from graph import lookup
        for q in qs:
            if q['family'] not in m['identity']['families'] or q['language'] not in m['identity']['languages']:
                raise ValueError('question outside actual family/language scope')
            if q['id']!='candidate:'+sha([q['family'],q['language'],lookup(q['lemma']),q['pos']]):
                raise ValueError('unstable upstream question ID')
        identity=dict(kind='mass02',manifest_sha256=file_hash(path/'MANIFEST.json'),
                      input_sha256=file_hash(qpath),source=m['identity']['source'],registry=r['database_sha256'],
                      source_version=m['version'],search_parameters=m['identity'])
    else:
        pilot=REPO/'associativvordes'/'pilot_evaluation'
        sys.path.insert(0,str(pilot))
        from gold import validate_cases
        cases=list(rows(path));validate_cases(cases)
        protocol=json.loads(Path(__file__).with_name('protocol05.json').read_text())
        if len(cases)!=protocol['cases'] or sha(cases)!=protocol['frozen_case_set_sha256']:
            raise ValueError('frozen pilot scope mismatch')
        qs=[frozen_question(c) for c in cases]
        identity=dict(kind='frozen04',input_sha256=file_hash(path),case_set_sha256=sha(cases),
          protocol_sha256=file_hash(Path(__file__).with_name('protocol05.json')))
    if len({q['id'] for q in qs})!=len(qs):raise ValueError('duplicate source question')
    return qs,identity

def fair_order(cards):
    lanes=defaultdict(deque)
    for card in sorted(cards,key=lambda c:c['candidate_id']):
        relation=','.join(sorted({p.get('category',p.get('proposed_category','unresolved')) for p in card['paths']})) or 'unresolved'
        lanes[(card['language'],relation)].append(card)
    while any(lanes.values()):
        for lane in sorted(lanes):
            if lanes[lane]:yield lanes[lane].popleft()

def prepare(store,questions,identity,source_index=None,family_context=None,aux_index=None):
    from source import NativeSource
    source=None
    if source_index:
        if identity['kind']!='mass02':raise ValueError('native index only with mass02 manifest; frozen graph refs are separate')
        source=NativeSource(source_index,identity['source'],aux_index)
    cards=[];duplicates=0
    try:
        for original in questions:
            q,raw=(source.enrich(original) if source else (copy.deepcopy(original),{}))
            seen={}
            for lex in q['lexeme_alternatives']:
                if lex['id'] in seen:
                    if seen[lex['id']]!=lex:raise ValueError('conflicting duplicate native identity')
                    duplicates+=1;continue
                seen[lex['id']]=lex
                card=card_for(q,lex,identity,raw,(family_context or {}).get(q['family']))
                reference=store.put(original)
                store.append('card',card['content_sha256'],dict(card=card,question_ref=reference))
                cards.append(card)
    finally:
        if source:source.close()
    return list(fair_order(cards)),duplicates

def stage_a(card):
    result=abstention('DETERMINISTIC_HAS_NO_SEMANTIC_GOLD',card)
    if card['productive_paths']:
        refs=sorted({e['id'] for p in card['productive_paths'] for e in
            p.get('evidence_refs',[]) if isinstance(e,dict)})
        for p in card['productive_paths']:
            for step in p['steps']:
                es=step.get('evidence_refs',[]) or [step.get('evidence',{})]
                refs.extend(e['id'] for e in es if isinstance(e,dict) and e.get('id'))
        refs=sorted(set(refs)&{e['id'] for e in card['source_assertions']})
        if refs:
            result['assessments']['formal_morphology']={'state':'supported','evidence_refs':refs}
            result['assessments']['derivation']={'state':'supported','evidence_refs':refs}
            result['evidence_refs']=refs
    result['uncertainty_flags']=sorted(set(result['uncertainty_flags']+card['risk_flags']))
    return result

def historical_check(card, decision):
    import importlib.util
    module_path=REPO/'associativvordes'/'history_registry'/'registry.py'
    try:
        spec=importlib.util.spec_from_file_location('interal_historical_constraints',module_path)
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        root=REPO/'audit'/'associative-history-registry'
        current=json.loads((root/'CURRENT.json').read_text())
        # A native lexeme ID is not a corpus lemma ID. Missing alignment is a hold.
        lex=card['lexeme']
        ids=lex.get('corpus_lemma_ids',[])
        if lex['id'].startswith('lemma:'):ids=sorted(set(ids+[lex['id']]))
        return module.check(REPO,root/current['snapshot'],current['sha256'],dict(
            operation='restore' if decision=='PROPOSE_INCLUDE' else 'delete',
            family_id=card['family_id'],language=card['language'],lemma_ids=ids,
            pos=lex.get('pos'),sense_id=None))
    except (OSError,ValueError,KeyError,ImportError) as e:
        return dict(status='HISTORY_UNAVAILABLE',allowed=False,reasons=[str(e)])


def classify(card,client,route,run_id,recipe_hash):
    a=stage_a(card);answer=a;stages=[{'stage':'A','status':'DETERMINISTIC_OBSERVATION','response':a}]
    if route!='deterministic':
        b,meta=client.request(card,'B');stages.append(dict(stage='B',**meta,response=b))
        if b:answer=b
        if route in {'multi','mixed'} and (card['risk_flags'] or not b or b['decision']!='ABSTAIN' or b['uncertainty_flags']):
            c,meta=client.request(card,'C') # original card only; B response is never passed.
            stages.append(dict(stage='C',**meta,response=c))
            if not b or not c:answer=abstention('INCOMPLETE_MULTI_STAGE_REVIEW',card)
            elif (b['decision'],b['relation_type'],b['identity_status'],b['sense_ids']) != (
                  c['decision'],c['relation_type'],c['identity_status'],c['sense_ids']):
                answer=abstention('MODEL_DISAGREEMENT',card)
            else:answer=b
    reasons=list(card['risk_flags'])
    if answer['decision']=='PROPOSE_INCLUDE' and reasons:
        answer=abstention('DETERMINISTIC_RISK_REQUIRES_HUMAN',card)
    if answer['decision']=='PROPOSE_EXCLUDE' and not card['source_assertions']:
        answer=abstention('NO_EVIDENCE_IS_NOT_A_REJECTION',card)
    history=historical_check(card,answer['decision'])
    if answer['decision'] in {'PROPOSE_INCLUDE','PROPOSE_EXCLUDE'} and not history['allowed']:
        answer=abstention(history['status'],card)
    model_ids=[(s.get('provider'),s.get('model'),s.get('model_version')) for s in stages if s['stage']!='A' and s.get('model')]
    return dict(schema='preannotation-proposal/1',history_check=history,candidate_id=card['candidate_id'],question_id=card['question_id'],
      family_id=card['family_id'],language=card['language'],lexeme=card['lexeme'],card_sha256=card['content_sha256'],
      proposed_decision=answer['decision'],identity_resolution=answer['identity_status'],
      relation_type=answer['relation_type'],assessments=answer['assessments'],
      evidence_refs=answer['evidence_refs'],source_versions=card['source_assertions'],
      contradictions=answer['contradictions'],explanation=answer['explanation'],
      explanation_status='unverified_model_interpretation' if answer is not a else 'deterministic_observation',
      uncertainty_flags=sorted(set(reasons+answer['uncertainty_flags'])),models=stages,
      model_agreement_independence='not_independent_same_model' if len(model_ids)>1 and len(set(model_ids))==1 else 'unknown',
      evidence_independence=card['independence'],run_id=run_id,recipe_sha256=recipe_hash,
      calibrated_reliability=None,needs_human_review=True,production_writes=0,human_decision_events=0,
      triage_category='LOW_EVIDENCE' if 'low_morphological_evidence' in reasons else
        'CONFLICT' if any(k in reasons for k in ('possible_family_merge','multiple_native_identities','multiple_source_assertions')) else 'MANUAL_CALIBRATION_REQUIRED',
      family_merge_authorized=False,created_at=now())

def result_key(card,recipe):return 'proposal:'+sha([card['candidate_id'],card['content_sha256'],recipe])
RETRY_STATUSES={'REQUEST_LIMIT','COST_LIMIT','UNRECONCILED_PAID_OUTCOME','PAID_NOT_AUTHORIZED','OFFLINE_NO_REQUEST'}
def execute(store,run_id,questions,identity,config=None,mode='dry-run',source_index=None,
            family_context=None,max_candidates=None,stop_after=None,transport=None,aux_index=None):
    started=time.monotonic();config=configuration(config)
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,120}',run_id):raise ValueError('safe run ID')
    cards,duplicates=prepare(store,questions,identity,source_index,family_context,aux_index)
    history_pointer=REPO/'audit'/'associative-history-registry'/'CURRENT.json'
    history_version=file_hash(history_pointer) if history_pointer.exists() else 'UNAVAILABLE'
    recipe=dict(history_snapshot=history_version,algorithm_sha256=code_version(),config=config,rules_sha256=sha(cards[0]['rules']) if cards else None)
    lane_count=len({(c['language'],','.join(sorted({p.get('category',p.get('proposed_category','unresolved')) for p in c['paths']})) or 'unresolved') for c in cards})
    if max_candidates is not None and max_candidates<lane_count:
        raise ValueError('candidate budget must retain every nonempty language/relation lane: '+str(lane_count))
    recipe_hash=sha(recipe);selected=cards[:max_candidates] if max_candidates else cards
    plan=dict(schema='preannotation-run/1',run_id=run_id,identity=identity,recipe=recipe,
      recipe_sha256=recipe_hash,cards=[c['content_sha256'] for c in selected],total_candidates=len(cards),
      omitted_candidates=len(cards)-len(selected),exact_duplicate_observations=duplicates,
      forecast=forecast(config,len(cards)))
    if run_id in store.runs and store.get(store.runs[run_id])!=plan:raise ValueError('run changed; new run ID required')
    store.append('run',run_id,plan);client=Client(store,config,mode,transport)
    counts=Counter();languages=Counter();decisions=Counter()
    pending=[]
    for card in selected:
        key=result_key(card,recipe_hash);old=store.latest(key)
        if old and not (mode in {'pilot','batch','resume','re-evaluate-changed'} and
                       any(s.get('status') in RETRY_STATUSES for s in old['models'])):
            counts['already_completed']+=1;continue
        pending.append(card)
    if stop_after:pending=pending[:stop_after]
    def worker(card):
        key=result_key(card,recipe_hash);value=classify(card,client,config['route'],run_id,recipe_hash)
        previous=store.proposal_index.get(card['candidate_id'],[])
        value['previous_result_ref']=previous[-1] if previous else None
        store.append('result',key,value)
        return value
    # Bound both active requests and submitted futures, including large queues.
    with ThreadPoolExecutor(max_workers=config['concurrency']) as pool:
        iterator=iter(pending);active=set()
        while True:
            while len(active)<config['concurrency']:
                try:active.add(pool.submit(worker,next(iterator)))
                except StopIteration:break
            if not active:break
            done,active=wait(active,return_when=FIRST_COMPLETED)
            for future in done:
                value=future.result();counts['processed']+=1;languages[value['language']]+=1;decisions[value['proposed_decision']]+=1
    selected_counts=Counter(c['language'] for c in selected);all_counts=Counter(c['language'] for c in cards)
    return dict(status='ENGINEERING_RUN_ONLY',run_id=run_id,counts=dict(counts),decisions=dict(decisions),
      selected_by_language=dict(sorted(selected_counts.items())),processed_by_language=dict(sorted(languages.items())),
      omitted_by_language={k:all_counts[k]-selected_counts[k] for k in sorted(all_counts)},
      elapsed_seconds=round(time.monotonic()-started,6),total_candidates=len(cards),selected_candidates=len(selected),
      exact_duplicate_observations=duplicates,accounting=store.accounting(),recipe_sha256=recipe_hash,
      cost_forecast=plan['forecast'],
      algorithm_sha256=recipe['algorithm_sha256'],production_writes=0,quality_status='BLOCKED_INDEPENDENT_HUMAN_GOLD')

def export(store,run_id,output,handoff=False):
    output=Path(output).resolve()
    if output.is_relative_to(REPO) or output.exists():raise ValueError('fresh export outside checkout required')
    plan=store.get(store.runs[run_id]);output.mkdir(parents=True,mode=0o700)
    proposals=[];questions={};missing=0
    for fingerprint in plan['cards']:
        saved=store.get(store.cards[fingerprint]);c=saved['card']
        p=store.latest(result_key(c,plan['recipe_sha256']))
        if p:proposals.append(p)
        else:missing+=1
        q=store.get(saved['question_ref'])
        if handoff:
            q=questions.setdefault(q['id'],copy.deepcopy(q))
            if p:q.setdefault('automated_proposals',[]).append(p)
    name='questions.ndjson' if handoff else 'proposals.ndjson'
    values=[questions[k] for k in sorted(questions)] if handoff else sorted(proposals,key=lambda x:x['candidate_id'])
    data=''.join(canonical(x)+'\n' for x in values).encode();atomic(output/name,data)
    manifest=dict(schema='preannotation-handoff/1' if handoff else 'preannotation-export/1',
      run_id=run_id,run_ref=store.runs[run_id],outputs={name:sha(data)},rows=len(values),
      missing_results=missing,counts={'questions':len(values)} if handoff else {'proposals':len(values)},production_writes=0,human_decision_events=0)
    # Existing review loader accepts a manifest with outputs.questions.ndjson.
    atomic(output/'MANIFEST.json',canonical(manifest).encode());return manifest

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('mode',nargs='?',default='dry-run',choices=['offline','dry-run','pilot','batch','resume',
      're-evaluate-changed','export-proposals','export-handoff','backup','restore','record-cost'])
    p.add_argument('--store',required=True);p.add_argument('--input');p.add_argument('--registry')
    p.add_argument('--aux-index');p.add_argument('--source-index');p.add_argument('--family-context');p.add_argument('--config')
    p.add_argument('--run-id',default='offline-1');p.add_argument('--output')
    p.add_argument('--receipt');p.add_argument('--max-candidates',type=int);p.add_argument('--stop-after',type=int)
    a=p.parse_args()
    if a.max_candidates is not None and a.max_candidates<1 or a.stop_after is not None and a.stop_after<1:
        p.error('positive bounds required')
    if a.mode=='restore':
        if not a.input:p.error('--input backup required')
        print(canonical(restore(a.input,a.store)));return
    s=Store(a.store)
    with s.lease():
        if a.mode=='backup':result=backup(s,a.output)
        elif a.mode=='record-cost':result={'receipt_ref':s.receipt(json.loads(Path(a.receipt).read_text()))}
        elif a.mode.startswith('export-'):result=export(s,a.run_id,a.output,a.mode=='export-handoff')
        else:
            if not a.input:p.error('--input frozen cases or mass02 release required')
            qs,identity=load_input(a.input,a.registry)
            cfg=json.loads(Path(a.config).read_text()) if a.config else {}
            context=json.loads(Path(a.family_context).read_text()) if a.family_context else None
            result=execute(s,a.run_id,qs,identity,cfg,a.mode,a.source_index,context,a.max_candidates,a.stop_after,aux_index=a.aux_index)
    print(canonical(result))
if __name__=='__main__':main()
