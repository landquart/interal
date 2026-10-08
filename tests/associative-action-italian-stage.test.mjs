import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {FamilyIndexLoader} from '../associativvordes/js/family-index-loader.js';
import {preReflexContinuationShard} from '../scripts/lib/associative-reflex-continuation-audit.mjs';
const b='audit/associative-family-v5/',stage=b+'action-italian-stage-20261002/',read=async p=>JSON.parse((p.endsWith('.gz')?gunzipSync(await readFile(p)):await readFile(p)).toString()),sha=x=>createHash('sha256').update(x).digest('hex');
test('Italian action stage overlays only pending IDs and preserves the complete source frame and runtime selection',async()=>{
 const inv=await read(stage+'inventory.json'),d=await read(stage+'decisions.json'),prior=await read(b+'action-continuation-20261002/linguistic-decisions.json.gz'),proof=await read(stage+'verb-source-records.json.gz');assert.equal(sha(await readFile(stage+'decisions.json')),inv.decision_sha256);assert.equal(sha(await readFile(stage+'verb-source-records.json.gz')),inv.source_proof_sha256);
 const byId=new Map(prior.decisions.it.map(m=>[m.lemma_id,m]));assert.equal(new Set(d.decisions.map(m=>m.lemma_id)).size,d.decisions.length);assert.equal(d.decisions.length,1536);
 for(const x of d.decisions){const before=byId.get(x.lemma_id);assert.equal(before.word,x.word);assert.equal(before.status,'pending_review');assert.equal(x.status,'excluded');assert(x.lexical_head&&x.source_references.length);if(x.base_lemma_id)assert.equal(proof.heads[x.lexical_head].member.lemma_id,x.base_lemma_id);byId.set(x.lemma_id,{...before,...x});}
 const counts={};for(const x of byId.values())counts[x.status]=(counts[x.status]||0)+1;assert.deepEqual(counts,d.counts.it);assert.equal(Object.values(d.counts).reduce((n,cs)=>n+Object.values(cs).reduce((a,b)=>a+b,0),0),52277);
 const f=new FamilyIndexLoader({baseUrl:'associativvordes/family-index-v5',fetchJson:read}),runtime=await f.candidateEntries('act','it');assert.equal(runtime.length,223);const ids=new Set(runtime.map(m=>m.lemma_id));assert(d.decisions.every(x=>!ids.has(x.lemma_id)));
 for(const w of ['comunicazione','autovalutazione','combattere','catturare','quattro','scattare'])assert(d.decisions.some(x=>x.word===w),w);for(const w of ['attuazione','riattualizzazione','interazione','transazione'])assert(!d.decisions.some(x=>x.word===w),w);
});
test('Italian nominal bases are unchanged existing corpus records, not synthetic lemma IDs',async()=>{
 const d=await read(stage+'decisions.json'),proof=await read(stage+'verb-source-records.json.gz'),groups=new Map();
 for(const x of d.decisions.filter(x=>x.base_lemma_id)){const base=proof.heads[x.lexical_head];if(!groups.has(base.shard_path))groups.set(base.shard_path,new Map());groups.get(base.shard_path).set(x.lexical_head,base);}
 for(const [path,records]of groups){const bytes=await readFile(path);const current=JSON.parse(gunzipSync(bytes));let historical=bytes;if(sha(bytes)!==proof.shard_hashes[path]){const root='associativvordes/family-index-v5',relative=path.slice(root.length+1),part=relative.slice(0,relative.lastIndexOf('/')),bucket=relative.slice(relative.lastIndexOf('/')+1,-8);historical=gzipSync(JSON.stringify(await preReflexContinuationShard(structuredClone(current),part,bucket)),{level:6});}assert.equal(sha(historical),proof.shard_hashes[path]);const shard=current;for(const record of records.values())assert.deepEqual(shard[record.family_id].find(m=>m.lemma_id===record.member.lemma_id),record.member);}
});
