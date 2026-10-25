import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('one installed v5 implementation: real module end-to-end and incompatible inputs',()=>{
 const r=spawnSync('python3',['-m','unittest','discover','-s','associativvordes/v5_integration','-p','test_*.py','-v'],{encoding:'utf8',env:{...process.env,PYTHONPATH:'.'},maxBuffer:8*1024*1024});
 assert.equal(r.status,0,r.stdout+r.stderr);
});
