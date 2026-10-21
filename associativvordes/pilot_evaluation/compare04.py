"""Current frozen pilot execution. Never use these predictions as human gold."""
import argparse
from collections import defaultdict,deque,Counter
import gzip,json,platform,subprocess,tempfile,time
from pathlib import Path
from gold import sha,canonical,file_hash,json_rows,validate_cases,compile_gold,new_release_directory
from graph import Graph,lookup,ref
from metrics04 import evaluate04,efficiency,zero_error_requirement,require_study_reviews

HERE=Path(__file__).resolve().parent
PROTOCOL=json.loads((HERE/'protocol04.json').read_text())
CATEGORIES=['direct','indirect','compound','orthographic_variant','allomorph','mixed','uncertain']

def category(steps):
    kinds=[s['type'] for s in steps]
    if any(s['direction']!='directed' for s in steps):return 'uncertain'
    if len(steps)>1:return 'indirect' if all(k=='derivation_direct' for k in kinds) else 'mixed'
    return {'derivation_direct':'direct','derivation_indirect':'indirect','compounding':'compound','orthographic_variant':'orthographic_variant','allomorphy':'allomorph'}.get(kinds[0],'uncertain')

def wordkey(family,language,word):return sha([family,language,lookup(word)])

def grouped(items):
    out={}
    for i in items:
        k=wordkey(i['family'],i['language'],i['word'])
        q=out.setdefault(k,{'key':k,'family':i['family'],'language':i['language'],'word':i['word'],'native_ids':[],
             'paths':[],'categories':[],'baseline_candidates':[],'frequency':None,'identity_status':'unresolved_word_group_only'})
        for field in ('native_ids','paths','categories','baseline_candidates'):
            for v in i.get(field,[]):
                if v not in q[field]:q[field].append(v)
        if i.get('frequency') is not None:q['frequency']=i['frequency']
    return list(out.values())

def balance(items,limit):
    buckets=defaultdict(deque)
    for q in items:
        cat=next((c for c in CATEGORIES if c in q['categories']),'uncertain');buckets[cat].append(q)
    out=[]
    while len(out)<limit and any(buckets.values()):
        for c in CATEGORIES:
            if buckets[c] and len(out)<limit:out.append(buckets[c].popleft())
    return out

def bounded_paths(g,start,family,allowed,budget):
    policy=PROTOCOL['budgets'];queue=deque([([start],[],False)]);found=[]
    while queue and len(found)<policy['paths_per_start'] and budget['local_expanded']<policy['expansions_per_start']:
        nodes,steps,terminal=queue.popleft()
        body=g.get(nodes[-1])['body'];guard=g.guard(family,body['language'],body['lemma'],channel='path')
        if guard['status'] in ('blocked','hold'):budget['guard_exclusions']+=1;continue
        if steps:found.append({'nodes':nodes,'steps':steps,'category':category(steps),'establishes_membership':False})
        if terminal or len(steps)>=policy['depth']:continue
        for rid,dst in g.db.execute('SELECT relation,dst FROM arcs WHERE src=? ORDER BY relation,dst',(nodes[-1],)):
            if budget['local_expanded']>=policy['expansions_per_start']:break
            relation=g.get(rid)['body'];kind=relation['type_id'];direction=relation['direction']['state']
            if kind not in {'derivation_direct','derivation_indirect','shared_base','compounding','orthographic_variant','allomorphy','ext:core:morphological_relatedness@1'}:continue
            es=[g.get(eid) for eid, in g.db.execute('SELECT evidence FROM supports WHERE relation=? ORDER BY evidence',(rid,))]
            es=[e for e in es if g.resolve(e['body']['source_revision_ref'])['body']['source_id'] in allowed]
            if not es:continue
            budget['local_expanded']+=1;budget['expanded']+=1
            if dst in nodes:continue
            if g.get(dst)['body']['language']!=body['language'] or len(g.relation_languages(relation))>1:
                budget['cross_language_exclusions']+=1;continue
            verdict=g.db.execute('SELECT status FROM reviews WHERE relation=?',(rid,)).fetchone()
            if verdict and verdict[0]=='rejected':continue
            source_evidence=[{'id':e['id'],**e['body']} for e in es]
            step={'relation_ref':ref(g.get(rid)),'type':kind,'direction':direction,'source_evidence':source_evidence}
            terminal=direction!='directed' or kind in {'orthographic_variant','allomorphy','ext:core:morphological_relatedness@1'}
            queue.append((nodes+[dst],steps+[step],terminal))
    budget['truncated_queries']+=bool(queue)
    return found

