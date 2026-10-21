"""TEST-ONLY labels and people: never publish these as human observations."""
import copy,gzip,json,math,tempfile,unittest,uuid
from pathlib import Path
from gold import compile_gold,sha,case_hash,json_rows
from metrics04 import interval,rate,zero_error_requirement,summary,evaluate04,efficiency,require_study_reviews,agreement_intervals
from study04 import plan
from compare04 import balance,combine,grouped,category,predictions,PROTOCOL
from human04 import Study,Server
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'review'))
from store import atomic,canonical,digest

def case(i=0):
    c={'schema':'pilot-case/1','id':'test-case:'+str(i),'family':'family:test','language':'en',
       'target':{'lemma':'testword'+str(i),'lexeme_id':'lexeme:test'+str(i),'pos_observed':None,'sense_scope':'unresolved','head_id':None},
       'origin':'TEST_ONLY','provenance':[{'kind':'TEST_ONLY'}],'gold_status':'unannotated','leakage_group':'test-group:'+str(i),'split':'evaluation','double_review':False}
    c['content_sha256']=case_hash(c);return c

def roster():
    return {a:{'kind':'human','authorized_by':'TEST_ONLY','authorization_ref':'TEST_ONLY','slot':s,'languages':['en'],'token_hash':digest(a.encode())}
        for a,s in [('TEST_A','gold-1'),('TEST_B','gold-2'),('TEST_C','study-1'),('TEST_D','study-2')]}

def judgment(c,actor='TEST_A',decision='yes'):
    return {'case_id':c['id'],'case_content_sha256':c['content_sha256'],'annotator_id':actor,'mode':'human',
      'decision':decision,'relation':'direct' if decision=='yes' else 'unrelated' if decision=='no' else 'uncertain',
      'sense':'TEST_ONLY_SENSE','pos':'NOUN','reason':'TEST_ONLY','evidence':[{'kind':'dictionary','locator':'TEST_ONLY','finding':'TEST_ONLY'}],
      'independent_review':True,'blind_to_test_predictions':True,'reviewed_at':'TEST_ONLY',
      'phenomena':[],'boundaries':None,'correct_families':None,'independent_model_id':None}

def pred(c,decision='yes',**kw):
    return dict(case_id=c['id'],case_content_sha256=c['content_sha256'],decision=decision,requires_manual_review=True,boundaries=None,merged_families=None,relation_prediction='direct',**kw)

