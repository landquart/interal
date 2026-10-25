"""Deterministic blind human study allocation; empty rosters stay BLOCKED."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse,gzip,json,contextlib
from collections import Counter,defaultdict
from pathlib import Path
from associativvordes.pilot_evaluation.gold import sha,canonical,file_hash,json_rows,validate_cases,assignments,new_release_directory
from associativvordes.pilot_evaluation.compare04 import PROTOCOL
from associativvordes.evidence_graph.graph import Graph,lookup

def plan(cases,n=180):
    validate_cases(cases)
    if n!=PROTOCOL['sampling']['initial_cases']:raise ValueError('subsample size is preregistered')
    cells=defaultdict(list)
    for c in cases:cells[(c['family'],c['language'])].append(c)
    for values in cells.values():values.sort(key=lambda c:sha([PROTOCOL['seed'],c['id']]))
    chosen=[];counts=Counter()
    while len(chosen)<n:
        eligible=[k for k,v in cells.items() if v]
        if not eligible:raise ValueError('insufficient frozen cases')
        k=min(eligible,key=lambda k:(counts[k],sha([PROTOCOL['seed'],list(k),counts[k]])))
        chosen.append(cells[k].pop(0));counts[k]+=1
    chosen.sort(key=lambda c:c['id']);tasks=[];pairing={}
    for c in chosen:
        # Assignment depends on leakage group, never an algorithm answer. For
        # each group, the two participants occupy opposite fixed arms. A third
        # and fourth participant provide the alternate block across groups.
        bits=int(sha([PROTOCOL['seed'],c['leakage_group']])[:8],16)
        pair=(('study-1','study-2') if bits%2==0 else ('study-3','study-4'))
        if bits%4>=2:pair=pair[::-1]
        pairing[c['leakage_group']]=pair
        base=assignments([c])[0]
        for slot,condition,purpose in [('gold-1','control','gold'),('gold-2','control','gold'),(pair[0],'control','efficiency'),(pair[1],'combined','efficiency')]:
            task={k:v for k,v in base.items() if k not in {'decision','relation','phenomena','sense','pos','boundaries','correct_families','independent_model_id','annotator_id','mode','blind_to_test_predictions','independent_review','reviewed_at','reason','evidence'}}
            task.update(task_id='study-task:'+sha([PROTOCOL['seed'],c['id'],slot]),slot=slot,condition=condition,purpose=purpose,leakage_group=c['leakage_group'])
            tasks.append(task)
    return chosen,tasks,dict(counts)

def prepare(cases_path,graph,output):
    cases=list(json_rows(cases_path));output=new_release_directory(output)
    if sha(cases)!=PROTOCOL['frozen_case_set_sha256']:raise ValueError('frozen scope')
    chosen,tasks,cells=plan(cases)
    evidence={}
    with contextlib.closing(Graph.open_snapshot(graph)) as g:
        for c in chosen:
            observations={}
            # Lookup is explicitly a spelling observation, never an identity
            # bridge or a path predicted by the tested candidate algorithm.
            for lid, in g.db.execute('SELECT id FROM lexemes WHERE language=? AND search=? ORDER BY id',(c['language'],lookup(c['target']['lemma']))):
                node=g.get(lid)
                for e in node['body'].get('origin_evidence_refs',[]):
                    item=g.resolve(e);body=item['body'];sr=g.resolve(body['source_revision_ref'])['body']
                    observations[item['id']]={'evidence_id':item['id'],'source':sr['source_id'],'version':sr.get('release_label'),
                        'native_lexeme':node,'raw_locator':body['raw_locator'],'raw_sha256':body['raw_record_sha256'],
                        'original_line_base64':body.get('extensions',{}).get('original_line_base64'),
                        'interpretations_source_claims_only':body['interpretations'],'identity_status':'same spelling; native identity unverified'}
            evidence[c['id']]=list(observations.values())
    def write(name,data):(output/name).write_text(json.dumps(data,ensure_ascii=False,sort_keys=True,indent=2)+'\n')
    write('STUDY.json',{'schema':'pilot04-study/1','case_set_sha256':sha(cases),'subset_sha256':sha(chosen),'protocol_sha256':file_hash(Path(__file__).with_name('protocol04.json')),
       'evidence_sha256':sha(evidence),'graph_manifest_sha256':file_hash(Path(graph)/'GRAPH-MANIFEST.json'),'subset_case_ids':[c['id'] for c in chosen],'tasks':tasks,'cells':{'|'.join(k):v for k,v in sorted(cells.items())},
       'minimum_gold_reviews':2*len(chosen),'minimum_efficiency_reviews':2*len(chosen),
       'full_pilot_minimum_gold_reviews':len(cases)+sum(c['double_review'] for c in cases),
       'required_original_repeat_cases_in_subset':sum(c['double_review'] for c in chosen),'verified_humans':0,'human_status':'BLOCKED',
       'minimum_slots':{'gold':2,'efficiency':4,'independent_arbiter_if_disagreement':1},
       'no_repeat_exposure':'slot participants must be distinct people; gold and efficiency rosters must be disjoint'})
    write('EVIDENCE-PRIVATE.json',evidence)
    (output/'subset-cases.ndjson').write_text(''.join(canonical(c)+'\n' for c in chosen))
    (output/'raters.json').write_text('{}\n')
    (output/'judgments.ndjson').write_text('');(output/'trials.ndjson').write_text('')
    return {'cases':len(chosen),'tasks':len(tasks),'cells':len(cells),'gold_status':'BLOCKED','gold_reviews':360,'timed_reviews':360}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for k in ('cases','graph','output'):p.add_argument('--'+k,required=True)
    a=p.parse_args()
    if Path(a.output).resolve().is_relative_to(Path(__file__).resolve().parents[2]):raise ValueError('output outside repo')
    print(canonical(prepare(a.cases,a.graph,a.output)))
