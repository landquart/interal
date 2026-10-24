"""Frozen-case paired evaluation; missing humans produce null metrics and BLOCKED."""
import argparse, gzip, json
from collections import Counter, defaultdict
from pathlib import Path
from associativvordes.family_boundary.core import digest,read,save,sha
from .prepare import HERE
from .human import compile_gold
from .statistics import evaluate, agreement, zero_error_n, ratio

def rows(path):
    with (gzip.open(path,'rt') if str(path).endswith('.gz') else open(path)) as f:return [json.loads(x) for x in f if x.strip()]

def release(folder):
    folder=Path(folder);m=read(folder/'MANIFEST.json')
    for r in m['files']:
        p=(folder/r['path']).resolve()
        if not p.is_relative_to(folder.resolve()) or p.stat().st_size!=r['bytes'] or sha(p)!=r['sha256']:raise ValueError('frozen evaluation release checksum')
    cases=rows(folder/'PROBABILITY.ndjson.gz')+rows(folder/'CHALLENGE.ndjson.gz')
    if digest(cases)!=m['case_set_sha256']:raise ValueError('frozen case order/scope')
    return cases,m

def run(folder,output,review_path=None,adjudication_path=None,roster_path=None):
    folder=Path(folder);out=Path(output)
    if out.exists():raise ValueError('new immutable evaluation directory required')
    cases,m=release(folder);protocol=read(HERE/'protocol.json')
    if m['identity']['protocol_sha256']!=digest(protocol):raise ValueError('protocol changed; new preregistration and untouched sample required')
    review_path=Path(review_path) if review_path else folder/'RAW-HUMAN-REVIEWS.ndjson';adjudication_path=Path(adjudication_path) if adjudication_path else folder/'RAW-ADJUDICATIONS.ndjson';roster_path=Path(roster_path) if roster_path else folder/'ROSTER.json'
    gold=compile_gold(cases,rows(review_path),rows(adjudication_path),read(roster_path));gg={r['case_id']:r for r in gold['rows']};pp=rows(folder/'PREDICTIONS.ndjson.gz');index={c['id']:c for c in cases};seen=set()
    for p in pp:
        k=(p['case_id'],p['configuration'])
        if k in seen or p['case_id'] not in index or p['case_sha256']!=index[p['case_id']]['content_sha256'] or p['configuration'] not in protocol['configurations'] or p['prediction'] not in ['KEEP','REMOVE','ABSTAIN','NOT_RUN']:raise ValueError('prediction scope/configuration')
        seen.add(k)
    if len(seen)!=len(cases)*len(protocol['configurations']):raise ValueError('paired configuration missing cases')
    results={}
    for cfg in protocol['configurations']:
        selected=[p for p in pp if p['configuration']==cfg];rr=[]
        for p in selected:
            c=index[p['case_id']];g=gg[c['id']];rr.append(dict(case_id=c['id'],gold=g['gold'],prediction=p['prediction'],weight=c.get('weight',1),cluster=c['cluster'],dataset=c['dataset'],language=c['language'],family_class=c.get('family_class','HISTORICAL_SCOPE'),relation_types=c.get('relation_types',[]) or ['UNKNOWN'],high_risk=bool(c.get('risk_flags')),scope=c['case_kind']))
        probability=[r for r in rr if r['dataset']=='probability'];challenge=[dict(r,weight=1) for r in rr if r['dataset']=='challenge']
        groups={}
        for field in ['language','family_class','relation_types']:
            buckets=defaultdict(list)
            for r in probability:
                for key in r[field] if isinstance(r[field],list) else [r[field]]:buckets[key].append(r)
            groups[field]={k:evaluate(v,repetitions=2000) for k,v in sorted(buckets.items())}
        results[cfg]=dict(probability=evaluate(probability),challenge=evaluate(challenge),breakdowns=groups,prediction_counts=dict(Counter(p['prediction'] for p in selected)),paired_case_ids_sha256=digest(sorted(p['case_id'] for p in selected)),unjustified_automatic_exclusions=ratio(0,0),false_merge_rate=ratio(0,0),operation_metrics=dict(family_operations=0,membership_operations=0,precision=None,ci=None,status='NO_PROPOSED_OPERATIONS_NOT_A_SUCCESS_ESTIMATE'),human_seconds=None,model_requests=0 if cfg=='llm_assisted' else None,model_cost_usd=0 if cfg=='llm_assisted' else None)
    alpha=.05/protocol['new_semantic_safety']['comparisons']
    gates=dict(schema='cleanup-operation-admission/1',semantic_gate='BLOCKED',classes=[dict(operation_class=k,status=s,exact_scope=None,reason=reason) for k,s,reason in [
        ('SAFE_STRUCTURAL_FIX','INSUFFICIENT_EVIDENCE','No current exact structural defect or nonempty plan; no blanket technical authorization'),
        ('SEMANTIC_MEMBERSHIP_EXCLUSION','INSUFFICIENT_EVIDENCE','No independent qualified human gold, calibrated protocol, certified holdout or nonempty operation scope'),
        ('FAMILY_REJECTION_SPLIT_MERGE','HUMAN_REVIEW_REQUIRED','Full scope proof, exact native/sense identities, history and stricter applicable precision/merge gates required'),
        ('HOMONYM_COMPOUND_ALLOMORPH_HISTORY','HUMAN_REVIEW_REQUIRED','Inherited always-manual categories remain manual'),
        ('LLM_ONLY_OR_SURFACE_ONLY_AUTOMATIC_EXCLUSION','REJECTED_POLICY','Model confidence, old membership or missing evidence cannot establish rejection')]],qualified_scopes=[],inherited_v5=protocol['v5_thresholds'],inherited_v6=protocol['v6_gates'],new_semantic_comparisons=protocol['new_semantic_safety']['comparisons'],simultaneous_alpha=alpha,conditional_zero_error_minimum_precision=zero_error_n(.01,alpha),conditional_zero_error_minimum_false_removal_or_merge=zero_error_n(.001,alpha),independence_assumed_for_planning_only=True,interval_gate='INSUFFICIENT_EVIDENCE; no binomial CI for dependent memberships or counts expanded from family operations')
    out.mkdir(parents=True)
    save(out/'FROZEN-GOLD.json',dict(gold,content_sha256=digest(gold)))
    (out/'RAW-HUMAN-REVIEWS.ndjson').write_bytes(review_path.read_bytes());(out/'RAW-ADJUDICATIONS.ndjson').write_bytes(adjudication_path.read_bytes());save(out/'ROSTER.json',read(roster_path))
    (out/'DISAGREEMENTS.ndjson').write_text(''.join(json.dumps(r,sort_keys=True)+'\n' for r in gold['disagreement_log']))
    metrics=dict(schema='cleanup-quality-metrics/1',release_sha256=sha(folder/'MANIFEST.json'),gold_sha256=digest(gold),configurations=results,agreement=agreement(gold['agreement_pairs']),conflict_rate=ratio(len(gold['disagreement_log']),len(gold['agreement_pairs'])),human_review_count=gold['completed_human_reviews'],human_adjudication_count=gold['completed_arbitrations'],semantic_gate='BLOCKED',human_time_and_speedup=None,warning='Challenge estimates never pooled with probability sample. Weighted descriptive ratios cannot certify automatic operation safety; zero actions is not zero risk.')
    save(out/'METRICS.json',metrics);save(out/'OPERATION-GATES.json',gates)
    save(out/'MANIFEST.json',dict(schema='cleanup-quality-evaluation/1',case_set_sha256=m['case_set_sha256'],code_sha256={n:sha(HERE/n) for n in ['evaluate.py','human.py','statistics.py']},files=[dict(path=p.name,bytes=p.stat().st_size,sha256=sha(p)) for p in sorted(out.iterdir()) if p.is_file()],production_writes=0,semantic_gate='BLOCKED'))
    return dict(status='ENGINEERING_PREPARED_SEMANTIC_GATE_BLOCKED',human_reviews=gold['completed_human_reviews'],human_gold=sum(r['gold'] in ('VALID','INVALID') for r in gold['rows']),probability=m['probability_cases'],challenge=m['challenge_cases'])

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--release',required=True);p.add_argument('--output',required=True);p.add_argument('--reviews');p.add_argument('--adjudications');p.add_argument('--roster');a=p.parse_args();print(json.dumps(run(a.release,a.output,a.reviews,a.adjudications,a.roster)))