class Quality04Tests(unittest.TestCase):
    def test_no_gold_is_null_not_zero_accuracy(self):
        c=case();g=compile_gold([c],[],{})
        runs={n:{'case_set_sha256':sha([c]),'predictions':[pred(c)]} for n in ('A','B','U','C','D')}
        e=evaluate04([c],g,runs)['configurations']['D']['overall']
        self.assertIsNone(e['confusion']['tp']);self.assertIsNone(e['precision']['value']);self.assertEqual(e['precision']['denominator'],0)
        self.assertEqual(e['algorithm_abstain']['denominator'],1);self.assertIsNone(e['false_family_merge']['value'])

    def test_tp_fp_fn_denominators_and_abstention(self):
        cs=[case(i)for i in range(4)]
        gold=compile_gold(cs,[judgment(c,decision='yes' if i in (0,2) else 'no')for i,c in enumerate(cs)],roster())
        out=summary([(c,g,pred(c,'abstain' if i==2 else 'no' if i==3 else 'yes'))for i,(c,g)in enumerate(zip(cs,gold['rows']))])
        self.assertEqual(out['confusion'],{'tp':1,'fp':1,'fn':1,'tn':1})
        self.assertEqual(out['precision']['value'],.5);self.assertEqual(out['recall_labeled_scope']['value'],.5)
        self.assertEqual(out['membership_error']['denominator'],3)
        self.assertIsNotNone(out['precision']['ci95_wilson'])

    def test_sparse_zero_errors_have_nonzero_upper_bound(self):
        self.assertGreater(interval(0,10)[1],.2)
        n=zero_error_requirement(.001,.05/12)
        self.assertLessEqual(1-(.05/12)**(1/n),.001)
        self.assertGreater(1-(.05/12)**(1/(n-1)),.001)

    def test_relation_error_distinct_from_membership(self):
        c=case();gold=compile_gold([c],[judgment(c)],roster());p=pred(c);p['relation_prediction']='compound'
        out=summary([(c,gold['rows'][0],p)])
        self.assertEqual(out['confusion']['tp'],1);self.assertEqual(out['relation_error']['numerator'],1)

    def test_merge_missing_is_not_observed_zero(self):
        c=case();j=judgment(c);j['correct_families']=['family:test'];g=compile_gold([c],[j],roster())['rows'][0]
        p=pred(c);self.assertIsNone(summary([(c,g,p)])['false_family_merge']['value'])
        p['merged_families']=['family:test','family:other']
        self.assertEqual(summary([(c,g,p)])['false_family_merge']['numerator'],1)

    def test_uncertain_gold_not_forced_into_confusion(self):
        c=case();g=compile_gold([c],[judgment(c,decision='uncertain')],roster())
        out=summary([(c,g['rows'][0],pred(c))]);self.assertIsNone(out['confusion']['tp']);self.assertEqual(out['human_uncertain']['value'],1)

    def test_current_case_lock_rejects_changed_prediction(self):
        c=case();g=compile_gold([c],[],{});p=pred(c);p['case_content_sha256']='wrong'
        with self.assertRaises(ValueError):evaluate04([c],g,{'A':{'case_set_sha256':sha([c]),'predictions':[p]}})

    def test_two_reviews_required_in_initial_cohort_without_case_mutation(self):
        c=case();before=copy.deepcopy(c);g=compile_gold([c],[judgment(c)],roster())
        stricter=require_study_reviews(g,{c['id']})
        self.assertEqual(stricter['rows'][0]['state'],'single_review');self.assertIsNone(stricter['rows'][0]['label'])
        self.assertEqual(c,before);self.assertEqual(g['rows'][0]['state'],'resolved')

    def test_rater_agreement_intervals_and_constant_kappa(self):
        c=case();g=compile_gold([c],[judgment(c),judgment(c,'TEST_B')],roster())
        a=agreement_intervals(g)['pairs'][0]
        self.assertEqual(a['decision_agreement'],1);self.assertIsNone(a['cohen_kappa_decision'])
        self.assertLess(a['decision_agreement_ci95_wilson'][0],1)

    def test_budget_balances_classes_and_keeps_unknown_frequency(self):
        items=[{'key':str(i),'categories':['direct'],'frequency':None}for i in range(25)]
        items+=[{'key':'compound','categories':['compound'],'frequency':None}]
        out=balance(items,20);self.assertIn('compound',[q['key']for q in out]);self.assertTrue(all(q['frequency'] is None for q in out))

    def test_B_has_real_additions_and_displacement(self):
        def q(i):return grouped([{'family':'family:test','language':'en','word':'word'+str(i),'categories':['uncertain'],'native_ids':[],'paths':[],'baseline_candidates':[]}])[0]
        a=[q(i)for i in range(20)];u=[q(i)for i in range(20,40)]
        kept,dropped=combine(a,u)
        self.assertEqual(len(kept),20);self.assertEqual(len(dropped),20)
        self.assertEqual(len({x['key']for x in a}-{x['key']for x in kept}),10)

    def test_spelling_group_does_not_resolve_native_identity(self):
        c=case();items=grouped([{'family':c['family'],'language':c['language'],'word':c['target']['lemma'],'native_ids':['lexeme:homonym'],'paths':[],'categories':['direct'],'baseline_candidates':[]}])
        self.assertEqual(predictions([c],items)[0]['decision'],'abstain')
        items[0]['native_ids'].append(c['target']['lexeme_id'])
        self.assertEqual(predictions([c],items)[0]['decision'],'yes')

    def test_frozen_real_subset_is_balanced_and_reproducible(self):
        path=Path(__file__).resolve().parents[2]/'audit/associative-external-preparation/pilot-validation/CASES.ndjson.gz'
        cases=[json.loads(x)for x in gzip.decompress(path.read_bytes()).splitlines()]
        chosen,tasks,cells=plan(cases)
        self.assertEqual(len(chosen),180);self.assertEqual(len(cells),72);self.assertLessEqual(max(cells.values()),3)
        available=__import__('collections').Counter((c['family'],c['language'])for c in cases)
        for cell,n in cells.items():self.assertGreaterEqual(n,min(2,available[cell]));self.assertLessEqual(n,available[cell])
        self.assertEqual(sha(plan(cases)[1]),sha(tasks))
        seen={}
        for t in tasks:
            k=(t['slot'],t['leakage_group'])
            self.assertIn(t['condition'],[seen.setdefault(k,t['condition'])])
            self.assertNotIn('provenance',t);self.assertNotIn('origin',t);self.assertNotIn('decision',t)
        self.assertEqual(len({(t['slot'],t['case_id'])for t in tasks}),720)

    def test_efficiency_requires_humans_and_does_not_erase_false_candidate_time(self):
        cs=[case(),case(1)];g=compile_gold(cs,[judgment(c)for c in cs],roster());trials=[]
        for actor,condition,seconds in [('TEST_C','control',10),('TEST_D','combined',5)]:
            for i,c in enumerate(cs):
                t=judgment(c,actor,'yes' if i==0 else 'no');t.update(condition=condition,active_seconds=seconds,server_timing=True);trials.append(t)
        out=efficiency(cs,g,trials,roster(),bootstrap=50)
        self.assertEqual(out['control']['total_active_seconds'],20);self.assertEqual(out['control']['correct_per_hour'],180)
        self.assertEqual(out['speedup'],2)
        wrong=copy.deepcopy(trials);wrong[0]['mode']='LLM'
        with self.assertRaises(ValueError):efficiency(cs,g,wrong,roster())
        wrong=copy.deepcopy(trials);wrong.append(copy.deepcopy(wrong[0]))
        with self.assertRaises(ValueError):efficiency(cs,g,wrong,roster())

    def test_interrupted_human_time_is_unknown(self):
        c=case();g=compile_gold([c],[judgment(c)],roster());t=judgment(c,'TEST_C');t.update(condition='control',active_seconds=None,server_timing=True)
        out=efficiency([c],g,[t],roster())
        self.assertIsNone(out['control']['correct_per_hour']);self.assertIsNone(out['control']['total_active_seconds'])

