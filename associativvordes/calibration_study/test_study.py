"""Synthetic protocol tests only. None of these fixtures is a real human/gold."""
import copy,json,unittest
from pathlib import Path
from .study import analyze,agreement,digest,approved

def verify(trust,kind,payload):
    trust.setdefault(kind,{})[digest(payload)]=dict(status='VERIFIED',payload_sha256=digest(payload),verification_ref='TEST_ONLY:external-verifier')

def fixture(full_protocol=False):
    p=json.loads(Path(__file__).with_name('protocol.json').read_bytes());
    if not full_protocol:p['id']='TEST_ONLY';p['cases_per_language']=2
    ph=digest(p);study='TEST_ONLY-study'
    roster={};assignments=[];trust={};questions=[];reviews=[];arbs=[]
    for role in ['A','B','arbiter']:
        actor='TEST_ONLY-'+role;person=dict(kind='human',person_key='TEST_ONLY-person-'+role,authorization_ref='TEST_ONLY',competence_refs=['TEST_ONLY'],identity_verification_ref='TEST_ONLY',conflicts_review_ref='TEST_ONLY',qualified_languages=p['languages'],roles=[role]);roster[actor]=person;verify(trust,'person_verifications',person)
        for lang in p['languages']:
            a=dict(language=lang,role=role,actor_id=actor,study_sha256=study);assignments.append(a);verify(trust,'assignment_verifications',a)
    for lang in p['languages']:
        for i in range(p['cases_per_language']):
            q=dict(question_id='TEST_ONLY:'+lang+':'+str(i),lexeme='TEST_ONLY_word_'+str(i),language=lang,release_status='RELEASED',protocol_sha256=ph,instructions_sha256=__import__('hashlib').sha256(Path(__file__).with_name('INSTRUCTIONS.md').read_bytes()).hexdigest());q['question_sha256']=digest(q);questions.append(q)
            for role in ['A','B']:
                r=dict(schema='interal-human-calibration-response/1',study_sha256=study,protocol_sha256=ph,question_id=q['question_id'],question_sha256=q['question_sha256'],actor_id='TEST_ONLY-'+role,role=role,action='independent_review',lexeme=q['lexeme'],language=lang,pos='NOUN',sense='TEST_ONLY-sense',normative_root='TEST_ONLY-root',national_correspondence='TEST_ONLY-correspondence',morphological_relation='TEST_ONLY-relation',verdict='VALID' if i%2==0 else 'INVALID',grounds='TEST_ONLY artificial grounds',sources=[dict(publisher='TEST_ONLY',version='1',locator='TEST_ONLY:entry',finding='TEST_ONLY assertion',url='https://example.invalid/TEST_ONLY')],rule_issues=[],started_at='2026-10-25T10:00:00Z',completed_at='2026-10-25T10:01:00Z',active_seconds=30,blind_to_predictions=True,blind_to_other_review=True,exposure_report=None)
                verify(trust,'submission_verifications',r);verify(trust,'delivery_verifications',dict(study_sha256=study,actor_id=r['actor_id'],role=role,question_id=q['question_id'],question_sha256=q['question_sha256']));reviews.append(r)
    for key in p['release_prerequisites']:verify(trust,'study_verifications',dict(study_sha256=study,protocol_sha256=ph,prerequisite=key))
    return dict(questions=questions,reviews=reviews,arbitrations=arbs,roster=roster,assignments=assignments,protocol=p,study_hash=study,trust=trust)

def seal(f):
    verify(f['trust'],'protocol_signoffs',dict(study_sha256=f['study_hash'],protocol_sha256=digest(f['protocol']),review_set_sha256=digest(f['reviews']),arbitration_set_sha256=digest(f['arbitrations']),instructions_final=True))

def arbitrate(f):
    result=analyze(**f)
    for row in result['arbitration_ledger']:
        if row['state']=='ADJUDICATED':continue
        originals=[r for r in f['reviews'] if r['question_id']==row['question_id']];q=next(q for q in f['questions'] if q['question_id']==row['question_id']);r=copy.deepcopy(originals[0]);r.update(role='arbiter',actor_id='TEST_ONLY-arbiter',action='arbitrate',started_at='2026-10-25T10:02:00Z',completed_at='2026-10-25T10:03:00Z',review_sha256=[digest(x) for x in originals])
        verify(f['trust'],'submission_verifications',r);verify(f['trust'],'delivery_verifications',dict(study_sha256=f['study_hash'],actor_id=r['actor_id'],role='arbiter',question_id=q['question_id'],question_sha256=q['question_sha256']));f['arbitrations'].append(r)
    seal(f)

