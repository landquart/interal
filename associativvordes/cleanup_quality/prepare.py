"""Frozen prospective language-stratified sample, separate challenge, blind tasks."""
import argparse, gzip, heapq, json, math, resource, sqlite3, time
from collections import Counter, defaultdict
from pathlib import Path
from associativvordes.family_boundary.core import ROOT, digest, sha, save, stream, read, verify_sources

HERE=Path(__file__).parent
PROPOSALS=[
 'audit/associative-v5-structural-cleanup/SAFE-FIXES.ndjson',
 'audit/associative-v5-surface-cleanup/PROPOSED-EXCLUSIONS.ndjson',
 'audit/associative-v5-morphology-cleanup/semantic-review-v2/VERIFIED-RELATION-CORRECTIONS.ndjson',
 'audit/associative-v5-morphology-cleanup/semantic-review-v2/PROPOSED-MEMBERSHIP-EXCLUSIONS.ndjson',
 'audit/associative-v5-semantic-cleanup/PROPOSED-RELATION-CORRECTIONS.ndjson',
 'audit/associative-v5-semantic-cleanup/PROPOSED-MEMBERSHIP-CORRECTIONS.ndjson',
 'audit/associative-v5-family-boundary/SPLIT-MERGE-PROPOSALS.ndjson',
 'audit/associative-v5-family-boundary/WRONG-ASSIGNMENT-PROPOSALS.ndjson']

def proposal_lock():
    rows=[]
    for s in PROPOSALS:
        p=ROOT/s; data=[json.loads(x) for x in p.read_text().splitlines() if x.strip()]
        rows.append(dict(path=s,sha256=sha(p),bytes=p.stat().st_size,rows=len(data)))
    # Nonempty future plans require their own operation adapter and preregistration.
    if any(r['rows'] for r in rows): raise ValueError('nonempty operations require exact-scope prediction adapter; never silently ignore')
    return rows

def lowest(d,protocol,state,stop_after=None):
    n=protocol['probability_design']['per_language'];seed=protocol['seed'];langs=protocol['probability_design']['languages']
    heaps={l:[] for l in langs};counts=Counter();offset=0
    if state.exists():
        s=read(state)
        if s['protocol_sha256']!=digest(protocol):raise ValueError('stale sampling checkpoint')
        heaps={l:[tuple(x) for x in s['heaps'][l]] for l in langs};counts.update(s['counts']);offset=s['offset']
        for h in heaps.values():heapq.heapify(h)
    cursor=d.execute('SELECT f.fid,m.lang,m.lid,m.ordinal,m.record_hash,f.bucket FROM members m JOIN families f ON f.f=m.f ORDER BY m.f,m.lang,m.lid LIMIT -1 OFFSET ?',(offset,))
    processed=0
    for fid,l,lid,i,rh,b in cursor:
        counts[l]+=1;offset+=1;processed+=1
        h=int(digest([seed,fid,l,lid,rh]),16);item=(-h,fid,l,lid,i,rh,b)
        if len(heaps[l])<n:heapq.heappush(heaps[l],item)
        elif item>heaps[l][0]:heapq.heapreplace(heaps[l],item)
        if offset%250000==0:
            save(state,dict(protocol_sha256=digest(protocol),offset=offset,heaps=heaps,counts=dict(counts)))
            if stop_after and processed>=stop_after:return None
    save(state,dict(protocol_sha256=digest(protocol),offset=offset,heaps=heaps,counts=dict(counts)))
    if sum(counts.values())!=10078319:raise ValueError('complete current membership frame required')
    result=[]
    for l in langs:
        if counts[l]<n:raise ValueError('requested sample exceeds stratum')
        for minus,fid,l,lid,i,rh,b in heaps[l]:
            result.append(dict(family_id=fid,language=l,lemma_id=lid,ordinal=i,record_sha256=rh,bucket=b,selection_hash=f'{-minus:064x}',stratum_population=counts[l],stratum_sample_size=n,inclusion_probability=n/counts[l],weight=counts[l]/n))
    return sorted(result,key=lambda x:(x['language'],x['selection_hash']))

