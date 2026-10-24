"""Resumable byte-copy shadow store with atomic final publication; no edits."""
import argparse,fcntl,os,shutil,time,resource
from pathlib import Path
from .core import *

def materialize(source,store,plan,notify=None,pause_at=None):
 source=Path(source).resolve();store=outside(store);plan=Path(plan);p=load(plan)
 validate_plan(p)
 if source==store or source.is_relative_to(store) or store.is_relative_to(source):raise ValueError('independent source/store required')
 lock=load(source/'SNAPSHOT.json');verify_files(source,lock)
 identity=dict(plan_sha256=sha(plan),source_snapshot_sha256=sha(source/'SNAPSHOT.json'),inventory_sha256=lock['inventory_sha256'],store_code_sha256=sha(__file__))
 store.mkdir(parents=True,exist_ok=True);start=time.monotonic();cpu=time.process_time();copied=reused=0;copied_bytes=0
 with (store/'LOCK').open('a') as f:
  fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB)
  dest=store/'objects'/lock['inventory_sha256'];stage=store/'materialization.partial';state_path=store/'CHECKPOINT.json'
  if (store/'IDENTITY.json').exists() and load(store/'IDENTITY.json')!=identity:raise ValueError('stale source/plan/code checkpoint')
  save(store/'IDENTITY.json',identity)
  state=load(state_path) if state_path.exists() else dict(committed=[])
  if dest.exists():
   verify_files(dest,lock)
   if sha(dest/'SNAPSHOT.json')!=identity['source_snapshot_sha256']:raise ValueError('published snapshot metadata differs')
   return dict(status='ALREADY_MATERIALIZED',copied_files=0,reused_files=len(lock['files']),production_writes=0)
  stage.mkdir(exist_ok=True);done=set(state['committed'])
  for i,r in enumerate(lock['files'],1):
   target=stage/r['path'];src=source/r['path'];target.parent.mkdir(parents=True,exist_ok=True)
   if r['path'] in done:
    if not target.is_file() or sha(target)!=r['sha256']:raise ValueError('committed file damaged')
    reused+=1;continue
   temp=target.with_name(target.name+'.partial');temp.unlink(missing_ok=True)
   with src.open('rb') as inp,temp.open('xb') as out:
    shutil.copyfileobj(inp,out,1048576);out.flush();os.fsync(out.fileno())
   if sha(temp)!=r['sha256']:raise ValueError('copied bytes differ')
   if pause_at==i:
    if not notify:raise ValueError('kill barrier notification required')
    save(notify,dict(file_number=i,committed=len(done),published=False))
    # Supervisor kills this process; never implicit approval or timed continuation.
    while True:time.sleep(.1)
   os.replace(temp,target);done.add(r['path']);save(state_path,dict(committed=sorted(done)));copied+=1;copied_bytes+=r['bytes']
  atomic(stage/'SNAPSHOT.json',(source/'SNAPSHOT.json').read_bytes());verify_files(stage,lock)
  dest.parent.mkdir(exist_ok=True);os.rename(stage,dest);fd=os.open(dest.parent,os.O_RDONLY);os.fsync(fd);os.close(fd)
  for q in dest.rglob('*'):
   if q.is_file():q.chmod(0o444)
  result=dict(status='MATERIALIZED_BYTE_IDENTICAL_SHADOW',inventory_sha256=lock['inventory_sha256'],copied_files=copied,reused_files=reused,copied_bytes=copied_bytes,total_files=len(lock['files']),wall_seconds=time.monotonic()-start,cpu_seconds=time.process_time()-cpu,peak_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,production_writes=0)
  save(store/'MATERIALIZATION.json',result);return result

def layers(source,store,plan):
 source=Path(source);store=outside(store);p=load(plan)
 validate_plan(p)
 identity=load(store/'IDENTITY.json')
 if identity['plan_sha256']!=sha(plan) or identity['source_snapshot_sha256']!=sha(source/'SNAPSHOT.json'):raise ValueError('layer source/plan differs from materialization')
 lock=load(source/'SNAPSHOT.json');obj=store/'objects'/lock['inventory_sha256'];verify_files(obj,lock);parent=None;results=[]
 for number,name in enumerate(LAYERS,1):
  # Every empty layer revalidates all 3,587 source/current hashes. A failure stops.
  verify_files(obj,lock)
  body=dict(schema='full-v5-shadow-layer/1',layer=number,name=name,parent=parent,plan_sha256=sha(plan),object='objects/'+lock['inventory_sha256'],inventory_sha256=lock['inventory_sha256'],applied_operation_ids=[],status='SKIPPED_EMPTY_APPROVED_SCOPE',changed_families=0,changed_memberships=0,changed_aliases=0,semantic_gate='BLOCKED')
  version=digest(body);path=store/'versions'/version/'VIEW.json'
  if path.exists() and load(path)!=body:raise ValueError('immutable layer changed')
  save(path,body);save(store/'CURRENT.json',dict(version=version,view=str(path.relative_to(store)),plan_sha256=sha(plan)))
  results.append(dict(body,version=version));parent=version
 save(store/'LAYERS.json',dict(layers=results,applied=0,all_changed_links_accounted=True,classification='EMPTY_PLAN_NOT_NONEMPTY_CLEANUP_VALIDATION'));return results

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('mode',choices=['copy','layers']);p.add_argument('--source',required=True);p.add_argument('--store',required=True);p.add_argument('--plan',required=True);p.add_argument('--notify');p.add_argument('--pause-at',type=int);a=p.parse_args()
 r=materialize(a.source,a.store,a.plan,a.notify,a.pause_at) if a.mode=='copy' else layers(a.source,a.store,a.plan);print(json.dumps(r))
