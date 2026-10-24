"""Removal endpoints: weighted point estimates, dependence-aware CIs, no empty PASS."""
import math, random
from collections import Counter, defaultdict

def zero_error_n(limit, alpha):
    if not 0 < limit < 1 or not 0 < alpha < 1: raise ValueError('probabilities')
    return math.ceil(math.log(alpha) / math.log1p(-limit))

def binomial_cdf(k, n, p):
    if k < 0: return 0.
    if k >= n: return 1.
    if p == 0: return 1.
    if p == 1: return 0.
    terms=[math.lgamma(n+1)-math.lgamma(i+1)-math.lgamma(n-i+1)+i*math.log(p)+(n-i)*math.log1p(-p) for i in range(k+1)]
    top=max(terms)
    return min(1., math.exp(top)*sum(math.exp(t-top) for t in terms))

def exact_bounds(k, n, alpha):
    """One-sided Clopper-Pearson bounds; not valid for weighted/dependent rows."""
    if not isinstance(n,int) or not isinstance(k,int) or not 0 <= k <= n or not 0 < alpha < 1: raise ValueError('binomial units')
    if not n: return None
    def solve(target, count):
        lo,hi=0.,1.
        for _ in range(65):
            mid=(lo+hi)/2
            if binomial_cdf(count,n,mid)>target: lo=mid
            else: hi=mid
        return (lo+hi)/2
    return [0. if k==0 else solve(1-alpha,k-1), 1. if k==n else solve(alpha,k)]

def ratio(k,n): return dict(value=k/n if n else None,numerator=k,denominator=n)

def summary(rows):
    c=Counter(); all_weight=sum(r['weight'] for r in rows)
    for r in rows:
        w=r['weight']; gold=r.get('gold'); prediction=r['prediction']
        if prediction=='NOT_RUN':c['not_run']+=w;continue
        if gold not in ('VALID','INVALID'): c['unknown']+=w; continue
        c['labeled']+=w; c['valid' if gold=='VALID' else 'invalid']+=w
        if prediction=='REMOVE': c['correct_removal' if gold=='INVALID' else 'false_removal']+=w
    removed=sum(r['weight'] for r in rows if r['prediction']=='REMOVE')
    resolved_removed=c['correct_removal']+c['false_removal']
    return dict(
        precision_exclusions=ratio(c['correct_removal'],resolved_removed),
        false_removal_rate=ratio(c['false_removal'],c['valid']),
        recall_erroneous_existing_links=ratio(c['correct_removal'],c['invalid']),
        # Bounds retain all unreviewed frame rows: do not silently drop nonresponse.
        precision_missing_gold_bounds=[c['correct_removal']/removed,(c['correct_removal']+removed-resolved_removed)/removed] if removed else None,
        false_removal_missing_gold_bounds=[c['false_removal']/(c['valid']+c['unknown']), (c['false_removal']+sum(r['weight'] for r in rows if r.get('gold') not in ('VALID','INVALID') and r['prediction']=='REMOVE'))/(c['valid']+sum(r['weight'] for r in rows if r.get('gold') not in ('VALID','INVALID') and r['prediction']=='REMOVE')) if c['valid']+sum(r['weight'] for r in rows if r.get('gold') not in ('VALID','INVALID') and r['prediction']=='REMOVE') else None] if c['valid']+c['unknown'] else None,
        counts=dict(c), total_design_weight=all_weight,proposed_removal_weight=removed,
        status='DESCRIPTIVE_PARTIAL_GOLD' if c['labeled'] else 'INSUFFICIENT_EVIDENCE')

def evaluate(rows, repetitions=2000, seed='quality11-cluster-bootstrap'):
    out=summary(rows); clusters=defaultdict(list)
    for r in rows:
        if not math.isfinite(r['weight']) or r['weight']<=0 or not r.get('cluster'): raise ValueError('weight/cluster')
        clusters[r['cluster']].append(r)
    # Resample linked clusters across languages jointly. Language design weights
    # remain in every draw; a family spanning languages is never split into PSUs.
    rng=random.Random(seed); keys=sorted(clusters); names=['precision_exclusions','false_removal_rate','recall_erroneous_existing_links']; values={n:[] for n in names}
    labeled_clusters={r['cluster'] for r in rows if r.get('gold') in ('VALID','INVALID')}
    if len(labeled_clusters)>=30:
        for _ in range(repetitions):
            draw=[r for k in rng.choices(keys,k=len(keys)) for r in clusters[k]]
            s=summary(draw)
            for n in names:
                if s[n]['value'] is not None: values[n].append(s[n]['value'])
    for n in names:
        v=sorted(values[n]);out[n]['ci95_linked_cluster_bootstrap']=[v[int(.025*(len(v)-1))],v[int(.975*(len(v)-1))]] if v else None
    out.update(clusters=len(keys),labeled_clusters=len(labeled_clusters),ci_method='Linked-cluster percentile bootstrap with original language design weights; descriptive, not an automatic safety certificate',bootstrap_seed=seed,bootstrap_repetitions=repetitions,safety_gate='BLOCKED',safety_reason='Requires calibrated protocol, complete independent gold, certified holdout and endpoint-specific independence; descriptive bootstrap cannot certify rare zero-error risk')
    return out

def agreement(pairs):
    if not pairs:return dict(n=0,raw_agreement=None,cohens_kappa=None,unresolved_rate=None)
    a=Counter(x for x,y in pairs);b=Counter(y for x,y in pairs);n=len(pairs);po=sum(x==y for x,y in pairs)/n;pe=sum(a[k]*b[k] for k in set(a)|set(b))/(n*n)
    return dict(n=n,raw_agreement=po,cohens_kappa=(po-pe)/(1-pe) if pe<1 else None,unresolved_rate=sum('UNCERTAIN' in p or p[0]!=p[1] for p in pairs)/n,confusion={x:{y:sum(p==(x,y) for p in pairs) for y in sorted(b)} for x in sorted(a)})