def audit_old(d,kit):
    import zipfile
    lock=read(ROOT/'audit/associative-family-v5/annotation-input-lock.json')
    if sha(kit)!=lock['artifact_zips']['semantic_probability_kit_v2']['sha256']:raise ValueError('historical kit checksum')
    exposure=set();present=Counter();complete={};source_null=0
    with zipfile.ZipFile(kit) as z:
        for fn in ['gold-sample.jsonl','annotation-packets.jsonl']:
            if sha_bytes(z.read(fn))!=lock['content_hashes']['probability_sample_v2_sha256' if fn=='gold-sample.jsonl' else 'annotation_packets_v2_sha256']:raise ValueError('historical sample member checksum')
        sample=[json.loads(x) for x in z.read('gold-sample.jsonl').splitlines()]
        for r in sample:
            exposure.add('family:'+r['family_id']);exposure.add('lemma:'+r['language']+':'+r['lemma_id'])
            f=d.execute('SELECT f FROM families WHERE fid=?',(r['family_id'],)).fetchone()
            if not f:present['family_absent']+=1
            elif d.execute('SELECT 1 FROM members WHERE f=? AND lang=? AND lid=?',(f[0],r['language'],r['lemma_id'])).fetchone():present['exact_legacy_membership_present']+=1
            else:present['membership_absent']+=1
        for fn in ['annotation-a.jsonl','annotation-b.jsonl']:
            rs=[json.loads(x) for x in z.read(fn).splitlines()];complete[fn]=sum(bool(r.get('annotator_id') and r.get('membership_verdict') and r.get('completed_at')) for r in rs)
        source_null=sum(not json.loads(x).get('source_record_hash') for x in z.read('annotation-packets.jsonl').splitlines())
    pilot=ROOT/'audit/associative-external-preparation/pilot-validation/CASES.ndjson.gz';pilot_n=0
    with gzip.open(pilot,'rt') as f:
        for line in f:
            c=json.loads(line);pilot_n+=1;exposure.add('family:'+c['family']);exposure.add('lemma:'+c['language']+':'+c['target']['lexeme_id'])
            def walk(x):
                if isinstance(x,dict):
                    for k,v in x.items():
                        if k=='family_id' and isinstance(v,str):exposure.add('family:'+v)
                        if k in ('record_sha256','raw_sha256') and v:exposure.add('record:'+v)
                        walk(v)
                elif isinstance(x,list):
                    for v in x:walk(v)
            walk(c.get('provenance',[]))
    return dict(schema='cleanup-old-study-compatibility/1',kit_sha256=sha(kit),sample_rows=len(sample),current_presence=dict(present),completed_reviews=complete,packets_missing_source_record_hash=source_null,old_probability_design='Known old-language weights, invalid for changed current frame without redesign',legacy_initial_sample='Challenge only; no known inclusion probabilities',human_qa=read(ROOT/'audit/associative-family-v5/annotation-qa.json'),pilot_cases=pilot_n,pilot_sha256=sha(pilot),false_negative_seed_rows_are_not_gold=True,status='NOT_CURRENT_HUMAN_GOLD',protocol_calibration_complete=False),exposure

def sha_bytes(b):
    import hashlib
    return hashlib.sha256(b).hexdigest()

def row_for(d,fid,l=None,lid=None):
    q='SELECT f.fid,m.lang,m.lid,m.ordinal,m.record_hash,f.bucket FROM families f JOIN members m ON m.f=f.f WHERE f.fid=?';a=[fid]
    if l:q+=' AND m.lang=?';a.append(l)
    if lid:q+=' AND m.lid=?';a.append(lid)
    r=d.execute(q+' ORDER BY m.lang,m.lid LIMIT 1',a).fetchone()
    return dict(zip(['family_id','language','lemma_id','ordinal','record_sha256','bucket'],r)) if r else None

