import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateDecision,validateSchema,evaluateMembership,assessRecognition,
  automaticCorrectionEligibility,evaluateAssociation,digest,scopeCovers,rules,stepDigest } from '../associativvordes/normative/validator.mjs';

const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const base='associativvordes/normative/';
const cases=read(base+'cases.json').cases, sources=read(base+'sources.json').sources;
const locks=read('audit/associative-family-normative/INPUT-LOCK.json');
const M='CONFIRMED_MEMBER',N='CONFIRMED_NONMEMBER',U='UNRESOLVED',C='CONFLICT';
const axes=['evidence_status','lexical_identity_status','sense_status','relation_status','association_status'];

// TEST ONLY: these objects are a verifier simulation, never reviewer/owner approvals.
function fixture(c=cases[0]) {
  const element={id:'element:'+c.kind+':'+c.element,kind:c.kind,normative_form:c.element,target_meaning:c.element};
  const scope={family_id:'family:'+c.element,element_id:element.id,language:c.language,
    lemma_id:'fixture:lemma:'+c.language+':'+c.lemma,lexeme_id:'fixture:lexeme:'+c.language+':'+c.lemma,
    sense_id:c.sense===null?null:'fixture:sense:'+c.sense,context_id:'fixture:context:'+c.id};
  const evidence=c.sources.map(id=>({...sources[id],id,scope:structuredClone(scope),
    polarity:c.expected===N?'rebuts':'supports',origin:'dictionary'}));
  const ids=evidence.map(e=>e.id), confirmed=[M,N].includes(c.expected);
  let steps=[];
  if (c.relation_type==='indirect' && confirmed) {
    const words=c.language==='ru'?['la:regula','fr:règle','fr:régler','fr:règlement','ru:регламент']:['la:regula','fr:règle','fr:régler','fr:règlement'];
    steps=ids.map((id,i)=>({from:i===0?words[0]:'fixture:path:'+words[i],
      to:i===ids.length-1?scope.lexeme_id:'fixture:path:'+words[i+1],
      from_sense:i===0?'rule':'relevant',to_sense:i===ids.length-1?scope.sense_id:'relevant',
      direction:'directed',evidence_ids:[id]}));
  }
  for(let i=0;i<steps.length;i++) {
    const step=steps[i];
    step.from_scope=i===0?{...scope,language:'fr',lemma_id:step.from,lexeme_id:step.from,sense_id:step.from_sense,context_id:'path:'+step.from}:structuredClone(steps[i-1].to_scope);
    step.to_scope=i===steps.length-1?structuredClone(scope):{...scope,language:'fr',lemma_id:step.to,lexeme_id:step.to,sense_id:step.to_sense,context_id:'path:'+step.to};
    const e=evidence.find(e=>e.id===step.evidence_ids[0]);e.scope=structuredClone(step.to_scope);e.relation_step_sha256=stepDigest(step);
  }
  const d={schema_version:'1.0.0',id:'test-only:'+c.id,element,scope,decision:c.expected,
    evidence_status:confirmed?'documented':'insufficient',lexical_identity_status:'resolved',
    sense_status:c.sense===null?'unresolved':'resolved',relation_status:confirmed?(c.expected===M?'supported':'refuted'):'unresolved',
    association_status:c.association_status,relation_type:c.relation_type,
    correspondence:!confirmed && c.relation_type==='indirect'?null:{form:c.form,scope:structuredClone(scope),evidence_ids:ids,steps},
    axis_evidence:Object.fromEntries(axes.map(k=>[k,k==='association_status'?[]:ids])),
    evidence,reason:c.explanation,supersedes:[],provenance:{snapshot_sha256:digest(locks.baseline_commit),
      source_lock_sha256:digest(locks),algorithm_sha256:digest('TEST_ONLY'),policy_version:'1.0.0',origin:'test_fixture'}};
  return d;
}
function trust(d) { return {verifiedEvidenceIds:new Set(d.evidence.map(e=>e.id)),authorizedDecisionIds:new Set([d.id]),
  verifiedEvidenceDigests:new Map(d.evidence.map(e=>[e.id,digest(e)])),authorizedDecisionDigests:new Map([[d.id,digest(d)]]),allowTestFixtures:true}; }
function result(d,ctx=trust(d)) { return evaluateMembership(d,ctx).decision; }

for (const c of cases) test('explainable case: '+c.id,()=>{
  const d=fixture(c); assert.ok(c.explanation.length>20); assert.ok(validateDecision(d));
  assert.equal(result(d),c.expected); assert.equal(result(d,{}),U);
  assert.equal(d.element.normative_form,c.element);
});

