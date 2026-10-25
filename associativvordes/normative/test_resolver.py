"""Real installed JS resolver through semantic admission, without production data."""
import copy,tempfile,unittest
from pathlib import Path
from associativvordes.v5_contract.versions import capture,Blocked
from associativvordes.v5_contract import policy
from associativvordes.v5_integration import test_integration as fixtures
from associativvordes.semantic_cleanup import policy as semantic
from associativvordes.normative.resolver import observe
class ResolverAdmission(unittest.TestCase):
 def setUp(self):
  self.c=capture('TEST_ONLY-v5',dict(test_only=True,coverage_complete=True,constraints=[]))
  self.q=dict(source_family_id='family:TEST_ONLY:manu',source_lemma_id='TEST_ONLY:lemma:manucure')
  self.d,self.trust=fixtures.IntegrationTests.decision(self,self.q)
  scope=dict(family_id=self.q['source_family_id'],language='fr',lemma_id=self.q['source_lemma_id'],word='manucure',source_version='TEST_ONLY:corpus')
  sense=dict(id='TEST_ONLY:dictionary-sense',language='fr',lemma='manucure',pos='NOUN',publisher_sense_locator='TEST_ONLY:dictionary:hand',source_refs=['TEST_ONLY:dictionary'])
  self.case=dict(id=semantic.case_id(scope,sense['id']),scope=scope,dictionary_sense=sense,corpus_binding=dict(scope,dictionary_sense_id=sense['id'],pos='NOUN',corpus_lexeme_id=self.d['scope']['lexeme_id'],corpus_sense_id=self.d['scope']['sense_id'],context_id=self.d['scope']['context_id']),all_alternative_paths_reviewed=True,family_target_meaning_ref='TEST_ONLY:hand',production_application_authorized=False,normative_decision=self.d)
  self.context=dict(version_contract=self.c,trust=self.trust)
 def adjudicate(self,case=None,context=None):
  clear=lambda c:dict(allowed=True,status='CLEAR')
  verifier=lambda h:dict(authority='INDEPENDENT_GOLD',payload_sha256=h,status='APPROVED')
  return semantic.adjudicate(case or self.case,'MEMBERSHIP_CONFIRMED',verifier,clear,normative_context=context)
 def test_receipt_alone_cannot_admit_membership(self):self.assertEqual(self.adjudicate()['status'],'INSUFFICIENT_EVIDENCE')
 def test_exact_normative_semantic_admission(self):
  r=self.adjudicate(context=self.context);self.assertEqual(r['status'],'MEMBERSHIP_CONFIRMED');self.assertEqual(r['normative_evaluation']['decision'],'CONFIRMED_MEMBER');self.assertFalse(r['production_application_authorized'])
 def test_altered_native_sense_cannot_reuse_receipt(self):
  c=copy.deepcopy(self.case);c['corpus_binding']['corpus_sense_id']='other';self.assertEqual(self.adjudicate(c,self.context)['status'],'INSUFFICIENT_EVIDENCE')
 def test_untrusted_self_authorization_is_ignored(self):
  c=copy.deepcopy(self.case);c['normative_context']=self.context;self.assertEqual(self.adjudicate(c)['status'],'INSUFFICIENT_EVIDENCE')
 def test_stale_decision_source_lock_blocked(self):
  d=copy.deepcopy(self.d);d['provenance']['source_lock_sha256']='0'*64
  with self.assertRaisesRegex(Blocked,'provenance'):policy.decision(d,self.c,self.trust,confirmed=True)
 def test_test_namespace_cannot_certify_production(self):
  d=copy.deepcopy(self.d);d['scope']['family_id']='family:manu'
  with self.assertRaisesRegex(Blocked,'production family'):policy.decision(d,self.c,self.trust,confirmed=True)
 def test_no_contract_nonempty_preview_is_blocked(self):
  from associativvordes.release_control.control import preview
  with self.assertRaisesRegex(ValueError,'normative version contract'):preview({},[dict(id='test')],{})
 def test_no_contract_verdict_cannot_enter_graph(self):
  from associativvordes.evidence_graph.graph import Graph,envelope,IntegrityConflict
  g=Graph();self.addCleanup(g.close)
  with self.assertRaisesRegex(IntegrityConflict,'normative decision stage'):g.put(envelope('Verdict','test',dict(subject=dict(domain='membership'))))
 def test_approved_registry_revalidates_on_read_and_write(self):
  from associativvordes.v5_contract.approved import ApprovedRegistry
  from associativvordes.v5_contract.versions import digest,canonical
  with tempfile.TemporaryDirectory() as t:
   registry=ApprovedRegistry(t,self.c);r=registry.approve(self.d,self.trust);self.assertEqual(registry.read(r['sha256'],self.trust),r);self.assertEqual(registry.approve(self.d,self.trust),r)
   forged=copy.deepcopy(r);forged['decision']['reason']='different unapproved claim';forged['sha256']=digest({k:v for k,v in forged.items() if k!='sha256'});Path(t,forged['sha256']+'.json').write_bytes(canonical(forged))
   with self.assertRaises(Blocked):registry.read(forged['sha256'],self.trust)
 def test_generic_publish_cannot_inject_approved_decision(self):
  from associativvordes.v5_integration.pipeline import Pipeline
  with tempfile.TemporaryDirectory() as t:
   pipeline=Pipeline(t,self.c)
   with self.assertRaisesRegex(Blocked,'external normative trust'):pipeline.publish('decision',dict(decision=self.d,result=dict(decision='CONFIRMED_MEMBER')))
 def test_observation_does_not_create_metrics_or_member(self):
  r=observe('TEST_ONLY');self.assertFalse(r['establishes_membership']);self.assertEqual(r['membership'],'UNRESOLVED');self.assertEqual(r['association_status'],'unknown');self.assertNotIn('A',r)
if __name__=='__main__':unittest.main()
