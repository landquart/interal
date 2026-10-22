import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const result=spawnSync(process.env.PYTHON || 'python3',['-m','unittest','discover','-s','associativvordes/auto_annotation','-v'],{encoding:'utf8',timeout:120000});
if(result.stdout)process.stdout.write(result.stdout);
if(result.stderr)process.stderr.write(result.stderr);
assert.equal(result.status,0,'preannotation contracts, costs, concurrency, recovery and blind review boundary');