def fixed_seeds(g,cases):
    out={}
    for family,language in sorted({(c['family'],c['language']) for c in cases}):
        pool=defaultdict(set)
        for word, in g.db.execute('SELECT DISTINCT word FROM known WHERE family=? AND language=? ORDER BY word',(family,language)):
            for lid, in g.db.execute('SELECT id FROM lexemes WHERE language=? AND search=? ORDER BY id',(language,word)):
                source=g.get(lid)['body']['source_id'];pool[source].add(lid)
        buckets={s:deque(sorted(ids,key=lambda lid:sha([PROTOCOL['seed'],lid]))) for s,ids in pool.items()}
        chosen=[]
        while len(chosen)<PROTOCOL['budgets']['shared_native_starts_per_family_language'] and any(buckets.values()):
            for source in sorted(buckets):
                if buckets[source] and len(chosen)<PROTOCOL['budgets']['shared_native_starts_per_family_language']:chosen.append(buckets[source].popleft())
        out[(family,language)]=chosen
    return out

def source_candidates(g,seeds,sources):
    allowed={'source:'+s for s in sources};out=[];budget=Counter();budget['queries']=0
    for (family,language),starts in sorted(seeds.items()):
        for start in starts:
            if g.get(start)['body']['source_id'] not in allowed:continue
            budget['queries']+=1;budget['local_expanded']=0
            for p in bounded_paths(g,start,family,allowed,budget):
                node=g.get(p['nodes'][-1]);b=node['body']
                out.append({'family':family,'language':language,'word':b['lemma'],'native_ids':[node['id']],
                    'paths':[p],'categories':[p['category']],'frequency':None})
    budget.pop('local_expanded',None)
    return grouped(out),dict(budget)

def select_cells(items):
    cells=defaultdict(list)
    for x in items:cells[(x['family'],x['language'])].append(x)
    selected=[];dropped=[]
    for cell,values in sorted(cells.items()):
        values.sort(key=lambda x:(min((len(p['steps']) for p in x['paths']),default=99),x['key']))
        kept=balance(values,PROTOCOL['budgets']['output_per_family_language']);ids={x['key'] for x in kept}
        selected.extend(kept);dropped.extend(x for x in values if x['key'] not in ids)
    return selected,dropped

def combine(a,u):
    bycell=defaultdict(lambda:[[],[]])
    for k,items in enumerate((a,u)):
        for q in items:bycell[(q['family'],q['language'])][k].append(q)
    selected=[];dropped=[]
    for cell,streams in sorted(bycell.items()):
        ordered=[]
        for i in range(max(map(len,streams),default=0)):
            for stream in streams:
                if i<len(stream):ordered.append(stream[i])
        all_items=grouped(ordered);selected.extend(all_items[:PROTOCOL['budgets']['output_per_family_language']]);dropped.extend(all_items[PROTOCOL['budgets']['output_per_family_language']:])
    return selected,dropped

def predictions(cases,items):
    index={q['key']:q for q in items};out=[]
    for c in cases:
        q=index.get(wordkey(c['family'],c['language'],c['target']['lemma']))
        match=bool(q and (q['baseline_candidates'] or c['target']['lexeme_id'] in q['native_ids']))
        categories=q['categories'] if match else []
        relation=categories[0] if len(categories)==1 and categories[0] in ('direct','indirect','compound','orthographic_variant','allomorph') else 'uncertain'
        out.append({'case_id':c['id'],'case_content_sha256':c['content_sha256'],'decision':'yes' if match else 'abstain',
            'requires_manual_review':True,'sense_identity_established':False,'relation_prediction':relation,
            'boundaries':None,'merged_families':None,'candidate_key':q['key'] if q else None,
            'reason':'candidate_proposal_not_membership' if match else 'no_selected_candidate_or_unresolved_native_identity'})
    return out

