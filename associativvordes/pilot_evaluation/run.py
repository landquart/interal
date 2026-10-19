"""Frozen source ablations over one identical case set; baseline is an explicit capture."""
import argparse
from collections import defaultdict
import json
from pathlib import Path
import tempfile
import time
from gold import canonical,sha,file_hash,json_rows,compile_gold,validate_cases
from evaluate import evaluate,compare,validate_predictions,CONFIGS
from graph import Graph,lookup,ref

BASELINE_COMMIT='156083cb5a631f3e5dd2d6f85d2abdc5d53ecc49'
BASELINE_HASHES={k:v['sha256'] for k,v in json.loads(Path(__file__).with_name('BASELINE-CODE-LOCK.json').read_text())['files'].items()}
POLICY={'id':'bounded-source-proposals/1','starts_per_family_language':8,'depth':2,'max_paths':20,'max_expansions':300,'cross_source_string_bridge':False,'accepted_membership':False}

def predictions_from_sources(g,cases,allowed):
    allowed={'source:'+x for x in allowed};bytarget=defaultdict(list)
    for c in cases:bytarget[(c['family'],c['language'],lookup(c['target']['lemma']))].append(c['id'])
    hits=defaultdict(dict);seeds=defaultdict(set);budget={'queries':0,'expanded':0,'truncated':0}
    # Remove disallowed arcs BEFORE bounded traversal: no excluded-source bridge or budget leakage.
    g.db.execute('SAVEPOINT source_ablation')
    try:
        g.db.execute('CREATE TEMP TABLE allowed_relations(id TEXT PRIMARY KEY)')
        for rid, in g.db.execute('SELECT id FROM relations ORDER BY id'):
            sources={g.resolve(g.get(eid)['body']['source_revision_ref'])['body']['source_id'] for eid, in g.db.execute('SELECT evidence FROM supports WHERE relation=?',(rid,))}
            if sources & allowed:g.db.execute('INSERT INTO allowed_relations VALUES(?)',(rid,))
        g.db.execute('DELETE FROM arcs WHERE relation NOT IN (SELECT id FROM allowed_relations)')
        scope={(c['family'],c['language']) for c in cases}
        for family,language in sorted(scope):
            for word, in g.db.execute('SELECT DISTINCT word FROM known WHERE family=? AND language=? ORDER BY word',(family,language)):
                for lid, in g.db.execute('SELECT id FROM lexemes WHERE language=? AND search=? ORDER BY id',(language,word)):
                    if g.get(lid)['body']['source_id'] in allowed:seeds[(family,language)].add(lid)
            def productive(lid):return bool(g.db.execute('SELECT 1 FROM arcs a JOIN relations r ON r.id=a.relation WHERE a.src=? AND r.type!=\'inflection\' LIMIT 1',(lid,)).fetchone())
            starts=sorted(seeds[(family,language)],key=lambda x:(not productive(x),x))[:POLICY['starts_per_family_language']]
            for start in starts:
                q=g.paths(start,max_depth=POLICY['depth'],max_paths=POLICY['max_paths'],max_expansions=POLICY['max_expansions'],include_uncertain='source:glemm' in allowed,family=family)
                budget['queries']+=1;budget['expanded']+=q['expanded'];budget['truncated']+=q['truncated']
                for path in q['paths']:
                    target=g.resolve(path['nodes'][-1]);b=target['body'];k=(family,b['language'],lookup(b['lemma']))
                    for cid in bytarget.get(k,[]):hits[cid][sha(path)]=path
        result=[]
        for c in cases:
            paths=[hits[c['id']][k] for k in sorted(hits[c['id']])];guard=g.guard(c['family'],c['language'],c['target']['lemma'],c['target']['lexeme_id'])
            if guard['status'] in {'blocked','hold'}:paths=[]
            result.append({'case_id':c['id'],'case_content_sha256':c['content_sha256'],'decision':'yes' if paths else 'abstain',
              'requires_manual_review':True,'evidence_paths':paths,'sense_identity_established':False,'boundaries':None,'merged_families':[],
              'establishes_membership':False,'reason':'source_proposal_requires_review' if paths else 'no_finite_support_or_existing_prohibition'})
        return result,budget
    finally:
        g.db.execute('ROLLBACK TO source_ablation');g.db.execute('RELEASE source_ablation')

