import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const result = spawnSync('python3', ['-m', 'unittest', 'discover', '-s', 'associativvordes/structural_cleanup', '-p', 'test_*.py'], { encoding: 'utf8' });
assert.equal(result.status, 0, result.stdout + result.stderr);
console.log('Structural cleanup contracts passed');
