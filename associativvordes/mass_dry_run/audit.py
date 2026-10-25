"""Deterministic proposal groups and structural checks; never linguistic gold."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
from collections import Counter,defaultdict
import copy
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[2]
None
from associativvordes.auto_annotation.contract import canonical,sha,scrub

GROUPS=('potential_additions','potential_exclusions','relation_type_audit','identity_unresolved',
 'interfamily_conflicts','possible_bases','confirmed_existing_decisions','manual_review',
 'preserved_existing_decisions','source_analysis_conflicts')
def normalized_proposal(p):
    return {k:copy.deepcopy(v) for k,v in p.items() if k not in
            {'created_at','run_id','previous_result_ref'}}
def groups_for(q,p):
    out=['manual_review'];cats=set(q.get('categories',[]))
    if 'NEW_MEMBER' in cats:out.append('potential_additions')
    if q.get('existing_memberships') and (q.get('prior_scoped_decisions') or
        q.get('guard',{}).get('status') in {'hold','blocked'}):
        out.append('potential_exclusions')
    if len(q.get('relation_types',[]))>1 or p['relation_type']=='unresolved':out.append('relation_type_audit')
    if p['identity_resolution']!='resolved' or len(q.get('lexeme_alternatives',[]))>1:out.append('identity_unresolved')
    if q.get('conflicts',{}).get('competing_families'):out.append('interfamily_conflicts')
    if p['lexeme']['id'] in {v['id'] for v in q.get('proposed_bases',[])}:out.append('possible_bases')
    if q.get('previous_decisions') or q.get('prior_scoped_decisions') or q.get('guard',{}).get('blockers'):
        out.append('preserved_existing_decisions')
    if 'CONFLICT' in cats:out.append('source_analysis_conflicts')
    # Preserving a record is not a newly confirmed semantic decision.
    return sorted(set(out))
def build_snapshot(questions,proposals,cards,identity):
    qs={q['id']:q for q in questions}
    if len(qs)!=len(questions):raise ValueError('duplicate question')
    groups={k:[] for k in GROUPS};rows=[];errors=[];risk=Counter();raw_rows={};bylang={};byfamily={}
    cards_index={}
    for p in sorted(proposals,key=lambda p:p['candidate_id']):
        q=qs[p['question_id']];c=cards[p['card_sha256']]
        if p['family_id']!=q['family'] or p['language']!=q['language']:errors.append('candidate scope')
        if p['candidate_id']!='auto-candidate:'+sha([q['id'],p['lexeme']['id']]):errors.append('candidate ID')
        original=next((l for l in q['lexeme_alternatives'] if l['id']==p['lexeme']['id']),None)
        if original!=p['lexeme']:errors.append('original lexeme/POS/sense altered')
        if c['frequency']!=q.get('frequency'):errors.append('frequency altered')
        if not p['needs_human_review'] or p['production_writes'] or p['family_merge_authorized']:errors.append('unauthorized semantic automation')
        if p['calibrated_reliability'] is not None:errors.append('uncalibrated probability')
        for path in c['productive_paths']:
            if any(l!=q['language'] for l in path['node_languages']):errors.append('cross language traversal')
            ids=[n if isinstance(n,str) else n['id'] for n in path['nodes']]
            if not (ids[-1]==p['lexeme']['id'] or path.get('reverse_search') and ids[0]==p['lexeme']['id']):
                errors.append('path from other native identity')
            for s in path['steps']:
                direction=s.get('direction');directed=direction=='directed' or isinstance(direction,dict) and direction.get('state')=='directed'
                if not directed or s['type'] not in {'direct_derivation','conversion','compounding'}:errors.append('invalid productive step')
        if c['independence'].get('status')!='unknown':
            # Supplied independent evidence must never be manufactured by this runner.
            if c['independence']!=q.get('independence'):errors.append('invented independence')
        for h in c['scoped_history']:
            if h.get('family',h.get('family_id',q['family']))!=q['family']:errors.append('negative history broadened')
        flags=groups_for(q,p)
        for g in flags:groups[g].append(p['candidate_id'])
        row=normalized_proposal(p);row['result_groups']=flags;rows.append(row);risk.update(p['uncertainty_flags'])
        cards_index[p['candidate_id']]={k:c[k] for k in
          ('question_id','family_id','language','lexeme','paths','productive_paths',
           'other_native_paths_not_supporting_candidate','risk_flags','scoped_history',
           'unassigned_history','frequency','independence')}
        cards_index[p['candidate_id']]['raw_evidence_ids']=sorted(r['id'] for r in c['source_rows'])
        for r in c['source_rows']:
            if r['id'] in raw_rows and raw_rows[r['id']]!=r:errors.append('source raw row conflict')
            raw_rows[r['id']]=r
        for index,key in ((bylang,p['language']),(byfamily,p['family_id'])):
            entry=index.setdefault(key,Counter());entry['native_candidates']+=1
            entry['abstain']+=p['proposed_decision']=='ABSTAIN'
            for g in flags:entry[g]+=1
    if len({p['candidate_id'] for p in proposals})!=len(proposals):errors.append('duplicate native proposal')
    if errors:raise ValueError('structural safety: '+canonical(dict(Counter(errors))))
    snapshot=dict(schema='mass-proposed-annotation-snapshot/1',identity=identity,
      questions=[scrub(qs[k]) for k in sorted(qs)],proposals=rows,card_index=cards_index,
      raw_source_rows={k:raw_rows[k] for k in sorted(raw_rows)},groups=groups,
      group_semantics='Detection hypotheses for audit, not approved membership changes; potential exclusion means a scoped existing-record audit.',
      actual_semantic_proposals={'include':[p['candidate_id'] for p in rows if p['proposed_decision']=='PROPOSE_INCLUDE'],
        'exclude':[p['candidate_id'] for p in rows if p['proposed_decision']=='PROPOSE_EXCLUDE'],
        'relation_type_changes':[]},production_writes=0)
    stats=dict(questions=len(qs),native_candidates=len(rows),groups={k:len(v) for k,v in groups.items()},
      by_language={k:dict(v) for k,v in sorted(bylang.items())},by_family={k:dict(v) for k,v in sorted(byfamily.items())},
      risk_flags=dict(sorted(risk.items())),unique_raw_source_rows=len(raw_rows),
      manual_fraction=len(groups['manual_review'])/len(rows) if rows else None,
      actual_semantic_proposals={k:len(v) for k,v in snapshot['actual_semantic_proposals'].items()},
      preserved_input_history_sha256=sha([{k:q.get(k) for k in ('id','previous_decisions','prior_scoped_decisions','prior_unassigned_questions')} for q in sorted(questions,key=lambda q:q['id'])]),
      errors=0,source_independence='unknown, no source-count-based corroboration',production_writes=0)
    return snapshot,stats

def compare(a,b):
    fields=('identity','questions','proposals','card_index','raw_source_rows','groups','actual_semantic_proposals')
    result={k:sha(a[k])==sha(b[k]) for k in fields}
    if not all(result.values()):raise ValueError('independent replay mismatch: '+canonical(result))
    return dict(status='PASS',parts=result,snapshot_sha256=sha(a),volatile_fields_separated=['created_at','run_id','previous_result_ref'],
                llm_disagreement_rate=None,llm_comparison_status='NOT_RUN_NO_REAL_MODEL_RESPONSES')
def samples(snapshot,seed,random_n=60,risk_n=60):
    rows=snapshot['proposals'];random=sorted(rows,key=lambda p:sha([seed,'random',p['candidate_id']]))[:random_n]
    # Balance risk cases across family/language before filling remaining risk rank.
    candidates=sorted(rows,key=lambda p:(-len(p['uncertainty_flags']),sha([seed,'risk',p['candidate_id']])))
    picked=[];cells=set()
    for p in candidates:
        cell=(p['family_id'],p['language'])
        if cell not in cells:picked.append(p);cells.add(cell)
        if len(picked)==risk_n:break
    if len(picked)<risk_n:
        ids={p['candidate_id'] for p in picked};picked.extend(p for p in candidates if p['candidate_id'] not in ids)
        picked=picked[:risk_n]
    chosen={p['candidate_id']:p for p in [*random,*picked]}
    tasks=[dict(candidate_id=k,question_id=p['question_id'],family_id=p['family_id'],language=p['language'],
       lexeme=p['lexeme'],decision=None,reason=None,required_independent_human_reviews=2,
       blind_to_predictions=True) for k,p in sorted(chosen.items())]
    return dict(schema='mass06-blind-quality-sample/1',seed=seed,random_ids=[p['candidate_id'] for p in random],
       risk_ids=[p['candidate_id'] for p in picked],unique_cases=len(chosen),
       required_reviews=2*len(chosen),tasks=tasks,status='BLOCKED_VERIFIED_HUMANS',
       distinction='Random and risk-oriented samples are not population precision estimates without human labels.')