def historical_context(h):
    """Recover observed lexical context from the exact locked source pointer."""
    import subprocess,hashlib
    source=h['source'];raw=subprocess.check_output(['git','-C',str(ROOT),'cat-file','blob',source['blob']])
    if hashlib.sha256(raw).hexdigest()!=source['sha256']:raise ValueError('historical lexical source checksum')
    data=json.loads(gzip.decompress(raw) if source['path'].endswith('.gz') else raw)
    for token in source.get('pointer','').split('/')[1:]:
        token=token.replace('~1','/').replace('~0','~');data=data[int(token)] if isinstance(data,list) else data[token]
    word=data.get('word') or data.get('lemma')
    if not isinstance(word,str) or not word:raise ValueError('historical task lacks a documented lexical form')
    # Previous decisions, explanations and proposed analyses remain blinded.
    observed={k:data[k] for k in ('word','normalized','search_form','context') if k in data}
    observed['word']=word;observed['source_refs']=[{k:source[k] for k in ('commit','path','blob','sha256','pointer') if k in source}]
    return word,observed

def challenges(d):
    result={}
    def add(r,tag):
        if r:
            k=(r['family_id'],r['language'],r['lemma_id']);result.setdefault(k,dict(r,risk_flags=[]))['risk_flags'].append(tag)
    for alias in ['manu','regul','creat','ocul','ped','pede','inter','liber','mut','net','nitidus','sonus','genea','act']:
        for (fid,) in d.execute('SELECT fid FROM aliases WHERE alias=? ORDER BY fid LIMIT 4',(alias,)):
            for l in ['en','de','fr','es','it','ru']:add(row_for(d,fid,l), 'ROOT_OR_OVERLAP:'+alias)
    for r in d.execute('SELECT fid FROM families ORDER BY n DESC,fid LIMIT 12'):add(row_for(d,r[0]),'LARGE_FAMILY')
    for r in d.execute('SELECT fid FROM families WHERE n=1 ORDER BY fid LIMIT 12'):add(row_for(d,r[0]),'SINGLETON')
    for line in (ROOT/'audit/associative-v5-semantic-cleanup/SEMANTIC-CASES.ndjson').read_text().splitlines():
        s=json.loads(line)['scope'];add(row_for(d,s['family_id'],s['language'],s['lemma_id']),'SEMANTIC_IDENTITY_UNRESOLVED')
    # Preserve removed exact historical scope as history tasks, not corpus members.
    historical=[]
    for (body,) in d.execute('SELECT body FROM history ORDER BY id'):
        h=json.loads(body);s=h.get('scope',{});ids=s.get('lemma_ids',[])
        if h.get('decision')=='CONFIRMED_NONMEMBER' and s.get('language') and ids:
            for lid in ids[:1]:
                add(row_for(d,s['family_id'],s['language'],lid),'SCOPED_NEGATIVE_HISTORY')
                word,context=historical_context(h)
                family_row=d.execute('SELECT meta FROM families WHERE fid=?',(s['family_id'],)).fetchone()
                family_canonical=json.loads(family_row[0]).get('canonical') if family_row else None
                historical.append(dict(family_canonical=family_canonical,source_record=context,case_kind='HISTORICAL_SCOPE_NOT_POPULATION_MEMBERSHIP',family_id=s['family_id'],language=s['language'],lemma_id=lid,word=word,pos=s.get('pos'),sense_id=s.get('sense_id'),history_ref=h['id'],history_sha256=digest(h),risk_flags=['SCOPED_NEGATIVE_HISTORY'],source_record_status='HISTORICAL_SCOPE_ONLY_NOT_RESTORED'))
        if len(historical)>=12:break
    return list(result.values()),historical

def sanitized(x):
    blocked={'confidence','review_status','corpus_quality','status','decision','verdict','automatic_confidence','risk_flags','frequency_score','rank'}
    if isinstance(x,dict):return {k:sanitized(v) for k,v in x.items() if k not in blocked}
    if isinstance(x,list):return [sanitized(v) for v in x]
    return x

