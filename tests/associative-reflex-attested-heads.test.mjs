import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const base='audit/associative-family-v5',dir=base+'/reflex-attested-heads-review-20261002';
const read=p=>JSON.parse(p.endsWith('.gz')?gunzipSync(fs.readFileSync(p)):fs.readFileSync(p));
const hash=b=>createHash('sha256').update(b).digest('hex');
const key=r=>[r.language,r.canonical_root,r.lemma_id].join('\0');

test('attested-head review conserves all 762 continuation IDs and exact source measurements',()=>{
 const prior=read(base+'/reflex-foreign-forms-review-20261002/pending-review.json').records;
 const old=[...read(base+'/reflex-continuation-20261002/decisions.json').decisions,...read(base+'/reflex-phrase-boundary-review-20261002/decisions.json').decisions,...read(base+'/reflex-foreign-forms-review-20261002/decisions.json').decisions];
 const ledger=read(dir+'/decisions.json'),inventory=read(dir+'/inventory.json');
 const pending=read(dir+'/pending-review.json').records,proof=read(dir+'/source-records.json.gz').records;
 const sourceBytes=fs.readFileSync(base+'/reflex-checkpoint-20261001/candidates.json.gz');
 assert.equal(hash(sourceBytes),ledger.source_candidate_sha256);
 assert.equal(hash(fs.readFileSync(base+'/reflex-foreign-forms-review-20261002/pending-review.json')),ledger.previous_pending_sha256);
 const source=JSON.parse(gunzipSync(sourceBytes));
 assert.equal(ledger.decisions.length,14);assert.equal(proof.length,14);
 assert.equal(new Set([...ledger.decisions,...pending].map(key)).size,553);
 assert.deepEqual(new Set([...ledger.decisions,...pending].map(key)),new Set(prior.map(key)));
 assert.equal(new Set([...old,...ledger.decisions,...pending].map(key)).size,762);
 const selected=new Set(ledger.decisions.map(key));
 assert.deepEqual(pending,prior.filter(r=>!selected.has(key(r))));
 for(const [name,digest]of Object.entries(inventory.artifact_sha256))assert.equal(hash(fs.readFileSync(dir+'/'+name)),digest);
 for(const r of ledger.decisions){
  assert.equal(r.previous_status,'pending_review');assert.equal(r.runtime_applied,false);
  assert(['accepted','excluded','uncertain'].includes(r.status));
  assert.deepEqual(r.source_family_ids,prior.find(m=>key(m)===key(r)).source_family_ids);
  const p=proof.find(p=>key({...p,lemma_id:p.member.lemma_id})===key(r));
  assert.deepEqual(p.member,source[r.language][r.canonical_root].find(m=>m.lemma_id===r.lemma_id));
  assert.deepEqual(p.previous_pending_record,prior.find(m=>key(m)===key(r)));
  if(r.analysis_type==='phrase_fusion')assert.equal(r.segmentation_or_lexical_identity.replaceAll(' ',''),r.word);
  if(r.status==='accepted')assert.match(r.reason,/Attested|attested|Oracle|Official/);
  if(r.status==='uncertain')assert.match(r.reason,/Investigated/);
 }
 assert.deepEqual(ledger.continuation_counts,{accepted:13,excluded:160,uncertain:50,pending_review:539});
 assert.equal(Object.values(ledger.continuation_counts).reduce((a,b)=>a+b),762);
 assert.equal(ledger.full_family_certification,false);assert.equal(ledger.accepted_unapplied,7);assert.equal(ledger.accepted_applied,6);
 assert.equal(ledger.decisions.find(r=>r.word==='informale').status,'uncertain');
 assert.equal(ledger.decisions.find(r=>r.word==='jobserve').status,'excluded');
 assert.equal(ledger.decisions.find(r=>r.word==='imageobserver').status,'accepted');
 // Productive compounds and clitic spelling questions were not blindly swept
 // into the phrase batch; the original German sense homonyms remain uncertain.
 for(const word of ['information-share','dinformation','informatenschutz'])
  assert(pending.some(m=>m.word===word));
 for(const word of ['informell','informelle','informelleren'])assert.equal(old.find(m=>m.word===word).status,'uncertain');
});
test('attested-head review reconstructs byte-identical artifacts independently of runtime',()=>{
 const output=fs.mkdtempSync(path.join(os.tmpdir(),'reflex-phrase-review-'));
 try{
  execFileSync('python',['scripts/review-associative-reflex-attested-heads-20261002.py','--output',output]);
  for(const name of ['decisions.json','pending-review.json','inventory.json','source-records.json.gz'])
   assert.deepEqual(fs.readFileSync(path.join(output,name)),fs.readFileSync(dir+'/'+name));
 }finally{fs.rmSync(output,{recursive:true,force:true});}
});
