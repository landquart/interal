import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('source recovery verifies bytes, SQLite and finite safe archive paths',()=>{
 const r=spawnSync('python3',['-m','unittest','associativvordes.source_recovery.test_restore','-v'],{encoding:'utf8'});
 assert.equal(r.status,0,r.stdout+r.stderr);
});
