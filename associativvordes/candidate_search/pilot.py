"""Explicit bounded seven-family evaluation. No production entry point."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse
from collections import Counter
import json
from pathlib import Path
import resource
import tempfile
import time
from associativvordes.candidate_search.search import Graph,Queue,build,reverse,canonical,file_hash,lookup,enqueue_reverse

def run(snapshot,frequencies,output):
    output=Path(output);output.mkdir(parents=True,exist_ok=True)
    families=['OCUL','PEDE','ALTER','REGUL','CREAT','NAT','INTER']
    f=json.loads(Path(frequencies).read_text())
    with tempfile.TemporaryDirectory(prefix='candidate-pilot-') as tmp:
        start=time.perf_counter();g=Graph.open_snapshot(snapshot,Path(tmp)/'index.sqlite');index_seconds=time.perf_counter()-start
        try:
            q=Queue(Path(tmp)/'a.sqlite');start=time.perf_counter();first=build(g,q,families,f);query_seconds=time.perf_counter()-start;q.export(output/'queue-a.ndjson')
            second=build(g,q,families,f);q.export(output/'queue-repeat.ndjson')
            other=Queue(Path(tmp)/'b.sqlite');build(g,other,families,f);other.export(output/'queue-fresh.ndjson');other.close()
            rows=list(q.rows());known=set(g.db.execute('SELECT family,language,word FROM known'));matched={k for k in known if g.db.execute('SELECT 1 FROM lexemes WHERE language=? AND search=? LIMIT 1',(k[1],k[2])).fetchone()}
            rq=Queue(Path(tmp)/'reverse.sqlite');reverse_rows=enqueue_reverse(g,rq,f);rq.export(output/'reverse-queue.ndjson');reverse_questions=len(list(rq.rows()));rq.close()
            (output/'reverse.json').write_text(canonical(reverse_rows)+'\n')
            example=[]
            for lang in ['en','de','fr','es','it','ru']:
                r=next(x for x in rows if x['language']==lang);p=r['discovery_paths'][0]
                example.append({'candidate_id':r['id'],'family':r['family'],'language':lang,'lemma':r['lemma'],'pos':r['pos'],'steps':p['steps'],'path_lemmas':[g.resolve(n)['body']['lemma'] for n in p['nodes']],'frequency':None,'status':'open_hypothesis_only'})
            metrics={'schema':'candidate-pilot/1','families':first,'repeat_changed':sum(x['changed'] for x in second.values()),
              'candidate_count':len(rows),'languages':dict(Counter(x['language'] for x in rows)),'duplicates':len(rows)-len({x['id'] for x in rows}),
              'no_morphological_path':sum(not x['discovery_paths'] or not x['evidence_refs'] for x in rows),'frequency_observed':sum(bool(x['frequency_observations']) for x in rows),
              'family_gold_evaluation':'not_available_no_membership_claim','known_lookup_subjects':len(known),'known_lookup_matches':len(matched),
              'known_lookup_by_language':{l:{'subjects':sum(k[1]==l for k in known),'matches':sum(k[1]==l for k in matched)} for l in ['en','de','fr','es','it','ru']},
              'reverse_queue_questions':reverse_questions,'reverse_count':len(reverse_rows),'real_frequency_records':len(f),'examples':example,
              'replay_hashes':{n:file_hash(output/n) for n in ['queue-a.ndjson','queue-repeat.ndjson','queue-fresh.ndjson']},
              'graph_manifest_sha256':file_hash(Path(snapshot)/'GRAPH-MANIFEST.json'),'frequencies_sha256':file_hash(frequencies),'code_sha256':file_hash(Path(__file__).with_name('search.py')),
              'establishes_membership':False}
            (output/'METRICS.json').write_text(canonical(metrics)+'\n')
            perf={'index_seconds':index_seconds,'bounded_query_seconds':query_seconds,'max_rss_kib_linux':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
              'note':'one environment observation; query time includes queue serialization and guards; not a scalability guarantee'}
            (output/'PERFORMANCE.json').write_text(json.dumps(perf,sort_keys=True,indent=2)+'\n');q.close()
        finally:g.close()

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['snapshot','frequencies','output']:p.add_argument('--'+n,required=True)
    a=p.parse_args()
    if Path(a.output).resolve().is_relative_to(Path(__file__).resolve().parents[2]):raise ValueError('outputs outside repository')
    run(a.snapshot,a.frequencies,a.output)
