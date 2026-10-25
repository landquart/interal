import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('real human calibration protocol: qualifications, blindness, arbitration and no fabricated gold',()=>{
 const r=spawnSync('python3',['-m','unittest','associativvordes.calibration_study.test_study','-v'],{encoding:'utf8'});
 assert.equal(r.status,0,r.stdout+r.stderr);
});
