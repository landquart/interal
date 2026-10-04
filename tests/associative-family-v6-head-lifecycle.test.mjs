import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import {gunzipSync} from 'node:zlib';
import {applyHeadReview,generateV6Memberships} from '../associativvordes/js/associative-family-v6.js';
import {stateHash,lifecyclePredecessor,replayHeadLifecycle,loadHeadLifecycle} from '../scripts/lib/associative-v6-head-lifecycle.mjs';
import {reviewBenchmarks} from '../scripts/lib/associative-v6-lexical-review.mjs';
const read=async p=>{const b=await fs.readFile(p);return JSON.parse(p.endsWith('.gz')?gunzipSync(b):b);};
// Every fixture below is synthetic. It never enters the real lifecycle registry.
const catalogFixture=await read('associativvordes/family-index-v6/catalog.json');
const fixture=()=>{const catalog=structuredClone(catalogFixture),head={id:'head:fixture',language:'en',normalized_head:'alpha',sense:'synthetic_fixture',identity_kind:'lexical_head',version:1,evidence:['synthetic-identity']},record={lemma_id:'lemma:fixture-a',word:'alpha'},locator={path:'synthetic://fixture',family_id:'fixture-source',record_sha256:stateHash(record)},link={language:'en',family_id:'family:act',lemma_id:record.lemma_id,word:'alpha',head_id:head.id,recognition:'reviewed_finite_identity',evidence:[{source:locator,lemma_id:record.lemma_id}],source_references:[]};
 let index={catalog,heads:[head],edges:[],links:[link],corpus:new Map([['en\0'+record.lemma_id,record]])};index=applyHeadReview(index,{head_id:head.id,family_id:'family:act',expected_version:0,status:'accepted',reason:'Synthetic fixture initial review',evidence:['fixture'],lemma_ids:[record.lemma_id]});return index;};