def main_run(cases_path,graph,runtime,output,judgments=(),roster=None,adjudications=(),trials=(),study=None):
    cases=list(json_rows(cases_path));validate_cases(cases)
    if sha(cases)!=PROTOCOL['frozen_case_set_sha256']:raise ValueError('frozen pilot changed')
    output=new_release_directory(output);runtime=Path(runtime);actual=json.loads(runtime.read_text())
    if actual['capture_kind']!='actual_runtime' or actual['base_commit']!=PROTOCOL['base_commit'] or actual['cases_file_sha256']!=file_hash(cases_path):raise ValueError('actual runtime capture scope')
    repo=HERE.parents[1]
    for path,expected in actual['runtime_code_hashes'].items():
        if file_hash(repo/path)!=expected:raise ValueError('runtime code changed: '+path)
    for path,receipt in actual['resource_receipts'].items():
        if file_hash(repo/path)!=receipt['sha256']:raise ValueError('runtime resource changed: '+path)
    scopes={(c['family'],c['language']) for c in cases}
    searches=actual['searches']
    if len({(s['family'],s['language']) for s in searches})!=len(searches) or {(s['family'],s['language']) for s in searches}!=scopes:raise ValueError('all actual searches required')
    baseline=[];baseline_dropped=[];cap=PROTOCOL['budgets']['output_per_family_language']
    for s in searches:
        # Only outputs of the real JS pipeline are consumed. Preserve original
        # entries even when outside frozen cases; no registry status substitutes.
        for i,c in enumerate(s['candidates']):
            q=grouped([{'family':s['family'],'language':s['language'],'word':c['word'],'native_ids':[],'paths':[],
               'categories':['uncertain'],'baseline_candidates':[c],'frequency':{'frequency_score':c.get('frequency_score'),'sources':c.get('sources'),'rank':c.get('rank')}}])[0]
            (baseline if i<cap else baseline_dropped).append(q)
    runs={'A':{'candidates':baseline,'dropped':baseline_dropped,'budget':{'queries':len(searches),'incomplete':sum(not s['complete'] for s in searches)}}}
    with tempfile.TemporaryDirectory(prefix='pilot04-graph-') as tmp:
        g=Graph.open_snapshot(graph,Path(tmp)/'graph.sqlite')
        try:
            seeds=fixed_seeds(g,cases)
            for name,sources in [('U',['uder']),('C',['uder','morphynet']),('D',['uder','morphynet','glemm'])]:
                start=time.perf_counter();pool,budget=source_candidates(g,seeds,sources);selected,dropped=select_cells(pool)
                runs[name]={'candidates':selected,'dropped':dropped,'budget':budget,'runtime_seconds':time.perf_counter()-start}
            seeds_receipt={family+'|'+lang:ids for (family,lang),ids in sorted(seeds.items())}
        finally:g.close()
    selected,dropped=combine(baseline,runs['U']['candidates'])
    runs['B']={'candidates':selected,'dropped':dropped,'budget':{'output_cap':cap,'combination':'round_robin_actual_A_and_UDer_then_word_group'}}
    runs={k:runs[k] for k in ('A','B','U','C','D')}
    for name,r in runs.items():r.update(configuration=name,case_set_sha256=sha(cases),status='completed',predictions=predictions(cases,r['candidates']),establishes_membership=False)
    judgments=list(judgments);trials=list(trials)
    if {j['annotator_id'] for j in judgments}&{t['annotator_id'] for t in trials}:raise ValueError('gold and efficiency people must be disjoint')
    gold=compile_gold(cases,judgments,roster or {},list(adjudications))
    if study:
        study_data=json.loads(Path(study).read_text())
        if study_data['case_set_sha256']!=sha(cases) or study_data['protocol_sha256']!=file_hash(HERE/'protocol04.json'):raise ValueError('study lock')
        if not set(study_data['subset_case_ids'])<=set(c['id'] for c in cases):raise ValueError('study cases')
        gold=require_study_reviews(gold,set(study_data['subset_case_ids']))
    evaluated=evaluate04(cases,gold,runs);speed=efficiency(cases,gold,list(trials),roster or {})
    differences={}
    for a,b in [('A','B'),('U','C'),('C','D'),('A','D')]:
        x={q['key'] for q in runs[a]['candidates']};y={q['key'] for q in runs[b]['candidates']}
        differences[a+'->'+b]={'added':sorted(y-x),'displaced':sorted(x-y),'shared':len(x&y),'identity_scope':'presentation word groups only; not native identity merges'}
    coverage={}
    for name,r in runs.items():
        langs={}
        for language in sorted({c['language'] for c in cases}):
            selected=[q for q in r['candidates'] if q['language']==language];pred=[p for c,p in zip(cases,r['predictions']) if c['language']==language]
            langs[language]={'selected_word_groups':len(selected),'native_identity_alternatives':sum(len(q['native_ids']) for q in selected),'cases':len(pred),'proposal_yes':sum(p['decision']=='yes' for p in pred),'abstain':sum(p['decision']=='abstain' for p in pred)}
        coverage[name]={'languages':langs,'selected':len(r['candidates']),'budget_dropped':len(r['dropped']),'proposal_yes':sum(p['decision']=='yes' for p in r['predictions']),'budget':r['budget']}
    alpha=PROTOCOL['gates']['familywise_alpha']/PROTOCOL['gates']['predeclared_strata']
    gates={'status':'BLOCKED_HUMAN_GOLD','automatic_positive_membership':False,'automatic_family_merge':False,
       'zero_error_99pct_precision_minimum_per_stratum':zero_error_requirement(.01,alpha),
       'zero_error_0_1pct_merge_risk_minimum_per_stratum':zero_error_requirement(.001,alpha),
       'multiplicity_adjusted_one_sided_alpha':alpha,'human_labels_available':sum(g['label'] is not None for g in gold['rows']),
       'warning':'These are preregistered future admission targets, not measured accuracy. Nonzero errors require larger samples; family merging remains manual.'}
    def write(name,obj):
        raw=(json.dumps(obj,ensure_ascii=False,sort_keys=True,indent=2,allow_nan=False)+'\n').encode()
        (output/name).write_bytes(gzip.compress(raw,mtime=0) if name.endswith('.gz') else raw)
    write('RUNS.json.gz',runs);write('GOLD.json.gz',gold);write('METRICS.json',evaluated);write('EFFICIENCY.json',speed);write('COVERAGE.json',coverage);write('DIFFERENCES.json',differences);write('GATES.json',gates);write('SEEDS.json',seeds_receipt)
    manifest={'schema':'pilot04-experiment/1','base_commit':PROTOCOL['base_commit'],'implementation_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=HERE,text=True).strip(),
      'protocol_sha256':file_hash(HERE/'protocol04.json'),'cases_file_sha256':file_hash(cases_path),'case_set_sha256':sha(cases),
      'graph_manifest_sha256':file_hash(Path(graph)/'GRAPH-MANIFEST.json'),'runtime_capture_sha256':file_hash(runtime),
      'source_lock_sha256':file_hash(HERE.parents[1]/'data/morphology-evidence/sources/source-lock.json'),
      'code_sha256':{p.name:file_hash(p) for p in sorted(HERE.glob('*.py'))}|{'runtime04.mjs':file_hash(HERE/'runtime04.mjs')},
      'runtime':{'python':platform.python_version(),'platform':platform.platform()},'outputs':{p.name:file_hash(p) for p in sorted(output.iterdir())},
      'source_versions':{'UDer':'1.1','MorphyNet':'378144f64df58c78db5245af19d16a511ccecf3a','GLeMM':'395020177a96a81177582fb59664509ff015f934'},
      'study_sha256':file_hash(study) if study else None,'older_predictions_superseded':True,'cases_or_gold_automatically_rewritten':False,'membership_writes':0}
    write('EXPERIMENT.json',manifest)
    return coverage

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for k in ('cases','graph','runtime','output'):p.add_argument('--'+k,required=True)
    for k in ('judgments','raters','adjudications','trials','study'):p.add_argument('--'+k)
    a=p.parse_args()
    if Path(a.output).resolve().is_relative_to(HERE.parents[1]):raise ValueError('output outside repository')
    print(canonical(main_run(a.cases,a.graph,a.runtime,a.output,list(json_rows(a.judgments)) if a.judgments else (),json.loads(Path(a.raters).read_text()) if a.raters else {},list(json_rows(a.adjudications)) if a.adjudications else (),list(json_rows(a.trials)) if a.trials else (),a.study)))
