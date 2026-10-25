import copy, unittest
from .model import digest,evaluate

def grant(trust,purpose,payload):
    trust.setdefault(purpose,{})[digest(payload)] = dict(payload_sha256=digest(payload),status='APPROVED',authority='INDEPENDENT_GOLD')

def fixture():
    # Artificial contract fixtures; never real linguistic evidence or gold.
    target=dict(language='en',source='TEST_ONLY',source_version='1',lemma='tester',pos='NOUN',lexical_identity='test:1',sense='test:sense',context='test:context')
    base=dict(target,lemma='test',lexical_identity='test:2',sense='test:base')
    s=dict(family_id='TEST_ONLY-family',normative_element='TEST_ONLY-element',target=target,input_version='TEST_ONLY-version',origin=dict(family_id='TEST_ONLY-family',language='en',lemma_id='TEST_ONLY-id',path='TEST_ONLY.json.gz',ordinal=0,record_sha256='a'*64,source_commit='b'*40))
    ref=dict(source_id='TEST_ONLY-source',source_sha256='c'*64,locator='TEST_ONLY entry 1',assertion_scope=s)
    step=dict(scope=s,**{'from':target,'to':base},relation='DERIVATION',direction='FROM_TO',segmentation=['test','er'],component_role='ROOT',meaning_bridge='TEST_ONLY relation',source_refs=[ref])
    endpoint=dict(element=s['normative_element'],lexical_identity=base)
    analysis=dict(scope=s,polarity='SUPPORT',path=[step],normative_endpoint=endpoint,source_refs=[ref])
    c=dict(schema='interal-research-evidence-case/1',namespace='research',scope=s,analyses=[analysis])
    t=dict(input_version=s['input_version'],sources={'TEST_ONLY-source':dict(sha256='c'*64,url='https://example.invalid/TEST_ONLY',version='1',license='TEST_ONLY',dependency_group='TEST_ONLY')})
    for purpose,payload in [('identity_reviews',s),('normative_reviews',s),('history_reviews',s),('documentary_reviews',ref),('step_reviews',step),('endpoint_reviews',endpoint),('analysis_reviews',analysis),('case_completeness_reviews',c)]:grant(t,purpose,payload)
    return c,t

class EvidenceTests(unittest.TestCase):
    def test_supported_research_never_authorizes_production(self):
        c,t=fixture();r=evaluate(c,t);self.assertEqual(r['status'],'SUPPORTED_MEMBER');self.assertFalse(r['production_application_authorized'])
    def test_missing_trust_cannot_self_authorize(self):
        c,t=fixture();c['APPROVED']=True;self.assertEqual(evaluate(c)['status'],'UNRESOLVED_EVIDENCE')
    def test_mutation_of_each_scope_field(self):
        for key in ['family_id','normative_element','input_version','target','origin']:
            c,t=fixture();c['scope'][key]='substituted';self.assertEqual(evaluate(c,t)['status'],'UNRESOLVED_EVIDENCE')
    def test_source_bytes_or_license_missing(self):
        for key in ['sha256','license','version','url']:
            c,t=fixture();t['sources']['TEST_ONLY-source'].pop(key);self.assertEqual(evaluate(c,t)['status'],'UNRESOLVED_EVIDENCE')
    def test_no_completeness_review(self):
        c,t=fixture();t.pop('case_completeness_reviews');self.assertEqual(evaluate(c,t)['status'],'UNRESOLVED_EVIDENCE')
    def test_absence_never_negative(self):
        c,t=fixture();c['analyses']=[];grant(t,'case_completeness_reviews',c);self.assertEqual(evaluate(c,t)['status'],'UNRESOLVED_EVIDENCE')
    def test_partial_refutation_and_other_family_not_negative(self):
        for basis,extent in [('ABSENCE_OF_SUPPORT','ENTIRE_SCOPED_MEMBERSHIP'),('OTHER_FAMILY_MEMBERSHIP','ENTIRE_SCOPED_MEMBERSHIP'),('REFUTED_SEGMENTATION','ONE_PATH')]:
            c,t=fixture();a=c['analyses'][0];a.update(polarity='REFUTE',basis=basis,extent=extent);grant(t,'analysis_reviews',a);grant(t,'exhaustiveness_reviews',a);grant(t,'case_completeness_reviews',c);self.assertEqual(evaluate(c,t)['status'],'UNRESOLVED_EVIDENCE')
    def test_sufficient_negative_requires_exhaustive_scope(self):
        c,t=fixture();a=c['analyses'][0];a.update(polarity='REFUTE',basis='DIFFERENT_COMPONENT_ORIGIN',extent='ENTIRE_SCOPED_MEMBERSHIP');grant(t,'analysis_reviews',a);grant(t,'case_completeness_reviews',c)
        self.assertEqual(evaluate(c,t)['status'],'UNRESOLVED_EVIDENCE');grant(t,'exhaustiveness_reviews',a);self.assertEqual(evaluate(c,t)['status'],'SUPPORTED_NONMEMBER')
    def test_opposition_remains_conflict(self):
        c,t=fixture();a=copy.deepcopy(c['analyses'][0]);a.update(polarity='REFUTE',basis='REFUTED_SEGMENTATION',extent='ENTIRE_SCOPED_MEMBERSHIP');c['analyses'].append(a);grant(t,'analysis_reviews',a);grant(t,'exhaustiveness_reviews',a);self.assertEqual(evaluate(c,t)['status'],'CONFLICTING_EVIDENCE')
    def test_invalid_path_even_with_analysis_receipt(self):
        for change in ['inflection','reverse','sense','role','meaning','scope','compound','correspondence','missing_step','endpoint']:
            c,t=fixture();a=c['analyses'][0];step=a['path'][0]
            if change=='inflection':step['relation']='INFLECTION'
            if change=='reverse':step['direction']='TO_FROM'
            if change=='sense':step['from']=dict(step['from'],sense='homonym')
            if change=='role':step['component_role']=None
            if change=='meaning':step['meaning_bridge']=None
            if change=='scope':step['scope']={}
            if change=='compound':step['relation']='COMPOUND'
            if change=='correspondence':step['relation']='HISTORICAL_CORRESPONDENCE'
            if change=='missing_step':a['path']=[]
            if change=='endpoint':a['normative_endpoint']['element']='another-root'
            grant(t,'step_reviews',step);grant(t,'analysis_reviews',a);grant(t,'case_completeness_reviews',c)
            self.assertEqual(evaluate(c,t)['status'],'UNRESOLVED_EVIDENCE',change)
    def test_scope_template_cannot_be_reused_for_next_record(self):
        c,t=fixture();c['scope']['origin']['ordinal']=1;self.assertEqual(evaluate(c,t)['status'],'UNRESOLVED_EVIDENCE')
    def test_unresolved_alternative_prevents_final_inference(self):
        c,t=fixture();c['analyses'].append(dict(polarity='REFUTE',source_refs=[]));grant(t,'case_completeness_reviews',c);self.assertEqual(evaluate(c,t)['status'],'UNRESOLVED_EVIDENCE')
    def test_unknown_schema_or_namespace_blocks(self):
        for field,value in [('schema','future-schema'),('namespace','production')]:
            c,t=fixture();c[field]=value;self.assertEqual(evaluate(c,t)['status'],'UNRESOLVED_EVIDENCE')

if __name__=='__main__':unittest.main()
