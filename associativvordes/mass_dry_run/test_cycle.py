"""TEST_ONLY engineering fixtures, never human gold or lexical truth."""
import copy
import json
from pathlib import Path
import signal
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from audit import build_snapshot,compare,groups_for,normalized_proposal,samples,sha
from run import measured,queue_history,PROTOCOL

def fixture(n=0):
    lid='lexeme:'+sha(['TEST_ONLY_LEXEME',n]);qid='TEST_ONLY_QUESTION:'+str(n)
    lex={'id':lid,'language':'en','lemma':'TEST_ONLY_'+str(n),'pos':None,'sense_scope':'unresolved'}
    q=dict(id=qid,family='family:TEST_ONLY',language='en',lexeme_alternatives=[lex],
      categories=['NEW_MEMBER'],frequency={'status':'unknown','rank':None},
      discovery_paths=[],previous_decisions=[],prior_scoped_decisions=[],guard={})
    c=dict(question_id=qid,family_id=q['family'],language='en',lexeme=lex,paths=[],productive_paths=[],
      other_native_paths_not_supporting_candidate=[],risk_flags=['sense_unresolved'],
      scoped_history=[],unassigned_history=[],frequency=q['frequency'],independence={'status':'unknown'},source_rows=[])
    fingerprint=sha(c)
    p=dict(candidate_id='auto-candidate:'+sha([qid,lid]),question_id=qid,family_id=q['family'],
       language='en',lexeme=lex,card_sha256=fingerprint,needs_human_review=True,production_writes=0,
       family_merge_authorized=False,calibrated_reliability=None,relation_type='unresolved',
       identity_resolution='unresolved',proposed_decision='ABSTAIN',uncertainty_flags=['sense_unresolved'],
       evidence_refs=[],models=[],created_at='TEST_ONLY_TIMESTAMP',run_id='TEST_ONLY_RUN',previous_result_ref=None)
    return q,p,c
def snapshot(n=1):
    qs=[];ps=[];cs={}
    for i in range(n):
        q,p,c=fixture(i);qs.append(q);ps.append(p);cs[p['card_sha256']]=c
    return build_snapshot(qs,ps,cs,{'fixture':'TEST_ONLY'})

class AuditTests(unittest.TestCase):
    def test_manual_counts_not_doubled(self):
        snap,stats=snapshot(3)
        self.assertEqual(stats['by_language']['en']['manual_review'],3)
        self.assertEqual(stats['native_candidates'],3)
    def test_abstain_is_not_semantic_rejection(self):
        snap,stats=snapshot()
        self.assertEqual(snap['actual_semantic_proposals']['exclude'],[])
        self.assertEqual(stats['manual_fraction'],1)
    def test_preserving_decision_is_not_confirmation(self):
        q,p,c=fixture();q['previous_decisions']=[{'state':'rejected','actor':'TEST_ONLY_PRIVATE'}]
        result,stats=build_snapshot([q],[p],{p['card_sha256']:c},{})
        self.assertEqual(stats['groups']['preserved_existing_decisions'],1)
        self.assertEqual(stats['groups']['confirmed_existing_decisions'],0)
        self.assertNotIn('TEST_ONLY_PRIVATE',json.dumps(result))
    def test_existing_exclusion_is_only_an_audit(self):
        q,p,c=fixture();q['existing_memberships']=[{'head_id':'TEST_ONLY_HEAD'}]
        q['guard']={'status':'blocked'}
        self.assertIn('potential_exclusions',groups_for(q,p))
        snap,stats=build_snapshot([q],[p],{p['card_sha256']:c},{})
        self.assertEqual(stats['actual_semantic_proposals']['exclude'],0)
    def test_family_conflict_does_not_merge(self):
        q,p,c=fixture();q['conflicts']={'competing_families':['family:TEST_ONLY_OTHER']}
        snap,stats=build_snapshot([q],[p],{p['card_sha256']:c},{})
        self.assertEqual(stats['groups']['interfamily_conflicts'],1)
        self.assertFalse(snap['proposals'][0]['family_merge_authorized'])
    def test_source_groups_not_counted_as_independent(self):
        snap,stats=snapshot()
        self.assertIn('unknown',stats['source_independence'])
    def test_original_sense_and_spelling_preserved(self):
        q,p,c=fixture();p=copy.deepcopy(p);p['lexeme']['sense_scope']='invented'
        with self.assertRaises(ValueError):build_snapshot([q],[p],{p['card_sha256']:c},{})
    def test_no_invented_zero_frequency(self):
        q,p,c=fixture();c=copy.deepcopy(c);c['frequency']={'status':'unknown','rank':0}
        with self.assertRaises(ValueError):build_snapshot([q],[p],{p['card_sha256']:c},{})
    def test_cross_language_productive_path_fails(self):
        q,p,c=fixture();lid=p['lexeme']['id']
        c['productive_paths']=[{'nodes':[lid,lid],'node_languages':['en','ru'],'steps':[]}]
        with self.assertRaises(ValueError):build_snapshot([q],[p],{p['card_sha256']:c},{})
    def test_other_native_same_spelling_cannot_provide_path(self):
        q,p,c=fixture();c['productive_paths']=[{'nodes':['other','other2'],'node_languages':['en','en'],'steps':[]}]
        with self.assertRaises(ValueError):build_snapshot([q],[p],{p['card_sha256']:c},{})
    def test_inflection_not_derivation(self):
        q,p,c=fixture();lid=p['lexeme']['id']
        c['productive_paths']=[{'nodes':[lid,lid],'node_languages':['en','en'],
                                'steps':[{'type':'inflection','direction':'directed'}]}]
        with self.assertRaises(ValueError):build_snapshot([q],[p],{p['card_sha256']:c},{})
    def test_wrong_family_negative_is_not_global(self):
        q,p,c=fixture();c['scoped_history']=[{'family':'family:TEST_ONLY_OTHER','state':'rejected'}]
        with self.assertRaises(ValueError):build_snapshot([q],[p],{p['card_sha256']:c},{})
    def test_uncalibrated_probability_fails(self):
        q,p,c=fixture();p['calibrated_reliability']=.99
        with self.assertRaises(ValueError):build_snapshot([q],[p],{p['card_sha256']:c},{})
    def test_duplicates_fatal(self):
        q,p,c=fixture()
        with self.assertRaises(ValueError):build_snapshot([q],[p,p],{p['card_sha256']:c},{})
    def test_stable_normalization_only_removes_volatile_fields(self):
        q,p,c=fixture();other=copy.deepcopy(p);other['created_at']='new';other['run_id']='new'
        self.assertEqual(normalized_proposal(p),normalized_proposal(other))
    def test_replay_compares_evidence_and_relations(self):
        a,_=snapshot();b=copy.deepcopy(a);b['proposals'][0]['evidence_refs']=['TEST_ONLY_CHANGED']
        with self.assertRaises(ValueError):compare(a,b)
    def test_replay_compares_groups_and_history(self):
        a,_=snapshot();b=copy.deepcopy(a);b['questions'][0]['previous_decisions']=[{'state':'rejected'}]
        with self.assertRaises(ValueError):compare(a,b)
    def test_independent_clone_matches(self):
        a,_=snapshot();self.assertEqual(compare(a,copy.deepcopy(a))['status'],'PASS')
    def test_random_and_risk_sampling_stable(self):
        snap,_=snapshot(150)
        a=samples(snap,'TEST_ONLY_SEED');b=samples(snap,'TEST_ONLY_SEED')
        self.assertEqual(a,b);self.assertEqual(len(a['random_ids']),60);self.assertEqual(len(a['risk_ids']),60)
        self.assertEqual(a['required_reviews'],2*a['unique_cases'])
        self.assertTrue(all(t['decision'] is None for t in a['tasks']))

