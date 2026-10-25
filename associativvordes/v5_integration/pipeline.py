"""Single-version real module adapters. Synthetic previews cannot publish production."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import copy,json,sys
from pathlib import Path
from associativvordes.v5_contract.versions import ROOT,capture,validate,require,seal,open_envelope,digest,canonical,Blocked
from associativvordes.v5_contract import policy

def load_adapter_modules():
 pass
 from associativvordes.v5_adapter.bridge import export,review_import
 return export,review_import

class Pipeline:
 def __init__(self,work,contract):
  validate(contract);self.contract=copy.deepcopy(contract);work=Path(work).resolve()
  require(not work.is_relative_to(ROOT),'separate research namespace required')
  self.root=work/contract['namespace'];self.root.mkdir(parents=True,exist_ok=True)
  path=self.root/'IMPLEMENTATION.json'
  import fcntl
  from associativvordes.release_control.control import atomic
  with (self.root/'LOCK').open('a') as lock:
   fcntl.flock(lock,fcntl.LOCK_EX)
   if path.exists():require(json.loads(path.read_bytes())==contract,'research destination belongs to another implementation')
   else:atomic(path,canonical(contract)+b'\n')
 def publish(self,stage,payload,parents=()):
  result=seal(stage,payload,self.contract,parents);path=self.root/(stage+'-'+result['sha256']+'.json')
  if path.exists():require(json.loads(path.read_bytes())==result,'immutable publication differs')
  else:
   from associativvordes.release_control.control import atomic
   atomic(path,canonical(result)+b'\n')
  return result
 def import_v5(self,adapter,**scope):
  source=Path(adapter.manifest['source_root']).resolve()
  require(not self.root.is_relative_to(source) and not source.is_relative_to(self.root),'source/output overlap')
  if self.contract['namespace']=='research-v5':require(adapter.manifest['source_commit']==self.contract['baseline']['source_commit'],'adapter belongs to another baseline')
  export,_=load_adapter_modules();dest=self.root/'queue'
  m=export(adapter,dest,**scope)
  m['version_contract']=self.contract;m['normative_assessment']=policy.hypothesis({'adapter':adapter.manifest['version'],'scope':m['scope']},self.contract)
  from associativvordes.release_control.control import atomic
  atomic(dest/'MANIFEST.json',canonical(m)+b'\n')
  return self.publish('adapter',dict(queue=str(dest),manifest=m))
 def candidates(self,projection,evidence):
  open_envelope(evidence,self.contract);require(evidence['stage']=='evidence','evidence stage required')
  p=open_envelope(projection,self.contract);qs=[json.loads(x) for x in (Path(p['queue'])/'questions.ndjson').read_bytes().splitlines() if x]
  pass
  from associativvordes.candidate_search.search import Queue
  q=Queue(self.root/'candidates.sqlite',version_contract=self.contract)
  try:
   for row in qs:q.upsert(dict(family=row['family'],language=row['language'],lemma=row['lemma'],pos=row.get('pos'),source_question_id=row['id'],source_question_sha256=digest(row)),'v5:'+self.contract['version'])
   result=list(q.rows());q.db.commit()
  finally:q.close()
  return self.publish('candidates',dict(questions=result,source_queue=p['queue']),[projection,evidence])
 def evidence(self,projection,external):
  p=open_envelope(projection,self.contract);qs=[json.loads(x) for x in (Path(p['queue'])/'questions.ndjson').read_bytes().splitlines() if x]
  require(not self.root.is_relative_to(external.folder.resolve()),'evidence output overlaps its source')
  if self.contract['namespace']=='research-v5':require(external.identity['source_lock_sha256']==self.contract['sources']['sha256'],'external source version mismatch')
  result=external.graph(qs,self.root/'evidence.sqlite',version_contract=self.contract)
  return self.publish('evidence',dict(counts=result,graph=str(self.root/'evidence.sqlite')),[projection])
 def review(self,projection,evidence,candidates):
  open_envelope(evidence,self.contract);open_envelope(candidates,self.contract)
  require(evidence['stage']=='evidence' and candidates['stage']=='candidates','typed evidence/candidate inputs required')
  p=open_envelope(projection,self.contract);_,import_queue=load_adapter_modules()
  result=import_queue(p['queue'],self.root/'ledger')
  return self.publish('review',dict(ledger=str(self.root/'ledger'),result=result),[projection,evidence,candidates])
 def decide(self,review,actor,role,accounts,request_id,items):
  p=open_envelope(review,self.contract);pass
  from associativvordes.review.store import Ledger
  ledger=Ledger(p['ledger']);result=ledger.decide(actor,role,accounts,request_id,items,ledger.snapshot)
  return self.publish('review_event',dict(ledger=p['ledger'],transaction=result),[review])
 def decision(self,review,decision,trust):
  reviewed=open_envelope(review,self.contract);require(review['stage']=='review_event','human review event required')
  require(any(r.get('normative_decision')==decision for r in reviewed['transaction']['decisions']),'normative decision not present in human transaction')
  evaluation=policy.decision(decision,self.contract,trust,confirmed=True)
  return self.publish('decision',dict(decision=decision,result=evaluation,write_authorized=False),[review])
 def quality(self,cases,reviews,arbitrations,roster,trust,parents=()):
  from associativvordes.cleanup_quality.human import compile_gold
  require(any(p['stage']=='decision' for p in parents) and any(p['stage']=='review_event' for p in parents),'review and decision lineage required for quality')
  approved={digest(open_envelope(p,self.contract)['decision']) for p in parents if p['stage']=='decision'}
  for j in reviews:
   if j.get('verdict')!='UNCERTAIN':require(digest(j.get('normative_decision')) in approved,'quality answer lacks reviewed decision lineage')
  for c in cases:require(c.get('version_contract')==self.contract,'unversioned/mixed quality case')
  result=compile_gold(cases,reviews,arbitrations,roster,normative_context=trust)
  result['namespace']=self.contract['namespace'];result['production_human_gold']=0 if self.contract['namespace']=='TEST_ONLY-v5' else sum(r['gold'] is not None for r in result['rows'])
  return self.publish('quality',result,parents)
 def preview(self,state,operations,decisions,trust,parents=()):
  from associativvordes.release_control.control import preview,digest as release_digest
  require(any(p['stage']=='quality' for p in parents) and any(p['stage']=='decision' for p in parents),'quality and normative decision required before preview')
  require(state.get('version_contract')==self.contract,'state version/namespace mismatch')
  inputs=dict(base=release_digest(state),version_contract=self.contract,normative_decisions=decisions)
  result=preview(state,operations,inputs,normative_context=trust)
  return self.publish('preview',dict(plan=result,phase='PREVIEW_ONLY',production_writes=0),parents)
 def release_gate(self,preview):
  p=open_envelope(preview,self.contract);require(preview['stage']=='preview','typed preview required')
  return self.publish('release_gate',dict(status='BLOCKED',reasons=['NO_PRODUCTION_MATERIALIZER_CAPABILITY','EXACT_OWNER_AND_VERIFIER_SIGNATURES_REQUIRED','INDEPENDENT_QUALITY_GATES_REQUIRED'],preview_sha256=preview['sha256'],namespace=self.contract['namespace'],production_writes=0),[preview])
