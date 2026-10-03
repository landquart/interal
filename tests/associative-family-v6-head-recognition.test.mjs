import test from 'node:test';
import assert from 'node:assert/strict';
import {recognizeFiniteHeadBindings,proposeMorphologicalHeads} from '../associativvordes/js/associative-family-v6-head-recognition.js';
function fixture(){const evidence=[{id:'fact-proof',language:'en',head:'create',sense:'make',status:'accepted',sources:['dictionary']}],facts=[{id:'lexical-fact:create',language:'en',normalized_head:'create',sense:'make',forms:['create','created'],component_stems:['creat'],evidence_ids:['fact-proof']}],records=[{language:'en',family_id:'family:creat',lemma_id:'lemma:real',word:'created'}],bindings=[{...records[0],fact_id:facts[0].id,link_role:'inflection',identity_proof:[{source:'finite-paradigm'}]}];return {evidence,facts,records,bindings};}
test('finite recognition validates language, whole source spelling and independent identity evidence',()=>{
 const f=fixture();assert.equal(recognizeFiniteHeadBindings(f).recognized.length,1);
 for(const mutate of [x=>x.bindings[0].word='creating',x=>x.bindings[0].language='es',x=>x.bindings[0].lemma_id='lemma:invented',x=>x.bindings[0].identity_proof=[],x=>x.evidence[0].sense='believe',x=>x.evidence[0].sources=[]]){const x=structuredClone(f);mutate(x);assert.throws(()=>recognizeFiniteHeadBindings(x));}
});
test('same spelling with incompatible senses remains unmerged',()=>{
 const x=fixture();x.evidence.push({...x.evidence[0],id:'different-proof',sense:'other'});x.facts.push({...x.facts[0],id:'lexical-fact:other',sense:'other',evidence_ids:['different-proof']});x.bindings.push({...x.bindings[0],fact_id:'lexical-fact:other'});
 const r=recognizeFiniteHeadBindings(x);assert.equal(r.recognized.length,0);assert.equal(r.unresolved.length,1);assert.equal(r.rejected.length,1);
});
test('morphology retrieval cannot resolve a record, and finite scopes never match future strings',()=>{
 const x=fixture();x.records.push({...x.records[0],lemma_id:'lemma:other',word:'creates'});const r=recognizeFiniteHeadBindings(x);assert.equal(r.recognized.length,1);assert.equal(r.unresolved.length,1);assert(proposeMorphologicalHeads(x.records,x.facts).every(p=>!p.identity_established&&!p.family_membership_established));
});
test('shared component head does not assert identity of the whole compound',()=>{
 const x=fixture();x.records[0].word='recreated';x.bindings[0]={...x.bindings[0],word:'recreated',link_role:'reviewed_lexical_base_component',component_segmentation:{before:'re',component:'creat',after:'ed',head:'create',boundary_proof:'finite-prior-review'}};assert.equal(recognizeFiniteHeadBindings(x).recognized[0].link_role,'reviewed_lexical_base_component');x.bindings[0].component_segmentation.before='wrong';assert.throws(()=>recognizeFiniteHeadBindings(x));
});
