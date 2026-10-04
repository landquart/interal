import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {organize,identityGrade,corpusKey} from '../scripts/lib/associative-v6-queue-organization.mjs';
// Explicitly synthetic: none of these IDs may enter real registries.
const occurrence=(id,root,status='pending',frame='current')=>({occurrence_id:id+root+frame,language:'xx',lemma_id:'synthetic:'+id,word:id,root,status,frame,locator:'synthetic-fixture/'+id+'/'+root+'/'+frame,head_ids:[],routes:['synthetic:route']});
const fact=(id,roots)=>({head_id:'synthetic:head:'+id,language:'xx',sense:'synthetic',version:1,finite_scope:roots.map(root=>({language:'xx',lemma_id:'synthetic:word',word:'word',family_id:'family:'+root,identity_grade:'proven_identity',proof_locator:'synthetic-proof'})),family_decisions:roots.map((root,i)=>({family_id:'family:'+root,status:['accepted','excluded','uncertain'][i%3],version:1}))});
test('synthetic: one corpus ID retains accepted, negative and uncertain independent questions',()=>{
 const result=organize({occurrences:['a','b','c'].map(r=>occurrence('word',r)),cache:[fact('word',['a','b','c'])]});
 assert.equal(result.records.length,1);assert.equal(result.questions.length,3);assert.equal(result.ranked.length,3);assert.deepEqual(result.ranked.map(g=>g.edge_decisions[0].status).sort(),['accepted','excluded','uncertain']);assert.equal(result.metrics.new_memberships,0);assert.equal(result.metrics.current_proven_units,3);
});
test('synthetic: two components remain independent identities for one word',()=>{
 const result=organize({occurrences:[occurrence('word','a')],cache:[fact('component1',['a']),fact('component2',['a'])]});assert.equal(result.ranked.length,2);assert.equal(result.records[0].identity_references.length,2);assert.equal(result.conservation.before.membership_candidates.length,1);
});
test('synthetic: correction and uncertain retention conserve exact source IDs and routes',()=>{
 const occ=[occurrence('word','a'),occurrence('word','b','uncertain'),occurrence('word','a','accepted','promotion'),occurrence('word','a','excluded','revision')],f=fact('word',['a','b']);
 const before=organize({occurrences:occ,cache:[f]});f.family_decisions[0]={...f.family_decisions[0],status:'excluded',version:2};const after=organize({occurrences:occ,cache:[f]});assert.deepEqual(after.conservation,before.conservation);assert.equal(after.records[0].occurrences.length,4);assert.equal(after.ranked.find(g=>g.root==='b').edge_decisions[0].status,'excluded');assert.equal(after.ranked.find(g=>g.root==='a').edge_decisions[0].version,2);
});
test('synthetic: morphology retrieval cannot create proved reduction or membership',()=>{
 const f=fact('word',['a']);f.finite_scope[0].identity_grade='morphology_proposal';const result=organize({occurrences:[occurrence('word','a')],cache:[f]});assert.equal(result.metrics.proven_groups,0);assert.equal(result.metrics.current_proven_reduction,0);assert(result.ranked.every(g=>!g.accepted_membership_created));
});
test('synthetic: stale/unknown packet scope, duplicates and conflicting corpus identity reject',()=>{
 const o=occurrence('word','a');assert.throws(()=>organize({occurrences:[o,o],cache:[]}),/Repeated/);assert.throws(()=>organize({occurrences:[o,{...occurrence('word','b'),word:'different'}],cache:[]}),/conflict/);assert.throws(()=>organize({occurrences:[o],cache:[],packetRoutes:[{language:'xx',lemma_id:'synthetic:unknown',route_id:'ety:x'}]}),/Out-of-scope/);assert.throws(()=>organize({occurrences:[o],cache:[],packetRoutes:[{language:'xx',lemma_id:o.lemma_id,route_id:'ety:x'}]}),/Unknown/);
});
test('historical labels and legacy exact membership do not establish new identity',()=>{
 assert.equal(identityGrade({identity_kind:'historically_reviewed_lexical_head'},{}),'disputed_identity');assert.equal(identityGrade({identity_kind:'legacy_exact_record'},{identity_proof:['synthetic']}),'morphology_proposal');
});
test('real saved cache covers multilingual positive, negative and uncertain finite branches',()=>{
 const p='audit/associative-family-v6/queue-organization-20261004/generated/',read=n=>JSON.parse(gunzipSync(fs.readFileSync(p+n)));
 const cache=read('lexical-fact-cache.json.gz'),records=Object.values(read('cross-frame-reference-index.json.gz').shards).flatMap(s=>read(s.path)),ranked=read('ranked-candidate-head-queue.json.gz');
 assert.deepEqual([...new Set(cache.map(f=>f.language))].sort(),['de','en','es','fr','it','ru']);assert(cache.some(f=>f.family_decisions.some(e=>e.status==='excluded')));assert(cache.some(f=>f.family_decisions.some(e=>e.status==='uncertain')));assert(cache.some(f=>f.family_decisions.some(e=>e.status==='accepted')));
 assert(cache.every(f=>!f.family_membership_propagates));assert(ranked.every(g=>!g.accepted_membership_created));assert(records.some(r=>r.family_questions.length>1));assert(records.some(r=>new Set(r.occurrences.map(o=>o.frame)).size>1));
 const actin=ranked.find(g=>g.identity_grade==='proven_identity'&&g.root==='act'&&g.open_candidate_ids.length===3);assert(actin);assert.equal(actin.edge_decisions[0].status,'uncertain');
 const system=cache.find(f=>f.language==='de'&&f.normalized_head==='system');assert.deepEqual(system.versions.map(v=>v.version),[1,2]);assert.equal(system.finite_scope.length,3);
 assert(records.every(r=>r.corpus_id===corpusKey(r)&&!r.lemma_id.startsWith('synthetic:')));
});
