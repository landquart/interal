import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('installed normative admission and approved registry reject every tested bypass',()=>{
 const r=spawnSync('python3',['-m','unittest','associativvordes.normative.test_resolver','-v'],{encoding:'utf8',timeout:120000});
 assert.equal(r.error,undefined,String(r.error));assert.equal(r.status,0,r.stdout+r.stderr);
});
