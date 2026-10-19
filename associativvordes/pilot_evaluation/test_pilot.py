"""Real lexical carriers; all human labels/captures here are TEST-ONLY simulations."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from gold import sha,canonical,compile_gold,case_hash,assignments,validate_cases
from sample import make_case
from evaluate import evaluate,counts,compare
from run import predictions_from_sources,capture_baseline,BASELINE_COMMIT,BASELINE_HASHES
from impact import diagnose
from graph import Graph,lookup
from records import read_json
from build_graph import load_registry,ingest

HERE=Path(__file__).parent;FIX=HERE.parents[0]/'candidate_search/fixtures'
ROSTER={x:{'kind':'human','authorized_by':'TEST-ONLY','authorization_ref':'test-only:'+x} for x in ['a','b','c']}

def make_cases():
    source=read_json(FIX/'v6.json.gz');cases=[]
    for m in source['memberships'][:5]:
        c=make_case(m['family_id'],m['language'],m['word'],m['lemma_id'],'test_carrier_real_project_record',{'kind':'real_project_fixture','object':m,'object_sha256':sha(m)},m['head_id'])
        c.update(split='evaluation',double_review=False,leakage_group='test-only-group:'+m['lemma_id']);c['content_sha256']=case_hash(c);cases.append(c)
    return cases

def judgment(c,actor='a',decision='yes',relation='direct',**extra):
    return {'case_id':c['id'],'case_content_sha256':c['content_sha256'],'annotator_id':actor,'mode':'human','decision':decision,'relation':relation,
      'sense':'TEST-ONLY label; no actual linguistic claim','pos':'NOUN','boundaries':None,'correct_families':[c['family']] if decision=='yes' else [],
      'reason':'TEST-ONLY simulated judgment','reviewed_at':'2026-10-19T00:00:00Z','evidence':[{'kind':'independent_manual_document','locator':'test-only:fixture','finding':'TEST-ONLY'}],**extra}

def prediction(c,decision='yes',**extra):return {'case_id':c['id'],'case_content_sha256':c['content_sha256'],'decision':decision,'requires_manual_review':True,**extra}
def run_for(cs,ps):return {'status':'completed','case_set_sha256':sha(cs),'predictions':ps,'runtime_seconds':0}

class PilotTests(unittest.TestCase):
    def setUp(self):self.cases=make_cases()
    def test_empty_gold_has_no_quality_claim(self):
        gold=compile_gold(self.cases,[],{});e=evaluate(self.cases,gold,run_for(self.cases,[prediction(c) for c in self.cases]))
        self.assertEqual(e['status'],'awaiting_human_gold');self.assertIsNone(e['overall']['precision']);self.assertIsNone(e['overall']['recall_labeled_scope'])
    def test_model_labels_unauthorized_humans_and_prior_status_not_gold(self):
        c=self.cases[0]
        for j,roster in [(judgment(c,mode='model'),ROSTER),(judgment(c),{}),(judgment(c,evidence=[{'kind':'uder','locator':'row','finding':'claim'}]),ROSTER)]:
            with self.assertRaises(ValueError):compile_gold(self.cases,[j],roster)
        self.assertEqual(compile_gold(self.cases,[],ROSTER)['counts']['unannotated'],len(self.cases))
    def test_independent_double_review_and_adjudication(self):
        c=copy.deepcopy(self.cases[0]);c['double_review']=True;c['content_sha256']=case_hash(c);cs=[c];a=judgment(c);b=judgment(c,'b','no','unrelated')
        self.assertEqual(compile_gold(cs,[a],ROSTER)['rows'][0]['state'],'single_review')
        self.assertEqual(compile_gold(cs,[a,b],ROSTER)['rows'][0]['state'],'disagreement')
        adj=judgment(c,'c',disputed_judgment_sha256=[sha(a),sha(b)])
        self.assertEqual(compile_gold(cs,[a,b],ROSTER,[adj])['rows'][0]['state'],'adjudicated')
        adj['annotator_id']='a'
        with self.assertRaises(ValueError):compile_gold(cs,[a,b],ROSTER,[adj])
    def test_exact_precision_recall_abstentions_and_unknown(self):
        cs=self.cases;js=[judgment(cs[0]),judgment(cs[1],decision='no',relation='unrelated'),judgment(cs[2]),judgment(cs[3],decision='no',relation='unrelated'),judgment(cs[4],decision='uncertain',relation='uncertain')]
        ps=[prediction(cs[0]),prediction(cs[1]),prediction(cs[2],'abstain'),prediction(cs[3],'no'),prediction(cs[4])]
        e=evaluate(cs,compile_gold(cs,js,ROSTER),run_for(cs,ps));self.assertEqual(e['overall']['precision'],.5);self.assertEqual(e['overall']['recall_labeled_scope'],.5)
        self.assertEqual(e['overall']['counts']['membership_errors'],1);self.assertEqual(e['overall']['counts']['abstain'],1)
        self.assertIsNone(e['overall']['boundary_errors']);self.assertEqual(e['overall']['counts']['gold_uncertain'],1)
    def test_boundary_errors_and_merges_are_separate_from_membership(self):
        c=next(c for c in self.cases if len(c['target']['lemma'])>2);cs=[c];j=judgment(c,boundaries=[1]);p=prediction(c,boundaries=[2],merged_families=[c['family'],'family:test-only-other'])
        out=evaluate(cs,compile_gold(cs,[j],ROSTER),run_for(cs,[p]))['overall'];self.assertEqual(out['boundary_errors'],1);self.assertEqual(out['false_family_merges'],1);self.assertEqual(out['counts']['membership_errors'],0)
    def test_same_case_checksums_and_complete_prediction_scope(self):
        gold=compile_gold(self.cases,[],{})
        for pp in [[prediction(c) for c in self.cases[:-1]],[prediction(c) for c in self.cases]+[prediction(self.cases[0])]]:
            with self.assertRaises(ValueError):evaluate(self.cases,gold,run_for(self.cases,pp))
        bad=copy.deepcopy(self.cases);bad[0]['target']['lemma']+='TEST-ONLY-tamper'
        with self.assertRaises(ValueError):validate_cases(bad)
    def test_blinded_tasks_hide_prior_decisions(self):
        for t in assignments(self.cases):self.assertIsNone(t['decision']);self.assertNotIn('provenance',t);self.assertNotIn('hypothesis_tags_not_gold',t)
    def test_paired_contribution_not_claimed_without_gold(self):
        e=evaluate(self.cases,compile_gold(self.cases,[],{}),run_for(self.cases,[prediction(c) for c in self.cases]));self.assertIsNone(compare({'A':e,'B':e})['paired_contributions']['A→B'])
    def test_baseline_missing_is_unavailable_not_a_proxy(self):
        self.assertEqual(capture_baseline(None,self.cases),(None,'actual_algorithm_capture_missing'))
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'bad.json';p.write_text(json.dumps({'algorithm_commit':'not-the-pinned-runtime'}))
            with self.assertRaises(ValueError):capture_baseline(p,self.cases)
    def test_real_source_ablation_preserves_manual_and_native_identity_guards(self):
        g=Graph();s=read_json(FIX/'v6.json.gz');load_registry(g,s);ingest(g,FIX/'records.ndjson',read_json(HERE.parents[1]/'data/morphology-evidence/sources/source-lock.json'))
        before=g.db.execute('SELECT COUNT(*) FROM arcs').fetchone()[0]
        pp,budget=predictions_from_sources(g,self.cases,['uder'])
        for p in pp:
            for path in p['evidence_paths']:
                for step in path['steps']:
                    sources={g.resolve(e['source_revision_ref'])['body']['source_id'] for e in step['sources']};self.assertIn('source:uder',sources)
        self.assertEqual(g.db.execute('SELECT COUNT(*) FROM arcs').fetchone()[0],before)
        self.assertEqual(g.resolve_family('regule'),['family:regul']);self.assertTrue(g.db.execute("SELECT 1 FROM lexemes WHERE language='fr' AND search='régulier'").fetchone())
        for c in s['corrections'][:5]:self.assertIn(g.guard(c['family_id'],c['language'],c['word'],c['lemma_id'])['status'],{'blocked','hold'})
        g.close()
    def captures(self):
        cs={l:{'represented':False,'status':'complete','models':[],'selected_top_five':[]} for l in ['en','de','fr','es','it','ru']}
        x={'capture_kind':'actual_runtime','algorithm_commit':BASELINE_COMMIT,'methodology_modified':False,'methodology_version':'TEST-ONLY','calculation_code_hashes':BASELINE_HASHES.copy(),'case_set_sha256':'TEST-ONLY','languages':cs,'internationality':None}
        return x,copy.deepcopy(x)
    def test_top_five_new_models_coverage_frequency_and_head_regressions(self):
        a,b=self.captures();model={'model_key':'TEST-ONLY:model','lexical_head_id':'TEST-ONLY:head','P':50,'frequency_observation':{'test_only':True},'independent_model_id':'TEST-ONLY:independent','independence_evidence':'test-only-proof'}
        a['languages']['en'].update(represented=True,models=[model],selected_top_five=[model['model_key']]);b=copy.deepcopy(a)
        b['languages']['en']['models'][0]['frequency_observation']=None
        b['languages']['en']['models'].append(dict(model,lexical_head_id='TEST-ONLY:other-head'));b['languages']['de']['represented']=True
        b['languages']['en']['selected_top_five']=[];a['internationality']=30;b['internationality']=31
        d=diagnose(a,b);en=d['languages']['en'];self.assertTrue(en['top_five_changed']);self.assertTrue(en['duplicate_model_keys']);self.assertTrue(en['lexical_head_collisions']);self.assertTrue(en['related_derivative_inflation_risk']);self.assertTrue(en['frequency_lost']);self.assertTrue(d['languages']['de']['represented_changed']);self.assertTrue(d['internationality_changed'])
    def test_missing_scores_and_missing_language_never_zero_or_new_formula(self):
        a,b=self.captures();b['languages']['fr']['status']='incomplete';self.assertIsNone(diagnose(a,b)['internationality_changed']);b['languages'].pop('ru')
        with self.assertRaises(ValueError):diagnose(a,b)
        a,b=self.captures();b['calculation_code_hashes']={'changed':'TEST-ONLY'}
        with self.assertRaises(ValueError):diagnose(a,b)

if __name__=='__main__':unittest.main()
