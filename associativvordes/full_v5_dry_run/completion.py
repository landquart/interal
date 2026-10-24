"""Require an input-bound, completed copy exercise before finalization or bundling.

Checksums bind evidence to this run; they are not an authority signature.
"""
from .core import *

RECEIPTS = ('BASELINE-VERIFICATION.json', 'SIGKILL-RECOVERY.json',
            'IDEMPOTENCY.json', 'INDEPENDENT-COPY.json',
            'ROLLBACK-VALIDATION.json', 'BACKUP-RESTORE-REPORT.json')
STORES = ('shadow', 'replay', 'rollback')
SEAL = 'COPY-PHASE.json'

def _require(condition, message):
 if not condition:raise ValueError('incomplete copy exercise: '+message)

def _records(work):
 paths=['SOURCE-LOCK.json','OPERATION-MANIFEST.json','SHADOW-PATH.json',*RECEIPTS]
 for name in STORES:
  paths += [name+'/IDENTITY.json']
  if name!='rollback':
   paths += [name+'/CURRENT.json',name+'/LAYERS.json']
   for row in load(work/name/'LAYERS.json')['layers']:
    paths.append(name+'/versions/'+row['version']+'/VIEW.json')
 result=[]
 for name in sorted(paths):
  path=work/name
  _require(path.is_file() and not path.is_symlink(),'missing/linked receipt '+name)
  result.append(dict(path=name,bytes=path.stat().st_size,sha256=sha(path)))
 return result

def _verify(work):
 """Validate all completion claims and their actual byte-copy outputs."""
 work=outside(work);plan_path=work/'OPERATION-MANIFEST.json';plan=load(plan_path)
 validate_plan(plan)
 _require(plan['source_lock_sha256']==sha(work/'SOURCE-LOCK.json'),'source lock differs')
 before=work/'before';snapshot=load(before/'SNAPSHOT.json');verify_files(before,snapshot)
 inventory=snapshot['inventory_sha256'];root='shadow/objects/'+inventory
 _require(load(work/'SHADOW-PATH.json')==dict(relative=root),'shadow path differs')
 expected=dict(plan_sha256=sha(plan_path),source_snapshot_sha256=sha(before/'SNAPSHOT.json'),inventory_sha256=inventory)
 for name in STORES:
  identity=load(work/name/'IDENTITY.json')
  _require(all(identity.get(k)==v for k,v in expected.items()),name+' identity differs')
  _require(identity.get('store_code_sha256')==sha(Path(__file__).with_name('store.py')),name+' store code differs')
  obj=work/name/'objects'/inventory;verify_files(obj,snapshot)
  _require(sha(obj/'SNAPSHOT.json')==expected['source_snapshot_sha256'],name+' snapshot differs')
 for name in ('shadow','replay'):
  rows=load(work/name/'LAYERS.json')['layers'];parent=None
  _require(len(rows)==len(LAYERS),name+' incomplete layers')
  for number,(row,label) in enumerate(zip(rows,LAYERS),1):
   body=dict(schema='full-v5-shadow-layer/1',layer=number,name=label,parent=parent,plan_sha256=expected['plan_sha256'],object='objects/'+inventory,inventory_sha256=inventory,applied_operation_ids=[],status='SKIPPED_EMPTY_APPROVED_SCOPE',changed_families=0,changed_memberships=0,changed_aliases=0,semantic_gate='BLOCKED')
   version=digest(body)
   _require(row==dict(body,version=version),name+' layer differs')
   _require(load(work/name/'versions'/version/'VIEW.json')==body,name+' view differs')
   parent=version
  current=dict(version=parent,view='versions/'+parent+'/VIEW.json',plan_sha256=expected['plan_sha256'])
  _require(load(work/name/'CURRENT.json')==current,name+' current differs')
 baseline=load(work/'BASELINE-VERIFICATION.json')
 _require(baseline.get('inventory_sha256')==inventory and baseline.get('files')==len(snapshot['files']) and baseline.get('production_writes')==0,'baseline differs')
 kill=load(work/'SIGKILL-RECOVERY.json')
 _require(kill.get('actual_signal')=='SIGKILL' and kill.get('exit_code')==-9 and kill.get('committed_files_before_kill')==1 and kill.get('partial_current_published') is False and kill.get('resume',{}).get('reused_files')==1,'SIGKILL/recovery incomplete')
 def copy_ok(r):
  return r.get('status') in ('MATERIALIZED_BYTE_IDENTICAL_SHADOW','ALREADY_MATERIALIZED') and r.get('production_writes')==0 and r.get('copied_files',0)+r.get('reused_files',0)==len(snapshot['files'])
 _require(copy_ok(kill['resume']),'recovery count differs')
 _require(copy_ok(load(work/'IDEMPOTENCY.json')) and load(work/'IDEMPOTENCY.json')['copied_files']==0,'idempotency incomplete')
 _require(copy_ok(load(work/'INDEPENDENT-COPY.json')),'independent copy incomplete')
 rollback=load(work/'ROLLBACK-VALIDATION.json')
 _require(rollback.get('status')=='PASS_NOOP_INVERSE_ONLY' and rollback.get('inverse_operation_ids')==[] and rollback.get('original_bytes_equal') is True and rollback.get('not_nonempty_rollback_certification') is True and copy_ok(rollback.get('materialization',{})),'rollback incomplete')
 backup=load(work/'BACKUP-RESTORE-REPORT.json')
 _require(backup.get('status')=='PASS_EXACT_REUSED_BACKUP' and backup.get('restore_verified') is True and backup.get('shadow_full_file_bytes_equal') is True and backup.get('inventory_sha256')==inventory and backup.get('files')==len(snapshot['files']),'restore incomplete')
 archive=work/'certified-source.tar'
 _require(archive.stat().st_size==backup['archive_bytes'] and sha(archive)==backup['archive_sha256'],'archive differs')
 pinned_backup=load(ROOT/'audit/associative-v5-structural-cleanup/ARCHIVE-VOLUMES.json')
 _require(backup['archive_sha256']==pinned_backup['archive_sha256'],'archive not certified')
 verify_files(work/'restored',snapshot)
 _require(sha(work/'restored/SNAPSHOT.json')==expected['source_snapshot_sha256'],'restored snapshot differs')
 return dict(schema='full-v5-copy-completion/2',status='PASS_NOOP_SHADOW_COPY_ONLY',data_root=root,layers=5,applied_operations=0,production_writes=0,semantic_gate='BLOCKED',bindings=expected,completion_code_sha256=sha(__file__),receipts=_records(work))

def seal(work):
 work=outside(work)
 # A failed retry cannot leave an older completion claim in place.
 (work/SEAL).unlink(missing_ok=True)
 body=_verify(work);save(work/SEAL,dict(body,content_sha256=digest(body)))

def require_complete(work):
 work=outside(work);receipt=load(work/SEAL)
 body={k:v for k,v in receipt.items() if k!='content_sha256'}
 _require(receipt.get('content_sha256')==digest(body),'completion checksum differs')
 _require(body==_verify(work),'completion receipts/input/code changed')
 return receipt