def enrich(rows,d,protocol_hash):
    wanted=defaultdict(list)
    for r in rows:wanted[(r['language'],r['bucket'])].append(r)
    for (l,b),rs in sorted(wanted.items()):
        source=f'associativvordes/family-index-v5/members/{l}/{b}.json.gz';data=json.load(gzip.open(ROOT/source));file_sha=sha(ROOT/source)
        for r in rs:
            raw=data[r['family_id']][r['ordinal']]
            if raw['lemma_id']!=r['lemma_id'] or digest(raw)!=r['record_sha256']:raise ValueError('exact source binding')
            meta=json.loads(d.execute('SELECT meta FROM families WHERE fid=?',(r['family_id'],)).fetchone()[0])
            profile=json.loads(d.execute('SELECT p.body FROM profiles p JOIN families f ON f.f=p.f WHERE f.fid=?',(r['family_id'],)).fetchone()[0])
            r.update(word=raw['word'],pos=None,sense_id=None,source_path=source,source_record=raw,source_file_sha256=file_sha,family_canonical=meta.get('canonical'),family_class=meta.get('source','UNKNOWN'),relation_types=list(profile['relation_type_counts']),protocol_sha256=protocol_hash,case_kind='EXISTING_MEMBERSHIP',native_identity_status='LEGACY_ID_SENSE_UNRESOLVED')
    return rows

def linked_clusters(cases):
    parent={};by={}
    def root(x):
        while parent[x]!=x:parent[x]=parent[parent[x]];x=parent[x]
        return x
    for c in cases:
        parent[c['id']]=c['id']
        tokens=['family:'+c['family_id'],'lemma:'+c['language']+':'+c['lemma_id']]
        if c.get('record_sha256'):tokens.append('record:'+c['record_sha256'])
        for t in tokens:
            if t in by:
                a,b=root(c['id']),root(by[t]);parent[max(a,b)]=min(a,b)
            else:by[t]=c['id']
    # This groups statistical dependence ONLY, never changes a family/canonical ID.
    return {c['id']:'statistical-cluster:'+digest(root(c['id'])) for c in cases}

