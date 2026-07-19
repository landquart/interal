import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { patchAssociativeSearchRuntime } from '../scripts/patch-associative-search-runtime.mjs';

const execFileAsync = promisify(execFile);
const tempRoot = '.tmp/associative-runtime-patch';
const tempFile = `${tempRoot}/script.mjs`;
const runtimeMarker = '// Static associative search runtime v2';
await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

try {
  const source = await readFile('associativvordes/script.js', 'utf8');
  const sourceWasAlreadyPatched = source.includes(runtimeMarker);
  const patched = patchAssociativeSearchRuntime(source);

  if (sourceWasAlreadyPatched) {
    assert.equal(patched, source, 'published patched runtime must remain unchanged');
  } else {
    assert.notEqual(patched, source, 'runtime migration must modify the unpatched source');
  }

  assert.ok(patched.includes(runtimeMarker));
  assert.ok(patched.includes('const SEARCH_RESULTS_PAGE_SIZE = 100'));
  assert.ok(patched.includes('autoAnalyzeCandidatesPerLanguage'));
  assert.ok(patched.includes("analysisStatus: 'pending'"));
  assert.ok(patched.includes('nextLangs[lang.code] = reconcileModelRepresentatives'));
  assert.ok(patched.includes('window.showMoreCandidates = showMoreCandidates'));
  assert.ok(patched.includes('frequency_score: Number.isFinite(Number(item.frequency_score))'));
  assert.ok(patched.includes('const analysisButton = item.analysisStatus'));
  assert.equal(patchAssociativeSearchRuntime(patched), patched, 'runtime migration is idempotent');

  await writeFile(tempFile, patched);
  await execFileAsync(process.execPath, ['--check', tempFile]);
  console.log('Associative search runtime patch tests passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
