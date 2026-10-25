#!/usr/bin/env python3
"""Reproduce four offline routes over the frozen scope; missing human/LLM data stay BLOCKED."""

# Installed writer boundary; isolated restored tools retain self-contained replay.
from pathlib import Path as _HistoryFencePath
import sys as _history_fence_sys
_history_fence_root=next((p for p in _HistoryFencePath(__file__).resolve().parents if (p/'associativvordes/mutation_guard.py').is_file()),None)
if _history_fence_root is not None:
    _history_fence_sys.path.insert(0,str(_history_fence_root))
    from associativvordes.mutation_guard import install as _install_history_fence
    _install_history_fence()
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse
from collections import Counter
import gzip
import json
from pathlib import Path
import sys
import time
from associativvordes.auto_annotation.contract import canonical,sha,file_hash
from associativvordes.auto_annotation.pipeline import load_input,execute,export,rows,code_version
from associativvordes.auto_annotation.storage import Store
from associativvordes.auto_annotation.providers import configuration,now

def benchmark(cases_path,store_root,output,config=None,judgments=None,roster=None,adjudications=None):
    repo=Path(__file__).resolve().parents[2];output=Path(output).resolve()
    if output.is_relative_to(repo) or output.exists():raise ValueError('fresh external report required')
    output.mkdir(parents=True)
    pilot=repo/'associativvordes'/'pilot_evaluation';pass
    from associativvordes.pilot_evaluation.gold import compile_gold
    from associativvordes.pilot_evaluation.metrics04 import summary,require_study_reviews,agreement_intervals
    from associativvordes.pilot_evaluation.study04 import plan
    from associativvordes.pilot_evaluation.archive04 import pack,unpack
    cases=list(rows(cases_path));questions,identity=load_input(cases_path)
    chosen,tasks,cells=plan(cases)
    human=compile_gold(cases,list(rows(judgments)) if judgments else [],
       json.loads(Path(roster).read_text()) if roster else {},
       list(rows(adjudications)) if adjudications else [])
    human=require_study_reviews(human,{c['id'] for c in chosen})
    gold={g['case_id']:g for g in human['rows']}
    cfg=configuration(config);runs={};proposals=[]
    for route in ('deterministic','single','multi','mixed'):
        c=dict(cfg,route=route);store=Store(Path(store_root)/route)
        with store.lease():
            first=execute(store,route,questions,identity,c,'offline')
            repeat=execute(store,route,questions,identity,c,'offline')
            destination=Path(store_root)/(route+'-export')
            if destination.exists():raise FileExistsError('fresh run/output required')
            release=export(store,route,destination)
            pp=list(rows(destination/'proposals.ndjson'))
        index={p['question_id']:p for p in pp}
        obs=[]
        for case in cases:
            p=index[case['id']]
            rel={'direct derivation':'direct','indirect derivation':'indirect',
                 'orthographic variant':'orthographic_variant'}.get(p['relation_type'],p['relation_type'])
            obs.append((case,gold[case['id']],{'decision':{'PROPOSE_INCLUDE':'yes','PROPOSE_EXCLUDE':'no','ABSTAIN':'abstain'}[p['proposed_decision']],
             'relation_prediction':rel,'merged_families':None}))
        measured=sum(p['status']=='MEASURED_MODEL_RESPONSE' for r in pp for p in r['models'])
        status='MEASURED_MODEL_OUTPUTS' if measured else 'NO_REAL_MODEL_OUTPUTS'
        runs[route]=dict(execution=first,repeat=repeat,model_observation_status=status,
          stage_status_counts=dict(Counter(s['status'] for p in pp for s in p['models'])),
          overall=summary(obs),primary_evaluation=summary([r for r in obs if r[0]['split']=='evaluation']),
          by_language={k:summary([r for r in obs if r[0]['language']==k]) for k in sorted({c['language'] for c in cases})},
          by_relation={k:summary([r for r in obs if (r[1].get('label') or {}).get('relation','unannotated')==k])
              for k in sorted({(r[1].get('label') or {}).get('relation','unannotated') for r in obs})},
          actual_correct_per_processing_hour=None,export=release)
        proposals.extend(dict(route=route,proposal=p) for p in pp)
    # Labels and timings are never populated by model predictions.
    experiment=dict(schema='preannotation-experiment/1',generated_at=now(),
      algorithm_sha256=code_version(),frozen=identity,cases=len(cases),double_review_cases=sum(c['double_review'] for c in cases),
      by_language=dict(sorted(Counter(c['language'] for c in cases).items())),
      families=sorted({c['family'] for c in cases}),runs=runs,gold_counts=human['counts'],
      agreement=agreement_intervals(human),
      manual_baseline={'status':'BLOCKED_HUMAN_TIME_AND_GOLD','trials':0,'correct_per_hour':None},
      llm_vs_human_speedup={'value':None,'ci95':None,'status':'BLOCKED_DISTINCT_BLINDED_TIMING_TRIALS'},
      calibrated_reliability=None,automatic_semantic_acceptance=False,automatic_family_merge=False,
      cost_this_offline_evaluation_usd=0,production_writes=0,
      required_followup={'initial_cases':180,'initial_gold_reviews':360,'initial_distinct_timing_reviews':360,
         'full_pilot_gold_reviews':len(cases)+sum(c['double_review'] for c in cases),
         'adjudications':'additional independent third-person reviews where disagreement',
         'llm_outputs':'same cases and budgets, explicitly authorized provider/local model; models are never gold'},
      limitations=['Offline engineering run is not a quality comparison of real LLMs.',
        'Unknown frequency, meaning, POS, identity and cost are not replaced by zero.',
        'No thresholds learned from the frozen evaluation set. Independent calibration and untouched grouped holdout required.',
        'Model or source agreement does not establish error independence.',
        'Timing is pipeline wall time including preparation; not annotator time or source-hint speedup.'])
    def write(name,value):(output/name).write_text(json.dumps(value,ensure_ascii=False,sort_keys=True,indent=2)+'\n')
    write('EXPERIMENT.json',experiment)
    # Existing DAG archival format preserves exact JSON while sharing repeated source/path objects.
    raw={'schema':'preannotation-results/1','proposals':proposals}
    temporary=Path(store_root)/'PROPOSALS.json';temporary.write_text(json.dumps(raw,ensure_ascii=False,sort_keys=True,indent=2)+'\n')
    archive=output/'PACKED-RESULTS.json.gz';info=pack({'PROPOSALS.json':str(temporary)},archive)
    restored=Path(store_root)/'roundtrip';unpack(archive,restored)
    if json.loads((restored/'PROPOSALS.json').read_text())!=raw:raise ValueError('archival roundtrip')
    write('RELEASE.json',dict(schema='preannotation-report-release/1',proposals=len(proposals),archive=info,
      outputs={'EXPERIMENT.json':file_hash(output/'EXPERIMENT.json'),'PACKED-RESULTS.json.gz':file_hash(archive)},
      canonical_results_sha256=sha(raw),roundtrip='PASS'))
    # Independent gold slots and timing slots must be distinct verified people.
    write('HUMAN-STUDY.json',dict(schema='preannotation-human-plan/1',status='BLOCKED_VERIFIED_HUMANS',
      case_set_sha256=sha(cases),subset_case_ids=[c['id'] for c in chosen],subset_sha256=sha(chosen),
      tasks=[dict(t,condition='llm_combined' if t['condition']=='combined' else 'control') for t in tasks],
      gold_slots=['gold-1','gold-2'],timing_slots=['study-1','study-2','study-3','study-4'],
      rules='Distinct verified people across slots; never show one person the same leakage group in different arms. Gold remains blind to predictions.',
      timing_capture='Use review ledger/server timing as in human04; LLM condition requires a separately mounted experimental queue. Do not reuse morphology-only timings.'))
    return {k:experiment[k] for k in ('cases','by_language','gold_counts','cost_this_offline_evaluation_usd','production_writes')}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ('cases','store','output'):p.add_argument('--'+n,required=True)
    for n in ('config','judgments','roster','adjudications'):p.add_argument('--'+n)
    a=p.parse_args();print(canonical(benchmark(a.cases,a.store,a.output,
       json.loads(Path(a.config).read_text()) if a.config else None,a.judgments,a.roster,a.adjudications)))