def run(index,output,kit,stop_after=None):
    start=time.monotonic();out=Path(output).resolve();index=Path(index).resolve();protocol=read(HERE/'protocol.json');ph=digest(protocol)
    if out.is_relative_to(ROOT):raise ValueError('research packets outside Git')
    out.mkdir(parents=True,exist_ok=True)
    if (out/'MANIFEST.json').exists():raise ValueError('immutable completed release exists')
    m=read(index/'MANIFEST.json')
    if sha(index/'index.sqlite')!=m['database_sha256']:raise ValueError('index checksum')
    verify_sources();d=sqlite3.connect('file:'+str(index/'index.sqlite')+'?mode=ro',uri=True);d.execute('PRAGMA cache_size=-32768');d.execute('PRAGMA temp_store=FILE')
    identity=dict(protocol_sha256=ph,index_version=m['version'],index_sha256=m['database_sha256'],old_kit_sha256=sha(kit),code_sha256=sha(__file__))
    ip=out/'INPUTS.json'
    if ip.exists() and read(ip)!=identity:raise ValueError('stale checkpoint inputs')
    save(ip,identity);proposals=proposal_lock();old,exposure=audit_old(d,kit);sample=lowest(d,protocol,out/'SAMPLING-CHECKPOINT.json',stop_after)
    if sample is None:return dict(status='CHECKPOINTED')
    challenge,historical=challenges(d);enrich(sample+challenge,d,ph);allcases=[]
    for name,rs in [('probability',sample),('challenge',challenge+historical)]:
        for r in rs:
            c=dict(r,dataset=name,split='holdout',protocol_sha256=ph)
            c['id']='quality-case:'+digest([name,c['family_id'],c['language'],c['lemma_id'],c.get('record_sha256'),c.get('history_ref')]);allcases.append(c)
    clusters=linked_clusters(allcases)
    for c in allcases:
        c['cluster']=clusters[c['id']];c['historical_exposure_flags']=[t for t in ['family:'+c['family_id'],'lemma:'+c['language']+':'+c['lemma_id'],'record:'+str(c.get('record_sha256'))] if t in exposure]
        c['content_sha256']=digest(c)
    save(out/'OLD-STUDY-COMPATIBILITY.json',old);save(out/'PROPOSAL-INVENTORY.json',dict(inputs=proposals,operation_count=0,empty_plan_is_not_precision=True))
    stream(out/'PROBABILITY.ndjson.gz',(c for c in allcases if c['dataset']=='probability'));stream(out/'CHALLENGE.ndjson.gz',(c for c in allcases if c['dataset']=='challenge'))
    for role in ['A','B']:
        cards=[]
        for c in allcases:
            cards.append(dict(task_id='blind-task:'+digest([role,c['id']]),role=role,case_id=c['id'],case_sha256=c['content_sha256'],protocol_sha256=ph,language=c['language'],family_id=c['family_id'],family_canonical=c.get('family_canonical'),lemma_id=c['lemma_id'],word=c['word'],pos=c.get('pos'),sense_id=c.get('sense_id'),source_record=sanitized(c.get('source_record',{})),historical_scope_only=c['case_kind']!='EXISTING_MEMBERSHIP',collection_status='NOT_RELEASED_PENDING_CALIBRATION_AND_RECRUITMENT'))
        cards.sort(key=lambda c:digest([protocol['seed'],role,c['task_id']]));stream(out/f'BLIND-{role}.ndjson.gz',cards)
    predictions=[]
    for cfg in protocol['configurations']:
        for c in allcases:
            prediction='KEEP' if cfg in ('original_v5','deterministic_filters') and c['case_kind']=='EXISTING_MEMBERSHIP' else 'NOT_RUN' if cfg=='llm_assisted' else 'ABSTAIN'
            predictions.append(dict(case_id=c['id'],case_sha256=c['content_sha256'],configuration=cfg,prediction=prediction,authority='ALGORITHM_NOT_GOLD',reason='Existing materialization' if cfg=='original_v5' else 'Empty exact proposal plan' if cfg=='deterministic_filters' else 'No paid/provider run' if cfg=='llm_assisted' else 'Unbound lexical/sense evidence; no approved operations'))
    stream(out/'PREDICTIONS.ndjson.gz',predictions)
    for fn in ['RAW-HUMAN-REVIEWS.ndjson','RAW-ADJUDICATIONS.ndjson','DISAGREEMENTS.ndjson']: (out/fn).write_text('')
    save(out/'ROSTER.json',{})
    save(out/'HOLDOUT.json',dict(training=0,calibration=0,probability=len(sample),challenge=len(challenge)+len(historical),heldout_case_hashes_sha256=digest([c['content_sha256'] for c in allcases]),within_release_cross_split_leakage=0,known_historical_exposure_units=sum(bool(c['historical_exposure_flags']) for c in allcases),independence_certification='BLOCKED',reason='Historical exposure detected; complete cross-version native/sense/evidence linkage unavailable. No exclusion/resampling of exposed probability rows; no evaluation tuning. Challenge never contributes population estimates.',human_labels=0,protocol_calibration='BLOCKED'))
    save(out/'SAMPLING-DESIGN.json',dict(schema='cleanup-probability-design/1',seed=protocol['seed'],frame=sum(r['stratum_population']/r['stratum_sample_size'] for r in sample),strata={l:dict(N=next(r['stratum_population'] for r in sample if r['language']==l),n=sum(r['language']==l for r in sample),pi=next(r['inclusion_probability'] for r in sample if r['language']==l)) for l in protocol['probability_design']['languages']},sampled=len(sample),no_risk_enrichment=True,source='Exact current materialized memberships; unassigned lemmas are outside membership frame and preserved'))
    verify_sources();d.close();(out/'SAMPLING-CHECKPOINT.json').unlink()
    save(out/'RESOURCE.json',dict(elapsed_seconds=time.monotonic()-start,peak_rss_mib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024,production_writes=0))
    save(out/'MANIFEST.json',dict(schema='cleanup-quality-packets/1',identity=identity,case_set_sha256=digest(allcases),probability_cases=len(sample),challenge_cases=len(challenge)+len(historical),files=[dict(path=p.name,bytes=p.stat().st_size,sha256=sha(p)) for p in sorted(out.iterdir()) if p.is_file() and p.name!='MANIFEST.json'],semantic_gate='BLOCKED',production_writes=0))
    return dict(status='PREPARED_HUMAN_GATE_BLOCKED',probability=len(sample),challenge=len(challenge)+len(historical))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--index',required=True);p.add_argument('--output',required=True);p.add_argument('--old-kit',required=True);p.add_argument('--stop-after',type=int);a=p.parse_args();print(json.dumps(run(a.index,a.output,a.old_kit,a.stop_after)))
