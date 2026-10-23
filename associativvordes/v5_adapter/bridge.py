"""Finite export to existing review, annotation and evidence-graph APIs."""
import argparse,base64,importlib.util,json,sys
from pathlib import Path
from common import *
from adapter import Adapter

def history_reader():
 path=ROOT/'associativvordes/history_registry/registry.py'
 spec=importlib.util.spec_from_file_location('v5_historical_constraints',path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 root=ROOT/'audit/associative-history-registry';pointer=read(root/'CURRENT.json')
 h=module.History(ROOT,root/pointer['snapshot'],pointer['sha256'])
 return h,pointer['sha256']

def export(adapter,destination,family=None,language=None,lemma=None,limit=1000,external=None,cursor=None,max_bytes=32*1024*1024,selections=None):
 destination=Path(destination)
 if destination.exists():raise ValueError('fresh queue destination required')
 if not 1<=limit<=10000:raise ValueError('finite export requires 1..10000 questions')
 scope=dict(family=family,language=language,lemma_id=lemma)
 if selections is not None:
  if cursor or family or language or lemma or not 1<=len(selections)<=limit:raise ValueError('finite explicit scope required')
  scope['memberships']=selections
 if not 1024<=max_bytes<=32*1024*1024:raise ValueError('finite byte budget')
 if cursor and (cursor['adapter']!=adapter.manifest['version'] or cursor['scope']!=scope):raise ValueError('stale or differently scoped cursor')
 destination.mkdir(parents=True);lines=[];ids=set();source_rows={};total=0;last=None;more=False
 if selections is None:iterator=iter(adapter.rows(family,language,lemma,cursor['position'] if cursor else None))
 else:
  import itertools
  iterator=itertools.chain.from_iterable(adapter.rows(*key) for key in selections)
 for row in iterator:
  q=adapter.question(*row)
  if external:q=external.enrich(q)
  if q['id'] in ids:raise ValueError('duplicate source membership identity')
  encoded=canonical(q)+b'\n'
  if total+len(encoded)>max_bytes:
   if not lines:raise ValueError('single question exceeds finite byte budget')
   more=True;break
  total+=len(encoded);ids.add(q['id']);lines.append(encoded);last=[bucket(row[0]),*row[:3]]
  for r in q.get('external_rows',[]):
   b=r['body'];source_rows[r['id']]=dict(record_id=r['id'],original_line_base64=b['original_line_base64'],
    raw_text=base64.b64decode(b['original_line_base64']).decode(),raw_locator=b['raw_locator'],revision=b['revision'],artifact=b['artifact'])
  if len(lines)>=limit:
   more=next(iterator,None) is not None;break
 if selections is not None and more:raise ValueError('explicit selection exceeds finite byte budget')
 data=b''.join(lines);raw=canonical(source_rows)
 atomic(destination/'questions.ndjson',data);atomic(destination/'source-rows.json',raw)
 metadata={name:hashes(Path(adapter.manifest['source_root'])/name) for name in ['manifest.json','report.json','repository-provenance.json'] if (Path(adapter.manifest['source_root'])/name).exists()}
 m=dict(schema='v5-review-projection/1',identity=dict(production_metadata_lock=metadata,source_commit=adapter.manifest['source_commit'],adapter=adapter.manifest['version'],
  adapter_manifest_sha256=filehash(adapter.folder/'MANIFEST.json'),history=getattr(getattr(adapter.history,'__self__',None),'digest',None),
  external=external.identity if external else None,source_lock_sha256=filehash(ROOT/'data/morphology-evidence/sources/source-lock.json'),
  code={p.name:filehash(p) for p in [Path(__file__),Path(__file__).with_name('adapter.py')]}),
  counts=dict(questions=len(lines)),outputs={'questions.ndjson':sha(data),'source-rows.json':sha(raw)},
  membership_writes=0,scope=dict(**scope,limit=limit,max_bytes=max_bytes),
  next_cursor=dict(adapter=adapter.manifest['version'],scope=scope,position=last) if more else None)
 atomic(destination/'MANIFEST.json',canonical(m)+b'\n');return m

def review_import(queue,ledger_root):
 sys.path.insert(0,str(ROOT/'associativvordes/review'))
 from store import Ledger,atomic as ledger_atomic,canonical as ledger_canonical,digest
 queue=Path(queue);m=read(queue/'MANIFEST.json');raw=(queue/'source-rows.json').read_bytes()
 if sha(raw)!=m['outputs']['source-rows.json']:raise ValueError('source rows checksum')
 ledger=Ledger(ledger_root);result=ledger.import_queue(queue);rows=json.loads(raw)
 wanted={e['id']:e for q in ledger.questions.values() for e in q.get('evidence_refs',[])}
 if set(rows)!=set(wanted):raise ValueError('source evidence closure')
 for identifier,r in rows.items():
  if r['raw_locator']!=wanted[identifier]['raw_locator'] or sha(base64.b64decode(r['original_line_base64'],validate=True))!=r['raw_locator']['raw_sha256']:raise ValueError('raw row differs from question evidence')
 payload=ledger_canonical(rows).encode();version=digest(payload)
 with ledger.lock():
  folder=ledger.root/'source-rows';folder.mkdir(exist_ok=True);ledger_atomic(folder/(version+'.json'),payload)
 return dict(result,source_rows=len(rows),source_rows_version=version)

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--adapter',required=True);p.add_argument('--output',required=True);p.add_argument('--family');p.add_argument('--language');p.add_argument('--lemma');p.add_argument('--limit',type=int,default=1000);p.add_argument('--cursor');p.add_argument('--external');p.add_argument('--review-ledger');p.add_argument('--graph');a=p.parse_args()
 h,_=history_reader();obj=Adapter(a.adapter,history=h.check)
 try:
  ext=None
  if a.external:
   from external import External
   ext=External(a.external,ROOT/'data/morphology-evidence/sources/source-lock.json')
  result=export(obj,a.output,a.family,a.language,a.lemma,a.limit,ext,read(a.cursor) if a.cursor else None)
  if a.review_ledger:result['review']=review_import(a.output,a.review_ledger)
  if a.graph:
   if not ext:raise ValueError('external index required for native graph export')
   questions=[json.loads(line) for line in (Path(a.output)/'questions.ndjson').read_bytes().splitlines()]
   result['graph']=ext.graph(questions,a.graph)
  print(json.dumps(result,ensure_ascii=False))
 finally:obj.close()
