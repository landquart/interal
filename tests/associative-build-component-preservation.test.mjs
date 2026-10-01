import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {applyExactControlOverride,scanEtymologies,etymonKeys,latinStemProposals} from '../scripts/build-associative-exhaustive-family-index.mjs';
test('methodology controls upsert inter while preserving independent components and source evidence',()=>{
 for(const [word,root] of [['international','nat'],['interval','val'],['internet','net']]){
  const original=[{surface:root,canonical_candidate:root,family_ids:['family:'+root],confidence:0.9,evidence:[{type:'fixture',path:[word,root]}]}],snapshot=structuredClone(original);
  const families=new Map([['family:inter',{canonical:'inter'}]]);
  const first=applyExactControlOverride({language:'en',word,componentRows:original,families});
  assert.deepEqual(original,snapshot);
  assert.deepEqual(first.componentRows.find(r=>r.canonical_candidate===root),original[0]);
  assert.equal(first.componentRows.filter(r=>r.family_ids.includes('family:inter')).length,1);
  assert.deepEqual(applyExactControlOverride({language:'en',word,componentRows:first.componentRows,families}),first);
  assert.deepEqual(applyExactControlOverride({language:'en',word,componentRows:[...original].reverse(),families}),first);
 }
});
test('review-required components survive even with no automatic root nodes or usable etymon key',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'associative-review-'));
 try{
  const entry={lang_code:'en',word:'international',etymology_templates:[{name:'compound',args:{1:'en',2:'inter',3:'national'}},{name:'prefix',args:{1:'en',2:'inter-',3:'national'}}]};
  const file=join(directory,'etymology.jsonl.gz');await writeFile(file,gzipSync(JSON.stringify(entry)+'\n'));
  const result=await scanEtymologies(file,{en:new Map([['international',{components:[{root:'inter'},{root:'nat'}]}]])},['en']);
  assert.equal(result.nonProto.size,0);
  assert.equal(result.reviewRelations.length,4);
  assert(result.reviewRelations.every(r=>r.reviewRequired&&r.reason==='relation_policy_requires_review'));
  assert(result.reviewRelations.some(r=>r.term==='inter-'));
  assert.deepEqual(result.reviewRelations.map(r=>r.relationType),['compound_component','compound_component','affix_component','affix_component']);
 }finally{await rm(directory,{recursive:true,force:true})}
});

test('Latin ending proposals cannot merge Actium with actio or create duplicate observatio containers',async()=>{
 assert.deepEqual(etymonKeys('la','āctiō'),['la:actio']);
 assert.deepEqual(etymonKeys('la','Actium'),['la:actium']);
 assert.deepEqual(etymonKeys('la','observātiō'),['la:observatio']);
 assert(latinStemProposals('la','Actium').includes('la:acti'));
 assert(latinStemProposals('la','āctiō').includes('la:acti'));
 const directory=await mkdtemp(join(tmpdir(),'associative-latin-'));
 try{
  const entries=[{lang_code:'en',word:'action',etymology_templates:[{name:'der',args:{1:'en',2:'la',3:'āctiō'}}]},{lang_code:'en',word:'Actium',etymology_templates:[{name:'bor',args:{1:'en',2:'la',3:'Actium'}}]}];
  const file=join(directory,'etymology.jsonl.gz');await writeFile(file,gzipSync(entries.map(e=>JSON.stringify(e)).join('\n')+'\n'));
  const result=await scanEtymologies(file,{en:new Map([['action',{components:[{root:'action'}]}],['actium',{components:[{root:'actium'}]}]])},['en']);
  assert(result.nonProto.has('la:actio'));assert(result.nonProto.has('la:actium'));assert(!result.nonProto.has('la:acti'));
  const proposals=result.reviewRelations.filter(r=>r.proposed_etymon_key==='la:acti');assert.equal(proposals.length,2);assert(proposals.every(r=>r.reviewRequired&&!r.mergeAllowed));
  assert.deepEqual(proposals.map(r=>r.term),['āctiō','Actium']);
 }finally{await rm(directory,{recursive:true,force:true})}
});
