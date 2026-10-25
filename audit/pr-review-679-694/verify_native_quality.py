"""Independent native JSON cutoff census; does not use the selection heap/index."""
from pathlib import Path
import json,gzip,hashlib,time,subprocess
from collections import Counter,defaultdict
from associativvordes.cleanup_quality.evaluate import release,rows
ROOT=Path(__file__).resolve().parents[2];W=Path('/tmp/interal-audit-work');A=Path(__file__).parent
canon=lambda x:json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
digest=lambda x:hashlib.sha256(canon(x)).hexdigest()
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
start=time.monotonic();first=W/'quality-final';replay=W/'quality-final-replay';cases,m=release(first);other,om=release(replay);assert cases==other and m['case_set_sha256']==om['case_set_sha256']
for name in ['PROBABILITY.ndjson.gz','CHALLENGE.ndjson.gz','BLIND-A.ndjson.gz','BLIND-B.ndjson.gz','PREDICTIONS.ndjson.gz','HOLDOUT.json','SAMPLING-DESIGN.json','HISTORICAL-LEXICAL-CONTEXTS.json']:
 assert sha(first/name)==sha(replay/name),name
protocol=json.loads((ROOT/'associativvordes/cleanup_quality/protocol.json').read_bytes());p=[c for c in cases if c['dataset']=='probability'];ns=Counter(c['language'] for c in p);assert set(ns)==set(protocol['probability_design']['languages']) and all(n==1600 for n in ns.values())
selected={};cutoffs={}
for c in p:
 key=(c['family_id'],c['language'],c['lemma_id'],c['record_sha256']);assert key not in selected and digest(c['source_record'])==c['record_sha256'];selected[key]=c
 assert digest([protocol['seed'],*key])==c['selection_hash'];cutoffs[c['language']]=max(cutoffs.get(c['language'],''),c['selection_hash'])
counts=Counter();qual=Counter();seen=set();root=ROOT/'associativvordes/family-index-v5'
for b in range(256):
 for lang in ns:
  path=root/'members'/lang/(f'{b:02x}.json.gz');file_sha=sha(path)
  for fid,records in json.load(gzip.open(path)).items():
   for ordinal,r in enumerate(records):
    rh=digest(r);key=(fid,lang,r['lemma_id'],rh);counts[lang]+=1
    if digest([protocol['seed'],*key])<=cutoffs[lang]:
     assert key in selected,('missing lower hash',key);qual[lang]+=1;c=selected[key];assert c['ordinal']==ordinal and c['source_record']==r and c['source_file_sha256']==file_sha;seen.add(key)
 if b%32==31:print(b+1,sum(counts.values()),flush=True)
assert sum(counts.values())==10078319 and qual==ns and seen==set(selected)
for c in p:
 n,N=ns[c['language']],counts[c['language']];assert c['stratum_population']==N and c['stratum_sample_size']==n and c['inclusion_probability']==n/N and c['weight']==N/n
# Different dependence algorithm: connected components, no union-find.
by=defaultdict(list);byid={c['id']:c for c in cases}
for c in cases:
 tokens=['family:'+c['family_id'],'lemma:'+c['language']+':'+c['lemma_id']]
 if c.get('record_sha256'):tokens.append('record:'+c['record_sha256'])
 c['_tokens']=tokens
 for t in tokens:by[t].append(c['id'])
visited=set()
for cid in byid:
 if cid in visited:continue
 todo=[cid];component=set()
 while todo:
  q=todo.pop()
  if q in component:continue
  component.add(q)
  for token in byid[q]['_tokens']:todo.extend(x for x in by[token] if x not in component)
 expected='statistical-cluster:'+digest(min(component));assert all(byid[q]['cluster']==expected for q in component);visited|=component
for c in cases:del c['_tokens']
forbidden={'prediction','configuration','confidence','risk_flags','historical_exposure_flags','review_status','verdict','sampling_stratum','weight','dataset','history_ref','history_sha256'}
def clean(x):
 if isinstance(x,dict):
  assert not forbidden&set(x)
  for v in x.values():clean(v)
 elif isinstance(x,list):
  for v in x:clean(v)
orders=[]
for role in ['A','B']:
 cards=rows(first/f'BLIND-{role}.ndjson.gz');ids=[]
 for card in cards:
  c=byid[card['case_id']];assert card['case_sha256']==c['content_sha256'] and card['role']==role;clean(card);ids.append(card['case_id'])
 assert len(ids)==len(set(ids))==len(cases) and set(ids)==set(byid);orders.append(ids)
assert orders[0]!=orders[1]
hroot=ROOT/'audit/associative-history-registry';cur=json.loads((hroot/'CURRENT.json').read_bytes());history={d['id']:d for d in json.loads((hroot/cur['snapshot']).read_bytes())['decisions']};historical=0
for c in cases:
 if c.get('case_kind')!='HISTORICAL_SCOPE_NOT_POPULATION_MEMBERSHIP':continue
 h=history[c['history_ref']];source=h['source'];raw=subprocess.check_output(['git','cat-file','blob',source['blob']],cwd=ROOT);assert hashlib.sha256(raw).hexdigest()==source['sha256'];data=json.loads(gzip.decompress(raw) if source['path'].endswith('.gz') else raw)
 for token in source.get('pointer','').split('/')[1:]:
  token=token.replace('~1','/').replace('~0','~');data=data[int(token)] if isinstance(data,list) else data[token]
 native=data.get('source_record',data);observed={k:native[k] for k in ('word','normalized','search_form','context') if k in native};observed['word']=native.get('word') or native.get('lemma')
 if 'sources' in native:observed['sources']=[{k:r[k] for k in ('id','file','category') if k in r} for r in native['sources']]
 expect=dict(observed,source_refs=[dict(artifact='HISTORICAL-LEXICAL-CONTEXTS.json',pointer='/contexts/'+digest(observed),sha256=digest(observed))]);assert c['source_record']==expect;historical+=1
for name in ['FROZEN-GOLD.json','OPERATION-GATES.json','RAW-HUMAN-REVIEWS.ndjson','RAW-ADJUDICATIONS.ndjson','DISAGREEMENTS.ndjson']:
 assert sha(W/'quality-final-evaluation'/name)==sha(W/'quality-final-replay-evaluation'/name)
left=json.loads((W/'quality-final-evaluation/METRICS.json').read_bytes());right=json.loads((W/'quality-final-replay-evaluation/METRICS.json').read_bytes());left.pop('release_sha256');right.pop('release_sha256');assert left==right
out=dict(status='PASS_ENGINEERING_ONLY',native_population_rows=sum(counts.values()),stratum_population=dict(counts),stratum_selected=dict(ns),probability_units=len(p),challenge_units=len(cases)-len(p),blind_cards_checked=2*len(cases),historical_git_contexts_independently_checked=historical,all_clusters_checked=True,evaluation_replay_identical=True,method='Native gzip JSON full frozen-cutoff census; separate component traversal and historical Git-pointer reconstruction',source_manifest_sha256=sha(first/'MANIFEST.json'),verifier_sha256=sha(__file__),human_reviews=0,semantic_gate='BLOCKED',production_writes=0,seconds=time.monotonic()-start)
(A/'QUALITY-INDEPENDENT-VERIFICATION.json').write_text(json.dumps(out,indent=2)+'\n');print(out,flush=True)