test('word/lexeme ID cannot be normative root ID',()=>{
  const d=fixture();d.element.id=d.scope.element_id='lexeme:manucure';assert.throws(()=>validateDecision(d),/normative element/);
  d.element.kind='word';assert.throws(()=>validateDecision(d),/enum/);
});
test('single-language membership survives failure of three-language threshold',()=>{
  const d=fixture();assert.equal(result(d),M);
  assert.equal(assessRecognition('root',{languages:['fr'],FAv:99,calculator_gates_passed:true}).eligible,false);
  assert.equal(result(d),M);
});
test('national form differs from normative form',()=>{
  const d=fixture(cases.find(c=>c.id==='manu-mani')); assert.equal(d.element.normative_form,'manu');
  assert.equal(d.correspondence.form,'мани');assert.equal(result(d),M);
});
for (const field of ['family_id','element_id','language','lemma_id','lexeme_id','sense_id','context_id'])
  test('no transfer of correspondence across '+field,()=>{
    const d=fixture();d.correspondence.scope[field]='different';assert.throws(()=>validateDecision(d),/scope mismatch|anyOf/);
  });
test('unknown is not a negative decision',()=>{
  const d=fixture();d.decision=N;d.relation_status='unresolved';assert.throws(()=>validateDecision(d),/refutation/);
});
test('confirmed member requires independently evidenced national correspondence',()=>{
  const d=fixture();d.correspondence.evidence_ids=[];assert.throws(()=>validateDecision(d),/correspondence missing/);
});
test('historical membership gives no association score',()=>{
  const d=fixture(cases.find(c=>c.id==='ocul-opaque')); assert.equal(result(d),M);
  assert.equal(d.association_status,'unknown');assert.equal('A' in d,false);
  d.association_status='supported';assert.throws(()=>validateDecision(d),/association proof/);
});
test('separate senses retain separate scopes',()=>{
  const a=fixture(cases.find(c=>c.id==='ocul-adj')),b=fixture(cases.find(c=>c.id==='ocul-noun'));
  assert.equal(a.scope.lexeme_id,b.scope.lexeme_id);assert.notEqual(a.scope.sense_id,b.scope.sense_id);
  b.scope.context_id=a.scope.context_id;
  assert.equal(scopeCovers(a.scope,b.scope),false);
});
test('modern association needs a separate verified assessment',()=>{
  const d=fixture();assert.equal(evaluateAssociation(d,trust(d)).status,'unknown');
  d.association_status='supported';d.axis_evidence.association_status=[d.evidence[0].id];
  assert.equal(evaluateAssociation(d,trust(d)).status,'unknown');
  const ctx={...trust(d),verifiedAssociationDecisionIds:new Set([d.id])};
  assert.equal(evaluateAssociation(d,ctx).status,'supported');
  d.association_status='weak';assert.equal(evaluateAssociation(d,{...trust(d),verifiedAssociationDecisionIds:new Set([d.id])}).status,'weak');assert.equal(result(d),M);
});
test('unknown homonym sense blocks confirmation',()=>{
  const d=fixture();d.scope.sense_id=null;d.correspondence.scope.sense_id=null;d.evidence.forEach(e=>e.scope.sense_id=null);
  assert.throws(()=>validateDecision(d),/scope incomplete/);
});
test('model confidence/consensus is never an authority',()=>{
  const d=fixture();d.provenance.origin='model';assert.equal(result(d),U);
  d.provenance.origin='test_fixture';d.evidence.forEach(e=>e.origin='model');assert.equal(result(d),U);
  d.confidence=1;assert.throws(()=>validateDecision(d),/unknown field/);
});
test('source dataset alone cannot confirm linguistic membership',()=>{
  const d=fixture();d.evidence.forEach(e=>e.origin='source_dataset');assert.equal(result(d),U);
});
test('test fixture authority is disabled outside explicit test mode',()=>{
  const d=fixture();assert.equal(result(d,{...trust(d),allowTestFixtures:false}),U);
});
test('trusted IDs cannot be reused after changing decision or evidence content',()=>{
  const d=fixture(),ctx=trust(d);d.reason+=' changed';assert.equal(result(d,ctx),U);
  const x=fixture(),prior=trust(x);x.evidence[0].finding+=' changed';
  const {source,version,locator,finding}=x.evidence[0];x.evidence[0].assertion_sha256=digest({source,version,locator,finding});
  prior.authorizedDecisionDigests.set(x.id,digest(x));assert.equal(result(x,prior),U);
});
test('tampered assertion fails hash validation',()=>{
  const d=fixture();d.evidence[0].finding+=' altered';assert.throws(()=>validateDecision(d),/digest mismatch/);
});
test('contradictory trusted evidence cannot be hidden behind documented status',()=>{
  const d=fixture();const e={...structuredClone(d.evidence[0]),id:'opposite',polarity:'rebuts'};
  d.evidence.push(e);d.axis_evidence.relation_status.push(e.id);assert.equal(result(d),C);
});
test('negative polarity cannot support a positive verdict',()=>{
  const d=fixture();d.evidence[0].polarity='rebuts';assert.equal(result(d),U);
});
test('indirect path must be complete, sense-continuous and terminate at exact target',()=>{
  const d=fixture(cases.find(c=>c.id==='regul-regl'));assert.equal(result(d),M);
  const x=structuredClone(d);x.correspondence.steps[1].from_sense='homonym';assert.throws(()=>validateDecision(x),/discontinuous|endpoint scope/);
  const y=structuredClone(d);y.correspondence.steps.at(-1).to='other';assert.throws(()=>validateDecision(y),/endpoint/);
  d.correspondence.steps=[];assert.throws(()=>validateDecision(d),/path missing|scope mismatch/);
});
test('pending/excluded v6 guards cannot be promoted implicitly',()=>{
  const d=fixture();for(const guard of ['pending','uncertain','excluded','quarantine']){
    const ctx={...trust(d),history:[{id:'prior',scope:d.scope,guard}]};
    assert.equal(result(d,ctx),['excluded','quarantine'].includes(guard)?C:U);
  }
});
test('supersedes input alone cannot erase a negative; verified explicit supersession can',()=>{
  const d=fixture();d.supersedes=['prior'];const ctx={...trust(d),history:[{id:'prior',scope:d.scope,decision:N}]};
  assert.equal(result(d,ctx),C);ctx.authorizedSupersessions=new Set([d.id+':prior']);assert.equal(result(d,ctx),M);
});
test('old negative remains active on a later unknown proposal',()=>{
  const d=fixture();d.decision=U;assert.equal(result(d,{history:[{id:'prior',scope:d.scope,decision:N}]}),N);
});
test('old exclusions with no semantic certification remain guards, not new confirmations',()=>{
  const d=fixture();d.decision=U;assert.equal(result(d,{history:[{id:'old',scope:d.scope,guard:'excluded'}]}),U);
});

