"""Restore only the exact certified stage04 registry, with no history reinterpretation."""
import argparse,os,shutil,tempfile,zipfile
from .core import *
def restore(archive,output):
 archive=Path(archive);out=Path(output).resolve();volume=read(ROOT/'audit/associative-v5-diagnostics/ARCHIVE-VOLUMES.json');expected=read(ROOT/'audit/associative-v5-diagnostics/REGISTRY-MANIFEST.json')
 if out.exists() or out.is_relative_to(ROOT):raise ValueError('fresh research input directory required')
 if archive.stat().st_size!=volume['archive_bytes'] or sha(archive)!=volume['archive_sha256']:raise ValueError('full archive checksum')
 out.parent.mkdir(parents=True,exist_ok=True);staging=Path(tempfile.mkdtemp(dir=out.parent,prefix='boundary-prior-'))
 try:
  with zipfile.ZipFile(archive) as z:
   names=[n for n in z.namelist() if Path(n).name=='registry.sqlite']
   if len(names)!=1:raise ValueError('ambiguous registry inventory')
   with z.open(names[0]) as source,(staging/'registry.sqlite').open('xb') as target:shutil.copyfileobj(source,target,1048576)
  if sha(staging/'registry.sqlite')!=expected['database_sha256']:raise ValueError('certified database checksum')
  save(staging/'MANIFEST.json',expected);os.rename(staging,out)
 except BaseException:shutil.rmtree(staging);raise
 return dict(schema='boundary-certified-source-restore/2',status='PASS',source_version=expected['version'],database_sha256=expected['database_sha256'],archive_sha256=volume['archive_sha256'],legacy_memberships_are_not_gold=True,production_writes=0)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--archive',required=True);p.add_argument('--output',required=True);p.add_argument('--receipt');a=p.parse_args();r=restore(a.archive,a.output)
 if a.receipt:save(a.receipt,r)
 print(json.dumps(r))
