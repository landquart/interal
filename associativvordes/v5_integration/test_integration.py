"""TEST_ONLY native fixtures through the actual v5 -> release-gate modules."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import contextlib,copy,gzip,hashlib,io,json,os,sqlite3,subprocess,sys,tempfile,unittest
from pathlib import Path
from associativvordes.v5_contract.versions import ROOT,capture,validate,compatible,Blocked,digest,canonical,open_envelope
from associativvordes.v5_contract import policy
from associativvordes.v5_integration.pipeline import Pipeline

class IntegrationTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.t=tempfile.TemporaryDirectory();cls.base=Path(cls.t.name)
  sys.path[:0]=[str(ROOT/'associativvordes/v5_adapter'),str(ROOT/'associativvordes/importers'),str(ROOT/'associativvordes/evidence_graph')]
  from associativvordes.v5_adapter.external import build,External
  lock=ROOT/'associativvordes/importers/fixtures/source-lock.json'
  with contextlib.redirect_stdout(io.StringIO()):build(lock.parent,lock,cls.base/'external')
  cls.ext=External(cls.base/'external',lock)
 @classmethod
 def tearDownClass(cls):cls.t.cleanup()
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.w=Path(self.tmp.name)
  self.c=capture('TEST_ONLY-v5',dict(test_only=True,coverage_complete=True,constraints=[]))
 def native(self):
  from associativvordes.v5_adapter.common import bucket,LANGS
  from associativvordes.v5_adapter.build import build
  from associativvordes.v5_adapter.adapter import Adapter
  repo=self.w/'native';source=repo/'associativvordes/family-index-v5';fid='family:TEST_ONLY:manu'
  en=next(p for p in self.ext.parts if p['artifact']['language']=='eng')
  db=sqlite3.connect(self.base/'external'/en['database']);word=db.execute('SELECT word FROM words LIMIT 1').fetchone()[0];db.close()
  def put(name,data):
   p=source/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(gzip.compress(canonical(data),mtime=0))
  buckets=sorted({bucket(fid),bucket('manu')})
  for b in buckets:
   put(f'families/{b}.json.gz',{fid:dict(id=fid,canonical='manu',aliases=['manu'],source='methodology_seed')} if bucket(fid)==b else {})
   put(f'aliases/{b}.json.gz',{'manu':[fid]} if bucket('manu')==b else {})
   for lang in LANGS:
    words={'en':word,'fr':'manucure'};rows=[]
    if lang in words and b==bucket(fid):rows=[dict(lemma_id='lemma:'+digest([lang,words[lang]])[:20],word=words[lang],normalized=words[lang].lower(),components=[])]
    put(f'members/{lang}/{b}.json.gz',{fid:rows} if rows else {})
  subprocess.run(['git','init','-q',str(repo)],check=True);subprocess.run(['git','-C',str(repo),'add','.'],check=True)
  subprocess.run(['git','-C',str(repo),'-c','user.name=TEST_ONLY','-c','user.email=test@example.invalid','commit','-qm','TEST_ONLY native fixture'],check=True)
  rev=subprocess.check_output(['git','-C',str(repo),'rev-parse','HEAD'],text=True).strip()
  with contextlib.redirect_stdout(io.StringIO()):build(source,self.w/'projection',rev,repo,buckets=buckets)
  obj=Adapter(self.w/'projection',history=lambda p:dict(allowed=False,status='TEST_ONLY_UNRESOLVED_OBSERVATION'));self.addCleanup(obj.close)
  return obj
 def decision(self,q):
  scope=dict(family_id=q['source_family_id'],element_id='element:root:manu',language='fr',lemma_id=q['source_lemma_id'],lexeme_id=q['source_lemma_id'],sense_id='TEST_ONLY:hand',context_id='TEST_ONLY:manucure')
  source=json.loads((ROOT/'associativvordes/normative/sources.json').read_bytes())['sources']['manucure']
  e=dict(source,id='manucure',scope=copy.deepcopy(scope),polarity='supports',origin='dictionary');ids=['manucure']
  d=dict(schema_version='1.0.0',id='TEST_ONLY:manucure',element=dict(id='element:root:manu',kind='root',normative_form='manu',target_meaning='hand'),scope=scope,decision='CONFIRMED_MEMBER',evidence_status='documented',lexical_identity_status='resolved',sense_status='resolved',relation_status='supported',association_status='unknown',relation_type='compound_component',correspondence=dict(form='manu',scope=copy.deepcopy(scope),evidence_ids=ids,steps=[]),axis_evidence={k:[] if k=='association_status' else ids for k in ['evidence_status','lexical_identity_status','sense_status','relation_status','association_status']},evidence=[e],reason='TEST_ONLY independent scoped dictionary fixture',supersedes=[],provenance=dict(snapshot_sha256=self.c['baseline']['inventory_sha256'],source_lock_sha256=self.c['sources']['sha256'],algorithm_sha256=digest(self.c['algorithms']),policy_version=self.c['normative']['version'],origin='test_fixture'))
  trust=dict(verifiedEvidenceIds=ids,verifiedEvidenceDigests={'manucure':digest(e)},authorizedDecisionIds=[d['id']],authorizedDecisionDigests={d['id']:digest(d)})
  return d,trust
 def test_real_end_to_end_and_fail_closed_release(self):
  adapter=self.native();p=Pipeline(self.w/'work',self.c)
  projection=p.import_v5(adapter,external=self.ext,limit=10)
  evidence=p.evidence(projection,self.ext);self.assertGreater(evidence['payload']['counts']['records'],0)
  candidates=p.candidates(projection,evidence);self.assertEqual(len(candidates['payload']['questions']),2)
  review=p.review(projection,evidence,candidates)
  qs=[json.loads(x) for x in (Path(projection['payload']['queue'])/'questions.ndjson').read_text().splitlines()];q=next(q for q in qs if q['language']=='fr');d,trust=self.decision(q)
  item=dict(question_id=q['id'],expected_revision=0,status='ACCEPT_PROPOSED',lexeme_id=q['source_lemma_id'],relation='compound',reason='TEST_ONLY review proposal',normative_decision=d)
  event=p.decide(review,'a','reviewer',{'a':'reviewer','b':'blind'},'TEST_ONLY_request_01',[item]);self.assertFalse(event['payload']['transaction']['decisions'][0]['establishes_membership'])
  decision=p.decision(event,d,trust);self.assertEqual(decision['payload']['result']['decision'],'CONFIRMED_MEMBER')
  cid=next('TEST_ONLY:case:'+str(i) for i in range(20) if int(digest('TEST_ONLY:case:'+str(i))[:8],16)%10)
  case=dict(id=cid,family_id=q['source_family_id'],language='fr',lemma_id=q['source_lemma_id'],word=q['lemma'],lexeme_id=q['source_lemma_id'],sense_id=d['scope']['sense_id'],context_id=d['scope']['context_id'],pos='NOUN',protocol_sha256=digest('TEST_ONLY'),version_contract=self.c);case['content_sha256']=digest(case)
  roster={a:dict(kind='human',authorization_ref='TEST_ONLY owner-authorized fixture',qualified_languages=['fr'],roles=[role]) for a,role in [('a','A'),('b','B')]}
  answers=[dict(actor_id=a,role=role,action='independent_review',case_id=cid,case_sha256=case['content_sha256'],protocol_sha256=case['protocol_sha256'],blind_to_predictions=True,blind_to_other_review=True,verdict='VALID',reason='TEST_ONLY dictionary fixture',sources=[dict(locator='TEST_ONLY',finding='TEST_ONLY scoped morphology',publisher='TEST_ONLY')],reviewed_at='2026-10-25T00:00:00Z',relation='compound',pos='NOUN',sense='TEST_ONLY:hand',normative_decision=d) for a,role in [('a','A'),('b','B')]]
  wrong=copy.deepcopy(answers);wrong[0]['sense']='TEST_ONLY:foreign-sense'
  with self.assertRaises(ValueError):p.quality([case],wrong,[],roster,trust,[event,decision])
  quality=p.quality([case],answers,[],roster,trust,[event,decision]);self.assertEqual(quality['payload']['rows'][0]['gold'],'VALID');self.assertEqual(quality['payload']['production_human_gold'],0)
  from associativvordes.release_control.control import VERSION
  fid=q['source_family_id'];head='TEST_ONLY:head';state=dict(schema=VERSION,data=dict(catalog=dict(families=[dict(id=fid)]),heads=[dict(id=head,language='fr')],memberships=[],links=[]),history=[],version_contract=self.c)
  row=dict(family_id=fid,language='fr',lemma_id=q['source_lemma_id'],head_id=head,word=q['lemma'],relation='compound')
  op=dict(id='operation:TEST_ONLY:add',kind='ADD_MEMBER',question_id=q['id'],candidate_id=q['source_lemma_id'],before=None,after=row,evidence_refs=['manucure'],reason='TEST_ONLY exact finite addition',supersedes=[])
  preview=p.preview(state,[op],{op['id']:d},trust,[decision,quality]);gate=p.release_gate(preview);self.assertEqual(gate['payload']['status'],'BLOCKED');self.assertEqual(gate['payload']['production_writes'],0)
  # Namespace and schema forgery never reach the writer.
  forged=copy.deepcopy(preview);forged['version_contract']['namespace']='production'
  with self.assertRaises(Blocked):p.release_gate(forged)
  bad=copy.deepcopy(d);bad['scope']['lemma_id']='foreign'
  with self.assertRaises(Blocked):policy.decision(bad,self.c,trust,dict(lemma_id=q['source_lemma_id']),True)
  if os.environ.get('INTERAL_INTEGRATION_RECEIPT'):
   Path(os.environ['INTERAL_INTEGRATION_RECEIPT']).write_text(json.dumps(dict(status='PASS_TEST_ONLY',flow=['native_v5','adapter','evidence','candidates','review','decision','quality','preview','release_gate'],native_questions=2,graph_records=evidence['payload']['counts']['records'],gold_fixture_cases=1,production_human_gold=0,preview_operations=1,production_release='BLOCKED',production_writes=0,implementation=self.c),indent=2)+'\n')
 def test_incompatible_versions_and_unknown_legacy_are_blocked(self):
  validate(self.c)
  for key in ['git_commit','normative','baseline','history','schemas','sources','algorithms']:
   bad=copy.deepcopy(self.c);bad[key]='TEST_ONLY foreign version';bad['version']=digest({k:v for k,v in bad.items() if k!='version'})
   with self.assertRaises((Blocked,TypeError)):validate(bad)
  with self.assertRaises(Blocked):open_envelope(dict(schema='legacy'),self.c)
  with self.assertRaises(Blocked):capture('production')
 def test_namespace_cannot_change_an_existing_graph(self):
  from associativvordes.evidence_graph.graph import Graph
  path=self.w/'graph.sqlite';g=Graph(path,version_contract=self.c);g.commit();g.close();before=path.read_bytes()
  with self.assertRaises(Blocked):Graph(path)
  self.assertEqual(before,path.read_bytes())
 def test_real_history_is_not_overridden_by_fixture_namespace(self):
  current=capture('TEST_ONLY-v5')
  self.assertFalse(current['history']['coverage_complete'])
  op=dict(before=None,after=dict(family_id='family:TEST_ONLY:manu',language='fr',lemma_id='TEST_ONLY'))
  with self.assertRaisesRegex(Blocked,'historical coverage'):policy.history_gate([op],current)
  policy.history_gate([],current)
  op['after']['family_id']='family:manu'
  with self.assertRaisesRegex(Blocked,'production family'):policy.history_gate([op],self.c)
 def test_conflicting_decision_cannot_reuse_authorized_digests(self):
  q=dict(source_family_id='family:TEST_ONLY:manu',source_lemma_id='TEST_ONLY:lemma')
  d,trust=self.decision(q);self.assertEqual(policy.decision(d,self.c,trust,confirmed=True)['decision'],'CONFIRMED_MEMBER')
  d['scope']['context_id']='TEST_ONLY:foreign-context'
  with self.assertRaises(Blocked):policy.decision(d,self.c,trust,confirmed=True)
 def test_unversioned_existing_candidate_database_is_not_converted(self):
  from associativvordes.candidate_search.search import Queue
  path=self.w/'legacy.sqlite';q=Queue(path);q.upsert(dict(family='family:TEST_ONLY:manu',language='fr',lemma='manucure',pos=None),'TEST_ONLY');q.db.commit();q.close();before=path.read_bytes()
  with self.assertRaises(Blocked):Queue(path,version_contract=self.c)
  self.assertEqual(before,path.read_bytes())
 def test_all_components_import_in_both_orders_without_flat_module_aliases(self):
  modules=['v5_baseline.census','history_registry.registry','v5_adapter.bridge','v5_diagnostics.run','structural_cleanup.workflow','surface_cleanup.run','morphology_cleanup.run','morphology_review.run','national_correspondences.registry','semantic_cleanup.bridge','family_boundary.build','cleanup_quality.evaluate','full_v5_dry_run.census','release_control.workflow','v5_release_control.package','evidence_graph.build_graph','candidate_search.search','review.server','auto_annotation.pipeline']
  for order in [modules,list(reversed(modules))]:
   code='import importlib,sys,json; modules=json.loads(sys.argv[1]); [importlib.import_module("associativvordes."+m) for m in modules]; assert not set(["common","policy","registry","graph","store"]) & set(sys.modules)'
   r=subprocess.run([sys.executable,'-c',code,json.dumps(order)],cwd=ROOT,capture_output=True,text=True)
   self.assertEqual(r.returncode,0,r.stderr)
 def test_installed_baseline_executes_current_file_without_git_show(self):
  import importlib.util
  path=ROOT/'associativvordes/structural_cleanup/common.py';spec=importlib.util.spec_from_file_location('TEST_ONLY_structural_common',path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  tool=m.pinned_baseline(ROOT,self.w);self.assertEqual(Path(tool.__file__),ROOT/'associativvordes/v5_baseline/census.py')

if __name__=='__main__':unittest.main()
