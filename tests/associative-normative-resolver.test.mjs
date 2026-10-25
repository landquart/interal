import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,trust,result,cases} from './associative-normative.test.mjs';
import {evaluateAssociation,validateDecision,digest,stepDigest,evaluateMembership} from '../associativvordes/normative/validator.mjs';
const M='CONFIRMED_MEMBER',U='UNRESOLVED',C='CONFLICT';
for(const field of ['language','lemma_id','context_id','lexeme_id','sense_id'])test('step cannot borrow another '+field,()=>{
 const d=fixture(cases.find(c=>c.id==='regul-regl'));
 const step=d.correspondence.steps[0],e=d.evidence.find(e=>e.id===step.evidence_ids[0]);
 e.scope[field]='unrelated';assert.throws(()=>validateDecision(d),/scope mismatch|enum/);
});
test('indirect step proof is bound to the complete directed transition',()=>{
 const d=fixture(cases.find(c=>c.id==='regul-regl'));
 d.evidence[0].relation_step_sha256=digest('another directed transition');assert.equal(result(d),U);
});
test('historical unscoped steps remain readable without confirmation',()=>{
 const d=fixture(cases.find(c=>c.id==='regul-regl'));
 for(const step of d.correspondence.steps){delete step.from_scope;delete step.to_scope;}
 d.evidence.forEach(e=>e.scope=structuredClone(d.scope));assert.ok(validateDecision(d));assert.equal(result(d),U);
});
test('full continuity includes language, lemma and application context',()=>{
 const d=fixture(cases.find(c=>c.id==='regul-regl'));d.correspondence.steps[1].from_scope.context_id='another';
 assert.throws(()=>validateDecision(d),/discontinuous/);
});
test('trusted rebuttal attached only to correspondence creates a conflict',()=>{
 const d=fixture();const e={...structuredClone(d.evidence[0]),id:'rebuttal',polarity:'rebuts'};
 d.evidence.push(e);d.correspondence.evidence_ids.push(e.id);assert.equal(result(d),C);
});
test('untrusted correspondence disagreement cannot create a normative conflict',()=>{
 const d=fixture();const e={...structuredClone(d.evidence[0]),id:'rebuttal',polarity:'rebuts',origin:'model'};
 d.evidence.push(e);d.correspondence.evidence_ids.push(e.id);assert.equal(result(d),M);
 const ctx=trust(d);ctx.verifiedEvidenceIds.delete(e.id);assert.equal(evaluateMembership(d,ctx).decision,M);
});
test('partial historical scope never permits a narrower conflicting restoration',()=>{
 const d=fixture();assert.equal(result(d,{...trust(d),history:[{id:'old',scope:{family_id:d.scope.family_id},guard:'excluded'}]}),C);
});
test('current unknown sense cannot evade an old narrower prohibition',()=>{
 const d=fixture();d.decision=U;d.scope.sense_id=null;d.correspondence.scope.sense_id=null;d.evidence.forEach(e=>e.scope.sense_id=null);
 const prior={id:'old',scope:{family_id:d.scope.family_id,sense_id:'known old sense'},guard:'excluded'};
 assert.equal(evaluateMembership(d,{history:[prior]}).reason,'preserved_prior_negative');
});
test('modern support requires current content-bound proof independent of membership',()=>{
 const d=fixture();d.association_status='supported';d.axis_evidence.association_status=[d.evidence[0].id];
 const ctx={...trust(d),verifiedAssociationDecisionIds:new Set([d.id])};assert.equal(evaluateAssociation(d,ctx).status,'supported');
 d.evidence[0].polarity='rebuts';assert.notEqual(evaluateAssociation(d,ctx).status,'supported');
});
test('a model cannot declare a verified association conflict',()=>{
 const d=fixture();d.association_status='conflict';assert.equal(evaluateAssociation(d,{}).status,'unknown');
});
test('runtime callers cannot mutate normative thresholds or the closed schema',async()=>{
 const {rules,schema}=await import('../associativvordes/normative/validator.mjs');
 assert.throws(()=>{rules.thresholds.root.languages=1;},TypeError);
 assert.throws(()=>{schema.required.length=0;},TypeError);
 assert.equal(rules.thresholds.root.languages,3);
});
