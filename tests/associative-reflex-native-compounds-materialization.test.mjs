import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { familyBucket } from '../associativvordes/js/family-index-loader.js';
import { continuationRepair, continuationLedger, continuationPath, reviewPaths, readJson, sha,
         auditContinuation, digest } from '../scripts/lib/associative-reflex-native-compounds-extension-audit.mjs';

const root='associativvordes/family-index-v5';
const provenance=await readJson(root+'/repository-provenance.json');
const applied=provenance.repository_repairs.some(r=>r.repair===continuationRepair);
test('7 exact selections have frozen prior prefixes and every source route',async()=>{
 const ledger=await readJson(continuationLedger);
 const review={decisions:(await Promise.all(reviewPaths.map(p=>readJson(p+'/decisions.json')))).flatMap(r=>r.decisions)};
 assert.deepEqual(ledger.additions,review.decisions.filter(r=>r.status==='accepted'));
 assert.equal(ledger.additions.length,7);assert.equal(ledger.before_families['family:observ'].support,311);
 assert.equal(ledger.before_families['family:inform'].support,1460);
 assert.equal(ledger.expected_removed_memberships,0);assert.equal(ledger.alias_delta,0);assert.equal(ledger.net_family_delta,0);
 assert.equal(ledger.full_family_certification,false);
 for(const row of ledger.additions){
  const routes=ledger.source_routes.filter(r=>r.language===row.language&&r.member.lemma_id===row.lemma_id);
  assert.deepEqual(routes.map(r=>r.family_id),row.source_family_ids);
  assert(routes.every(r=>r.member.word===row.word));
  for(const r of routes){
   const shard=await readJson(root+'/members/'+r.language+'/'+familyBucket(r.family_id)+'.json.gz');
   assert.deepEqual(shard[r.family_id]?.find(m=>m.lemma_id===r.member.lemma_id),r.member);
  }
 }
 for(const [p,hash]of Object.entries(ledger.source_hashes))assert.equal(sha(await readFile(p)),hash);
 // Only the 7 accepted records are materialization candidates. Independently
 // excluded lexical heads remain absent; no exclusion is silently added.
 for(const row of review.decisions.filter(r=>r.status!=='accepted')){
  const id='family:'+row.canonical_root;
  const ms=(await readJson(root+'/members/'+row.language+'/'+familyBucket(id)+'.json.gz'))[id]||[];
  assert(!ms.some(m=>m.lemma_id===row.lemma_id));
 }
});
test('applied continuation preserves complete old prefixes, metadata, routes and unrelated bytes',{skip:!applied},async()=>{
 const ledger=await auditContinuation(root);assert(ledger);
 const status=await readJson(continuationPath+'/materialization-status.json');
 assert.deepEqual(status.runtime_support,{observ:312,inform:1466});
});
test('materializer refuses stale HEAD or repeated application before any writes',async()=>{
 const before=await readFile(continuationLedger),meta=await readFile(root+'/repository-provenance.json');
 const result=spawnSync(process.execPath,['scripts/materialize-associative-reflex-native-compounds-20261002.mjs','--apply','--expected-head','0000000000000000000000000000000000000000'],{encoding:'utf8'});
 assert.notEqual(result.status,0);
 assert.match(result.stderr,applied?/Already applied/:/Baseline HEAD changed/);
 assert.equal(digest(await readFile(continuationLedger)),digest(before));
 assert.equal(digest(await readFile(root+'/repository-provenance.json')),digest(meta));
});
