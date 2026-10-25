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
from associativvordes.cleanup_quality.privacy import blind_record,assert_blind_record,require_final_blinding
cases=[dict(id='a',family_id='F',language='en',lemma_id='x',record_sha256='1'),dict(id='b',family_id='F',language='de',lemma_id='y',record_sha256='2'),dict(id='c',family_id='G',language='de',lemma_id='y',record_sha256='3'),dict(id='d',family_id='H',language='fr',lemma_id='z',record_sha256='1')]
c=linked_clusters(cases);assert len(set(c.values()))==1
assert [r['family_id'] for r in cases]==['F','F','G','H']
assert sanitized(dict(confidence=.99,risk_flags=['X'],components=[dict(path=['a','b'],confidence=1)],review_status='safe'))==dict(components=[dict(path=['a','b'])])
raw=dict(word='TEST_ONLY',components=[dict(canonical_candidate='GUESS',evidence=[dict(path=['x','y'])])],national_form='GUESS',sources=[dict(id='corpus',confidence=1,ipm=9)])
assert blind_record(raw)==dict(word='TEST_ONLY',sources=[dict(id='corpus')]);assert_blind_record(blind_record(raw))
try:assert_blind_record(raw)
except ValueError:pass
else:raise AssertionError('component predictions visible to blind reviewer')
import tempfile
with tempfile.TemporaryDirectory() as td:
 try:require_final_blinding(td)
 except ValueError:pass
 else:raise AssertionError('intermediate packets eligible for human evaluation')
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


test('4367043681: NOT_RUN has no performance estimates even with complete gold',()=>py(String.raw`
from associativvordes.cleanup_quality.statistics import evaluate
rows=[dict(weight=1,cluster=str(i),prediction='NOT_RUN',gold='VALID' if i%2 else 'INVALID') for i in range(40)]
s=evaluate(rows,repetitions=50)
for k in ['precision_exclusions','false_removal_rate','recall_erroneous_existing_links']:
 assert s[k]['value'] is None and s[k]['ci95_linked_cluster_bootstrap'] is None
`));
test('4367043683: resolved human answers require an explicit relation',()=>py(String.raw`
from associativvordes.cleanup_quality.human import validate
c=dict(id='c',content_sha256='h',protocol_sha256='p',language='en')
r=dict(a=dict(kind='human',authorization_ref='TEST_ONLY',qualified_languages=['en'],roles=['A','arbiter']))
for role in ['A','arbiter']:
 j=dict(actor_id='a',action='arbitrate' if role=='arbiter' else 'independent_review',case_id='c',case_sha256='h',protocol_sha256='p',blind_to_predictions=True,blind_to_other_review=True,verdict='VALID',pos='NOUN',sense='x',reason='TEST_ONLY',sources=[dict(locator='fixture',finding='x',publisher='fixture')],reviewed_at='2026-10-25T00:00:00Z')
 try:validate(j,c,r,role)
 except ValueError:pass
 else:raise AssertionError('missing relation accepted')
 j['relation']='derivation';assert validate(j,c,r,role)==j
`));
test('4367043688: missing required bundle sources fail before publication',()=>py(String.raw`
import tempfile
from pathlib import Path
from associativvordes.cleanup_quality.bundle import pack
with tempfile.TemporaryDirectory() as t:
 p=Path(t);missing=p/'missing';archive=p/'archive.zip'
 try:pack(archive,missing,missing,missing,missing,missing)
 except (ValueError,FileNotFoundError):pass
 else:raise AssertionError('missing inputs silently archived')
 assert not archive.exists()
`));

test('4367043686: documentary additions share existing family clusters and rebind all cards',()=>py(String.raw`
import tempfile,json
from pathlib import Path
from associativvordes.cleanup_quality.supplement import run
from associativvordes.cleanup_quality.evaluate import release,rows
from associativvordes.family_boundary.core import stream,save,digest,sha
with tempfile.TemporaryDirectory() as td:
 p=Path(td);source=p/'source';source.mkdir();cases=[]
 for dataset,lid in [('probability','one'),('challenge','two')]:
  c=dict(id=lid,dataset=dataset,split='holdout',family_id='family:manu',language='fr',lemma_id=lid,word='manucure',cluster='TEST_ONLY_OLD_CLUSTER',protocol_sha256='fixture',source_record=dict(word='manucure'),case_kind='EXISTING_MEMBERSHIP');c['content_sha256']=digest(c);cases.append(c)
 for dataset,name in [('probability','PROBABILITY.ndjson.gz'),('challenge','CHALLENGE.ndjson.gz')]:stream(source/name,(c for c in cases if c['dataset']==dataset))
 for role in ['A','B']:stream(source/f'BLIND-{role}.ndjson.gz',(dict(task_id=role+c['id'],role=role,case_id=c['id'],case_sha256=c['content_sha256'],source_record=c['source_record']) for c in cases))
 stream(source/'PREDICTIONS.ndjson.gz',[])
 save(source/'SAMPLING-DESIGN.json',dict(strata={'fr':dict(N=10,n=1)}));save(source/'HOLDOUT.json',dict(challenge=1,known_historical_exposure_units=0))
 for name in ['RAW-HUMAN-REVIEWS.ndjson','RAW-ADJUDICATIONS.ndjson']:(source/name).write_text('')
 save(source/'MANIFEST.json',dict(identity={},case_set_sha256=digest(cases),probability_cases=1,challenge_cases=1,files=[dict(path=f.name,bytes=f.stat().st_size,sha256=sha(f)) for f in sorted(source.iterdir())]))
 out=p/'out';run(source,out);new,m=release(out);linked=[c for c in new if c['family_id']=='family:manu'];assert len(linked)>2 and len({c['cluster'] for c in linked})==1
 index={c['id']:c for c in new}
 for role in ['A','B']:
  for card in rows(out/f'BLIND-{role}.ndjson.gz'):assert card['case_sha256']==index[card['case_id']]['content_sha256']
 for pred in rows(out/'PREDICTIONS.ndjson.gz'):assert pred['case_sha256']==index[pred['case_id']]['content_sha256']
`));
