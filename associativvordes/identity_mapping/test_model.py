import copy,tempfile,unittest
from pathlib import Path
from .model import *
from associativvordes.v5_contract.versions import capture,Blocked
from associativvordes.v5_contract.policy import decision
from associativvordes.v5_integration import test_integration as fixtures
class IdentityTests(unittest.TestCase):
 def setUp(self):
  self.origin=dict(language='fr',family_id='TEST_ONLY',lemma_id='legacy:one',record_sha256='a'*64)
  self.target=dict(language='fr',source='dictionary-A',source_version='locked-a',lemma='sens',pos='NOUN',lexical_identity='source:a',sense='sense:one',context='use:one')
  self.p=dict(origin=self.origin,target=self.target,status='SUPPORTED_MAPPING',evidence_refs=['exact-source-evidence'])
 def receipt(self,h):return dict(payload_sha256=h,authority='INDEPENDENT_GOLD',status='APPROVED')
 def test_spelling_alone_never_confirms_single_candidate(self):self.assertEqual(adjudicate(self.origin,[self.target])['status'],'UNRESOLVED')
 def test_all_homonyms_retained(self):
  b=dict(self.target,sense='other');r=adjudicate(self.origin,[self.target,b]);self.assertEqual(r['status'],'MULTIPLE_POSSIBLE_IDENTITIES');self.assertEqual(len(r['alternatives']),2)
 def test_no_candidates_not_rejection(self):self.assertEqual(adjudicate(self.origin,[])['status'],'UNRESOLVED')
 def test_cross_source_needs_reviewed_mapping(self):
  self.assertEqual(adjudicate(self.origin,[self.target],self.p)['status'],'UNRESOLVED');self.assertEqual(adjudicate(self.origin,[self.target],self.p,self.receipt)['status'],'SUPPORTED_MAPPING')
 def test_exact_native_identity_requires_source_identity(self):
  p=dict(self.p,status='EXACT_IDENTITY');self.assertEqual(adjudicate(self.origin,[self.target],p,self.receipt)['status'],'UNRESOLVED')
  o=dict(self.origin,declared_native_identity=self.target);p=dict(p,origin=o);self.assertEqual(adjudicate(o,[self.target],p,self.receipt)['status'],'EXACT_IDENTITY')
 def test_unknown_pos_sense_context_cannot_be_guessed(self):
  for field in ['pos','sense','context','lexical_identity']:
   p=copy.deepcopy(self.p);p['target'][field]=None;self.assertNotIn(adjudicate(self.origin,[p['target']],p,self.receipt)['status'],STRONG)
 def test_reviewed_incompatible_mapping_is_not_a_delete(self):
  r=adjudicate(self.origin,[self.target],dict(self.p,status='INCOMPATIBLE'),self.receipt);self.assertEqual(r['status'],'INCOMPATIBLE');self.assertFalse(r['operation_authorized'])
 def test_reused_receipt_cannot_rebind_sense_or_source(self):
  h=digest(self.p);verify=lambda x:self.receipt(h) if x==h else None
  for field in ['sense','source','source_version','context','pos']:
   p=copy.deepcopy(self.p);p['target'][field]='changed';self.assertNotIn(adjudicate(self.origin,[p['target']],p,verify)['status'],STRONG)
 def test_normalized_identity_keeps_homonyms_sources_and_contexts_separate(self):
  for field in ['pos','lexical_identity','sense','source','source_version','context']:
   self.assertNotEqual(entity_id(self.target),entity_id(dict(self.target,**{field:'different'})))
 def test_corpus_binding_gate_is_mandatory(self):
  self.c=capture('TEST_ONLY-v5',dict(test_only=True,coverage_complete=True,constraints=[]));d,trust=fixtures.IntegrationTests.decision(self,dict(source_family_id='family:TEST_ONLY:manu',source_lemma_id='TEST_ONLY:lemma'))
  self.assertEqual(decision(d,self.c,trust,confirmed=True)['decision'],'CONFIRMED_MEMBER')
  for field in ['verifiedLexicalMappings','verifiedLexicalMappingDigests']:
   bad=copy.deepcopy(trust);bad.pop(field)
   with self.assertRaisesRegex(Blocked,'mapping required'):decision(d,self.c,bad,confirmed=True)
  bad=copy.deepcopy(trust);row=bad['verifiedLexicalMappings'][d['id']];row['target']['sense']='another';bad['verifiedLexicalMappingDigests'][d['id']]=digest(row)
  with self.assertRaisesRegex(Blocked,'mismatch'):decision(d,self.c,bad,confirmed=True)
if __name__=='__main__':unittest.main()
