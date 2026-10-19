"""Closed-scope metrics. Missing human labels and abstentions are never zero accuracy."""
from collections import Counter,defaultdict
from gold import sha,canonical,validate_cases

CONFIGS={'A':[],'B':['uder'],'C':['uder','morphynet'],'D':['uder','morphynet','glemm'],'E':['uder','morphynet','glemm','flexor']}

def ratio(a,b):return a/b if b else None

def counts(rows):
    d=Counter();known=[];boundary_compared=boundary_errors=merge_compared=merge_errors=0
    for c,g,p in rows:
        d['cases']+=1
        if g['state'] in {'disagreement','single_review'}:d['disputed_or_incomplete']+=1
        if not g['label']:d['no_gold']+=1;continue
        if g['label']['decision']=='uncertain':d['gold_uncertain']+=1;continue
        d['labeled']+=1;truth=g['label']['decision']=='yes';guess=p['decision'];yes=guess=='yes'
        d['tp']+=truth and yes;d['fp']+=not truth and yes;d['fn']+=truth and not yes;d['tn']+=not truth and guess=='no';d['abstain']+=guess=='abstain'
        d['manual_review']+=p['requires_manual_review'];d['membership_errors']+=guess!='abstain' and (yes!=truth)
        if truth and yes:known.append(c['id'])
        if guess=='yes' and g['label'].get('boundaries') is not None and p.get('boundaries') is not None:
            boundary_compared+=1;boundary_errors+=p['boundaries']!=g['label']['boundaries']
        if guess=='yes' and g['label'].get('correct_families') is not None:
            merge_compared+=1;merge_errors+=bool(set(p.get('families',[c['family']]))-set(g['label']['correct_families']))
    return {'counts':dict(d),'precision':ratio(d['tp'],d['tp']+d['fp']),'recall_labeled_scope':ratio(d['tp'],d['tp']+d['fn']),
      'membership_error_rate':ratio(d['membership_errors'],d['labeled']),'false_family_merges':merge_errors if merge_compared else None,'merge_evaluable':merge_compared,
      'boundary_errors':boundary_errors if boundary_compared else None,'boundary_evaluable':boundary_compared,
      'disputed_fraction':ratio(d['disputed_or_incomplete']+d['gold_uncertain'],d['cases']),
      'manual_review_fraction_labeled':ratio(d['manual_review'],d['labeled']),'unique_correct_case_ids':sorted(set(known))}

def validate_predictions(cases,predictions):
    index=validate_cases(cases);by={}
    for p in predictions:
        cid=p.get('case_id')
        if cid not in index or cid in by or p.get('case_content_sha256')!=index[cid]['content_sha256']:raise ValueError('prediction scope/duplicate/checksum')
        if p.get('decision') not in {'yes','no','abstain'} or type(p.get('requires_manual_review'))!=bool:raise ValueError('prediction contract')
        by[cid]=p
    if set(by)!=set(index):raise ValueError('explicit abstention required for every unprocessed case')
    return by

def evaluate(cases,gold,run):
    validate_cases(cases)
    if gold['content_sha256']!=sha({k:v for k,v in gold.items() if k!='content_sha256'}) or gold['case_set_sha256']!=sha(cases) or run['case_set_sha256']!=sha(cases):raise ValueError('same frozen cases/gold required')
    if run['status']!='completed':return {'status':'unavailable','reason':run.get('reason'),'quality_metrics':None}
    preds=validate_predictions(cases,run['predictions']);gg={r['case_id']:r for r in gold['rows']}
    if set(gg)!={c['id'] for c in cases} or len(gg)!=len(gold['rows']):raise ValueError('gold coverage')
    for c in cases:
        if gg[c['id']]['case_content_sha256']!=c['content_sha256']:raise ValueError('gold case checksum')
    rows=[(c,gg[c['id']],preds[c['id']]) for c in cases];groups={}
    for dimension in ['language','family','relation','split']:
        buckets=defaultdict(list)
        for row in rows:
            c,g,p=row;key=(g['label']['relation'] if g['label'] else 'unannotated') if dimension=='relation' else c[dimension]
            buckets[key].append(row)
        groups[dimension]={k:counts(v) for k,v in sorted(buckets.items())}
    overall=counts(rows)
    return {'status':'evaluated_labeled_scope' if overall['counts'].get('labeled') else 'awaiting_human_gold','overall':overall,'groups':groups,
      'runtime_seconds':run.get('runtime_seconds'),'full_population_claim':False,'gold_sha256':gold['content_sha256'],'case_set_sha256':sha(cases)}

def compare(evaluations):
    contributions={}
    for a,b in [('A','B'),('B','C'),('C','D'),('D','E')]:
        if a not in evaluations or b not in evaluations or not evaluations[a].get('overall') or not evaluations[b].get('overall'):contributions[a+'→'+b]=None;continue
        x=evaluations[a]['overall'];y=evaluations[b]['overall'];xx=set(x['unique_correct_case_ids']);yy=set(y['unique_correct_case_ids'])
        contributions[a+'→'+b]={'additional_correct':sorted(yy-xx),'lost_correct':sorted(xx-yy),'delta_fp':y['counts'].get('fp',0)-x['counts'].get('fp',0),
          'interpretation':'paired configuration difference, not causal source attribution; B→C removes baseline and adds MorphyNet'} if x['counts'].get('labeled') else None
    return {'paired_contributions':contributions,'independence_warning':'GLeMM may inherit MorphyNet; distinct records are not independent confirmations'}
