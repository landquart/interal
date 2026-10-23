"""Independent regression examples: formal strings never decide lexical membership."""
import unittest
from policy import *

class PolicyTests(unittest.TestCase):
    def family(self,base='tion',source='surface_singleton',n=50):return dict(id='surface:en:'+base,canonical=base,source=source,support=n)
    def test_endings_are_candidates_not_rejections(self):
        for base in ('are','tion','skij','ten'):
            f=self.family(base);r=decide(f,signals(f,{f['id']}),{'compound_morphology'})
            self.assertEqual(r['operation'],'INSUFFICIENT_EVIDENCE');self.assertFalse(r['automatic_exclusion'])
    def test_short_real_roots_preserved(self):
        for base in ('art','sun','sea','oc'):
            f=self.family(base);self.assertFalse(decide(f,signals(f,set()),{'morphological_parse'})['automatic_exclusion'])
    def test_productive_suffix_is_not_invalidated(self):
        f=self.family('mente');r=decide(f,signals(f,{f['id']}),{'derivation'})
        self.assertEqual(r['operation'],'RETAIN_WITH_REVIEW')
    def test_historical_allomorphs_preserved(self):
        for root,form in [('manu','mani'),('regul','regl'),('creat','crea'),('ocul','occh')]:
            f=self.family(root,'wiktionary_non_proto_etymology');r=decide(f,['SHORT_FRAGMENT_EXPOSURE'],{'direct_allomorph'})
            self.assertEqual(r['operation'],'RETAIN_WITH_REVIEW');self.assertEqual(r['historical_correspondences'],'UNKNOWN_NOT_DISPROVED')
    def test_real_compound_claim_not_false_by_default(self):
        f=self.family('sky');r=decide(f,signals(f,set()),{'compound_morphology'})
        self.assertFalse(r['automatic_exclusion'])
    def test_borrowed_component_preserved(self):
        r=decide(self.family('bio','borrowing_family'),['SHORT_FRAGMENT_EXPOSURE'],{'borrowed_form'})
        self.assertEqual(r['operation'],'RETAIN_WITH_REVIEW')
    def test_missing_path_is_not_negative_proof(self):
        self.assertEqual(decide(self.family(),['CONFIGURED_TAIL_EXPOSURE'],set())['independent_morphological_paths'],'UNKNOWN_NOT_DISPROVED')
    def test_old_decision_not_transferred_by_spelling(self):
        self.assertEqual(decide(self.family('ten'),['CONFIGURED_TAIL_EXPOSURE'],set())['history_decision_ids'],[])
    def test_positive_history_is_preserved(self):
        self.assertEqual(decide(self.family(),['CONFIGURED_TAIL_EXPOSURE'],set(),['exact-positive'])['operation'],'RETAIN_WITH_REVIEW')
    def test_confidence_cannot_authorize(self):
        self.assertFalse(authorize('REJECT_ENTIRE_FAMILY',['a','b'],['a','b'],{'confidence':1},{'allowed':True,'status':'CLEAR'}))
    def test_small_sample_never_covers_full_family(self):
        self.assertFalse(authorize('REJECT_ENTIRE_FAMILY',['a','b'],['a'],{},dict(allowed=True,status='CLEAR')))
    def test_all_boolean_claims_still_need_real_verifier(self):
        p=dict(verified_existing_review_receipt=True,authority='INDEPENDENT_GOLD',independent_source_adapter_verified=True,
            all_native_identity_and_sense_bindings_verified=True,all_competing_paths_adjudicated=True,negative_scope_sha256=scope_hash(['a']),source_version_matches=True)
        self.assertFalse(authorize('REMOVE_EXACT_MEMBERSHIPS',['a'],['a'],p,dict(allowed=True,status='CLEAR')))
    def test_negative_history_cannot_enable_unavailable_history(self):
        self.assertFalse(authorize('REMOVE_EXACT_MEMBERSHIPS',['a'],['a'],{},dict(allowed=False,status='HISTORY_UNAVAILABLE'),lambda p:True))
    def test_equal_sets_hash_order_independent(self):self.assertEqual(scope_hash([['en','a'],['ru','b']]),scope_hash([['ru','b'],['en','a']]))
    def test_sense_specific_scopes_not_merged(self):self.assertNotEqual(scope_hash([['en','id','sense-a']]),scope_hash([['en','id','sense-b']]))
    def test_unknown_operation_rejected(self):
        with self.assertRaises(ValueError):authorize('DELETE_SOURCE_LEMMA',['a'],['a'],{}, {})

if __name__=='__main__':unittest.main()
