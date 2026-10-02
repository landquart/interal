"""Reproduce a finite manually adjudicated reflex overlay; no classifier."""
import gzip, hashlib, json
from collections import Counter
from pathlib import Path
BASE=Path('audit/associative-family-v5')
def sha(b):return hashlib.sha256(b).hexdigest()
def enc(x):return (json.dumps(x,ensure_ascii=False,indent=2)+'\n').encode()
def build(stage,out):
 spec_path=BASE/stage/'review-spec.json';spec_bytes=spec_path.read_bytes();spec=json.loads(spec_bytes)
 prior=BASE/spec['previous_stage'];pending_bytes=(prior/'pending-review.json').read_bytes();prior_inv_bytes=(prior/'inventory.json').read_bytes();prior_inv=json.loads(prior_inv_bytes)
 assert sha(pending_bytes)==prior_inv['artifact_sha256']['pending-review.json']
 previous=json.loads(pending_bytes)['records'];assert len(previous)==spec['before_counts']['pending_review']
 assert prior_inv['continuation_counts']==spec['before_counts']
 source_path=BASE/'reflex-checkpoint-20261001/candidates.json.gz';source_bytes=source_path.read_bytes();assert sha(source_bytes)==prior_inv['source_candidate_sha256'];source=json.loads(gzip.decompress(source_bytes))
 key=lambda r:(r['language'],r['canonical_root'],r['lemma_id'])
 by_word={(r['language'],r['canonical_root'],r['word']):r for r in previous};delta=[];proof=[];chosen=set()
 for item in spec['decisions']:
  original=by_word[(item['language'],item['canonical_root'],item['word'])];k=key(original);assert k not in chosen;chosen.add(k)
  assert original['status']=='pending_review' and item['status'] in ['accepted','excluded','uncertain']
  assert item['reason'] and item['source_references'] and item['segmentation_or_lexical_identity']
  member=next(m for m in source[item['language']][item['canonical_root']] if m['lemma_id']==original['lemma_id'])
  assert member['word']==item['word'] and member['source_family_ids']==original['source_family_ids']
  delta.append({**original,**item,'previous_status':'pending_review','runtime_applied':False})
  proof.append({'language':item['language'],'canonical_root':item['canonical_root'],'member':member,'previous_pending_record':original})
 remaining=[r for r in previous if key(r) not in chosen];c=Counter(r['status'] for r in delta)
 counts={k:spec['before_counts'][k]+c[k] for k in ['accepted','excluded','uncertain']};counts['pending_review']=len(remaining);assert sum(counts.values())==762
 inputs={'spec_path':str(spec_path),'spec_sha256':sha(spec_bytes),'previous_pending_path':str(prior/'pending-review.json'),'previous_pending_sha256':sha(pending_bytes),'previous_inventory_path':str(prior/'inventory.json'),'previous_inventory_sha256':sha(prior_inv_bytes),'source_candidate_path':str(source_path),'source_candidate_sha256':sha(source_bytes)}
 ledger={'schema_version':1,'source_run_id':35647932153,'inputs':inputs,'source_candidate_sha256':sha(source_bytes),'previous_pending_sha256':sha(pending_bytes),'decisions':delta,'new_counts':dict(c),'continuation_counts':counts,'accepted_applied':spec['accepted_applied'],'accepted_unapplied':spec['accepted_unapplied']+c['accepted'],'runtime_changes':False,'full_family_certification':False,'review_scope':spec['review_scope']}
 files={'decisions.json':enc(ledger),'pending-review.json':enc({'count':len(remaining),'records':remaining}),'source-records.json.gz':gzip.compress(enc({'records':proof}),mtime=0)};out.mkdir(parents=True,exist_ok=True)
 for name,raw in files.items():(out/name).write_bytes(raw)
 inv={'schema_version':1,'source_run_id':35647932153,'previous_stage':str(prior),'inputs':inputs,'source_candidate_sha256':sha(source_bytes),'reviewed_count':len(delta),'new_counts':dict(c),'continuation_counts':counts,'artifact_sha256':{n:sha(b) for n,b in files.items()},'runtime_changes':False,'full_family_certification':False}
 (out/'inventory.json').write_bytes(enc(inv));print(json.dumps({'new_counts':dict(c),'continuation_counts':counts}))