const doc=(index,operation='revise_verdict',family_id='family:act',status='uncertain')=>{
 const p=lifecyclePredecessor(index,'head:fixture',family_id),records=index.links.filter(l=>l.family_id===family_id).map(l=>({language:'en',lemma_id:l.lemma_id,word:l.word,source_record:index.corpus.get('en\0'+l.lemma_id),source_locator:l.evidence[0].source,link_role:'whole_lexeme',identity_decision:{status:'accepted',reason:'Synthetic identity',evidence:['fixture']},boundary_proof:{status:'accepted',reason:'Synthetic boundary',evidence:['fixture']}}));
 return {schema_version:6,production_enabled:false,synthetic_fixture:true,id:'fixture:'+operation+':'+family_id+':'+p.head_version,operation,head_id:'head:fixture',family_id,identity:{language:'en',normalized_head:'alpha',sense:'synthetic_fixture'},predecessor:p,binding_authorized:true,review_authorized:true,accepted_membership_authorized:true,evidence:['fixture'],reason:'Synthetic only',finite_forms:['alpha'],records,decision:{status,expected_version:p.edge_version,reason:'Independent synthetic edge',evidence:['fixture-edge'],lemma_ids:records.map(r=>r.lemma_id)}};
};
test('synthetic correction preserves source and immutable input, rejects repeated/stale/conflicting predecessor',()=>{
 const index=fixture(),d=doc(index),before=JSON.stringify(index.links),r=replayHeadLifecycle({index,docs:[d]});assert.equal(r.index.memberships.length,0);assert.equal(index.memberships.length,1);assert.equal(JSON.stringify(r.index.links),before);assert.equal(r.index.heads.length,1);assert.equal(r.index.edges[0].version,2);
 for(const bad of [d,{...d,id:'fixture:conflict'},{...d,predecessor:{...d.predecessor,edge_version:999}},{...d,predecessor:{...d.predecessor,head_sha256:'unknown'}}])assert.throws(()=>replayHeadLifecycle({index:r.index,docs:[bad]}),/predecessor/);
 assert.throws(()=>replayHeadLifecycle({index,docs:[d,d]}),/repeated/);
 for(const status of ['excluded','uncertain'])assert.equal(replayHeadLifecycle({index,docs:[doc(index,'revise_verdict','family:act',status)]}).index.memberships.length,0);
});
test('synthetic head supports independent accepted, excluded and uncertain family edges',()=>{
 let index=fixture();for(const [family,status] of [['family:mut','excluded'],['family:oper','uncertain']]){
  const d=doc(index,'new_family_edge',family,status);d.records=doc(index).records;d.decision.lemma_ids=d.records.map(r=>r.lemma_id);index=replayHeadLifecycle({index,docs:[d]}).index;
 }assert.equal(index.heads.length,1);assert.deepEqual(index.edges.map(e=>e.status),['accepted','excluded','uncertain']);assert.equal(index.memberships.length,1);
 const d=doc(index);const corrected=replayHeadLifecycle({index,docs:[d]}).index;assert.equal(corrected.edges.find(e=>e.family_id==='family:mut').status,'excluded');assert.equal(corrected.edges.find(e=>e.family_id==='family:oper').status,'uncertain');
 const accept=doc(index,'revise_verdict','family:mut','accepted');const accepted=replayHeadLifecycle({index,docs:[accept],initialLedger:[{...index.edges.find(e=>e.family_id==='family:act'),language:'en',affected_lemma_ids:['lemma:fixture-a']}]});assert.equal(accepted.index.memberships.length,2);assert.equal(accepted.metrics.unique_resolved_records,1);assert.equal(accepted.metrics.unique_resolved_head_family_records,2);assert.equal(accepted.metrics.new_heads,0);assert.equal(accepted.metrics.repeated_record_reviews,1);
});
test('synthetic finite additions require identity, boundary and a fresh full scope; no inherited verdict',()=>{
 const index=fixture(),d=doc(index,'extend_forms','family:act','uncertain'),record={lemma_id:'lemma:fixture-b',word:'alphas'};
 d.records.push({...d.records[0],lemma_id:record.lemma_id,word:record.word,source_record:record,source_locator:{...d.records[0].source_locator,record_sha256:stateHash(record)},link_role:'inflection'});d.finite_forms.push('alphas');d.decision.lemma_ids.push(record.lemma_id);
 const r=replayHeadLifecycle({index,docs:[d]});assert.equal(r.index.links.length,2);assert.equal(r.index.memberships.length,0);assert.equal(r.metrics.new_heads,0);assert.equal(r.metrics.new_finite_links,1);
 for(const mutate of [x=>delete x.records[1].identity_decision,x=>x.records[1].boundary_proof.status='uncertain',x=>x.decision.lemma_ids.pop(),x=>x.identity.sense='invented',x=>x.accepted_membership_authorized=false,x=>x.records[1].relation_kind='semantic_translation',x=>x.records[1].formal_continuity_status='uncertain',x=>x.decision.relation_kind='remote_common_ancestor']){const bad=structuredClone(d);bad.decision.status='accepted';mutate(bad);assert.throws(()=>replayHeadLifecycle({index,docs:[bad]}));}
});
test('synthetic clarification keeps identity and old proofs addressable',()=>{
 const index=fixture(),d=doc(index,'clarify_sense','family:act','accepted');d.sense_clarification={description:'Synthetic annotation, no new identity',evidence:['fixture']};const r=replayHeadLifecycle({index,docs:[d]});assert.equal(r.index.heads[0].sense,'synthetic_fixture');assert.equal(r.index.heads[0].evidence[0],'synthetic-identity');assert.equal(r.ledger[0].predecessor.head.version,1);
});
test('synthetic queue history determines latest state without unique-count inflation',()=>{
 const index=fixture(),first={...index.decision_ledger,language:'en'},d=doc(index),revision=replayHeadLifecycle({index,docs:[d],initialLedger:[first]}).ledger[0];
 const args={backlog:[{language:'en',canonical_root:'act',lemma_id:'lemma:fixture-a',word:'alpha',status:'pending',queue:'fixture',review_unit:'fixture'}],frames:[],review:{doc:{finite_bindings:[],lexical_facts:[]},facts:new Map()},headId:()=> 'fixture'};
 const r=reviewBenchmarks({...args,ledger:[first,revision]});assert.equal(r.metrics.records_reviewed,1);assert.equal(r.metrics.new_records_resolved,0);assert.equal(r.metrics.revisions,1);assert.equal(r.metrics.repeated_record_reviews,1);assert.equal(r.active[0].status,'uncertain');assert.equal(r.active[0].review_unit,'head:fixture');
 assert.throws(()=>reviewBenchmarks({...args,ledger:[first,first]}),/stale/);assert.throws(()=>reviewBenchmarks({...args,ledger:[revision]}),/predecessor/);
 const metrics=replayHeadLifecycle({index,docs:[d],initialLedger:[first]}).metrics;assert.equal(metrics.unique_resolved_records,0);assert.equal(metrics.unique_reviewed_records,1);
});
test('real registry proof is exactly one immutable Systeme ID and cannot contain synthetic fixtures',async()=>{
 const inputs={},docs=await loadHeadLifecycle({read,readBytes:p=>fs.readFile(p),inputs});assert.equal(docs.length,1);const d=docs[0];assert.equal(d.synthetic_fixture,false);assert.deepEqual(d.records.map(r=>r.word),['system','systems','systeme']);assert.equal(d.predecessor.head_version,1);assert.equal(d.predecessor.edge_version,1);assert.equal(d.records[2].lemma_id,'lemma:e0e390279d7daf67fbc3');
 const corrupt=structuredClone(d);corrupt.records[2].source_record.rank++;await assert.rejects(loadHeadLifecycle({read:p=>p.includes('system-de-extension')?Promise.resolve(corrupt):read(p),readBytes:p=>fs.readFile(p),inputs:{}}),/Invented/);
 const registryPath='associativvordes/family-index-v6/head-lifecycle.json',registry=await read(registryPath);await assert.rejects(loadHeadLifecycle({read:p=>p===registryPath?Promise.resolve({...registry,decisions:[...registry.decisions,...registry.decisions]}):read(p),readBytes:p=>fs.readFile(p),inputs:{}}),/Repeated/);
 const bad=structuredClone(d);bad.synthetic_fixture=true;await assert.rejects(loadHeadLifecycle({read:p=>p.includes('system-de-extension')?Promise.resolve(bad):read(p),readBytes:p=>fs.readFile(p),inputs:{}}),/Synthetic/);
});

