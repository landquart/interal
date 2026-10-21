import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const result=spawnSync(process.env.PYTHON || 'python3',['-m','unittest','discover','-s','associativvordes/pilot_evaluation','-p','test_quality04.py','-v'],{encoding:'utf8'});
if(result.stdout)process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
assert.equal(result.status,0,'frozen pilot quality and human-study integration checks');
