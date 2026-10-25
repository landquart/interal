"""Real pinned probes; mutations below are explicitly adversarial tests, not corpus data."""
if not __package__:
    import sys as _bootstrap_sys
    from pathlib import Path as _BootstrapPath
    _bootstrap_sys.path.insert(0,str(next(p for p in _BootstrapPath(__file__).resolve().parents if p.name=='associativvordes').parent))
import copy
import json
from pathlib import Path
import tempfile
import unittest
from associativvordes.candidate_search.search import Graph,Queue,build,collect,reverse,priority,DEFAULT_WEIGHTS,match_real_lexeme,lookup,canonical,sha,frequency_index,enqueue_reverse
from associativvordes.evidence_graph.records import read_json
from associativvordes.evidence_graph.build_graph import load_registry,ingest

HERE=Path(__file__).parent

class SearchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.g=Graph();load_registry(cls.g,read_json(HERE/'fixtures/v6.json.gz'))
        cls.ingested=ingest(cls.g,HERE/'fixtures/records.ndjson',read_json(HERE.parents[1]/'data/morphology-evidence/sources/source-lock.json'))
        cls.f=json.loads((HERE/'fixtures/frequencies.json').read_text());cls.families=['OCUL','PEDE','ALTER','REGUL','CREAT','NAT','INTER']
    @classmethod
    def tearDownClass(cls):cls.g.close()
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name);self.q=Queue(self.path/'queue.sqlite')
    def tearDown(self):self.q.close();self.tmp.cleanup()
    def seed(self):
        summary=build(self.g,self.q,self.families,self.f);rows=list(self.q.rows());self.assertTrue(rows);return rows,summary
    def test_real_parsing_provenance_and_bounded_paths(self):
        rows,s=self.seed();self.assertGreater(self.ingested['records'],10)
        self.assertTrue(all(not x['establishes_membership'] for x in rows))
        for x in rows:
            self.assertTrue(x['discovery_paths']);self.assertTrue(x['evidence_refs'])
            for e in x['evidence_refs']:self.g.resolve(e)
            for p in x['discovery_paths']:
                self.assertLessEqual(len(p['steps']),2)
                self.assertTrue(all(s['type']!='inflection' for s in p['steps']))
        self.assertEqual(len({r['id'] for r in rows}),len(rows))
    def test_repeat_import_does_not_change_output_or_review(self):
        self.seed();self.q.export(self.path/'a');s=build(self.g,self.q,self.families,self.f);self.q.export(self.path/'b')
        self.assertEqual((self.path/'a').read_bytes(),(self.path/'b').read_bytes());self.assertEqual(sum(x['changed'] for x in s.values()),0)
    def test_rejected_state_survives_reopen_and_evidence_change(self):
        rows,_=self.seed();r=rows[0];self.q.decide(r['id'],'rejected','test-only explicit decision','test reviewer');self.q.close();self.q=Queue(self.path/'queue.sqlite')
        build(self.g,self.q,self.families,self.f);current=next(x for x in self.q.rows() if x['id']==r['id']);self.assertEqual(current['review_state'],'rejected');self.assertFalse(current['evidence_changed_since_review'])
        body=json.loads(self.q.db.execute('SELECT body FROM questions WHERE id=?',(r['id'],)).fetchone()[0]);body['uncertainty_reasons'].append('test-only changed evidence')
        self.q.upsert(body,r['family']);updated=next(x for x in self.q.rows() if x['id']==r['id']);self.assertEqual(updated['review_state'],'rejected');self.assertTrue(updated['evidence_changed_since_review']);self.assertEqual(len(updated['previous_decisions']),1)
    def test_pos_change_cannot_hide_rejection(self):
        rows,_=self.seed();r=rows[0];self.q.decide(r['id'],'rejected','test prohibition','test reviewer')
        body=json.loads(self.q.db.execute('SELECT body FROM questions WHERE id=?',(r['id'],)).fetchone()[0]);body['pos']='test-only-new-pos';cid,_=self.q.upsert(body,r['family'])
        inherited=next(x for x in self.q.rows() if x['id']==cid);self.assertEqual(inherited['review_state'],'rejected');self.assertTrue(inherited['previous_decisions'])
    def test_reviewed_preserved_and_unrelated_question_unchanged(self):
        rows,_=self.seed();a,b=rows[:2];self.q.decide(a['id'],'reviewed','test completed review, no membership grant','test reviewer')
        body=json.loads(self.q.db.execute('SELECT body FROM questions WHERE id=?',(b['id'],)).fetchone()[0]);body['uncertainty_reasons'].append('test-only delta');self.q.upsert(body,b['family'])
        aa=next(x for x in self.q.rows() if x['id']==a['id']);self.assertEqual(aa['review_state'],'reviewed');self.assertEqual(aa['input_fingerprint'],a['input_fingerprint'])
    def test_scope_rebuild_retains_inactive_history(self):
        rows,_=self.seed();r=rows[0];self.q.decide(r['id'],'split_required','test-only split question','test reviewer')
        self.q.db.execute('DELETE FROM scopes WHERE candidate=?',(r['id'],));self.q.db.commit();self.q.export(self.path/'export')
        x=next(x for x in self.q.rows() if x['id']==r['id']);self.assertEqual(x['review_state'],'split_required');self.assertTrue(x['previous_decisions']);self.assertEqual(x['active_scopes'],[])
    def test_priority_is_configurable_separate_and_missing_impact_explicit(self):
        rows,_=self.seed();r=rows[0];self.assertTrue(r['priority']['experimental']);self.assertFalse(r['priority']['methodology_score']);features=r['priority']['components']
        w=dict(DEFAULT_WEIGHTS);w['frequency']=100;features=dict(features,frequency=6)
        self.assertGreater(priority(features,w)['score'],priority(features)['score']);self.assertEqual(features['model_impact'],0)
        with self.assertRaises(ValueError):priority(features,{'frequency':1})
    def test_real_frequency_is_preserved_and_tamper_rejected(self):
        self.assertTrue(frequency_index(self.f))
        for f in self.f:self.assertEqual(sha(f['record_json']),f['record_sha256']);self.assertTrue(json.loads(f['record_json'])['sources'])
        f=copy.deepcopy(self.f);f[0]['record_json']+=' '
        with self.assertRaises(ValueError):frequency_index(f)
    def test_reverse_uses_real_observed_lexemes_only(self):
        results=reverse(self.g,self.f)
        for r in results:
            self.g.resolve(r['lexeme_ref']);self.g.resolve(r['proposed_base']);self.g.resolve(r['relation_ref']);self.assertFalse(r['creates_canonical_root'])
        with self.assertRaises(ValueError):reverse(self.g,self.f,101)
    def test_no_known_or_prohibited_spelling_in_new_queue(self):
        rows,_=self.seed()
        for x in rows:
            guard=self.g.guard(x['family'],x['language'],x['lemma']);self.assertNotIn(guard['status'],{'blocked','hold'});self.assertFalse(guard.get('known_records'))
    def test_finite_matching_no_language_or_new_allomorph_grant(self):
        rows,_=self.seed();x=rows[0];lid=x['lexeme_alternatives'][0]['id']
        self.assertEqual(match_real_lexeme(self.g,lid,x['family'],x['language'],x['lemma'])['kind'],'exact')
        self.assertEqual(match_real_lexeme(self.g,lid,x['family'],'zz',x['lemma'])['kind'],'no_match')
        self.assertFalse(match_real_lexeme(self.g,lid,x['family'],x['language'],x['lemma']+'x',proposed=True)['establishes_membership'])
        self.assertNotEqual(lookup('ока'),lookup('oka'));self.assertEqual(lookup('e\u0301'),lookup('é'));self.assertNotEqual(lookup('é'),lookup('e'))
    def test_actual_finite_allomorph_rule_does_not_generalize(self):
        lid=self.g.db.execute("SELECT id FROM lexemes WHERE language='fr' AND search='régulier' ORDER BY id LIMIT 1").fetchone()[0]
        result=match_real_lexeme(self.g,lid,'REGUL','fr','régul','lemma:c8d358461e538d46315e')
        self.assertEqual(result['kind'],'allowed_allomorph');self.assertFalse(result['establishes_membership'])
        self.assertNotEqual(match_real_lexeme(self.g,lid,'REGUL','fr','régul','lemma:test-only-wrong-scope')['kind'],'allowed_allomorph')
    def test_reverse_queue_preserves_negative_history(self):
        hits=enqueue_reverse(self.g,self.q,self.f);self.assertTrue(hits);rows=list(self.q.rows());self.assertTrue(rows)
        cid=rows[0]['id'];self.q.decide(cid,'rejected','test reverse-base refusal','test reviewer')
        enqueue_reverse(self.g,self.q,self.f)
        self.assertEqual(next(x for x in self.q.rows() if x['id']==cid)['review_state'],'rejected')
        self.assertTrue(all(x['family']=='unassigned' and not x['creates_canonical_root'] for x in self.q.rows()))
    def test_no_accepted_review_state(self):
        rows,_=self.seed()
        with self.assertRaises(ValueError):self.q.decide(rows[0]['id'],'accepted','test','test')
    def test_existing_pos_alternative_inherits_later_negative(self):
        rows,_=self.seed();r=rows[0]
        body=json.loads(self.q.db.execute('SELECT body FROM questions WHERE id=?',(r['id'],)).fetchone()[0]);body['pos']='test-other-pos';other,_=self.q.upsert(body,r['family'])
        self.q.decide(r['id'],'rejected','test explicit refusal','test reviewer');self.q.upsert(body,r['family'])
        self.assertEqual(next(x for x in self.q.rows() if x['id']==other)['review_state'],'rejected')
    def test_failed_build_rolls_back_scope_and_queue(self):
        self.seed();before=list(self.q.rows())
        with self.assertRaises(ValueError):build(self.g,self.q,self.families,self.f,{'bad':1})
        self.assertEqual(before,list(self.q.rows()))
        with self.assertRaises(ValueError):collect(self.g,'OCUL',max_starts=51)
        with self.assertRaises(ValueError):build(self.g,self.q,self.families*2,self.f)

if __name__=='__main__':unittest.main()
