import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const dir='audit/associative-family-v5/credit-mute-heads-review-20261002';
const read=p=>JSON.parse(p.endsWith('.gz')?gunzipSync(fs.readFileSync(p)):fs.readFileSync(p));
const hash=b=>createHash('sha256').update(b).digest('hex');
const key=r=>[r.root,r.language,r.lemma_id].join('\0');
test('credit/mute review preserves every prior accepted record and exact pending source',()=>{
 const ledger=read(dir+'/decisions.json'),inv=read(dir+'/inventory.json');
 const pending=read(dir+'/pending-review.json.gz'),proof=read(dir+'/source-records.json.gz');
 assert.equal(ledger.decisions.length,31);assert.equal(proof.length,31);
 assert.equal(inv.new_exclusions,31);assert.equal(inv.pending_review,4987);
 for(const [name,sha]of Object.entries(inv.artifact_sha256))assert.equal(hash(fs.readFileSync(dir+'/'+name)),sha);
 for(const [root,input]of Object.entries(ledger.inputs)){
  for(const type of ['candidate','previous_pending','inventory'])assert.equal(hash(fs.readFileSync(input[type+'_path'])),input[type+'_sha256']);
  const before=read(input.previous_pending_path).filter(r=>r.root===root);
  const selected=ledger.decisions.filter(r=>r.root===root),after=pending.filter(r=>r.root===root);
  assert.deepEqual(new Set([...selected,...after].map(key)),new Set(before.map(key)));
  assert.equal(new Set([...selected,...after].map(key)).size,before.length);
  const ids=new Set(selected.map(key));assert.deepEqual(after,before.filter(r=>!ids.has(key(r))));
  const source=read(input.candidate_path),prior=read(input.inventory_path);
  for(const row of selected){
   assert.equal(row.status,'excluded');assert.equal(row.previous_status,'pending_review');
   const p=proof.find(p=>key({...p,lemma_id:p.member.lemma_id})===key(row));
   assert.deepEqual(p.member,source[row.language][root].find(m=>m.lemma_id===row.lemma_id));
   assert.deepEqual(p.previous_pending_record,before.find(m=>key(m)===key(row)));
  }
  for(const [language,c]of Object.entries(ledger.counts[root])){
   const old=prior.counts[root][language];
   assert.equal(c.accepted,old.accepted);assert.equal(c.excluded,old.excluded+c.new_exclusions);
   assert.equal(c.pending_review,old.pending_review-c.new_exclusions);
   assert.equal(c.accepted+c.excluded+c.pending_review+c.reviewed_uncertain,c.total);
  }
 }
 assert.equal(ledger.runtime_changes,false);assert.equal(ledger.full_family_certification,false);
});
test('credit/mute review reconstructs exact archived artifacts',()=>{
 const output=fs.mkdtempSync(path.join(os.tmpdir(),'credit-mute-review-'));
 try{
  execFileSync('python',['scripts/review-associative-credit-mute-heads-20261002.py','--output',output]);
  for(const file of ['decisions.json','inventory.json','source-records.json.gz','pending-review.json.gz'])
   assert.deepEqual(fs.readFileSync(path.join(output,file)),fs.readFileSync(dir+'/'+file));
 }finally{fs.rmSync(output,{recursive:true,force:true});}
});