const legacy=read('audit/associative-family-v5/manual-case-decisions.json');
for(const row of legacy.rejected_memberships) test('preserve actual legacy exclusion: '+row.family_id+'/'+row.word,()=>{
  const d=fixture();Object.assign(d.scope,{family_id:row.family_id,language:row.language,lemma_id:row.lemma_id});
  d.correspondence.scope=structuredClone(d.scope);d.evidence.forEach(e=>e.scope=structuredClone(d.scope));
  const prior={id:'legacy:'+row.lemma_id,scope:{...d.scope,lexeme_id:null,sense_id:null,context_id:null},guard:'excluded'};
  assert.equal(result(d,{...trust(d),history:[prior]}),C);
  prior.scope.family_id+=':other';assert.equal(result(d,{...trust(d),history:[prior]}),M);
});
test('legacy quarantine covers narrower lemma scope',()=>{
  const d=fixture(),q=legacy.quarantined_families[0];d.scope.family_id=q.family_id;
  d.correspondence.scope=structuredClone(d.scope);d.evidence.forEach(e=>e.scope=structuredClone(d.scope));
  const prior={id:'quarantine',scope:{...d.scope,lemma_id:null,lexeme_id:null,sense_id:null,context_id:null},guard:'quarantine'};
  assert.equal(result(d,{...trust(d),history:[prior]}),C);
});

