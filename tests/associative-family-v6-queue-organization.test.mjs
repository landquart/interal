import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {organize,identityGrade,corpusKey,routeOccurrenceId} from '../scripts/lib/associative-v6-queue-organization.mjs';
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
test('synthetic: historical and candidate pools remain open independently of current metrics',()=>{
 const occurrences=[occurrence('word','a','unresolved_historical_without_current_decision','historical'),occurrence('word','b','proposal_requires_review','val'),occurrence('word','c','accepted','completed_review')];
 const result=organize({occurrences,cache:[fact('word',['a','b','c'])]});
 assert.equal(result.metrics.current_membership_candidates,0);assert.equal(result.metrics.current_proven_units,0);assert.equal(result.metrics.open_membership_questions,2);
 assert.deepEqual(result.ranked.find(g=>g.root==='a').open_frames,['historical']);assert.deepEqual(result.ranked.find(g=>g.root==='b').open_frames,['val']);assert.equal(result.ranked.find(g=>g.root==='c').open_candidate_ids.length,0);assert(result.ranked.find(g=>g.root==='a').priority>0);
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

test('synthetic: regroup and finite additions preserve task identity across movable positions',()=>{
 const task={language:'xx',lemma_id:'synthetic:word',root:'a',head_ids:['synthetic:head'],source:'synthetic-source'};
 for(const frame of ['current','materialized','historical_identity','completed_review']){const a=routeOccurrenceId({...task,frame,locator:'snapshot#/1',version:1});assert.equal(a,routeOccurrenceId({...task,frame,locator:'snapshot#/20',version:1}));assert.notEqual(a,routeOccurrenceId({...task,frame,locator:'snapshot#/1',root:'b',version:1}));}
 assert.notEqual(routeOccurrenceId({...task,frame:'revision',version:1}),routeOccurrenceId({...task,frame:'revision',version:2}));
});
test('current planning cache tracks finite decisions independently of the frozen historical cache',()=>{
 const config=JSON.parse(fs.readFileSync('associativvordes/family-index-v6/queue-planning.json')),p=config.output+'/',read=n=>JSON.parse(gunzipSync(fs.readFileSync(p+n)));
 const cache=read('lexical-fact-cache.json.gz'),heads=JSON.parse(gunzipSync(fs.readFileSync('associativvordes/family-index-v6/generated/heads.json.gz'))).filter(h=>h.identity_kind!=='legacy_exact_record');
 assert.deepEqual(cache.map(f=>f.head_id).sort(),heads.map(h=>h.id).sort());
 const stage=JSON.parse(fs.readFileSync('audit/associative-family-v6/oper-relat-continuation-20261004/decision.json'));
 for(const g of stage.groups){const f=cache.find(f=>f.language===g.language&&f.normalized_head===g.normalized_head&&f.sense===g.sense);assert(f);assert.equal(f.family_membership_propagates,false);assert.equal(f.family_decisions.find(e=>e.family_id==='family:'+g.root).status,'accepted');assert.deepEqual(f.finite_scope.map(r=>r.lemma_id).sort(),g.records.map(r=>r.lemma_id).sort());}
 const historical=JSON.parse(gunzipSync(fs.readFileSync('audit/associative-family-v6/queue-organization-20261004/generated/lexical-fact-cache.json.gz')));assert.equal(historical.length,216);
});
