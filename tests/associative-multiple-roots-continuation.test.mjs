import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';

const base='audit/associative-family-v5';
const hash=b=>createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(p.endsWith('.gz')?gunzipSync(fs.readFileSync(p)):fs.readFileSync(p));
const folders={creat:'creation',relat:'relation',oper:'operation',mut:'mutation'};
const key=r=>`${r.root}\0${r.language}\0${r.lemma_id}`;

for (const [stage, expected] of [['creation-relation',35],['operation-mutation',200]]) {
  test(`${stage}: complete source proof and exact unresolved partition`,()=>{
    const dir=`${base}/${stage}-independent-heads-20261002`;
    const inventory=read(`${dir}/inventory.json`);
    const ledger=read(`${dir}/decisions.json`);
    const proofs=read(`${dir}/source-records.json.gz`);
    const pending=read(`${dir}/pending-review.json.gz`);
    assert.equal(ledger.runtime_changed,false);
    assert.equal(ledger.decisions.length,expected);
    assert.equal(proofs.length,expected);
    const reviewed=new Map(ledger.decisions.map(r=>[key(r),r]));
    assert.equal(reviewed.size,expected);
    assert.equal(new Set(pending.map(key)).size,pending.length);
    for(const [name,digest] of Object.entries(inventory.artifacts))
      assert.equal(hash(fs.readFileSync(`${dir}/${name}`)),digest);
    const untouched=[];
    for(const [root,files] of Object.entries(ledger.historical_artifacts)){
      assert.deepEqual(files,inventory.historical_artifacts[root]);
      for(const [p,digest] of Object.entries(files)) assert.equal(hash(fs.readFileSync(p)),digest);
      const oldDir=`${base}/${folders[root]}-checkpoint-20261001`;
      const old=read(`${oldDir}/linguistic-decisions.json`);
      const source=read(`${oldDir}/candidates.json.gz`);
      for(const [language,roots] of Object.entries(old.decisions)){
        const rows=roots[root];
        const members=new Map(source[language][root].map(r=>[r.lemma_id,r]));
        let n=0;
        for(const r of rows){
          const tagged={root,language,...r};
          const delta=reviewed.get(key(tagged));
          if(delta){
            ++n;
            assert.equal(r.status,'uncertain');
            assert.equal(delta.status,'excluded');
            assert.equal(delta.runtime_applied,false);
            assert.equal(delta.word,r.word);
            assert.deepEqual(delta.source_family_ids,r.source_family_ids);
            assert.ok(delta.reason.length>50);
            assert.ok(delta.source_references.every(u=>u.startsWith('https://')));
            const proof=proofs.find(p=>p.root===root&&p.language===language&&p.member.lemma_id===r.lemma_id);
            assert.deepEqual(proof.member,members.get(r.lemma_id));
            assert.deepEqual(proof.historical_decision,r);
          } else if(r.status==='uncertain'){
            untouched.push({...tagged,status:'pending_review',historical_status:'uncertain'});
          }
        }
        const counts=ledger.counts[root][language];
        assert.equal(counts.reviewed_exclusions,n);
        assert.equal(counts.reviewed_uncertain,0);
        assert.equal(counts.accepted,rows.filter(r=>r.status==='accepted').length);
        assert.equal(counts.excluded,rows.filter(r=>r.status==='excluded').length+n);
        assert.equal(counts.pending_review,rows.filter(r=>r.status==='uncertain').length-n);
        assert.equal(counts.total,counts.accepted+counts.excluded+counts.pending_review);
      }
    }
    assert.deepEqual(pending,untouched);
    assert.equal(inventory.pending_review,pending.length);
    assert.deepEqual(inventory.counts,ledger.counts);
  });
  test(`${stage}: byte-identical reconstruction without runtime writes`,()=>{
    const out=fs.mkdtempSync(path.join(os.tmpdir(),'associative-review-'));
    try{
      execFileSync('python',['scripts/review-associative-multiple-roots-20261002.py',stage,'--output',out]);
      for(const name of ['decisions.json','inventory.json','source-records.json.gz','pending-review.json.gz'])
        assert.deepEqual(fs.readFileSync(path.join(out,name)),fs.readFileSync(`${base}/${stage}-independent-heads-20261002/${name}`));
    } finally {fs.rmSync(out,{recursive:true,force:true});}
  });
}
