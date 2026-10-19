"""Compare immutable actual calculator captures; never implement or alter its formulas."""
import argparse
import json
import math
from pathlib import Path
from gold import file_hash
from run import BASELINE_COMMIT,BASELINE_HASHES

LANGUAGES={'en','de','fr','es','it','ru'}

def finite(x):return type(x) in {int,float} and math.isfinite(x)

def validate_capture(c):
    if c.get('capture_kind')!='actual_runtime' or c.get('algorithm_commit')!=BASELINE_COMMIT or c.get('methodology_modified') is not False:raise ValueError('actual pinned unchanged calculator capture required')
    if not c.get('methodology_version') or c.get('calculation_code_hashes')!=BASELINE_HASHES or not c.get('case_set_sha256'):raise ValueError('calculation dependency lock')
    if set(c.get('languages',{}))!=LANGUAGES:raise ValueError('six explicit language states required; no silent denominator drift')
    for language,row in c['languages'].items():
        if type(row.get('represented'))!=bool or row.get('status') not in {'complete','incomplete','unavailable'}:raise ValueError('language status')
        models=row.get('models');top=row.get('selected_top_five')
        if not isinstance(models,list) or top is not None and (not isinstance(top,list) or len(top)>5):raise ValueError('model capture')
        keys={m['model_key'] for m in models}
        if top is not None and any(k not in keys for k in top):raise ValueError('unknown selected model')
        for m in models:
            if not m.get('model_key') or not m.get('lexical_head_id'):raise ValueError('explicit model/head identity')
            if m.get('P') is not None and not finite(m['P']):raise ValueError('invalid actual score')
            if m.get('independent_model_id') and not m.get('independence_evidence'):raise ValueError('independence requires separate evidence')
    if c.get('internationality') is not None and not finite(c['internationality']):raise ValueError('actual internationality')
    return c

def diagnose(before,after):
    validate_capture(before);validate_capture(after)
    if any(before[k]!=after[k] for k in ['case_set_sha256','methodology_version','calculation_code_hashes']):raise ValueError('same evaluation scope and unchanged calculation dependencies required')
    languages={};all_missing=False
    for lang in sorted(LANGUAGES):
        a=before['languages'][lang];b=after['languages'][lang];old=a['selected_top_five'];new=b['selected_top_five']
        aa={m['model_key']:m for m in a['models']};bb={m['model_key']:m for m in b['models']}
        independent_a={m['independent_model_id'] for m in a['models'] if m.get('independent_model_id')};independent_b={m['independent_model_id'] for m in b['models'] if m.get('independent_model_id')}
        head_collisions=[]
        for key in bb:
            heads={m['lexical_head_id'] for m in b['models'] if m['model_key']==key}
            if len(heads)>1:head_collisions.append({'model_key':key,'lexical_heads':sorted(heads)})
        model_ids=[m.get('independent_model_id') for m in b['models'] if m.get('independent_model_id')]
        am={(m['model_key'],m['lexical_head_id']):m for m in a['models']};bm={(m['model_key'],m['lexical_head_id']):m for m in b['models']}
        frequency_lost=[list(k) for k in am.keys() & bm.keys() if am[k].get('frequency_observation') is not None and bm[k].get('frequency_observation') is None]
        missing=any(m.get('P') is None for m in b['models']);all_missing|=missing
        languages[lang]={'top_five_changed':old!=new if old is not None and new is not None else None,'before_top_five':old,'after_top_five':new,
          'new_independent_models':sorted(independent_b-independent_a) if independent_b else None,
          'independence_coverage':sum(bool(m.get('independent_model_id')) for m in b['models']),
          'represented_changed':a['represented']!=b['represented'],'frequency_lost':sorted(frequency_lost),
          'duplicate_model_keys':len(bb)!=len(b['models']),'lexical_head_collisions':head_collisions,
          'related_derivative_inflation_risk':len(model_ids)!=len(set(model_ids)),'missing_actual_scores':missing}
    x,y=before.get('internationality'),after.get('internationality')
    complete=all(r['status']=='complete' for c in [before,after] for r in c['languages'].values())
    return {'status':'diagnostic_only','languages':languages,'represented_before':sorted(k for k,v in before['languages'].items() if v['represented']),
      'represented_after':sorted(k for k,v in after['languages'].items() if v['represented']),
      'internationality_changed':x!=y if finite(x) and finite(y) and complete and not all_missing else None,
      'internationality_before':x,'internationality_after':y,'new_candidate_impact_unknown':not complete or all_missing or not finite(y),
      'formula_changed':False,'membership_changed':False}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['before','after','lock','output']:p.add_argument('--'+n,required=True)
    a=p.parse_args();lock=json.loads(Path(a.lock).read_text())
    if file_hash(a.before)!=lock['before_sha256'] or file_hash(a.after)!=lock['after_sha256']:raise ValueError('capture checksum')
    if Path(a.output).resolve().is_relative_to(Path(__file__).resolve().parents[2]):raise ValueError('output outside repository')
    Path(a.output).write_text(json.dumps(diagnose(json.loads(Path(a.before).read_text()),json.loads(Path(a.after).read_text())),ensure_ascii=False,sort_keys=True,indent=2)+'\n')