class Study04Tests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.c=case();r=roster();base={'task_id':'test-task','case_id':self.c['id'],'case_content_sha256':self.c['content_sha256'],'family':self.c['family'],'language':'en','target':self.c['target'],'slot':'gold-1','condition':'control','purpose':'gold','leakage_group':self.c['leakage_group']}
        self.task=base
        for name,obj in [('STUDY.json',{'subset_sha256':sha([self.c]),'protocol_sha256':'TEST_ONLY','evidence_sha256':sha({self.c['id']:[{'source':'TEST_ONLY_SECRET_HINT'}]}),'tasks':[base]}),('EVIDENCE-PRIVATE.json',{self.c['id']:[{'source':'TEST_ONLY_SECRET_HINT'}]}),('raters.json',r)]:
            (self.root/name).write_text(canonical(obj))
        (self.root/'subset-cases.ndjson').write_text(canonical(self.c)+'\n');self.s=Study(self.root)
    def tearDown(self):self.tmp.cleanup()

    def test_control_allowlist_has_no_cues_or_other_answers(self):
        opened=self.s.open('TEST_A');text=canonical(opened['task'])
        self.assertNotIn('TEST_ONLY_SECRET_HINT',text)
        for field in ('condition','purpose','slot','leakage_group','origin','provenance','prediction'):self.assertNotIn(field,opened['task'])

    def test_save_idempotency_and_recovery_with_full_labels(self):
        j=judgment(self.c);e=self.s.save('TEST_A',self.task,j,10,'TEST_REQUEST_0001')
        self.assertEqual(self.s.save('TEST_A',self.task,j,99,'TEST_REQUEST_0001'),e)
        s=Study(self.root);self.assertEqual(len(s.events),1);folder=s.export()
        self.assertEqual(len(list(json_rows(folder/'judgments.ndjson'))),1)
        self.assertNotIn('token_hash',(folder/'raters.json').read_text())
        with self.assertRaises(ValueError):self.s.save('TEST_A',self.task,j,12,'TEST_REQUEST_0002')

    def test_interruption_marks_timing_unknown(self):
        self.s.open('TEST_A');self.assertTrue(Study(self.root).open('TEST_A')['interrupted'])
        self.s.save('TEST_A',self.task,judgment(self.c),10,'TEST_REQUEST_0001',interrupted=True)
        self.assertIsNone(self.s.events[0]['active_seconds'])

    def test_study_tail_corruption_is_detected(self):
        self.s.save('TEST_A',self.task,judgment(self.c),10,'TEST_REQUEST_0001')
        (self.root/'events'/'00000001.json').unlink()
        with self.assertRaises(ValueError):Study(self.root)

    def test_missing_verified_humans_blocks_collection(self):
        (self.root/'raters.json').write_text('{}')
        with self.assertRaisesRegex(ValueError,'BLOCKED'):Server(('127.0.0.1',0),Study(self.root))

    def test_http_collects_blind_task_and_idempotent_human_record(self):
        import http.client,threading
        server=Server(('127.0.0.1',0),self.s);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        cookie=None;csrf=None
        def request(path,body=None):
            nonlocal cookie,csrf
            c=http.client.HTTPConnection('127.0.0.1',server.server_port)
            h={'Content-Type':'application/json'}
            if cookie:h['Cookie']=cookie
            if csrf:h['X-CSRF-Token']=csrf
            c.request('POST' if body is not None else 'GET','/api/'+path,canonical(body) if body is not None else None,h)
            r=c.getresponse();data=json.loads(r.read())
            if r.getheader('Set-Cookie'):cookie=r.getheader('Set-Cookie').split(';')[0]
            status=r.status;c.close();return status,data
        try:
            self.assertEqual(request('login',{'token':'TEST_A'})[0],200)
            status,payload=request('task');self.assertEqual(status,200);csrf=payload['csrf']
            self.assertEqual(payload['task']['source_observations'],[])
            self.assertNotIn('condition',payload['task'])
            body={'request_id':'TEST_HTTP_REQUEST','judgment':judgment(self.c)}
            response=request('save',body);self.assertEqual(response[0],200,response);response=request('save',body);self.assertEqual(response[0],200,response)
            self.assertEqual(len(self.s.events),1)
            self.assertEqual(request('next',{})[0],200);self.assertTrue(request('task')[1]['done'])
        finally:server.shutdown();server.server_close()

    def test_lossless_archive_restores_raw_capture_bytes(self):
        from archive04 import pack,unpack
        raw=b'{"a": 1.0, "b": "unicode"}'
        source=self.root/'capture.json';source.write_bytes(raw)
        pack({'capture.json':source},self.root/'packed.gz')
        unpack(self.root/'packed.gz',self.root/'restored')
        self.assertEqual((self.root/'restored/capture.json').read_bytes(),raw)

    def test_source_evidence_cannot_change_silently(self):
        (self.root/'EVIDENCE-PRIVATE.json').write_text('{}')
        with self.assertRaises(ValueError):Study(self.root)

if __name__=='__main__':unittest.main()