def capture_baseline(path,cases):
    if path is None:return None,'actual_algorithm_capture_missing'
    x=json.loads(Path(path).read_text())
    if x.get('algorithm_commit')!=BASELINE_COMMIT or x.get('case_set_sha256')!=sha(cases) or x.get('runtime_code_hashes')!=BASELINE_HASHES or not x.get('capture_operator') or x.get('capture_kind')!='actual_runtime':raise ValueError('baseline must be pinned actual runtime capture for exact frozen cases')
    if x.get('methodology_modified') is not False:raise ValueError('baseline methodology must be unchanged')
    validate_predictions(cases,x['predictions']);return x,None

def run(cases,graph,output,baseline=None,judgments=(),roster=None,adjudications=()):
    validate_cases(cases);output=Path(output);output.mkdir(parents=True,exist_ok=True);gold=compile_gold(cases,judgments,roster or {},adjudications)
    captured,reason=capture_baseline(baseline,cases);runs={};evals={};manifest={'case_set_sha256':sha(cases),'graph_manifest_sha256':file_hash(Path(graph)/'GRAPH-MANIFEST.json'),
      'baseline_commit':BASELINE_COMMIT,'baseline_capture_sha256':file_hash(baseline) if baseline else None,'policy':POLICY,'policy_sha256':sha(POLICY),
      'code_sha256':{n:file_hash(Path(__file__).with_name(n)) for n in ['run.py','gold.py','evaluate.py']},'all_configs_same_case_set':True,'gold_sha256':gold['content_sha256']}
    with tempfile.TemporaryDirectory(prefix='pilot-ablation-') as tmp:
        g=Graph.open_snapshot(graph,Path(tmp)/'graph.sqlite')
        try:
            for name,sources in dict(CONFIGS,U=['uder']).items():
                start=time.perf_counter();item={'configuration':name,'case_set_sha256':sha(cases),'sources':sources,'policy_sha256':sha(POLICY)}
                if name=='E':item.update(status='unavailable',reason='flexor_identity_version_license_and_independent_validation_not_established')
                elif name in {'A','B'} and captured is None:item.update(status='unavailable',reason=reason)
                elif name=='A':item.update(status='completed',predictions=captured['predictions'],capture_sha256=file_hash(baseline))
                else:
                    pp,budget=predictions_from_sources(g,cases,sources)
                    if name=='B':
                        original={p['case_id']:p for p in captured['predictions']}
                        # Do not silently repair the baseline by hiding its false positives.
                        for p in pp:
                            old=original[p['case_id']]
                            if old['decision']=='yes':p.update(decision='yes',baseline_proposal=old)
                            elif old['decision']=='no' and p['decision']=='abstain':p.update(decision='no',baseline_proposal=old)
                    item.update(status='completed',predictions=pp,budget=budget)
                item['runtime_seconds']=time.perf_counter()-start;runs[name]=item;evals[name]=evaluate(cases,gold,item)
        finally:g.close()
    def write(name,x):(output/name).write_text(json.dumps(x,ensure_ascii=False,sort_keys=True,indent=2,allow_nan=False)+'\n')
    write('GOLD.json',gold);write('RUNS.json',runs);write('EVALUATION.json',{'configurations':evals,**compare(evals)})
    manifest['outputs']={n:file_hash(output/n) for n in ['GOLD.json','RUNS.json','EVALUATION.json']};write('EXPERIMENT-MANIFEST.json',manifest)
    return manifest

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['cases','graph','output']:p.add_argument('--'+n,required=True)
    p.add_argument('--baseline');p.add_argument('--judgments');p.add_argument('--raters');p.add_argument('--adjudications');a=p.parse_args()
    if Path(a.output).resolve().is_relative_to(Path(__file__).resolve().parents[2]):raise ValueError('outputs outside repository')
    run(list(json_rows(a.cases)),a.graph,a.output,a.baseline,list(json_rows(a.judgments)) if a.judgments else (),json.loads(Path(a.raters).read_text()) if a.raters else {},list(json_rows(a.adjudications)) if a.adjudications else ())
