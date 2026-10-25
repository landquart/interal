#!/usr/bin/env python3
"""Resume coordinator after host execution limit; pinned algorithms and data are reverified."""

# Installed writer boundary; isolated restored tools retain self-contained replay.
from pathlib import Path as _HistoryFencePath
import sys as _history_fence_sys
_history_fence_root=next((p for p in _HistoryFencePath(__file__).resolve().parents if (p/'associativvordes/mutation_guard.py').is_file()),None)
if _history_fence_root is not None:
    _history_fence_sys.path.insert(0,str(_history_fence_root))
    from associativvordes.mutation_guard import install as _install_history_fence
    _install_history_fence()
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import argparse
import fcntl
import json
import os
from pathlib import Path
import resource
import shutil
import sys
import time
from associativvordes.mass_dry_run import run as cycle
from associativvordes.mass_dry_run.audit import compare,sha
from associativvordes.auto_annotation.contract import file_hash
from associativvordes.auto_annotation.storage import Store,backup,restore
from associativvordes.auto_annotation.pipeline import export

def verify_modules(frozen):
    for name,expected in frozen['algorithm_modules'].items():
        if file_hash(cycle.ROOT/name)!=expected:raise ValueError('frozen algorithm changed: '+name)

def finish(a):
    output=Path(a.output).resolve()
    frozen=json.loads((output/'FROZEN-INPUTS.json').read_text())
    verify_modules(frozen)
    registered=dict(schema='mass06-coordinator-resume/1',input_lock_sha256=file_hash(output/'FROZEN-INPUTS.json'),
      driver_sha256=file_hash(__file__),policy='Reuse only complete hash-verified stage snapshots; no semantic algorithms, inputs or thresholds changed.')
    # Registration precedes lock waiting and all continuation work.
    cycle.write(output/'RESUME-REGISTERED.json',registered)
    lock=open(output/'LOCK','a')
    deadline=time.monotonic()+1800
    while True:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);break
        except BlockingIOError:
            if not a.wait or time.monotonic()>deadline:raise RuntimeError('original coordinator active')
            time.sleep(1)
    if (output/'ARCHIVE.json').exists():
        # Original coordinator may have completed during the wait.
        value=json.loads((output/'ARCHIVE.json').read_text())
        if file_hash(output/'PACKED-PROPOSALS.json.gz')!=value['sha256']:raise ValueError('archive changed')
        print(json.dumps({'status':'ORIGINAL_COMPLETED_ARCHIVE_VERIFIED'}));return
    verify_modules(frozen)
    for name in ('registry','index','aux','project','prior_queue'):setattr(a,name,frozen['databases'][name]['path'])
    a.review_ledger=frozen['manual_review_ledger']['path'];a.judgments=None;a.roster=None
    stages=[];first=other=None;repeat_stage=None
    for stage in [*cycle.PROTOCOL['stages'],dict(cycle.PROTOCOL['stages'][-1],name='independent-full')]:
        folder=output/'stages'/stage['name']
        if (folder/'STAGE.json').exists() and (folder/'SNAPSHOT.json').exists():
            report=json.loads((folder/'STAGE.json').read_text())
            snap=json.loads((folder/'SNAPSHOT.json').read_text())
            if report['engineering_gate']!='PASS' or sha(snap)!=report['snapshot_sha256']:
                raise ValueError('completed stage corruption')
        else:
            # A partially written working store is retained; rerun missing stage in a fresh workspace.
            replacement=dict(stage,name=stage['name']+'-recovered')
            report,snap=cycle.stage_run(a,output,replacement,frozen)
            folder=output/'stages'/replacement['name']
        report=dict(report,coordinator_reused=True,verified_stage_path=str(folder))
        if stage['name']=='all':first=snap
        if stage['name']=='independent-full':other=snap;repeat_stage=report
        else:stages.append(report)
    repeat=compare(first,other)
    primary_release=cycle.release_at(Path(stages[-1]['verified_stage_path'])/'search')
    independent_release=cycle.release_at(Path(repeat_stage['verified_stage_path'])/'search')
    if json.loads((primary_release/'MANIFEST.json').read_text())!=json.loads((independent_release/'MANIFEST.json').read_text()):
        raise ValueError('independent discovery manifests differ')
    repeat.update(discovery_manifest_identical=True,prior_history_identical=stages[-1]['statistics']['preserved_input_history_sha256']==repeat_stage['statistics']['preserved_input_history_sha256'])
    cycle.write(output/'REPEAT.json',repeat)
    q=cycle.quality(first,a);cycle.write(output/'QUALITY.json',q)
    integrity=cycle.unchanged(a,frozen,full=True);cycle.write(output/'INTEGRITY.json',integrity)
    final=output/'final';final.mkdir(exist_ok=True)
    cycle.write(final/'SNAPSHOT.json',first)
    selected={p['candidate_id']:p for p in first['proposals']}
    for group,ids in first['groups'].items():
        cycle.write(final/(group.upper()+'.json'),dict(schema='mass06-proposal-group/1',group=group,
          proposals=[selected[i] for i in ids],semantic_status='UNVALIDATED_REVIEW_HYPOTHESES',production_writes=0))
    cycle.write(final/'REGISTRY-STATE.json',frozen['registry'])
    store_path=Path(stages[-1]['verified_stage_path'])/'annotation'
    if not (output/'ANNOTATION-BACKUP.zip').exists():
        s=Store(store_path)
        with s.lease():backup(s,output/'ANNOTATION-BACKUP.zip')
    # An interrupted archive/restore is not considered a valid completed restore.
    restored_path=output/'restored-annotation-finished'
    if restored_path.exists():raise ValueError('finish already attempted; preserve state and choose a new explicit restore target')
    restored=restore(output/'ANNOTATION-BACKUP.zip',restored_path)
    cycle.write(output/'RESTORE.json',dict(status='PASS',backup_sha256=file_hash(output/'ANNOTATION-BACKUP.zip'),
      backup_bytes=(output/'ANNOTATION-BACKUP.zip').stat().st_size,restored=restored))
    handoff_path=output/'review-handoff-finished'
    s=Store(store_path)
    with s.lease():handoff=export(s,'mass06',handoff_path,True)
    import importlib.util
    spec=importlib.util.spec_from_file_location('phase06_finished_review',cycle.ROOT/'associativvordes/review/store.py')
    review=importlib.util.module_from_spec(spec);spec.loader.exec_module(review)
    ledger=review.Ledger(output/'review-ledger-finished');ledger.import_queue(handoff_path)
    if ledger.events:raise ValueError('human decisions changed')
    report=dict(schema='mass06-cycle/1',status='DRY_RUN_COMPLETE_SEMANTIC_APPLICATION_BLOCKED',
      stages=stages,independent=repeat_stage,repeat=repeat,quality=q,integrity=integrity,
      scope={'families':frozen['registry']['families'],'production_v5_included':False},
      output_statistics=stages[-1]['statistics'],api_generation_requests=0,api_cost_usd=0,infrastructure_cost_usd=None,
      production_writes=0,formulas_changed=False,canonical_roots_created=False,
      handoff={'questions':len(ledger.questions),'proposals':sum(len(x.get('automated_proposals',[])) for x in ledger.questions.values()),'human_decision_events':0},
      restored=restored,final_disk=cycle.disk(output),input_lock_sha256=registered['input_lock_sha256'],
      coordinator_resume=registered)
    cycle.write(output/'CYCLE.json',report)
    # Export in a separate child, so the original coordinator's retained snapshots are not duplicated in archival memory.
    del selected,first,other
    args=[sys.executable,'-c',
      "import sys,json;from pathlib import Path;sys.path.insert(0,sys.argv[1]);from archive04 import pack;root=Path(sys.argv[2]);print(json.dumps(pack({'SNAPSHOT.json':str(root/'final/SNAPSHOT.json'),'QUALITY.json':str(root/'QUALITY.json'),'REGISTRY-STATE.json':str(root/'final/REGISTRY-STATE.json')},root/'PACKED-PROPOSALS.json.gz')))",
      str(cycle.ROOT/'associativvordes/pilot_evaluation'),str(output)]
    metrics,receipt=cycle.measured(output,'finished-archive',args)
    if metrics['max_rss_kib']>cycle.PROTOCOL['stage_gates']['max_rss_kib']:raise ValueError('archive resource gate exceeded')
    from associativvordes.pilot_evaluation.archive04 import unpack
    roundtrip=output/'archive-roundtrip-finished';unpack(output/'PACKED-PROPOSALS.json.gz',roundtrip)
    files={'SNAPSHOT.json':final/'SNAPSHOT.json','QUALITY.json':output/'QUALITY.json','REGISTRY-STATE.json':final/'REGISTRY-STATE.json'}
    for name,path in files.items():
        if file_hash(roundtrip/name)!=file_hash(path):raise ValueError('archive roundtrip changed bytes')
    cycle.write(output/'ARCHIVE.json',dict(receipt,roundtrip='PASS_EXACT_JSON_BYTES',
        files={k:file_hash(v) for k,v in files.items()},snapshots_complete=True))
    cycle.write(output/'RESUME-COMPLETED.json',dict(registered,status='PASS',reused_stages=len(stages)+1,
       finisher_max_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,archive_resources=metrics))
    print(json.dumps({'status':'RECOVERED_COORDINATOR_COMPLETE','stages':len(stages)+1,'repeat':'PASS','archive_bytes':receipt['bytes']}))

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',required=True);p.add_argument('--release',required=True)
    p.add_argument('--source-lock',default=str(cycle.ROOT/'data/morphology-evidence/sources/source-lock.json'))
    p.add_argument('--wait',action='store_true');finish(p.parse_args())
