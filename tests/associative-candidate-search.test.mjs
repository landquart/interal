import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('isolated candidate search preserves provenance, history and prohibitions', () => {
  const cwd = fileURLToPath(new URL('../', import.meta.url));
  const result = spawnSync('python3', ['-m', 'unittest', 'discover', '-s',
    'associativvordes/candidate_search', '-p', 'test_*.py', '-v'],
  { cwd, encoding: 'utf8', timeout: 60_000 });
  assert.equal(result.error, undefined, String(result.error));
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
