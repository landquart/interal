"""Reproduce capture, forced interruption, recovery and complete restored recount.
Large work/backup files must be outside the Git checkout.
"""
import argparse,hashlib,json,pathlib,resource,sqlite3,subprocess,sys,time
from census import prepare,run,backup,restore,load,atomic_json,sha_file,VERSION

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--repo',required=True);ap.add_argument('--commit',required=True);ap.add_argument('--work',required=True)
 a=ap.parse_args();repo=pathlib.Path(a.repo).resolve();work=pathlib.Path(a.work).resolve()
 if work==repo or repo in work.parents:raise ValueError('Work must be outside repository')
 if work.exists():raise ValueError('Use a fresh external work directory')
 work.mkdir(parents=True);prepare(repo,work,a.commit);snapshot=work/'snapshot';tool=pathlib.Path(__file__).with_name('census.py')
 cmd=[sys.executable,str(tool),'census','--snapshot',str(snapshot),'--work',str(work/'run')]
 start=time.monotonic();crash=subprocess.run(cmd+['--crash-after','2'])
 db=sqlite3.connect(work/'run/census.sqlite');checkpoints=db.execute('select count(*) from checkpoints').fetchone()[0];db.close()
 interruption={'exit_code':crash.returncode,'expected_exit_code':75,'committed_checkpoints_after_crash':checkpoints,
  'rollback_verified':crash.returncode==75 and checkpoints==1,'seconds':time.monotonic()-start}
 atomic_json(work/'INTERRUPTION.json',interruption)
 if not interruption['rollback_verified']:raise ValueError('Interrupted transaction did not roll back')
 # Same implementation and immutable inputs: resume rechecks completed source hashes.
 run(snapshot,work/'run')
 archive=work/'baseline.tar';b=backup(snapshot,archive);restored=work/'restored';r=restore(archive,restored,b['archive_sha256'])
 # Execute the independently restored tool; no checkout imports or original snapshot required.
 measurement_start=time.monotonic()
 subprocess.run([sys.executable,str(restored/'tool/census.py'),'census','--snapshot',str(restored),'--work',str(work/'restored-run')],check=True)
 atomic_json(work/'COMPLETE-RESOURCE-MEASUREMENT.json',{'schema_version':1,'wall_seconds':time.monotonic()-measurement_start,'peak_rss_kib':resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss,'scope':'complete restored census, fresh database, all 768 tasks'})
 first=sha_file(work/'run/FULL-CENSUS.json');second=sha_file(work/'restored-run/FULL-CENSUS.json')
 atomic_json(work/'BACKUP-RESTORE-REPORT.json',{'schema_version':1,**b,**r,'full_recount_equal':first==second,
   'first_census_sha256':first,'restored_census_sha256':second,'interruption':interruption,
   'durable_external_storage_verified':False,'note':'Retain archive and receipt outside this work directory before declaring durable backup complete.'})
 if first!=second:raise ValueError('Restored full recount differs')
 print(json.dumps({'reproduced':True,'census_sha256':first,'verdict':load(work/'run/INTEGRITY-REPORT.json')['verdict']}))
if __name__=='__main__':main()
