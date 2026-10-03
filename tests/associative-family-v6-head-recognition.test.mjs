import test from 'node:test';
import assert from 'node:assert/strict';
import {recognizeFiniteHeadBindings,proposeMorphologicalHeads} from '../associativvordes/js/associative-family-v6-head-recognition.js';
import {materializeLexicalReviews,reviewBenchmarks} from '../scripts/lib/associative-v6-lexical-review.mjs';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
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
test('new compound reviews retain exact component proof in materialized links',()=>{
 const catalog=JSON.parse(readFileSync(new URL('../associativvordes/family-index-v6/catalog.json',import.meta.url)));
 const r={language:'de',canonical_root:'loc',lemma_id:'lemma:fixture',word:'lokalredaktion',status:'uncertain'};
 const f={id:'lexical-fact:fixture',language:'de',normalized_head:'lokal',sense:'place',forms:[],component_stems:['lokal'],evidence_ids:['proof']};
 const e={id:'proof',language:'de',head:'lokal',sense:'place',status:'accepted',sources:['dictionary']};
 const b={...r,family_id:'family:loc',fact_id:f.id,decision_kind:'accepted_membership_addition',expected_membership_status:'uncertain',link_role:'reviewed_lexical_base_component',identity_proof:[{source:'finite-review'}],component_segmentation:{before:'',component:'lokal',after:'redaktion',head:'lokal',boundary_proof:'finite-reviewed-boundary'}};
 const doc={lexical_facts:[f],evidence_cache:[e],finite_bindings:[b],head_reviews:[{fact_id:f.id,family_id:'family:loc',status:'accepted',expected_version:0,lemma_ids:[r.lemma_id],evidence:[e],reason:'reviewed local newsroom',morphology_policy:'finite_explicit_lemma_ids'}]};
 const result=materializeLexicalReviews({index:{catalog,heads:[],edges:[],links:[],corpus:new Map()},review:{doc,facts:new Map([[f.id,f]])},external:new Map([['de\0'+r.lemma_id,{m:{word:r.word},proof:{path:'fixture'}}]]),headId:()=> 'head:fixture',prior:[],sourceQueue:[r]});
 assert.deepEqual(result.index.links[0].component_segmentation,b.component_segmentation);
 assert.equal(result.index.links[0].whole_compound_identity_established,false);
 assert.equal(result.index.memberships.length,1);
});
test('pending review acceleration is separate from resolving investigated uncertainties',()=>{
 const backlog=[{language:'en',canonical_root:'relat',lemma_id:'lemma:pending',word:'relace',queue:'relat',status:'pending_review',review_unit:'one'},{language:'ru',canonical_root:'loc',lemma_id:'lemma:uncertain-a',word:'посёлок',queue:'loc',status:'uncertain',review_unit:'two'},{language:'ru',canonical_root:'loc',lemma_id:'lemma:uncertain-b',word:'поселок',queue:'loc',status:'uncertain',review_unit:'three'}];
 const ledger=[{language:'en',family_id:'family:relat',head_id:'head:one',affected_lemma_ids:['lemma:pending'],status:'excluded',review_stage:'relat'},{language:'ru',family_id:'family:loc',head_id:'head:two',affected_lemma_ids:['lemma:uncertain-a','lemma:uncertain-b'],status:'excluded',review_stage:'loc'}];
 const m=reviewBenchmarks({backlog,frames:[],review:{doc:{finite_bindings:[],lexical_facts:[]},facts:new Map()},ledger,headId:()=>{throw Error('No lexical identity invented');}}).metrics;
 assert.equal(m.new_records_resolved,3);assert.equal(m.newly_pending_records_resolved,1);assert.equal(m.investigated_uncertainties_resolved,2);assert.equal(m.pending_review_reduction_factor,1);assert.equal(m.new_review_reduction_factor,1.5);
});

test('uncertain family review groups proven identities but preserves the entire active queue',()=>{
 const catalog=JSON.parse(readFileSync(new URL('../associativvordes/family-index-v6/catalog.json',import.meta.url))),x=fixture();
 x.facts[0].forms.push('creates');
 const source=x.records.concat({...x.records[0],lemma_id:'lemma:second',word:'creates'}).map(r=>({...r,canonical_root:'creat',status:'pending_review',queue:'creat',review_unit:r.lemma_id,reason:'Not yet investigated'}));
 const bindings=source.map(r=>({...r,fact_id:x.facts[0].id,expected_membership_status:'pending',decision_kind:'investigated_uncertainty',link_role:'inflection',identity_proof:[{source:'reviewed-finite-identity'}]}));
 const doc={finite_bindings:bindings,lexical_facts:x.facts,evidence_cache:x.evidence,head_reviews:[{fact_id:x.facts[0].id,family_id:'family:creat',status:'uncertain',expected_version:0,lemma_ids:source.map(r=>r.lemma_id),reason:'Lexical identity established; family relation remains unresolved',evidence:[{source:'identity-only-review'}],review_stage:'uncertain-fixture',morphology_policy:'finite_explicit_lemma_ids'}]};
 const review={doc,facts:new Map(x.facts.map(f=>[f.id,f]))},external=new Map(source.map(r=>[r.language+'\0'+r.lemma_id,{m:{lemma_id:r.lemma_id,word:r.word},proof:{source:'real-fixture-record'}}]));
 const headId=()=> 'head:fixture';
 const result=materializeLexicalReviews({index:{catalog,heads:[],edges:[],links:[],memberships:[],corpus:new Map()},review,external,headId,prior:[],sourceQueue:source});
 assert.deepEqual(result.index.memberships,[]);assert.equal(result.ledger[0].decision_kind,'investigated_uncertainty');
 const measured=reviewBenchmarks({backlog:source,frames:[{name:'creat',path:'fixture'}],review,ledger:result.ledger,headId});
 assert.equal(measured.active.length,2);assert.equal(measured.ranked.length,1);assert(measured.active.every(r=>r.status==='uncertain'&&r.source_membership_status==='pending_review'));
 assert.equal(measured.metrics.new_records_resolved,0);assert.equal(measured.metrics.records_reviewed,2);assert.equal(measured.metrics.unresolved_reviewed_records,2);assert.equal(measured.metrics.newly_pending_records_investigated_without_resolution,2);
 assert.deepEqual(measured.metrics.current_status_counts,{pending:0,uncertain:2});assert.equal(measured.metrics.new_review_reduction_factor,0);assert.equal(measured.metrics.pending_review_reduction_factor,0);
 assert.equal(measured.benchmarks[0].records_after,2);assert.equal(measured.benchmarks[0].records_resolved,0);assert.equal(measured.benchmarks[0].reviewed_records_retained_uncertain,2);
});
test('research-only withdrawn evidence cannot mutate finite review bindings',()=>{
 const path=new URL('../associativvordes/family-index-v6/lexical-head-review.json.gz',import.meta.url),before=readFileSync(path);
 assert.throws(()=>execFileSync(process.execPath,['scripts/integrate-associative-v6-reviewed-stage.mjs','audit/associative-family-v6/actin-protein-head-evidence-20261003.json'],{stdio:'pipe'}),/Finite identity binding not approved/);
 assert.deepEqual(readFileSync(path),before);
});
