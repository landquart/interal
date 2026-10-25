import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('historical scope and installed mutation fences fail closed',()=>{
 const r=spawnSync('python3',['-m','unittest','associativvordes.history_adjudication.test_guards','associativvordes.history_adjudication.test_scope','-v'],{encoding:'utf8'});
 assert.equal(r.status,0,r.stdout+r.stderr);
});