class ExecutionTests(unittest.TestCase):
    def test_protocol_disables_network_and_production(self):
        c=PROTOCOL['llm_config'];self.assertFalse(c['allow_paid']);self.assertEqual(c['max_requests'],0)
        self.assertEqual(c['providers'],{});self.assertFalse(PROTOCOL['canonical_roots_created'])
    def test_resource_measurement_is_real_child_usage(self):
        with tempfile.TemporaryDirectory() as d:
            metrics,value=measured(d,'TEST_ONLY',[sys.executable,'-c','import json;print(json.dumps({"ok":True}))'])
            self.assertTrue(value['ok']);self.assertGreater(metrics['max_rss_kib'],0);self.assertGreater(metrics['wall_seconds'],0)
    def test_real_signal_is_reported(self):
        with tempfile.TemporaryDirectory() as d:
            metrics,value=measured(d,'TEST_ONLY_SIGNAL',[sys.executable,'-c','import os,signal;os.kill(os.getpid(),signal.SIGKILL)'],allowed=(-9,))
            self.assertEqual(metrics['returncode'],-9)
    def test_history_read_does_not_write(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'history.sqlite';db=sqlite3.connect(path)
            db.executescript('CREATE TABLE history(candidate,sequence,state);CREATE TABLE questions(id,state);')
            db.execute("INSERT INTO history VALUES('TEST_ONLY',1,'rejected')")
            db.execute("INSERT INTO questions VALUES('TEST_ONLY','rejected')");db.commit();db.close()
            before=path.read_bytes();state=queue_history(path)
            self.assertEqual(state['rows'][0][2],'rejected');self.assertEqual(before,path.read_bytes())


class PublicationTests(unittest.TestCase):
    def test_export_to_fresh_review_ledger(self):
        from export_snapshot import export_snapshot
        snap,_=snapshot();snap['questions'][0]['lemma']='TEST_ONLY'
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);path=root/'snapshot.json';path.write_text(json.dumps(snap))
            manifest=export_snapshot(path,root/'queue',root/'ledger')
            self.assertEqual(manifest['counts'],{'questions':1,'proposals':1})
            self.assertEqual(manifest['human_decision_events'],0)
            self.assertTrue((root/'ledger/source-rows').is_dir())
    def test_export_refuses_existing_ledger(self):
        from export_snapshot import export_snapshot
        snap,_=snapshot()
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);path=root/'snapshot.json';path.write_text(json.dumps(snap));(root/'ledger').mkdir()
            with self.assertRaises(ValueError):export_snapshot(path,root/'queue',root/'ledger')
            self.assertFalse((root/'queue').exists())
    def test_export_checksum_guard(self):
        from export_snapshot import export_snapshot
        snap,_=snapshot()
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);path=root/'snapshot.json';path.write_text(json.dumps(snap))
            with self.assertRaises(ValueError):export_snapshot(path,root/'queue',expected_sha256='wrong')
    def test_resume_rejects_changed_pinned_algorithm(self):
        import finish
        from unittest.mock import patch
        from contract import file_hash
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);p=root/'a.py';p.write_text('TEST_ONLY')
            frozen={'algorithm_modules':{'a.py':file_hash(p)}}
            with patch.object(finish.cycle,'ROOT',root):
                finish.verify_modules(frozen);p.write_text('changed')
                with self.assertRaises(ValueError):finish.verify_modules(frozen)

if __name__=='__main__':unittest.main()

