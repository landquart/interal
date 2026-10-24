import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const py=code=>{const r=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);};
test('empty gold and no removals produce null precision, not perfect safety',()=>py(String.raw`
from associativvordes.cleanup_quality.statistics import *
s=evaluate([dict(weight=1,cluster='family:A',prediction='KEEP',gold=None)])
assert s['precision_exclusions']['value'] is None and s['precision_exclusions']['ci95_linked_cluster_bootstrap'] is None
assert s['recall_erroneous_existing_links']['value'] is None and s['safety_gate']=='BLOCKED'
assert agreement([])['cohens_kappa'] is None
assert zero_error_n(.01,.05/12)==546 and zero_error_n(.001,.05/12)==5478
assert zero_error_n(.001,.05/150)>5478
lo,hi=exact_bounds(100,100,.05);assert abs(lo-.05**.01)<1e-9 and hi==1
lo,hi=exact_bounds(0,100,.05);assert lo==0 and abs(hi-(1-.05**.01))<1e-9
assert exact_bounds(0,0,.05) is None
`));
test('removal precision, correct-link false-removal risk and detection recall have different denominators',()=>py(String.raw`
from associativvordes.cleanup_quality.statistics import summary
rs=[dict(weight=w,prediction=p,gold=g) for w,p,g in [(2,'REMOVE','INVALID'),(1,'REMOVE','VALID'),(3,'KEEP','VALID'),(2,'KEEP','INVALID')]]
s=summary(rs);assert s['precision_exclusions']['value']==2/3
assert s['false_removal_rate']['value']==1/4
assert s['recall_erroneous_existing_links']['value']==1/2
assert summary([dict(weight=1,prediction='REMOVE',gold=None)])['precision_missing_gold_bounds']==[0,1]
`));
test('linked dependence clusters cross languages and cases; they never become family merges',()=>py(String.raw`
from associativvordes.cleanup_quality.prepare import linked_clusters,sanitized
cases=[dict(id='a',family_id='F',language='en',lemma_id='x',record_sha256='1'),dict(id='b',family_id='F',language='de',lemma_id='y',record_sha256='2'),dict(id='c',family_id='G',language='de',lemma_id='y',record_sha256='3'),dict(id='d',family_id='H',language='fr',lemma_id='z',record_sha256='1')]
c=linked_clusters(cases);assert len(set(c.values()))==1
assert [r['family_id'] for r in cases]==['F','F','G','H']
assert sanitized(dict(confidence=.99,risk_flags=['X'],components=[dict(path=['a','b'],confidence=1)],review_status='safe'))==dict(components=[dict(path=['a','b'])])
`));
test('human gold rejects synthetic answers, stale scopes, one reviewer and arbitration as review',()=>py(String.raw`
from associativvordes.cleanup_quality.human import *
from associativvordes.family_boundary.core import digest
c=dict(id='c',language='en',protocol_sha256='p',family_id='F',lemma_id='L');c['content_sha256']=digest(c)
people={a:dict(kind='human',authorization_ref='TEST_ONLY',qualified_languages=['en'],roles=['A','B','arbiter']) for a in ['a','b','arb']}
def j(actor,role='A',verdict='VALID'):
 return dict(case_id='c',case_sha256=c['content_sha256'],protocol_sha256='p',actor_id=actor,role=role,action='independent_review',blind_to_predictions=True,blind_to_other_review=True,verdict=verdict,pos='NOUN',sense='TEST_ONLY',relation='derivation',reason='TEST_ONLY',sources=[dict(locator='fixture',finding='TEST_ONLY',publisher='fixture')],reviewed_at='2026-10-24T00:00:00Z')
assert compile_gold([c],[],[],people)['rows'][0]['gold'] is None
assert compile_gold([c],[j('a')],[],people)['rows'][0]['gold'] is None
def bad(fn):
 try:fn()
 except ValueError:pass
 else:raise AssertionError('invalid human evidence accepted')
bad(lambda:compile_gold([c],[dict(j('a'),action='arbitrate')],[],people))
bad(lambda:compile_gold([c],[dict(j('a'),case_sha256='other')],[],people))
bad(lambda:compile_gold([c],[j('a'),j('a','B')],[],people))
bad(lambda:compile_gold([c],[j('a')],[],dict(people,a=dict(kind='llm'))))
a,b=j('a'),j('b','B','INVALID');assert compile_gold([c],[a,b],[],people)['rows'][0]['gold'] is None
adj=dict(j('arb'),action='arbitrate',review_sha256=[digest(a),digest(b)])
assert compile_gold([c],[a,b],[adj],people)['rows'][0]['state']=='ADJUDICATED'
bad(lambda:compile_gold([c],[a,b],[dict(adj,actor_id='a')],people))
`));
test('a qualified exact structural scope never grants semantic or production authority',()=>py(String.raw`
from associativvordes.cleanup_quality.gates import *
from associativvordes.family_boundary.core import digest
p=dict(operation_class='SAFE_STRUCTURAL_FIX',rule='CORRECT_PROVEN_COUNTER',exact_scope=['F'],source_version='v',before_sha256='b',after_sha256='a',evidence_refs=['TEST_ONLY'],inverse_operation={'old':1})
def receipt(h):return dict(operation_sha256=h,authority='INDEPENDENT_ENGINEERING_VERIFIER',**{k:True for k in ['full_scope_checked','semantic_relation_set_identical','provenance_preserved','untouched_records_identical','rollback_verified','source_hashes_verified','history_clear','correspondences_clear']})
q=qualify(p,receipt);assert q['status']=='QUALIFIED_FOR_EXACT_SCOPE' and q['production_operation']=='NONE'
assert qualify(p)['status']=='INSUFFICIENT_EVIDENCE'
assert qualify(dict(p,operation_class='SEMANTIC_EXCLUSION'),receipt)['status']=='HUMAN_REVIEW_REQUIRED'
assert qualify(dict(p,basis='MODEL_CONFIDENCE_ONLY'),receipt)['status']=='REJECTED_POLICY'
`));
