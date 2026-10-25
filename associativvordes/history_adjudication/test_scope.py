import copy,hashlib,json,tempfile,unittest
from pathlib import Path
from types import SimpleNamespace
from .query import explain
class ScopedQuery(unittest.TestCase):
 def setUp(self):
  self.t=tempfile.TemporaryDirectory();self.addCleanup(self.t.cleanup);self.p=Path(self.t.name)/'registry.json'
  self.d=dict(id='old',scope=dict(domain='membership',family_id='family:A',language='en',lemma_ids=['native:A'],sense_id='river'),operation='removed',authority='ENGINEERING_CHECK',historical_outcome='CONFIRMED_NONMEMBER',source={'blob':'source'},data_version='old-corpus',supersedes=[])
  self.h=SimpleNamespace(digest='old',decisions=[self.d],snapshot=dict(conflicts=[]),ids=lambda d:set(d['scope']['lemma_ids']))
  self.r=dict(schema='interal-history-adjudication/1',source_snapshot_sha256='old',coverage=dict(mutation_authorization=False),previous_constraints=[dict(original_decision=self.d)],conflict_resolution_ledger=[])
  self.proposal=dict(operation='restore',family_id='family:A',language='en',lemma_ids=['native:A'],sense_id='river',data_version='current-corpus')
 def run_query(self,p=None):
  raw=json.dumps(self.r).encode();self.p.write_bytes(raw);return explain(self.p,hashlib.sha256(raw).hexdigest(),self.h,p or self.proposal)
 def test_removed_record_never_automatically_restored(self):
  r=self.run_query();self.assertFalse(r['allowed']);self.assertEqual(r['applicable_prior_decisions'][0]['id'],'old')
 def test_same_spelling_different_native_identity(self):self.assertEqual(self.run_query(dict(self.proposal,lemma_ids=['native:B'],word='same'))['applicable_prior_decisions'],[])
 def test_different_family_and_language_do_not_expand_scope(self):
  self.assertFalse(self.run_query(dict(self.proposal,family_id='family:B'))['applicable_prior_decisions']);self.assertFalse(self.run_query(dict(self.proposal,language='de'))['applicable_prior_decisions'])
 def test_distinct_known_sense(self):self.assertFalse(self.run_query(dict(self.proposal,sense_id='finance'))['applicable_prior_decisions'])
 def test_missing_sense_still_intersects(self):
  p=dict(self.proposal);p.pop('sense_id');self.assertTrue(self.run_query(p)['applicable_prior_decisions'])
 def test_newer_opposite_claim_does_not_erase_old(self):
  other=copy.deepcopy(self.d);other.update(id='new',historical_outcome='CONFIRMED_MEMBER',data_version='newer-corpus');self.h.decisions.append(other);self.r['previous_constraints'].append(dict(original_decision=other));r=self.run_query();self.assertEqual(len(r['applicable_prior_decisions']),2);self.assertFalse(r['allowed'])
 def test_omitted_old_restriction_is_rejected(self):
  self.r['previous_constraints']=[]
  with self.assertRaisesRegex(ValueError,'omitted'):self.run_query()
 def test_rehashed_scope_change_rejected(self):
  self.r['previous_constraints']=copy.deepcopy(self.r['previous_constraints']);self.r['previous_constraints'][0]['original_decision']['scope']['family_id']='other'
  with self.assertRaisesRegex(ValueError,'scope or authority'):self.run_query()
 def test_quarantine_applies_only_to_potential_family(self):
  self.h.snapshot['conflicts']=[dict(source='s')];self.r['conflict_resolution_ledger']=[dict(id='q',source=dict(blob='s'),resolution='QUARANTINED_UNRESOLVED',scope=dict(kind='SOURCE_INDEXED_POTENTIAL',explicit_family_ids=['family:A'],explicit_languages=['en'],unbound_quarantined_observations=0))]
  self.assertEqual(len(self.run_query()['applicable_quarantines']),1);self.assertEqual(self.run_query(dict(self.proposal,family_id='family:B'))['applicable_quarantines'],[])
 def test_unobservable_source_retains_global_potential_hold(self):
  self.h.snapshot['conflicts']=[dict(source='s')];self.r['conflict_resolution_ledger']=[dict(id='q',source=dict(blob='s'),resolution='QUARANTINED_UNRESOLVED',scope=dict(kind='GLOBAL_UNKNOWN_POTENTIAL'))];self.assertEqual(len(self.run_query(dict(self.proposal,family_id='family:B'))['applicable_quarantines']),1)
 def test_same_identity_record_update_is_retained(self):
  self.r['record_update_safeguards']=[dict(id='row-update',scope=dict(domain='membership',family_id='family:A',language='en',lemma_ids=['native:A']))]
  self.assertEqual([x['id'] for x in self.run_query()['applicable_prior_decisions']],['old','row-update'])
  self.assertEqual(self.run_query(dict(self.proposal,lemma_ids=['other']))['applicable_prior_decisions'],[])
 def test_missing_corpus_and_merge_fail(self):
  p=dict(self.proposal);p.pop('data_version')
  with self.assertRaisesRegex(ValueError,'corpus version'):self.run_query(p)
  with self.assertRaisesRegex(ValueError,'source/destination'):self.run_query(dict(self.proposal,operation='merge'))
if __name__=='__main__':unittest.main()
