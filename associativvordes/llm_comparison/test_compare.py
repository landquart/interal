"""Synthetic TEST_ONLY engineering cases; never model receipts or human gold."""
import unittest
from .compare import (digest, prompt, metrics, validate_splits, stratified,
                      hybrid_decision, proportion)


class ComparisonTests(unittest.TestCase):
    def test_false_exclusion_and_abstention_denominators(self):
        g = [{'id':str(i), 'label':v} for i,v in enumerate(
            ['INCLUDE','INCLUDE','INCLUDE','EXCLUDE','EXCLUDE','UNCERTAIN'])]
        p = [{'id':str(i), 'decision':v} for i,v in enumerate(
            ['INCLUDE','EXCLUDE','ABSTAIN','EXCLUDE','INCLUDE','ABSTAIN'])]
        m = metrics(g,p)
        self.assertEqual(m['confirmation_precision']['value'], .5)
        self.assertEqual(m['negative_precision']['value'], .5)
        self.assertEqual(m['dangerous_false_exclusion_rate']['value'], 1/3)
        self.assertEqual(m['membership_recall_including_abstentions']['value'], 1/3)
        self.assertEqual(m['abstain_fraction']['value'], 1/3)

    def test_missing_and_duplicate_predictions_rejected(self):
        g = [{'id':'a','label':'INCLUDE'}]
        for p in ([], [{'id':'a','decision':'ABSTAIN'}]*2):
            with self.assertRaises(ValueError): metrics(g,p)

    def test_unknown_metrics_are_null(self):
        self.assertIsNone(metrics([],[])['confirmation_precision']['value'])
        self.assertIsNone(proportion(0,0)['wilson95'])
        self.assertLess(proportion(100,100)['wilson95'][0],1)

    def test_group_leakage_and_missing_splits(self):
        c = [{'id':str(i),'split':s,'leakage_keys':[str(i)]} for i,s in
             enumerate(['calibration','development','holdout'])]
        self.assertEqual(validate_splits(c)['holdout'],1)
        c[2]['leakage_keys']=['0']
        with self.assertRaises(ValueError): validate_splits(c)
        with self.assertRaises(ValueError): validate_splits([])

    def test_blind_projection_and_exact_approval(self):
        q = {k:'TEST_ONLY' for k in ('id','language','lemma','pos','target_meaning',
             'root','national_correspondence','evidence','graph','rules','alternatives')}
        baseline = prompt(q,'baseline',{digest(q)})['messages'][1]['content']
        self.assertNotIn('evidence',baseline)
        graph = prompt(q,'graph',{digest(q)})['messages'][1]['content']
        self.assertIn('graph',graph)
        self.assertNotIn('alternatives',graph)
        with self.assertRaises(ValueError): prompt(dict(q,gold='INCLUDE'),'baseline',set())
        with self.assertRaises(ValueError): prompt(dict(q,lemma='changed'),'baseline',{digest(q)})
        with self.assertRaises(ValueError): prompt(dict(q,evidence={'gold':'yes'}),'evidence',set())

    def test_high_risk_abstains(self):
        self.assertEqual(hybrid_decision({'decision':'EXCLUDE'},['allomorph'],True),'ABSTAIN')
        self.assertEqual(hybrid_decision({'decision':'INCLUDE'},[],False),'ABSTAIN')

    def test_empty_named_strata_preserved(self):
        m = stratified([],[], 'root',['manu','regul','creat'])
        self.assertEqual(set(m),{'manu','regul','creat'})
        self.assertIsNone(m['regul']['negative_precision']['value'])


if __name__ == '__main__': unittest.main()
