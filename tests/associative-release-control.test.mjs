import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { compare } from '../associativvordes/release_control/calculator.mjs';
test('controlled release signatures, atomicity, history and incremental contracts', () => {
  const result = spawnSync('python3', ['-m', 'unittest', 'discover', '-s', 'associativvordes/release_control', '-p', 'test_*.py', '-v'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
test('real calculator preserves unknown inputs and does not certify empty before/after', async () => {
  const recording = { schema: 'release07-calculator-recording/1', input: { root: 'TEST_ONLY', maxModels: 5 }, languages: {} };
  const result = await compare(recording, recording);
  assert.equal(result.complete, false);
  assert.equal(result.before.state.FA, null);
  assert.deepEqual(result.before.topFive, result.after.topFive);
  assert.equal(result.api_calls, 0);
});
