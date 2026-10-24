"""Independent cutoff census (no sampler heap) and paired frozen-output replay."""
import argparse,json,sqlite3,time,resource
from collections import Counter
from pathlib import Path
from associativvordes.family_boundary.core import digest,read,save,sha,verify_sources
from .evaluate import release,rows
from .prepare import HERE

def verify(first,replay,index,eval_first,eval_replay,receipt):
    start=time.monotonic();first=Path(first);replay=Path(replay);index=Path(index);cases,m=release(first);other,om=release(replay)
    if m['case_set_sha256']!=om['case_set_sha256'] or cases!=other:raise ValueError('case replay mismatch')
    compared=[]
    for name in ['PROBABILITY.ndjson.gz','CHALLENGE.ndjson.gz','BLIND-A.ndjson.gz','BLIND-B.ndjson.gz','PREDICTIONS.ndjson.gz','HOLDOUT.json','SAMPLING-DESIGN.json','OLD-STUDY-COMPATIBILITY.json','PROPOSAL-INVENTORY.json']:
        if sha(first/name)!=sha(replay/name):raise ValueError('nondeterministic output '+name)
        compared.append(dict(path=name,sha256=sha(first/name)))
    for name in ['FROZEN-GOLD.json','OPERATION-GATES.json','RAW-HUMAN-REVIEWS.ndjson','RAW-ADJUDICATIONS.ndjson','DISAGREEMENTS.ndjson']:
        if sha(Path(eval_first)/name)!=sha(Path(eval_replay)/name):raise ValueError('evaluation replay mismatch')
    left,right=read(Path(eval_first)/'METRICS.json'),read(Path(eval_replay)/'METRICS.json')
    if left.pop('release_sha256')!=sha(first/'MANIFEST.json') or right.pop('release_sha256')!=sha(replay/'MANIFEST.json') or left!=right:raise ValueError('evaluation content or release binding mismatch')
    index_manifest=read(index/'MANIFEST.json')
    if sha(index/'index.sqlite')!=index_manifest['database_sha256'] or index_manifest['version']!=m['identity']['index_version']:raise ValueError('input corpus version')
    probability=[c for c in cases if c['dataset']=='probability'];protocol=read(HERE/'protocol.json');cutoffs={};selected=set();ns=Counter();counts=Counter();qualifying=Counter()
    for c in probability:
        key=(c['family_id'],c['language'],c['lemma_id'],c['record_sha256'])
        h=digest([protocol['seed'],*key])
        if h!=c['selection_hash'] or key in selected or digest(c['source_record'])!=c['record_sha256']:raise ValueError('sample key/raw provenance')
        selected.add(key);ns[c['language']]+=1;cutoffs[c['language']]=max(cutoffs.get(c['language'],''),h)
    d=sqlite3.connect('file:'+str(index/'index.sqlite')+'?mode=ro',uri=True)
    # Algorithm differs from selection: scan every frame row and prove exactly n
    # meet each frozen cutoff, rather than retaining a second set of minima.
    for fid,l,lid,rh in d.execute('SELECT f.fid,m.lang,m.lid,m.record_hash FROM members m JOIN families f ON f.f=m.f'):
        counts[l]+=1;key=(fid,l,lid,rh)
        if digest([protocol['seed'],*key])<=cutoffs[l]:
            qualifying[l]+=1
            if key not in selected:raise ValueError('unsampled lower hash detected')
    d.close();design=read(first/'SAMPLING-DESIGN.json')
    if sum(counts.values())!=10078319 or dict(ns)!=dict(qualifying) or design['frame']!=sum(counts.values()):raise ValueError('full population cutoff proof')
    for c in probability:
        n,N=ns[c['language']],counts[c['language']]
        if c['stratum_population']!=N or c['stratum_sample_size']!=n or c['inclusion_probability']!=n/N or c['weight']!=N/n:raise ValueError('design weights')
    ii={c['id']:c for c in cases};orders=[]
    forbidden={'prediction','configuration','confidence','risk_flags','historical_exposure_flags','review_status','verdict','sampling_stratum','weight','dataset'}
    def clean(x):
        if isinstance(x,dict):
            if forbidden&set(x):raise ValueError('blind task leaked predictions or risk')
            for v in x.values():clean(v)
        elif isinstance(x,list):
            for v in x:clean(v)
    for role in ['A','B']:
        cards=rows(first/f'BLIND-{role}.ndjson.gz');seen=set()
        for c in cards:
            if c['case_id'] in seen or c['case_sha256']!=ii[c['case_id']]['content_sha256'] or c['role']!=role:raise ValueError('blind exact identity')
            seen.add(c['case_id']);clean(c)
        if seen!=set(ii):raise ValueError('missing review tasks')
        orders.append([c['case_id'] for c in cards])
    if orders[0]==orders[1]:raise ValueError('reviewers not independently shuffled')
    prod=verify_sources()
    result=dict(schema='cleanup-quality-independent-verification/1',status='PASS_ENGINEERING_ONLY',probability_units=len(probability),challenge_units=len(cases)-len(probability),all_source_memberships_scanned=sum(counts.values()),stratum_population=dict(counts),stratum_selected=dict(ns),independent_method='Full frozen-cutoff census without the sampler heap',source_files_rechecked=prod,deterministic_artifacts=compared,evaluation_replay_identical=True,blind_tasks_checked=2*len(cases),no_placeholder_counted_as_human=True,semantic_gate='BLOCKED',holdout_independence_certification='BLOCKED',elapsed_seconds=time.monotonic()-start,peak_rss_mib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024,production_writes=0)
    save(receipt,result);return result
if __name__=='__main__':
    p=argparse.ArgumentParser()
    for n in ['first','replay','index','eval-first','eval-replay','receipt']:p.add_argument('--'+n,required=True)
    a=p.parse_args();print(json.dumps(verify(a.first,a.replay,a.index,a.eval_first,a.eval_replay,a.receipt)))
