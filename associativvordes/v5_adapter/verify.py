"""Independent full source-to-projection comparison, one decoded shard at a time."""
import argparse,gzip,json,resource,time,zlib
from collections import Counter
from pathlib import Path
from common import *
from adapter import Adapter

def verify(folder):
 start=time.monotonic();obj=Adapter(folder);source=Path(obj.manifest['source_root']);totals=Counter();files=[]
 try:
  for b,r in sorted(obj.shards.items()):
   db=obj.db(b)
   for dep in r['identity']['files']:
    path=source/dep['path'];actual=hashes(path)
    if any(actual[k]!=dep[k] for k in ['bytes','sha256','git_blob']):raise ValueError('source changed: '+str(path))
    files.append(dict(path=dep['path'],**actual))
    # Uses stdlib's independent whole-shard JSON decoder, not the streaming parser.
    with gzip.open(path,'rt',encoding='utf-8') as f:data=json.load(f)
    if dep['path'].startswith(('families/','aliases/')):
     table='families' if dep['path'].startswith('families/') else 'aliases';col='id' if table=='families' else 'alias'
     if db.execute('SELECT COUNT(*) FROM '+table).fetchone()[0]!=len(data):raise ValueError('metadata count')
     for key,value in data.items():
      got=db.execute('SELECT body FROM '+table+' WHERE '+col+'=?',(key,)).fetchone()
      if not got or json.loads(zlib.decompress(got[0]))!=value:raise ValueError('metadata body differs')
     totals[table]+=len(data)
    else:
     lang=dep['path'].split('/')[1];count=0
     for fid,rows in data.items():
      found={lid:(ordinal,json.loads(zlib.decompress(raw))) for lid,ordinal,raw in db.execute('SELECT lemma,ordinal,body FROM members WHERE family=? AND language=?',(fid,lang))}
      if len(found)!=len(rows):raise ValueError('family member count')
      for ordinal,row in enumerate(rows):
       if found.get(row['lemma_id'])!=(ordinal,row):raise ValueError('member identity/order/body differs')
       count+=1
     if db.execute('SELECT COUNT(*) FROM members WHERE language=?',(lang,)).fetchone()[0]!=count:raise ValueError('language count')
     totals[lang]+=count
    del data
   print(json.dumps(dict(bucket=b,verified=True)),flush=True)
  if dict(totals)!=obj.manifest['counts']:raise ValueError('full count mismatch')
  report=dict(schema='v5-projection-integrity/1',status='PASS',projection_version=obj.manifest['version'],
   manifest_sha256=filehash(Path(folder)/'MANIFEST.json'),counts=dict(totals),memberships=sum(totals[l] for l in LANGS),
   source_files=len(files),source_inventory_sha256=sha(canonical(sorted(files,key=lambda x:x['path']))),
   every_source_and_projected_record_compared=True,production_modified=False,linguistic_certification=False,
   seconds=time.monotonic()-start,max_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
  atomic(Path(folder)/'INTEGRITY.json',canonical(report)+b'\n');return report
 finally:obj.close()
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--adapter',required=True);a=p.parse_args();print(json.dumps(verify(a.adapter),sort_keys=True))
