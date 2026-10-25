import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {stableLemmaId} from '../scripts/lib/associative-family-graph.mjs';
test('legacy stable ID encodes spelling and language, never POS or sense',()=>{
 assert.equal(stableLemmaId('en','bank'),stableLemmaId('en','BANK'));
 assert.notEqual(stableLemmaId('en','bank'),stableLemmaId('de','bank'));
});
test('verified lexical/sense bindings are mandatory for membership admission',()=>{
 const r=spawnSync('python3',['-m','unittest','associativvordes.identity_mapping.test_model','-v'],{encoding:'utf8'});
 assert.equal(r.status,0,r.stdout+r.stderr);
});
