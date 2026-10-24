import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const v=await import(process.env.P14_NORMATIVE_VALIDATOR?pathToFileURL(process.env.P14_NORMATIVE_VALIDATOR):new URL('../associativvordes/normative/validator.mjs',import.meta.url));
const {digest,evaluateMembership}=v;
function fixture(negative=false){
 const scope={family_id:'family:TEST_ONLY',element_id:'element:root:TEST_ONLY',language:'ru',lemma_id:'lemma:TEST_ONLY',lexeme_id:'lexeme:TEST_ONLY',sense_id:'sense:TEST_ONLY',context_id:'context:TEST_ONLY'};
 const e={id:'e:TEST_ONLY',source:'TEST_ONLY',version:'1',locator:'TEST_ONLY',finding:'TEST_ONLY',scope:structuredClone(scope),origin:'dictionary',polarity:negative?'rebuts':'supports'};
 e.assertion_sha256=digest({source:e.source,version:e.version,locator:e.locator,finding:e.finding});
 return {schema_version:'1.0.0',id:'d:TEST_ONLY',element:{id:scope.element_id,kind:'root',normative_form:'TEST_ONLY',target_meaning:'TEST_ONLY'},scope,decision:negative?'CONFIRMED_NONMEMBER':'CONFIRMED_MEMBER',evidence_status:'documented',lexical_identity_status:'resolved',sense_status:'resolved',relation_status:negative?'refuted':'supported',association_status:'unknown',relation_type:'exact_base',correspondence:{form:'TEST_ONLY',scope:structuredClone(scope),evidence_ids:[e.id],steps:[]},axis_evidence:{evidence_status:[e.id],lexical_identity_status:[e.id],sense_status:[e.id],relation_status:[e.id],association_status:[]},evidence:[e],reason:'TEST_ONLY fixture',supersedes:[],provenance:{snapshot_sha256:'0'.repeat(64),source_lock_sha256:'0'.repeat(64),algorithm_sha256:'0'.repeat(64),policy_version:'1.0.0',origin:'test_fixture'}};
}
const trust=d=>({allowTestFixtures:true,verifiedEvidenceIds:new Set(d.evidence.map(e=>e.id)),verifiedEvidenceDigests:new Map(d.evidence.map(e=>[e.id,digest(e)])),authorizedDecisionIds:new Set([d.id]),authorizedDecisionDigests:new Map([[d.id,digest(d)]])});
test('4354127381: rebutted correspondence cannot confirm a member',()=>{
 const d=fixture(),e={...structuredClone(d.evidence[0]),id:'e:rebut',polarity:'rebuts'};d.evidence.push(e);d.correspondence.evidence_ids=[e.id];
 assert.notEqual(evaluateMembership(d,trust(d)).decision,'CONFIRMED_MEMBER');
});
test('4354127391: untrusted declared conflict remains unresolved',()=>{
 const d=fixture();d.decision='CONFLICT';d.provenance.origin='model';
 assert.equal(evaluateMembership(d).decision,'UNRESOLVED');
});
test('4354127396: fresh verified nonmembership survives a compatible legacy guard',()=>{
 const d=fixture(true);assert.equal(evaluateMembership(d,{...trust(d),history:[{id:'legacy:TEST_ONLY',scope:d.scope,guard:'excluded'}]}).decision,'CONFIRMED_NONMEMBER');
});
test('4354127406: indirect intermediate evidence retains its real endpoint scope',()=>{
 const d=fixture();d.relation_type='indirect';const s={...d.scope,language:'fr',lemma_id:'fr:regle',lexeme_id:'fr:regle',sense_id:'rule',context_id:'fr:TEST_ONLY'};
 const e={...structuredClone(d.evidence[0]),id:'e:intermediate',scope:s};d.evidence.push(e);
 d.correspondence.steps=[{from:'la:regula',to:'fr:regle',from_sense:'rule',to_sense:'rule',direction:'directed',scope:s,evidence_ids:[e.id]},{from:'fr:regle',to:d.scope.lexeme_id,from_sense:'rule',to_sense:d.scope.sense_id,direction:'directed',scope:d.scope,evidence_ids:[d.evidence[0].id]}];
 assert.equal(evaluateMembership(d,trust(d)).decision,'CONFIRMED_MEMBER');
 const wrong=structuredClone(d);wrong.evidence[1].scope.lexeme_id='unrelated';assert.throws(()=>evaluateMembership(wrong,trust(wrong)),/scope mismatch/);
});
