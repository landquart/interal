import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
const base='audit/associative-family-v5',dir=base+'/reflex-multilingual-heads-review-20261002-2010';
const read=p=>JSON.parse(p.endsWith('.gz')?gunzipSync(fs.readFileSync(p)):fs.readFileSync(p));
const hash=b=>createHash('sha256').update(b).digest('hex');
const key=r=>[r.language,r.canonical_root,r.lemma_id].join('\0');
test('finite multilingual review conserves exact source records and all 762 IDs',()=>{
 const ledger=read(dir+'/decisions.json'),inv=read(dir+'/inventory.json'),pending=read(dir+'/pending-review.json').records,proof=read(dir+'/source-records.json.gz').records;
 const prior=read(ledger.inputs.previous_pending_path).records;
 for(const type of ['spec','previous_pending','previous_inventory','source_candidate'])assert.equal(hash(fs.readFileSync(ledger.inputs[type+'_path'])),ledger.inputs[type+'_sha256']);
 for(const [name,sha]of Object.entries(inv.artifact_sha256))assert.equal(hash(fs.readFileSync(dir+'/'+name)),sha);
 assert.equal(ledger.decisions.length,35);assert.equal(proof.length,35);
 assert.equal(new Set([...ledger.decisions,...pending].map(key)).size,278);
 assert.deepEqual(new Set([...ledger.decisions,...pending].map(key)),new Set(prior.map(key)));
 const selected=new Set(ledger.decisions.map(key));assert.deepEqual(pending,prior.filter(r=>!selected.has(key(r))));
 const source=read(ledger.inputs.source_candidate_path);
 for(const r of ledger.decisions){
  assert.equal(r.status,'uncertain');assert.equal(r.analysis_type,'investigated_foreign_paradigm');assert.match(r.reason,/Investigated/);assert.equal(r.runtime_applied,false);
  const p=proof.find(p=>key({...p,lemma_id:p.member.lemma_id})===key(r));
  assert.deepEqual(p.member,source[r.language][r.canonical_root].find(m=>m.lemma_id===r.lemma_id));
  assert.deepEqual(p.previous_pending_record,prior.find(m=>key(m)===key(r)));

 }
 assert.deepEqual(ledger.continuation_counts,{accepted:31,excluded:334,uncertain:154,pending_review:243});
 assert.equal(Object.values(ledger.continuation_counts).reduce((a,b)=>a+b),762);
 assert.equal(ledger.accepted_applied,31);assert.equal(ledger.accepted_unapplied,0);assert.equal(ledger.full_family_certification,false);
 // Do not erase rare words, foreign forms, voseo or historical variants by generic spelling distance.
 for(const word of ['observadote','informastes','osservazzione','informazzione','osservator','informazion','observat'])assert(pending.some(r=>r.word===word));
});
test('finite multilingual review reproduces byte-identical evidence',()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'reflex-multilingual-'));
 try{execFileSync('python',['scripts/review-associative-reflex-multilingual-heads-20261002.py','--output',out]);
 for(const name of ['decisions.json','inventory.json','pending-review.json','source-records.json.gz'])assert.deepEqual(fs.readFileSync(path.join(out,name)),fs.readFileSync(dir+'/'+name));}
 finally{fs.rmSync(out,{recursive:true,force:true});}
});
