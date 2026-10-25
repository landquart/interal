import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const r=spawnSync('python3',['-m','unittest','discover','-s','associativvordes/surface_cleanup','-p','test_*.py'],{encoding:'utf8'});
assert.equal(r.status,0,r.stdout+r.stderr);
console.log('Surface proof and historical-correspondence guards passed');