test('synthetic independent uncertain edge keeps a reused head in the other queue benchmark',()=>{
 const index=fixture(),d=doc(index,'new_family_edge','family:mut','uncertain');d.records=doc(index).records;d.decision.lemma_ids=d.records.map(r=>r.lemma_id);const r=replayHeadLifecycle({index,docs:[d]});
 const b=reviewBenchmarks({backlog:[{language:'en',canonical_root:'mut',lemma_id:'lemma:fixture-a',word:'alpha',status:'pending',queue:'fixture',review_unit:'exact:fixture'}],frames:[{name:'fixture',path:'synthetic://fixture'}],review:{doc:{finite_bindings:[],lexical_facts:[]},facts:new Map()},ledger:r.ledger,headId:()=> 'fixture'});
 assert.equal(b.active[0].review_unit,'head:fixture');assert.equal(b.benchmarks[0].evidenced_heads,1);assert.equal(b.benchmarks[0].unresolved_exact_records,0);assert.equal(b.ranked[0].review_unit,'head:fixture');assert.equal(r.index.memberships.length,1);assert.equal(r.index.edges.find(e=>e.family_id==='family:act').status,'accepted');
});

test('synthetic extension retains one benchmark head across initial and lifecycle identity proofs',()=>{
 const index=fixture(),d=doc(index,'extend_forms','family:act','uncertain'),record={lemma_id:'lemma:fixture-b',word:'alphas'};d.records.push({...d.records[0],lemma_id:record.lemma_id,word:record.word,source_record:record,source_locator:{...d.records[0].source_locator,record_sha256:stateHash(record)},link_role:'inflection'});d.finite_forms.push('alphas');d.decision.lemma_ids.push(record.lemma_id);const r=replayHeadLifecycle({index,docs:[d]});
 const f={id:'fact:fixture',language:'en',normalized_head:'alpha',sense:'synthetic_fixture',forms:['alpha'],component_stems:[]};
 const b=reviewBenchmarks({backlog:d.records.map(x=>({...x,canonical_root:'act',status:'pending',queue:'fixture',review_unit:'exact:'+x.lemma_id})),frames:[{name:'fixture',path:'synthetic://fixture'}],review:{doc:{finite_bindings:[{language:'en',family_id:'family:act',lemma_id:'lemma:fixture-a',fact_id:f.id}],lexical_facts:[f]},facts:new Map([[f.id,f]])},ledger:[{...index.decision_ledger,language:'en'},...r.ledger],headId:()=> 'head:fixture'});assert.equal(b.benchmarks[0].evidenced_heads,1);assert.equal(b.ranked.length,1);assert.equal(b.ranked[0].review_unit,'head:fixture');assert.equal(b.metrics.unique_corpus_records_reviewed,2);
});

test('synthetic extend_links adds only the explicitly segmented component without whole-compound identity',()=>{
 const index=fixture(),d=doc(index,'extend_links','family:act','accepted'),record={lemma_id:'lemma:fixture-component',word:'prealphafoo'};
 d.records.push({...d.records[0],lemma_id:record.lemma_id,word:record.word,source_record:record,source_locator:{...d.records[0].source_locator,record_sha256:stateHash(record)},link_role:'reviewed_lexical_base_component',component_segmentation:{before:'pre',component:'alpha',after:'foo',head:'alpha',boundary_proof:'Synthetic explicit boundary'}});d.decision.lemma_ids.push(record.lemma_id);
 const r=replayHeadLifecycle({index,docs:[d]});assert.equal(r.index.memberships.length,2);assert.equal(r.index.links[1].whole_compound_identity_established,false);assert.equal(r.index.heads.length,1);
 const bad=structuredClone(d);bad.records[1].component_segmentation.after='wrong';assert.throws(()=>replayHeadLifecycle({index,docs:[bad]}),/segmentation/);
});
