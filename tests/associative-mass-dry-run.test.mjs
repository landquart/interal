import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const r=spawnSync(process.env.PYTHON || 'python3',['-m','unittest','discover','-s','associativvordes/mass_dry_run','-v'],{encoding:'utf8',timeout:120000});
if(r.stdout)process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
assert.equal(r.status,0,'mass dry-run groups, immutable scope, sampling and process resource checks');
