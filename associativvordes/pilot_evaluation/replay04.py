"""Fresh full-source replay of Prompt 04, retaining the original frozen cases."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse,gzip,json,shutil,subprocess,sys
from pathlib import Path
from associativvordes.pilot_evaluation.gold import new_release_directory,file_hash,sha,json_rows
from associativvordes.pilot_evaluation.prepare_inputs import prepare
from associativvordes.evidence_graph.select_pilot import select
from associativvordes.evidence_graph.build_graph import build
from associativvordes.pilot_evaluation.study04 import prepare as prepare_study
from associativvordes.pilot_evaluation.compare04 import main_run

HERE=Path(__file__).resolve().parent;REPO=HERE.parents[1]

def replay(cache,raw,output):
    output=new_release_directory(output)
    prepare(cache,HERE.parent/'evidence_graph/fixtures/v6.json.gz',output/'inputs')
    frozen=REPO/'audit/associative-external-preparation/pilot-validation'
    for name,out in [('CASES.ndjson.gz','cases.ndjson'),('ANNOTATION-TASKS.ndjson.gz','annotation-tasks.ndjson')]:
        (output/out).write_bytes(gzip.decompress((frozen/name).read_bytes()))
    select(REPO/'data/morphology-evidence/sources/source-lock.json',raw,output/'inputs/seeds.json',output/'selection')
    graph=build(output/'selection/records.ndjson',REPO/'data/morphology-evidence/sources/source-lock.json',output/'inputs/v6.json',output/'inputs/v6-lock.json',output/'graph')
    prepare_study(output/'cases.ndjson',graph,output/'study')
    subprocess.run(['node',str(HERE/'runtime04.mjs'),str(output/'cases.ndjson'),str(output/'A-RUNTIME.json')],check=True)
    main_run(output/'cases.ndjson',graph,output/'A-RUNTIME.json',output/'comparison',study=output/'study/STUDY.json')
    return {'status':'REPLAYED_NOT_HUMAN_EVALUATED','case_set_sha256':sha(list(json_rows(output/'cases.ndjson'))),
        'graph':str(graph),'gold_status':'BLOCKED','membership_writes':0}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ('registry-cache','raw-root','output'):p.add_argument('--'+n,type=Path,required=True)
    a=p.parse_args()
    if a.output.resolve().is_relative_to(REPO):raise ValueError('output outside repository')
    print(json.dumps(replay(a.registry_cache,a.raw_root,a.output),indent=2))
