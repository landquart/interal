import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('completed copy evidence is required, input-bound and independently rechecked',()=>{
 const r=spawnSync('python3',['-c',String.raw`
import tempfile,unittest.mock as mock
from associativvordes.full_v5_dry_run.core import *
from associativvordes.full_v5_dry_run.store import materialize,layers
from associativvordes.full_v5_dry_run import completion as c,checks

def denied(fn):
 try:fn()
 except (ValueError,FileNotFoundError,KeyError):return
 raise AssertionError('incomplete or changed exercise admitted')

with tempfile.TemporaryDirectory() as td:
 w=Path(td);src=w/'before';src.mkdir();(src/'a').write_bytes(b'TEST_ONLY_A');(src/'b').write_bytes(b'TEST_ONLY_B')
 files=[dict(path=p.name,bytes=p.stat().st_size,sha256=sha(p)) for p in sorted(src.iterdir())]
 snapshot=dict(files=files,inventory_sha256=digest(files));save(src/'SNAPSHOT.json',snapshot)
 save(w/'SOURCE-LOCK.json',dict(TEST_ONLY=True))
 body=dict(operations=[],categories={k:[] for k in CATEGORIES},semantic_gate='BLOCKED',unknown_proposals_applied=0,nonempty_application_supported=False,source_lock_sha256=sha(w/'SOURCE-LOCK.json'))
 save(w/'OPERATION-MANIFEST.json',dict(body,content_sha256=digest(body)));plan=w/'OPERATION-MANIFEST.json'
 copies={}
 for name in ('shadow','replay','rollback'):
  copies[name]=materialize(src,w/name,plan)
  if name!='rollback':layers(src,w/name,plan)
 save(w/'SHADOW-PATH.json',dict(relative='shadow/objects/'+snapshot['inventory_sha256']))
 save(w/'BASELINE-VERIFICATION.json',dict(files=2,inventory_sha256=snapshot['inventory_sha256'],production_writes=0))
 save(w/'SIGKILL-RECOVERY.json',dict(actual_signal='SIGKILL',exit_code=-9,committed_files_before_kill=1,partial_current_published=False,resume={**copies['shadow'], 'copied_files':1,'reused_files':1}))
 save(w/'IDEMPOTENCY.json',materialize(src,w/'shadow',plan));save(w/'INDEPENDENT-COPY.json',copies['replay'])
 save(w/'ROLLBACK-VALIDATION.json',dict(status='PASS_NOOP_INVERSE_ONLY',inverse_operation_ids=[],original_bytes_equal=True,not_nonempty_rollback_certification=True,materialization=copies['rollback']))
 archive=w/'certified-source.tar';archive.write_bytes(b'TEST_ONLY_BACKUP')
 fake_root=w/'test-repo';save(fake_root/'audit/associative-v5-structural-cleanup/ARCHIVE-VOLUMES.json',dict(archive_sha256=sha(archive)));c.ROOT=fake_root
 shutil.copytree(src,w/'restored')
 save(w/'BACKUP-RESTORE-REPORT.json',dict(status='PASS_EXACT_REUSED_BACKUP',restore_verified=True,shadow_full_file_bytes_equal=True,inventory_sha256=snapshot['inventory_sha256'],files=2,archive_sha256=sha(archive),archive_bytes=archive.stat().st_size))
 # Model the reviewer's reproduction: all census/replay stages could exist,
 # but a missing completion must stop before pinned census/final RUN writes.
 with mock.patch.object(checks,'pinned',side_effect=AssertionError('too late')):
  denied(lambda:checks.run(w))
 assert not (w/'RUN.json').exists()
 c.seal(w);assert c.require_complete(w)['schema']=='full-v5-copy-completion/2'
 for name in c.RECEIPTS:
  p=w/name;original=p.read_bytes();p.unlink();denied(lambda:c.require_complete(w));atomic(p,original)
  p.write_bytes(original+b' ');denied(lambda:c.require_complete(w));atomic(p,original)
 # A self-checksummed receipt cannot certify incomplete backup/restore.
 backup=w/'BACKUP-RESTORE-REPORT.json';original=backup.read_bytes();bad=load(backup);bad['restore_verified']=False;save(backup,bad)
 denied(lambda:c.seal(w));assert not (w/c.SEAL).exists();atomic(backup,original);c.seal(w)
 for name in ('shadow','replay','rollback'):
  p=w/name/'IDENTITY.json';original=p.read_bytes();bad=load(p);bad['plan_sha256']='wrong';save(p,bad);denied(lambda:c.seal(w));atomic(p,original);c.seal(w)
 p=w/'restored/a';original=p.read_bytes();p.write_bytes(b'CORRUPT');denied(lambda:c.seal(w));p.write_bytes(original);c.seal(w)
 # A changed source lock remains invalid even when the operation manifest's
 # self-checksum is recomputed; it no longer binds to the copy identities.
 p=w/'SOURCE-LOCK.json';original=p.read_bytes();save(p,dict(TEST_ONLY='changed'));denied(lambda:c.require_complete(w));atomic(p,original)
 # Finalizer failure must occur before it can synthesize PASS.
 (w/'COPY-PHASE.json').unlink()
 save(w/'RUN.json',dict(status='PASS_EMPTY_PLAN_INTEGRITY_ONLY',TEST_ONLY='stale'))
 with mock.patch.object(checks,'pinned',side_effect=AssertionError('too late')):denied(lambda:checks.run(w))
 assert not (w/'RUN.json').exists()
`],{encoding:'utf8'});
 assert.equal(r.status,0,r.stdout+r.stderr);
});

test('bundle rejects a stale PASS when completion evidence is absent',()=>{
 const r=spawnSync('python3',['-c',String.raw`
import tempfile,subprocess
from pathlib import Path
from associativvordes.full_v5_dry_run.core import save
with tempfile.TemporaryDirectory() as td:
 w=Path(td)/'work';w.mkdir();save(w/'RUN.json',dict(status='PASS_EMPTY_PLAN_INTEGRITY_ONLY'))
 target=Path(td)/'archive.zip'
 r=subprocess.run(['node','associativvordes/full_v5_dry_run/bundle.mjs',str(w),str(target)],capture_output=True,text=True)
 assert r.returncode!=0,(r.stdout,r.stderr)
 assert not target.exists() and not target.with_name(target.name+'.partial').exists()
`],{encoding:'utf8'});
 assert.equal(r.status,0,r.stdout+r.stderr);
});
