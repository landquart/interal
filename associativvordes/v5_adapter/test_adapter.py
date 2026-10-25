if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import gzip,json,subprocess,sys,tempfile,unittest
from pathlib import Path
from associativvordes.v5_adapter.common import *
from associativvordes.v5_adapter.build import build
from associativvordes.v5_adapter.adapter import Adapter
from associativvordes.v5_adapter.bridge import export,history_reader,review_import
class ProjectionTests(unittest.TestCase):
 def setUp(self):
  self.t=tempfile.TemporaryDirectory();self.addCleanup(self.t.cleanup);self.base=Path(self.t.name);self.repo=self.base/'repo';self.source=self.repo/'associativvordes/family-index-v5';self.out=self.base/'out'
  self.fid='family:manu';self.other='surface:en:man';self.buckets=sorted({bucket(self.fid),bucket(self.other),bucket('man')})
  words=dict(en='manicure',de='Maniküre',fr='manucure',es='manicura',it='manicure',ru='маникюр')
  for b in self.buckets:
   fs={f:dict(id=f,canonical='manu',aliases=['man'],source='surface_singleton' if f==self.other else 'methodology_seed',review_status='needs_review') for f in [self.fid,self.other] if bucket(f)==b}
   self.put(f'families/{b}.json.gz',fs);self.put(f'aliases/{b}.json.gz',{'man':[self.fid,self.other]} if bucket('man')==b else {})
   for l in LANGS:
    r=dict(lemma_id='lemma:'+sha((l+words[l]).encode())[:20],word=words[l],normalized=words[l].lower(),components=[dict(evidence=[dict(type='compound_morphology',source='candidate_index')])])
    self.put(f'members/{l}/{b}.json.gz',{f:[r] for f in fs if f==self.fid or l=='en'})
  subprocess.run(['git','init','-q',str(self.repo)],check=True);self.commit()
 def commit(self):
  subprocess.run(['git','-C',str(self.repo),'add','.'],check=True)
  subprocess.run(['git','-C',str(self.repo),'-c','user.name=TEST_ONLY','-c','user.email=test@example.invalid','commit','-qm','TEST_ONLY fixture'],check=True)
  self.commit_id=subprocess.check_output(['git','-C',str(self.repo),'rev-parse','HEAD'],text=True).strip()
 def put(self,name,x):
  p=self.source/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(gzip.compress(canonical(x),mtime=0))
 def run_build(self,**kw):return build(self.source,self.out,self.commit_id,self.repo,buckets=self.buckets,**kw)
 def obj(self,history=None):
  a=Adapter(self.out,history=history);self.addCleanup(a.close);return a
 def test_six_languages_and_no_lexical_head_invention(self):
  r=self.run_build();self.assertEqual(sum(r['counts'][l] for l in LANGS),7)
  a=self.obj()
  for row in a.rows():
   q=a.question(*row);self.assertIsNone(q['pos']);self.assertEqual(q['sense_scope'],'unresolved');self.assertFalse(q['establishes_membership']);self.assertFalse(q['lexeme_alternatives'][0]['establishes_lexical_head'])
 def test_alias_fanout_is_not_family_equivalence(self):
  self.run_build();self.assertEqual(self.obj().aliases('man'),[self.fid,self.other])
 def test_scoped_history_receives_original_family_and_lemma(self):
  self.run_build();seen=[];a=self.obj(lambda p:seen.append(p) or dict(allowed=False,status='HISTORY_CONFLICT'))
  q=a.question(*next(a.rows(self.fid,'en')));self.assertEqual(seen[0]['family_id'],self.fid);self.assertEqual(seen[0]['lemma_ids'],[q['source_lemma_id']]);self.assertIn('HISTORY_CONFLICT',q['categories'])
 def test_overlapping_categories(self):
  self.run_build();a=self.obj();q=a.question(*next(a.rows(self.other,'en')))
  self.assertTrue({'SURFACE_ONLY_FAMILY','SENSE_IDENTITY_UNRESOLVED','HISTORY_CONFLICT','EVIDENCE_MISSING'}<=set(q['categories']))
 def test_source_commit_is_checked_not_just_recorded(self):
  self.run_build();b=bucket(self.fid);p=self.source/f'families/{b}.json.gz';x=json.loads(gzip.decompress(p.read_bytes()));x[self.fid]['canonical']='changed';self.put(f'families/{b}.json.gz',x)
  with self.assertRaisesRegex(ValueError,'pinned Git'):self.run_build()
 def test_incremental_rebuild_and_previous_question_ids(self):
  self.run_build();a=self.obj();before={q[0:3]:a.question(*q)['id'] for q in a.rows()};self.assertEqual(self.run_build()['benchmark']['reused'],len(self.buckets))
  b=bucket(self.fid);x=json.loads(gzip.decompress((self.source/f'families/{b}.json.gz').read_bytes()));x[self.fid]['note']='new source revision';self.put(f'families/{b}.json.gz',x);self.commit()
  r=self.run_build();self.assertEqual(r['benchmark']['reused'],len(self.buckets)-1);a2=self.obj();self.assertEqual(before,{q[0:3]:a2.question(*q)['id'] for q in a2.rows()})
 def test_hard_interruption_rollback_and_resume(self):
  cmd=[sys.executable,str(Path(__file__).with_name('build.py')),'--source',str(self.source),'--output',str(self.out),'--commit',self.commit_id,'--repo',str(self.repo),'--buckets',*self.buckets,'--crash-after','1']
  r=subprocess.run(cmd,capture_output=True);self.assertEqual(r.returncode,75);self.assertFalse((self.out/'MANIFEST.json').exists());r=self.run_build();self.assertEqual(sum(r['counts'][l] for l in LANGS),7)
 def test_corruption_fails_closed(self):
  self.run_build();m=read(self.out/'MANIFEST.json');(self.out/m['shards'][0]['database']).write_bytes(b'partial')
  with self.assertRaises(ValueError):Adapter(self.out)
 def test_full_independent_comparison(self):
  self.run_build();from associativvordes.v5_adapter.verify import verify
  r=verify(self.out);self.assertEqual(r['memberships'],7);self.assertTrue(r['every_source_and_projected_record_compared'])
 def test_cursor_no_loss_no_duplicate_and_review_compatibility(self):
  self.run_build();h,_=history_reader();a=self.obj(h.check);cursor=None;ids=[]
  for n in range(4):
   dest=self.base/f'q{n}';m=export(a,dest,limit=2,cursor=cursor);ids.extend(json.loads(l)['id'] for l in (dest/'questions.ndjson').read_bytes().splitlines());cursor=m['next_cursor']
   result=review_import(dest,self.base/f'ledger{n}');self.assertEqual(result['questions'],m['counts']['questions'])
   if not cursor:break
  self.assertEqual(len(ids),7);self.assertEqual(len(set(ids)),7);self.assertIsNone(cursor)
 def test_unknown_senses_are_not_copied_from_unverified_fields(self):
  self.run_build();a=self.obj();row=list(next(a.rows(self.fid,'en')));row[-1].update(pos='NOUN',sense='finance');q=a.question(*row);self.assertIsNone(q['pos']);self.assertEqual(q['sense_scope'],'unresolved')
 def test_casefold_does_not_merge_distinct_source_lemma_ids(self):
  self.assertNotEqual(qid(self.fid,'de','lemma:first'),qid(self.fid,'de','lemma:second'))
 def test_annotation_load_and_legacy_risk(self):
  self.run_build();h,_=history_reader();a=self.obj(h.check);queue=self.base/'q';export(a,queue,limit=6)
  from associativvordes.v5_adapter.queue_input import load_queue
  qs,identity=load_queue(queue,self.out)
  sys.path.insert(0,str(ROOT/'associativvordes/auto_annotation'));from associativvordes.auto_annotation.contract import card_for
  q=qs[0];c=card_for(q,q['lexeme_alternatives'][0],identity)
  self.assertIn('legacy_exact_record_is_not_a_reviewed_lexical_head',c['risk_flags']);self.assertEqual(c['legacy_scope']['family_id'],q['source_family_id'])
 def test_forged_sense_with_rehashed_queue_is_rejected(self):
  self.run_build();h,_=history_reader();a=self.obj(h.check);queue=self.base/'q';export(a,queue,limit=1)
  q=json.loads((queue/'questions.ndjson').read_bytes());q['lexeme_alternatives'][0]['verified_senses']=[dict(id='FAKE')]
  data=canonical(q)+b'\n';atomic(queue/'questions.ndjson',data);m=read(queue/'MANIFEST.json');m['outputs']['questions.ndjson']=sha(data);atomic(queue/'MANIFEST.json',canonical(m))
  from associativvordes.v5_adapter.queue_input import load_queue
  with self.assertRaisesRegex(ValueError,'differs'):load_queue(queue,self.out)

 def test_byte_budget_cursor_and_explicit_scope_fail_closed(self):
  self.run_build();a=self.obj();row=next(a.rows());size=len(canonical(a.question(*row)))+1
  m=export(a,self.base/'byteq',max_bytes=max(1024,size+100))
  self.assertIsNotNone(m['next_cursor']);self.assertEqual(m['counts']['questions'],1)
  keys=[list(r[:3]) for r in a.rows()]
  with self.assertRaisesRegex(ValueError,'byte budget'):export(a,self.base/'explicit',selections=keys,max_bytes=max(1024,size+100))
  self.assertFalse((self.base/'explicit'/'MANIFEST.json').exists())


 def test_4359323416_entire_question_is_locked(self):
  self.run_build();h,_=history_reader();a=self.obj(h.check)
  from associativvordes.v5_adapter.queue_input import load_queue
  for field in ['discovery_paths','prior_scoped_decisions','existing_memberships','unexpected']:
   queue=self.base/field;export(a,queue,limit=1);q=json.loads((queue/'questions.ndjson').read_bytes());q[field]=[dict(id='fabricated',evidence_refs=[dict(id='fake')])]
   data=canonical(q)+b'\n';atomic(queue/'questions.ndjson',data);m=read(queue/'MANIFEST.json');m['outputs']['questions.ndjson']=sha(data);atomic(queue/'MANIFEST.json',canonical(m))
   with self.assertRaisesRegex(ValueError,'differs'):load_queue(queue,self.out)
 def test_4359323422_external_manifest_identity(self):
  from associativvordes.v5_adapter.external import External
  lock=self.base/'lock.json';atomic(lock,canonical(dict(artifacts=[])));folder=self.base/'external';folder.mkdir()
  m=dict(identity=dict(source_lock_sha256=filehash(lock)),complete=True,parts=[],missing=[]);m['version']=sha(canonical(m));atomic(folder/'EXTERNAL.json',canonical(m));External(folder,lock)
  m['injected']='changed';atomic(folder/'EXTERNAL.json',canonical(m))
  with self.assertRaisesRegex(ValueError,'manifest'):External(folder,lock)
 def test_4359323435_invalid_rows_cannot_publish_current(self):
  self.run_build();a=self.obj();queue=self.base/'queue';export(a,queue,limit=1)
  m=read(queue/'MANIFEST.json');data=canonical({'injected':{}});atomic(queue/'source-rows.json',data);m['outputs']['source-rows.json']=sha(data);atomic(queue/'MANIFEST.json',canonical(m))
  ledger=self.base/'ledger'
  with self.assertRaises(ValueError):review_import(queue,ledger)
  self.assertFalse((ledger/'CURRENT').exists())
 def test_4359323448_wrong_bucket_rejected(self):
  fid='misplaced-family';b=next(b for b in self.buckets if bucket(fid)!=b);data=json.loads(gzip.decompress((self.source/f'families/{b}.json.gz').read_bytes()));data[fid]=dict(id=fid);self.put(f'families/{b}.json.gz',data);self.commit()
  with self.assertRaisesRegex(ValueError,'bucket'):self.run_build()

if __name__=='__main__':unittest.main()
