import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('independent readiness controls: exact identities, scoped reverse history, language and path types', () => {
  const dir = mkdtempSync(join(tmpdir(), 'readiness-regression-'));
  try {
    const out = join(dir, 'results.json');
    const result = spawnSync('python3', [
      'audit/associative-external-preparation/verification08/verify.py', '--out', out,
    ], { cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', timeout: 60_000 });
    assert.equal(result.error, undefined, String(result.error));
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const report = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(report.summary.FAIL, 0, JSON.stringify(report.results.filter(x => x.status === 'FAIL')));
    assert.equal(report.summary.PASS, 35);
    assert.equal(report.automatic_gold, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
