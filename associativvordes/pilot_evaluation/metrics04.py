"""Closed frozen-scope quality, explicit denominators, intervals and missing-data gates."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
from collections import Counter,defaultdict
import math,random
from associativvordes.pilot_evaluation.gold import sha,validate_cases,validate_judgment
from associativvordes.pilot_evaluation.evaluate import validate_predictions,agreement

def interval(success,total,z=1.959963984540054):
    if not total:return None
    p=success/total;d=1+z*z/total
    center=(p+z*z/(2*total))/d
    half=z*math.sqrt(p*(1-p)/total+z*z/(4*total*total))/d
    return [max(0,center-half),min(1,center+half)]

def rate(k,n):
    return {'value':k/n if n else None,'numerator':k,'denominator':n,'ci95_wilson':interval(k,n)}

def zero_error_requirement(limit,alpha=.05):
    if not 0<limit<1 or not 0<alpha<1:raise ValueError('probability bounds')
    return math.ceil(math.log(alpha)/math.log1p(-limit))

def summary(rows):
    c=Counter();correct=[];relation_n=relation_error=merge_n=merge_error=0
    for case,g,p in rows:
        c['cases']+=1;c['algorithm_abstain']+=p['decision']=='abstain'
        if g['state']=='disagreement':c['disagreements']+=1
        label=g.get('label')
        if not label:c['missing_gold']+=1;continue
        if label['decision']=='uncertain':c['human_uncertain']+=1;continue
        c['labeled']+=1
        yes=label['decision']=='yes';guess=p['decision']
        c['tp']+=yes and guess=='yes';c['fp']+=not yes and guess=='yes'
        c['fn']+=yes and guess!='yes';c['tn']+=not yes and guess=='no'
        c['decided']+=guess!='abstain';c['membership_errors']+=guess!='abstain' and ((guess=='yes')!=yes)
        if yes and guess=='yes':correct.append(case['id'])
        rel=p.get('relation_prediction')
        if guess=='yes' and rel not in (None,'uncertain','unresolved') and label.get('relation') not in (None,'uncertain'):
            relation_n+=1;relation_error+=rel!=label['relation']
        merges=p.get('merged_families')
        if merges is not None and label.get('correct_families') is not None:
            merge_n+=1;merge_error+=len(set(merges))>1 and bool(set(merges)-set(label['correct_families']))
    labeled=c['labeled'];resolved=labeled+c['human_uncertain']
    confusion={k:c[k] if labeled else None for k in ('tp','fp','fn','tn')}
    return {'status':'MEASURED_CLOSED_SCOPE' if labeled else 'BLOCKED_HUMAN_GOLD','counts':dict(c),'confusion':confusion,
      'precision':rate(c['tp'],c['tp']+c['fp']),'recall_labeled_scope':rate(c['tp'],c['tp']+c['fn']),
      'membership_error':rate(c['membership_errors'],c['decided']),'algorithm_abstain':rate(c['algorithm_abstain'],c['cases']),
      'human_uncertain':rate(c['human_uncertain'],resolved),'relation_error':rate(relation_error,relation_n),
      'false_family_merge':rate(merge_error,merge_n),'correct_case_ids':sorted(correct),
      'scope_warning':'word/candidate proposals do not establish native lexeme or sense identity; no population recall claim'}


def require_study_reviews(gold,subset_ids):
    """Stronger eligibility for the preregistered initial cohort, no label rewriting."""
    import copy
    out=copy.deepcopy(gold)
    for row in out['rows']:
        if row['case_id'] in subset_ids and len(row['judgment_refs'])<2 and row['state']!='unannotated':
            row['state']='single_review';row['label']=None;row['adjudication_ref']=None
    counts={k:0 for k in out['counts']}
    for row in out['rows']:
        counts[row['state']]+=1
        if row['label'] and row['label']['decision']=='uncertain':counts['uncertain']+=1
    out['counts']=counts;out['study_review_requirements_sha256']=sha(sorted(subset_ids))
    out['content_sha256']=sha({k:v for k,v in out.items() if k!='content_sha256'})
    return out

def agreement_intervals(gold):
    result=agreement(gold)
    for pair in result['pairs']:
        a,b=pair['raters'];values=[]
        for observation in gold['agreement_observations']:
            rr=dict(zip(observation['raters'],observation['decisions']))
            if a in rr and b in rr:values.append((rr[a],rr[b]))
        pair['decision_agreement_ci95_wilson']=interval(sum(x==y for x,y in values),len(values))
        rng=random.Random(sha([a,b]));est=[]
        for _ in range(1000):
            sample=rng.choices(values,k=len(values));left=Counter(x for x,y in sample);right=Counter(y for x,y in sample)
            pe=sum(left[k]*right[k] for k in set(left)|set(right))/(len(sample)**2)
            if pe<1:est.append((sum(x==y for x,y in sample)/len(sample)-pe)/(1-pe))
        est.sort()
        pair['cohen_kappa_ci95_case_bootstrap']=[est[int(.025*(len(est)-1))],est[int(.975*(len(est)-1))]] if est else None
    result['warning']='repeat set is stratified and prior-risk enriched; interval is not population inter-rater reliability'
    return result

def evaluate04(cases,gold,runs):
    validate_cases(cases)
    if gold['case_set_sha256']!=sha(cases) or gold['content_sha256']!=sha({k:v for k,v in gold.items() if k!='content_sha256'}):raise ValueError('gold lock')
    gg={g['case_id']:g for g in gold['rows']}
    if len(gg)!=len(gold['rows']) or set(gg)!={c['id'] for c in cases}:raise ValueError('gold scope')
    results={}
    for name,run in runs.items():
        if run['case_set_sha256']!=sha(cases):raise ValueError('run scope')
        pp=validate_predictions(cases,run['predictions'])
        rows=[]
        for c in cases:
            g=gg[c['id']]
            if g['case_content_sha256']!=c['content_sha256']:raise ValueError('gold content')
            rows.append((c,g,pp[c['id']]))
        groups={}
        for field in ('language','family','split','relation'):
            buckets=defaultdict(list)
            for row in rows:
                k=(row[1]['label']['relation'] if row[1]['label'] else 'unannotated') if field=='relation' else row[0][field]
                buckets[k].append(row)
            groups[field]={k:summary(v) for k,v in sorted(buckets.items())}
        results[name]={'overall':summary(rows),'primary_evaluation':summary([r for r in rows if r[0]['split']=='evaluation']),'groups':groups}
    pairs={}
    for a,b in [('A','B'),('U','C'),('C','D'),('U','D'),('A','D')]:
        x,y=results[a]['primary_evaluation'],results[b]['primary_evaluation']
        valid=bool(x['counts'].get('labeled'))
        pairs[a+'->'+b]={'status':'MEASURED_CLOSED_SCOPE' if valid else 'BLOCKED_HUMAN_GOLD',
          'additional_correct':sorted(set(y['correct_case_ids'])-set(x['correct_case_ids'])) if valid else None,
          'displaced_correct':sorted(set(x['correct_case_ids'])-set(y['correct_case_ids'])) if valid else None,
          'warning':'paired configuration difference under fixed budgets, not independent causal source attribution'}
    return {'schema':'pilot04-evaluation/1','case_set_sha256':sha(cases),'gold_sha256':gold['content_sha256'],
      'configurations':results,'paired_unique_correct':pairs,'agreement':agreement_intervals(gold),
      'interval_method':'Wilson 95% marginal intervals; clustering and sparse cells limit population interpretation',
      'independence_warning':'GLeMM/MorphyNet dependence unknown; source counts are not independent confirmations'}

def efficiency(cases,gold,trials,roster,bootstrap=1000):
    index=validate_cases(cases);gg={g['case_id']:g for g in gold['rows']};seen=set();exposures=set();arms=defaultdict(list)
    for t in trials:
        cid=t['case_id'];actor=t['annotator_id'];arm=t['condition']
        if cid not in index or t['case_content_sha256']!=index[cid]['content_sha256']:raise ValueError('trial case')
        if arm not in ('control','combined') or (actor,cid) in seen:raise ValueError('repeated exposure/invalid arm')
        seen.add((actor,cid))
        group=index[cid]['leakage_group']
        if (actor,group,'combined' if arm=='control' else 'control') in exposures:raise ValueError('cross-condition leakage')
        exposures.add((actor,group,arm))
        if not roster.get(actor,{}).get('kind')=='human' or not roster[actor].get('authorized_by') or not roster[actor].get('authorization_ref'):raise ValueError('verified human required')
        validate_judgment(t,index[cid],roster)
        if not t.get('server_timing') or (t['active_seconds'] is not None and (not math.isfinite(t['active_seconds']) or t['active_seconds']<=0)):raise ValueError('valid measured timing required')
        label=gg[cid].get('label')
        arms[arm].append({'case_id':cid,'group':group,'actor':actor,'seconds':t['active_seconds'],
             'correct':None if not label or label['decision']=='uncertain' else t['decision']==label['decision']})
    result={}
    for arm in ('control','combined'):
        values=arms[arm];n=sum(v['correct'] is not None for v in values);correct=sum(v['correct'] is True for v in values);seconds=sum(v['seconds'] for v in values) if values and all(v['seconds'] is not None for v in values) else None
        result[arm]={'attempts':len(values),'gold_evaluable':n,'correct':correct if n else None,'total_active_seconds':seconds if values else None,
          'correct_per_hour':3600*correct/seconds if n==len(values) and n and seconds else None,
          'unjudged_time_is_not_excluded':True}
    result['status']='MEASURED_CLOSED_SCOPE' if all(result[a]['correct_per_hour'] is not None for a in ('control','combined')) else 'BLOCKED_HUMAN_TIME_AND_GOLD'
    result['speedup']=None;result['speedup_ci95_cluster_bootstrap']=None
    if result['status'].startswith('MEASURED'):
        x=result['control']['correct_per_hour'];y=result['combined']['correct_per_hour'];result['speedup']=y/x if x else None
        rng=random.Random('pilot04-efficiency-v1');groups=sorted({v['group'] for vs in arms.values() for v in vs});actors=sorted({v['actor'] for vs in arms.values() for v in vs});est=[]
        for _ in range(bootstrap):
            gw=Counter(rng.choices(groups,k=len(groups)));aw=Counter(rng.choices(actors,k=len(actors)));rates={}
            for a in ('control','combined'):
                seconds=sum(v['seconds']*gw[v['group']]*aw[v['actor']] for v in arms[a]);corr=sum(int(v['correct'])*gw[v['group']]*aw[v['actor']] for v in arms[a])
                rates[a]=corr/seconds if seconds else 0
            if rates['control']:est.append(rates['combined']/rates['control'])
        est.sort()
        if est:result['speedup_ci95_cluster_bootstrap']=[est[int(.025*(len(est)-1))],est[int(.975*(len(est)-1))]]
        result['bootstrap_valid_resamples']=len(est)
    result['method']='crossed participant/leakage-group bootstrap; all attempted time including false/uncertain candidates retained'
    return result
