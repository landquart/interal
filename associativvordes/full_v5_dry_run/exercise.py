"""Actual SIGKILL barrier, recovery, independent copies and no-op rollback."""
import argparse,os,signal,subprocess,sys,time,sqlite3
from pathlib import Path
from .core import *
from .store import materialize,layers
def run(work):
 work=outside(work);lock=inputs(work);tool=pinned(work);before=work/'before';snapshot=tool.verify_snapshot(before)
 committed=load(ROOT/'audit/associative-v5-structural-cleanup/BEFORE-MANIFEST.json')
 if snapshot['files']!=committed['files']:raise ValueError('certified baseline file manifest differs')
 for r in snapshot['files']:
  if r['path'].startswith('current/'):
   p=ROOT/r['path'][8:]
   if sha(p)!=r['sha256']:raise ValueError('current main v5 differs from baseline')
 save(work/'BASELINE-VERIFICATION.json',dict(files=len(snapshot['files']),current_files=sum(r['path'].startswith('current/') for r in snapshot['files']),inventory_sha256=snapshot['inventory_sha256'],source='Restored certified stage05 archive, verified against current main bytes',production_writes=0))
 store=work/'shadow';plan=work/'OPERATION-MANIFEST.json';barrier=work/'KILL-BARRIER.json'
 if not (work/'SIGKILL-RECOVERY.json').exists():
  if store.exists():raise ValueError('unexpected store before intentional kill test')
  cmd=[sys.executable,'-m','associativvordes.full_v5_dry_run.store','copy','--source',str(before),'--store',str(store),'--plan',str(plan),'--notify',str(barrier),'--pause-at','2']
  with (work/'kill-child.log').open('wb') as log:
   proc=subprocess.Popen(cmd,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT);start=time.monotonic()
   while not barrier.exists():
    if proc.poll() is not None:raise ValueError('child exited before actual kill barrier')
    if time.monotonic()-start>60:proc.kill();proc.wait();raise TimeoutError('kill barrier timed out')
    time.sleep(.05)
   os.kill(proc.pid,signal.SIGKILL);code=proc.wait(timeout=10)
  checkpoint=load(store/'CHECKPOINT.json')
  if code!=-signal.SIGKILL or len(checkpoint['committed'])!=1 or (store/'CURRENT.json').exists():raise ValueError('SIGKILL publication/transaction invariant')
  if list((store/'objects').glob('*')) if (store/'objects').exists() else []:raise ValueError('partial object published')
  recovery=materialize(before,store,plan)
  if recovery['reused_files']!=1:raise ValueError('committed copy checkpoint not reused')
  save(work/'SIGKILL-RECOVERY.json',dict(actual_signal='SIGKILL',exit_code=code,committed_files_before_kill=1,partial_current_published=False,resume=recovery))
 save(work/'IDEMPOTENCY.json',materialize(before,store,plan));layers(before,store,plan)
 after=store/'objects'/snapshot['inventory_sha256'];save(work/'SHADOW-PATH.json',dict(relative=str(after.relative_to(work))))
 replay=work/'replay';save(work/'INDEPENDENT-COPY.json',materialize(before,replay,plan));layers(before,replay,plan)
 if load(store/'CURRENT.json')!=load(replay/'CURRENT.json') or load(store/'LAYERS.json')!=load(replay/'LAYERS.json'):raise ValueError('independent copy/layer replay mismatch')
 inverse=work/'rollback';r=materialize(before,inverse,plan);back=inverse/'objects'/snapshot['inventory_sha256'];verify_files(back,snapshot)
 save(work/'ROLLBACK-VALIDATION.json',dict(status='PASS_NOOP_INVERSE_ONLY',inverse_operation_ids=[],original_bytes_equal=True,not_nonempty_rollback_certification=True,materialization=r))
 # Existing immutable archive is the exact durable backup of this identical tree.
 archive=work/'certified-source.tar';expected=load(ROOT/'audit/associative-v5-structural-cleanup/ARCHIVE-VOLUMES.json')['archive_sha256']
 if not (work/'restored').exists():save(work/'BACKUP-RESTORE-REPORT.json',tool.restore(archive,work/'restored',expected))
 restored=work/'restored';verify_files(restored,snapshot)
 if (restored/'SNAPSHOT.json').read_bytes()!=(after/'SNAPSHOT.json').read_bytes():raise ValueError('restored complete snapshot differs')
 r=load(work/'BACKUP-RESTORE-REPORT.json');r.update(status='PASS_EXACT_REUSED_BACKUP',archive_sha256=expected,archive_bytes=archive.stat().st_size,shadow_full_file_bytes_equal=True,archive_created_stage='05',actual_restore_stage='12',reason='Empty operation plan; existing durable archive is exact full byte backup of the shadow snapshot');save(work/'BACKUP-RESTORE-REPORT.json',r)
 save(work/'COPY-PHASE.json',dict(status='PASS_NOOP_SHADOW_COPY_ONLY',data_root=str(after.relative_to(work)),layers=5,applied_operations=0,production_writes=0,semantic_gate='BLOCKED'));return after
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--work',required=True);a=p.parse_args();print(run(a.work))