for(const kind of ['root','preposition']) test(kind+' recognition boundaries and immutable necessary thresholds',()=>{
  const x={languages:['en','fr','ru'],FAv:35,calculator_gates_passed:true};
  assert.equal(assessRecognition(kind,x).eligible,true);
  for(const bad of [{FAv:34.999},{FAv:null},{FAv:'35'},{FAv:Infinity},{languages:['fr','es','it']},
    {languages:['en','en','fr']},{languages:['en','fr','la']},{calculator_gates_passed:false}])
    assert.equal(assessRecognition(kind,{...x,...bad}).eligible,false);
  assert.equal(assessRecognition(kind,x).recognition_authorized,false);
});
test('suffix preserves FAa 15 and >=3 IPM in EACH language',()=>{
  const x={languages:['en','fr','ru'],FAa:15,ipm:{en:3,fr:3,ru:3},calculator_gates_passed:true};
  assert.equal(assessRecognition('suffix',x).eligible,true);
  for(const bad of [{FAa:14.99},{ipm:{en:3,fr:3,ru:2.99}},{ipm:{en:3,fr:3}}])
    assert.equal(assessRecognition('suffix',{...x,...bad}).eligible,false);
  assert.deepEqual(rules.preserved_metrics,['Di','Pr','Sh','SWOW','A','F','P','FAv','FAₐ']);
});
test('automatic correction is scoped, locked, externally authorized and never writes',()=>{
  const d=fixture(),ctx={...trust(d),operation:'ADD_MEMBER',currentLocks:d.provenance,exactOperationVerified:true,releaseGatesVerified:true};
  assert.equal(automaticCorrectionEligibility(d,ctx).eligible,true);
  for(const bad of [{currentLocks:{}},{releaseGatesVerified:false},{exactOperationVerified:false},{operation:'create_root'},
    {operation:'EXCLUDE_MEMBER'},{authorizedDecisionIds:new Set()},{verifiedEvidenceIds:new Set()}])
    assert.equal(automaticCorrectionEligibility(d,{...ctx,...bad}).eligible,false);
  assert.equal(automaticCorrectionEligibility(d,ctx).write_authorized,false);
});
test('closed schema rejects unknown fields and nonmatching versions',()=>{
  const d=fixture();d.schema_version='2';assert.throws(()=>validateSchema(d),/const/);
  d.schema_version='1.0.0';d.unchecked=true;assert.throws(()=>validateSchema(d),/unknown field/);
});
test('protected calculation and negative-policy files keep baseline Git blob hashes',()=>{
  for(const entry of [...locks.protected_files,...locks.historical_decision_files]){
    const bytes=readFileSync(new URL('../'+entry.path,import.meta.url));
    const hash=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    assert.equal(hash,entry.git_blob,entry.path);
  }
});



test('4354127381: correspondence rebuttal cannot establish membership',()=>{
 const d=fixture();const e={...structuredClone(d.evidence[0]),id:'correspondence-rebuttal',polarity:'rebuts'};
 d.evidence.push(e);d.correspondence.evidence_ids=[e.id];
 assert.notEqual(result(d),M);
});
test('4354127391: untrusted declared conflicts have no normative authority',()=>{
 for(const field of ['decision','evidence_status','lexical_identity_status','sense_status','relation_status']){
  const d=fixture();d.decision=U;d[field]=field==='decision'?C:field==='evidence_status'?'contradictory':'conflict';
  assert.equal(result(d,{}),U,field);
 }
});
test('4354127396: verified nonmembership survives compatible legacy guards',()=>{
 const d=fixture(cases.find(c=>c.expected===N));
 for(const guard of ['excluded','quarantine'])assert.equal(result(d,{...trust(d),history:[{id:'old',scope:d.scope,guard}]}),N);
});
test('4354127406: indirect evidence retains exact intermediate endpoint scopes',()=>{
 const d=fixture(cases.find(c=>c.id==='regul-regl'));
 for(const step of d.correspondence.steps.slice(0,-1)){
  const e=d.evidence.find(e=>e.id===step.evidence_ids[0]);
  e.scope=structuredClone(step.to_scope);
 }
 assert.doesNotThrow(()=>validateDecision(d));assert.equal(result(d),M);
 const bad=structuredClone(d);bad.evidence[0].scope.lexeme_id='unrelated';
 assert.throws(()=>validateDecision(bad),/scope mismatch/);
});

test('4354127406: intermediate contexts remain distinct and cannot replace final identity proof',()=>{
 const d=fixture(cases.find(c=>c.id==='regul-regl'));
 const intermediate=[];
 for(const step of d.correspondence.steps.slice(0,-1)){
  const e=d.evidence.find(e=>e.id===step.evidence_ids[0]);e.scope=structuredClone(step.to_scope);intermediate.push(e.id);
 }
 assert.doesNotThrow(()=>validateDecision(d));assert.equal(result(d),M);
 d.axis_evidence.lexical_identity_status=intermediate;assert.equal(result(d),U);
});

export {fixture,trust,result,cases};
