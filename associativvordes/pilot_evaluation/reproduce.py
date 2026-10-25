"""One-command immutable replay; cached selection requires an externally pinned receipt."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse
import json
from pathlib import Path
import shutil
import time
from associativvordes.pilot_evaluation.gold import new_release_directory,file_hash,sha
from associativvordes.pilot_evaluation.prepare_inputs import prepare
from associativvordes.pilot_evaluation.sample import sample
from associativvordes.pilot_evaluation.run import run
from associativvordes.evidence_graph.graph import json_rows
from associativvordes.evidence_graph.select_pilot import select
from associativvordes.evidence_graph.build_graph import build

def reproduce(cache,prior_snapshot,source_lock,output,raw_root=None,selection=None,selection_manifest_sha256=None):
    output=new_release_directory(output);start=time.perf_counter();prepare(cache,prior_snapshot,output/'inputs')
    if selection:
        selection=Path(selection);mp=selection/'SELECTION.json'
        if not selection_manifest_sha256 or file_hash(mp)!=selection_manifest_sha256:raise ValueError('externally pinned selection receipt required')
        m=json.loads(mp.read_text())
        if m['records_sha256']!=file_hash(selection/'records.ndjson') or m['seeds_sha256']!=file_hash(output/'inputs/seeds.json') or m['source_lock_sha256']!=file_hash(source_lock) or m['selector_sha256']!=file_hash(Path(__file__).resolve().parents[1]/'evidence_graph/select_pilot.py'):raise ValueError('cached selection dependency mismatch')
        shutil.copytree(selection,output/'selection')
    else:
        if not raw_root:raise ValueError('raw source cache required for fresh selection')
        select(source_lock,raw_root,output/'inputs/seeds.json',output/'selection')
    graph=build(output/'selection/records.ndjson',source_lock,output/'inputs/v6.json',output/'inputs/v6-lock.json',output/'graph')
    sampling=sample(output/'inputs/v6.json',graph,output/'cases')
    experiment=run(list(json_rows(output/'cases/cases.ndjson')),graph,output/'experiment')
    receipt={'schema':'pilot-replay/1','sampling_case_set_sha256':sampling['case_set_sha256'],'graph_build':graph.name,
      'selection_manifest_sha256':file_hash(output/'selection/SELECTION.json'),'files':{str(p.relative_to(output)):file_hash(p) for p in [output/'inputs/FAMILIES.json',output/'inputs/v6-lock.json',output/'cases/SAMPLING-MANIFEST.json',output/'experiment/EXPERIMENT-MANIFEST.json']},
      'reproduce_code_sha256':file_hash(__file__),'automatic_gold_labels':0,'quality_evaluation':'awaiting_human_gold_and_actual_baseline'}
    (output/'REPLAY.json').write_text(json.dumps(receipt,ensure_ascii=False,sort_keys=True,indent=2)+'\n')
    (output/'PERFORMANCE.json').write_text(json.dumps({'total_seconds':time.perf_counter()-start,'note':'cached-selection replay excludes original downloads/selection scan when cache supplied'},sort_keys=True,indent=2)+'\n')
    return receipt

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['cache','prior-snapshot','source-lock','output']:p.add_argument('--'+n,required=True)
    for n in ['raw-root','selection','selection-manifest-sha256']:p.add_argument('--'+n)
    a=p.parse_args()
    if Path(a.output).resolve().is_relative_to(Path(__file__).resolve().parents[2]):raise ValueError('output outside repository')
    reproduce(a.cache,a.prior_snapshot,a.source_lock,a.output,a.raw_root,a.selection,a.selection_manifest_sha256)
