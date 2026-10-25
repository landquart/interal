#!/usr/bin/env python3
"""Immutable archive, streamed real restore and exact byte verification."""
import argparse,hashlib,json,os,shutil,sqlite3,sys,time,zipfile
from pathlib import Path
from query import open_registry,filehash
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from classify import canonical

def backup(registry,archive,restore):
 start=time.monotonic();registry=Path(registry);archive=Path(archive);restore=Path(restore)
 if archive.exists() or restore.exists():raise ValueError('fresh immutable destinations required')
 db,m=open_registry(registry);db.close()
 files=[p for p in sorted(registry.rglob('*')) if p.is_file() and p.name!='LOCK' and not p.name.endswith(('.partial','-journal','-wal','-shm'))]
 inventory={str(p.relative_to(registry)):dict(sha256=filehash(p),bytes=p.stat().st_size) for p in files}
 pending=archive.with_suffix(archive.suffix+'.partial')
 with zipfile.ZipFile(pending,'x',allowZip64=True,compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  for p in files:
   name=str(p.relative_to(registry));info=zipfile.ZipInfo(name,date_time=(2026,10,23,0,0,0));info.compress_type=zipfile.ZIP_STORED if p.suffix=='.gz' else zipfile.ZIP_DEFLATED;info.external_attr=0o100444<<16
   with p.open('rb') as src,z.open(info,'w',force_zip64=True) as dst:shutil.copyfileobj(src,dst,1024*1024)
  info=zipfile.ZipInfo('BACKUP-MANIFEST.json',date_time=(2026,10,23,0,0,0));info.external_attr=0o100444<<16
  z.writestr(info,canonical(dict(schema='v5-diagnostic-backup/1',files=inventory,registry_manifest_version=m['version'])))
 with pending.open('rb') as f:os.fsync(f.fileno())
 os.replace(pending,archive)
 result=restore_archive(archive,restore);result['seconds']=time.monotonic()-start;return result

def restore_archive(archive,restore,expected_sha256=None):
 start=time.monotonic();archive=Path(archive);restore=Path(restore)
 if restore.exists():raise ValueError('fresh restore target required')
 if expected_sha256 and filehash(archive)!=expected_sha256:raise ValueError('archive checksum')
 final=restore;stage=restore.with_name(restore.name+'.partial')
 if stage.exists():raise ValueError('unexamined restore staging exists')
 restore=stage
 try:
  restore.mkdir(parents=True)
  with zipfile.ZipFile(archive) as z:
   manifest=json.loads(z.read('BACKUP-MANIFEST.json'));inventory=manifest['files']
   if set(z.namelist())!=set(manifest['files'])|{'BACKUP-MANIFEST.json'}:raise ValueError('backup inventory mismatch')
   for name,lock in manifest['files'].items():
    if Path(name).is_absolute() or '..' in Path(name).parts:raise ValueError('backup traversal')
    p=restore/name;p.parent.mkdir(parents=True,exist_ok=True);h=hashlib.sha256();n=0
    with z.open(name) as src,p.open('xb') as dst:
     for b in iter(lambda:src.read(1024*1024),b''):dst.write(b);h.update(b);n+=len(b)
     dst.flush();os.fsync(dst.fileno())
    if h.hexdigest()!=lock['sha256'] or n!=lock['bytes']:raise ValueError('restored bytes differ')
    p.chmod(0o444)
  db,restored=open_registry(restore)
  try:
   if db.execute('PRAGMA quick_check').fetchone()[0]!='ok':raise ValueError('restored database corruption')
   counts=dict(families=db.execute('SELECT COUNT(*) FROM families').fetchone()[0],memberships=db.execute('SELECT COUNT(*) FROM members').fetchone()[0])
  finally:db.close()
  os.replace(stage,final)
 except BaseException:
  shutil.rmtree(stage,ignore_errors=True)
  raise
 report=dict(schema='v5-diagnostic-backup-restore/1',status='PASS',archive=archive.name,archive_sha256=filehash(archive),archive_bytes=archive.stat().st_size,restored_file_count=len(inventory),restored_bytes=sum(x['bytes'] for x in inventory.values()),all_exact_file_hashes_verified=True,restored_registry_version=restored['version'],restored_counts=counts,sqlite_integrity='ok',sqlite_verification='quick_check after exact byte hashes; full source-registry integrity is a separate prerequisite, not established by restore',source_directory_required=False,production_writes=0,seconds=time.monotonic()-start)
 return report
if __name__=='__main__':
 p=argparse.ArgumentParser();group=p.add_mutually_exclusive_group(required=True);group.add_argument('--registry');group.add_argument('--restore-archive');p.add_argument('--archive');p.add_argument('--expected-sha256');p.add_argument('--restore-target',required=True);p.add_argument('--receipt',required=True);a=p.parse_args()
 if a.restore_archive:
  if not a.expected_sha256:p.error('--expected-sha256 required for standalone restore')
  r=restore_archive(a.restore_archive,a.restore_target,a.expected_sha256)
 else:
  if not a.archive:p.error('--archive required with --registry')
  r=backup(a.registry,a.archive,a.restore_target)
 Path(a.receipt).write_bytes(canonical(r)+b'\n');print(canonical(r).decode())