class CalibrationTests(unittest.TestCase):
    def test_complete_TEST_ONLY_flow_and_no_production_authority(self):
        f=fixture();arbitrate(f);r=analyze(**f);self.assertEqual(r['status'],'PASS_CALIBRATION_ONLY');self.assertTrue(r['main_annotation_allowed']);self.assertFalse(r['production_application_authorized']);self.assertEqual(r['metrics']['overall']['cohens_kappa'],1)
    def test_main_collection_needs_independent_calibration_receipt(self):
        from .study import require_main_annotation
        f=fixture(full_protocol=True);arbitrate(f);r=analyze(**f)
        with self.assertRaisesRegex(ValueError,'verification'):require_main_annotation(r,{})
        proof=dict(study_sha256=r['study_sha256'],protocol_sha256=r['protocol_sha256'],analysis_sha256=digest(r),calibration_complete=True)
        verify(f['trust'],'calibration_verifications',proof)
        self.assertTrue(require_main_annotation(r,f['trust'])['collection_allowed'])
        r['status']='BLOCKED'
        with self.assertRaisesRegex(ValueError,'completed'):require_main_annotation(r,f['trust'])
    def test_live_quality_cannot_start_before_calibration(self):
        from associativvordes.cleanup_quality.human import compile_gold
        case=dict(version_contract=dict(namespace='research-v5'))
        with self.assertRaisesRegex(ValueError,'calibration'):compile_gold([case],[{}],[],{})
    def test_legacy_main_gold_cannot_bypass_calibration(self):
        from associativvordes.cleanup_quality.human import compile_gold
        with self.assertRaisesRegex(ValueError,'calibration'):compile_gold([dict(id='legacy')],[{}],[],{})
    def test_instruction_bytes_are_in_the_installed_version_contract(self):
        from associativvordes.v5_contract.versions import implementation
        files=implementation()['calibration_study']
        self.assertIn('associativvordes/calibration_study/INSTRUCTIONS.md',files)
    def test_stale_protocol_or_instruction_receipt_cannot_reopen_main_collection(self):
        from .study import require_main_annotation
        for field in ['protocol_sha256','instructions_sha256','scientific_implementation_sha256']:
            f=fixture(full_protocol=True);arbitrate(f);r=analyze(**f);r[field]='stale'
            proof=dict(study_sha256=r['study_sha256'],protocol_sha256=r['protocol_sha256'],analysis_sha256=digest(r),calibration_complete=True);verify(f['trust'],'calibration_verifications',proof)
            with self.assertRaisesRegex(ValueError,'stale'):require_main_annotation(r,f['trust'])
    def test_empty_is_not_experiment(self):
        f=fixture();f.update(reviews=[],arbitrations=[],roster={},assignments=[]);r=analyze(**f);self.assertEqual(r['status'],'BLOCKED');self.assertEqual(r['human_gold'],[]);self.assertIsNone(r['metrics']['overall']['raw_agreement']);self.assertIsNone(r['metrics']['overall']['timing']['median_seconds'])
    def test_fictional_roster_without_verification(self):
        f=fixture();f['trust'].pop('person_verifications')
        with self.assertRaisesRegex(ValueError,'self-declared'):analyze(**f)
    def test_models_are_not_humans(self):
        f=fixture();f['roster']['TEST_ONLY-A']['kind']='model';verify(f['trust'],'person_verifications',f['roster']['TEST_ONLY-A'])
        with self.assertRaisesRegex(ValueError,'human'):analyze(**f)
    def test_real_identity_cannot_use_two_accounts(self):
        f=fixture();f['roster']['TEST_ONLY-B']['person_key']='TEST_ONLY-person-A';verify(f['trust'],'person_verifications',f['roster']['TEST_ONLY-B'])
        with self.assertRaisesRegex(ValueError,'same person'):analyze(**f)
    def test_language_competence_required(self):
        f=fixture();f['roster']['TEST_ONLY-A']['qualified_languages']=[];verify(f['trust'],'person_verifications',f['roster']['TEST_ONLY-A'])
        with self.assertRaisesRegex(ValueError,'qualified language'):analyze(**f)
    def test_authentic_submission_and_delivery_required(self):
        for key in ['submission_verifications','delivery_verifications','assignment_verifications']:
            f=fixture();f['trust'].pop(key)
            with self.assertRaises(ValueError):analyze(**f)
    def test_changed_answer_cannot_reuse_receipt(self):
        f=fixture();f['reviews'][0]['verdict']='UNCERTAIN'
        with self.assertRaisesRegex(ValueError,'authenticated'):analyze(**f)
    def test_duplicate_slot_never_overwrites(self):
        f=fixture();f['reviews'].append(f['reviews'][0])
        with self.assertRaisesRegex(ValueError,'slot'):analyze(**f)
    def test_duplicate_assignment_never_selects_first(self):
        f=fixture();f['assignments'].append(f['assignments'][0])
        with self.assertRaisesRegex(ValueError,'duplicate role'):analyze(**f)
    def test_arbitration_cannot_substitute_two_reviews(self):
        f=fixture();arbitrate(f)
        if not f['arbitrations']:self.skipTest('no audit selected')
        q=f['arbitrations'][0]['question_id'];f['reviews']=[r for r in f['reviews'] if not(r['question_id']==q and r['role']=='B')]
        with self.assertRaisesRegex(ValueError,'substitute'):analyze(**f)
    def test_arbitration_bound_to_both_originals(self):
        f=fixture();arbitrate(f);self.assertTrue(f['arbitrations']);r=f['arbitrations'][0];r['review_sha256']=[];verify(f['trust'],'submission_verifications',r)
        with self.assertRaisesRegex(ValueError,'both exact'):analyze(**f)
    def test_arbiter_must_be_third_person(self):
        f=fixture();arbitrate(f);f['roster']['TEST_ONLY-arbiter']['person_key']='TEST_ONLY-person-A';verify(f['trust'],'person_verifications',f['roster']['TEST_ONLY-arbiter'])
        with self.assertRaisesRegex(ValueError,'third independent'):analyze(**f)
    def test_every_scientific_disagreement_goes_to_arbiter(self):
        for field in ['pos','sense','normative_root','national_correspondence','morphological_relation']:
            f=fixture();r=f['reviews'][0];r[field]='TEST_ONLY-alternative';verify(f['trust'],'submission_verifications',r);result=analyze(**f);self.assertTrue(any(field in row['dimensions'] for row in result['arbitration_ledger']),field)
    def test_uncertainty_not_converted_to_invalid(self):
        f=fixture();r=f['reviews'][0];r.update(verdict='UNCERTAIN',pos=None,sense=None);verify(f['trust'],'submission_verifications',r);result=analyze(**f);self.assertTrue(any(row['uncertainty'] for row in result['arbitration_ledger']));self.assertEqual(r['verdict'],'UNCERTAIN')
    def test_incomplete_resolved_response_retained_as_protocol_defect(self):
        f=fixture();r=f['reviews'][0];r['sources']=[];verify(f['trust'],'submission_verifications',r);result=analyze(**f);self.assertEqual(result['accepted_human_reviews'],24);self.assertGreater(result['instruction_issue_count'],0);self.assertEqual(result['status'],'BLOCKED')
    def test_blinding_exposure_cannot_be_waived_by_agreement(self):
        f=fixture();r=f['reviews'][0];r['exposure_report']='TEST_ONLY: saw an answer';verify(f['trust'],'submission_verifications',r);arbitrate(f);self.assertEqual(analyze(**f)['status'],'BLOCKED')
    def test_rule_clarification_requires_new_round(self):
        f=fixture();r=f['reviews'][0];r['rule_issues']=['TEST_ONLY unclear wording'];verify(f['trust'],'submission_verifications',r);arbitrate(f);self.assertEqual(analyze(**f)['status'],'BLOCKED')
    def test_provisional_packet_cannot_pass(self):
        f=fixture();f.update(reviews=[],arbitrations=[])
        for q in f['questions']:q['release_status']='PROVISIONAL_NOT_RELEASED';q['question_sha256']=digest({k:v for k,v in q.items() if k!='question_sha256'})
        self.assertIn('PROVISIONAL_PACKETS_NOT_RELEASED',analyze(**f)['blockers'])
    def test_invalid_time_or_timezone(self):
        for value in [float('nan'),float('inf'),-1,61]:
            f=fixture();r=f['reviews'][0];r['active_seconds']=value
            if math_finite(value):verify(f['trust'],'submission_verifications',r)
            with self.assertRaises(ValueError):analyze(**f)
        f=fixture();r=f['reviews'][0];r['started_at']='2026-10-25T10:00:00';verify(f['trust'],'submission_verifications',r)
        with self.assertRaisesRegex(ValueError,'timezone'):analyze(**f)
    def test_degenerate_kappa_is_unknown(self):
        self.assertIsNone(agreement([('VALID','VALID')]*20)['cohens_kappa']);self.assertEqual(agreement([('VALID','INVALID'),('INVALID','VALID')])['cohens_kappa'],-1)
    def test_kappa_against_hand_calculation(self):
        # observed .75; both marginals .5; chance .5 => kappa .5
        r=agreement([('VALID','VALID')]*3+[('INVALID','INVALID')]*3+[('VALID','INVALID'),('INVALID','VALID')]);self.assertEqual(r['raw_agreement'],.75);self.assertEqual(r['cohens_kappa'],.5)
    def test_prespecified_agreement_audit_is_not_skipped(self):
        f=fixture();r=analyze(**f);self.assertTrue(any(x['prespecified_agreement_audit'] and not x['dimensions'] for x in r['arbitration_ledger']));self.assertGreater(r['pending_arbitrations'],0)

def math_finite(v):
    import math
    return math.isfinite(v)
if __name__=='__main__':unittest.main()
