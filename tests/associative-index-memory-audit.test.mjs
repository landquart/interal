import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';

const reportPath = '.tmp/associative-index-memory-audit-test.json';
await rm(reportPath, { force: true });
const result = spawnSync(process.execPath, [
  'scripts/audit-associative-index-memory.mjs',
  '--language=en',
  '--input-root=tests/fixtures/associative-frequency',
  '--limits=2,5',
  `--report=${reportPath}`
], { encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout);
const report = JSON.parse(await readFile(reportPath, 'utf8'));
assert.equal(report.language, 'en');
assert.equal(report.bounded, true);
assert.deepEqual(report.limits, [2, 5]);
assert.equal(report.samples.length, 2);
for (const sample of report.samples) {
  assert.equal(sample.exit_code, 0);
  assert.ok(sample.duration_ms >= 0);
  assert.ok(sample.records_read <= sample.max_records);
  assert.ok(sample.valid_lemmas >= 0);
  assert.equal(typeof sample.peak_rss_bytes, 'number');
}
assert.doesNotMatch(JSON.stringify(report), /category_breakdown|search_form|sources/, 'memory report does not include dictionary entries');

console.log('associative index memory audit tests passed');
