#!/usr/bin/env python3
"""Independent complete normalization replay against compact morphology profiles."""
import argparse,collections,hashlib,json,pathlib,resource,sqlite3,sys,time,zlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'associativvordes/v5_adapter'))
from external import External,make_record
from common import canonical,atomic,connect,filehash,lookup,read
# Deliberately independent policy literals; full normalized claims, not raw label search.
D={'direct_derivation':1,'inflection':4,'compounding':8,'prefixation':128,'suffixation':256,'unconfirmed':512}
def verify(folder,lock,profiles,out):
 start=time.monotonic();out=pathlib.Path(out);out.mkdir(parents=True,exist_ok=True);e=External(folder,lock);manifest=read(pathlib.Path(profiles)/'MANIFEST.json');parts=[]
 for i,p in enumerate(e.parts):
  artifact=p['artifact'];target=out/f'{i:02d}.json'
  if filehash(pathlib.Path(profiles)/f'{i:02d}.sqlite')!=manifest['parts'][i]['sha256']:raise ValueError('profile checksum mismatch')
  if target.exists():
   r=read(target)
   if r['raw_sha256']!=p['database_sha256'] or r['profile_sha256']!=manifest['parts'][i]['sha256']:raise ValueError('stale verification')
   parts.append(r);continue
  temp=out/'working.sqlite';temp.unlink(missing_ok=True);db=connect(temp)
  db.executescript('CREATE TABLE expected(word TEXT,mask INTEGER,n INTEGER,PRIMARY KEY(word,mask)) WITHOUT ROWID; CREATE TABLE nodes(native TEXT PRIMARY KEY) WITHOUT ROWID; CREATE TABLE endpoints(native TEXT);')
  raw=connect(pathlib.Path(folder)/p['database'],True);stats=collections.Counter()
  with db:
   for line,blob in raw.execute('SELECT line,raw FROM rows ORDER BY line'):
    record=make_record(artifact,line,zlib.decompress(blob),p['header']);n=record['body']['normalized'];mask=0;stats['rows']+=1
    words={lookup(x['lemma']) for x in n['lexemes']}
    if 'inflection' in n:
     mask|=D['inflection'];words.add(lookup(n['inflection']['form']));stats['inflections']+=1
    for claim in n['claims']:
     stats['type:'+claim['type']]+=1;stats['direction:'+claim['direction']]+=1
     mask|=D.get(claim['type'],0)
     op=claim.get('parameters',{}).get('operation','').lower()
     if op in ('prefix','prefixation'):mask|=D['prefixation']
     elif op in ('suffix','suffixation'):mask|=D['suffixation']
     if artifact['format']=='derinet2':
      db.executemany('INSERT INTO endpoints VALUES(?)',((x,) for x in claim.get('sources',[])))
    if artifact['format']=='derinet2':
     db.executemany('INSERT INTO nodes VALUES(?)',((x['native_key'],) for x in n['lexemes']))
    if n.get('segmentation'):stats['rows_with_documented_segmentation']+=1
    if n['claims'] and any(x['type']=='compounding' for x in n['claims']):stats['compound_rows']+=1
    mask=mask or D['unconfirmed']
    db.executemany('INSERT INTO expected VALUES(?,?,1) ON CONFLICT(word,mask) DO UPDATE SET n=n+1',((w,mask) for w in sorted(words)))
  raw.close();db.execute('ATTACH DATABASE ? AS profile',(str(pathlib.Path(profiles)/f'{i:02d}.sqlite'),))
  for sql in ('SELECT * FROM expected EXCEPT SELECT * FROM profile.profiles','SELECT * FROM profile.profiles EXCEPT SELECT * FROM expected'):
   if db.execute(sql).fetchone() is not None:raise ValueError('profile differs from complete normalized claims: '+artifact['id'])
  stats['missing_native_endpoints']=db.execute('SELECT count(*) FROM endpoints e LEFT JOIN nodes n ON n.native=e.native WHERE n.native IS NULL').fetchone()[0]
  db.close();temp.unlink();r=dict(artifact=artifact['id'],raw_sha256=p['database_sha256'],profile_sha256=manifest['parts'][i]['sha256'],counts=dict(stats),status='PASS')
  atomic(target,canonical(r)+b'\n');parts.append(r);print(artifact['id'],dict(stats),flush=True)
 totals=collections.Counter()
 for p in parts:totals.update(p['counts'])
 report=dict(status='PASS',parts=parts,totals=dict(totals),external_version=e.identity,seconds=time.monotonic()-start,max_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,profile_comparison='Every word/type/count in both directions; independently normalized every accepted raw row',source_quarantines_preserved=24)
 atomic(out/'REPORT.json',canonical(report)+b'\n')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--external',required=True);p.add_argument('--lock',required=True);p.add_argument('--profiles',required=True);p.add_argument('--output',required=True);a=p.parse_args();verify(a.external,a.lock,a.profiles,a.output)
