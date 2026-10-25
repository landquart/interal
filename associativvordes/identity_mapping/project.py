"""Complete streaming physical-member projection with recoverable original locators."""
import argparse,collections,gzip,hashlib,json,resource,sqlite3,subprocess,time
from pathlib import Path
from .model import canonical,digest,lookup
from associativvordes.v5_adapter.stream import pairs
LANGS=('en','de','fr','es','it','ru')
COLUMNS=['family_id','lemma_id','ordinal','word','record_sha256','lookup_key','priority_flags','original_pos']
def hash_file(p):
 h=hashlib.sha256()
 with Path(p).open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
def project(source,repo,commit,history,output):
 source=Path(source).resolve();repo=Path(repo).resolve();output=Path(output).resolve()
 if output.is_relative_to(repo) or output.exists():raise ValueError('fresh external mapping projection required')
 output.mkdir(parents=True);(output/'origins').mkdir();db=sqlite3.connect(output/'historical-priority.sqlite');db.execute('CREATE TABLE negatives(family TEXT,language TEXT,lemma TEXT,PRIMARY KEY(family,language,lemma)) WITHOUT ROWID')
 with gzip.open(history,'rt') as f:
  for line in f:
   x=json.loads(line)
   if x['historical_status']=='REMOVED':db.execute('INSERT OR IGNORE INTO negatives VALUES(?,?,?)',(x['family_id'],x['language'],x['lemma_id']))
 old=json.loads((repo/'audit/history-adjudication-20261025/REGISTRY.json').read_bytes())
 for c in old['previous_constraints']:
  d=c['original_decision'];s=d['scope']
  if s['domain']=='membership':
   for lid in s.get('lemma_ids',[]):db.execute('INSERT OR IGNORE INTO negatives VALUES(?,?,?)',(s['family_id'],s['language'],lid))
 db.commit();snapshot=[];prefix='associativvordes/family-index-v5/'
 raw=subprocess.check_output(['git','-C',str(repo),'ls-tree','-r',commit,'--',prefix],text=True);expected={p.removeprefix(prefix):m.split()[2] for m,p in (line.split('\t') for line in raw.splitlines())};pins={}
 for rel,oid in sorted(expected.items()):
  p=source/rel;b=p.read_bytes();h=hashlib.sha256(b).hexdigest();assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==oid
  pins[rel]=dict(path=rel,bytes=len(b),sha256=h,git_blob=oid);snapshot.append(pins[rel])
 assert sum(p.endswith('.json.gz') for p in pins)==2048
 parts=[];total=collections.Counter();start=time.monotonic()
 for lang in LANGS:
  for bucket in range(256):
   rel=f'members/{lang}/{bucket:02x}.json.gz';p=source/rel;dest=output/'origins'/f'{lang}-{bucket:02x}.ndjson.gz';count=0;flags=collections.Counter()
   with dest.open('wb') as rawout,gzip.GzipFile(fileobj=rawout,mode='wb',mtime=0,filename='') as out:
    for fid,rows in pairs(p):
     for ordinal,r in enumerate(rows):
      priority=[]
      if fid.startswith('surface:') or r.get('corpus_quality',{}).get('status') in {'rejected','suspicious','requires_manual_review'}:priority.append('FORMAL_OR_SURFACE_REVIEW')
      if len(rows)>=100:priority.append('LARGE_FAMILY')
      if len({c.get('canonical_candidate') for c in r.get('components',[])})>1:priority.append('COMPETING_BASES')
      if db.execute('SELECT 1 FROM negatives WHERE family=? AND language=? AND lemma=?',(fid,lang,r['lemma_id'])).fetchone():priority.append('EXACT_HISTORICAL_NEGATIVE_OR_UNRESOLVED_SCOPE')
      row=[fid,r['lemma_id'],ordinal,r['word'],digest(r),lookup(r['word']),priority,r.get('pos')]
      out.write(canonical(row)+b'\n');count+=1;flags.update(priority)
   assert hash_file(p)==pins[rel]['sha256'];part=dict(language=lang,bucket=f'{bucket:02x}',source=pins[rel],rows=count,file=str(dest.relative_to(output)),sha256=hash_file(dest),priority_counts=dict(flags));parts.append(part);total[lang]+=count
   if bucket%32==31:print(json.dumps(dict(language=lang,bucket=f'{bucket:02x}',rows=total[lang])),flush=True)
 db.close();result=dict(schema='interal-v5-identity-projection/1',source_commit=commit,columns=COLUMNS,parts=parts,counts=dict(total),memberships=sum(total.values()),source_inventory=snapshot,source_inventory_sha256=digest(snapshot),history_priority_sha256=hash_file(history),history_semantic_certified=False,production_writes=0,seconds=time.monotonic()-start,max_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,retained_at_most='one family list plus bounded parser buffer; never the complete corpus')
 (output/'PROJECTION.json').write_text(json.dumps(result,indent=2)+'\n');return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--repo',required=True);p.add_argument('--commit',required=True);p.add_argument('--history',required=True);p.add_argument('--output',required=True);a=p.parse_args();project(a.source,a.repo,a.commit,a.history,a.output)
