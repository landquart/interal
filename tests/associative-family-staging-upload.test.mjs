import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('staging uploader is immutable and cannot target production v4', async () => {
  const source = await readFile('scripts/upload-associative-family-staging-blobs.mjs', 'utf8');
  assert.match(source, /v5-staging/);
  assert.match(source, /allowOverwrite: false/);
  assert.doesNotMatch(source, /allowOverwrite: true/);
  assert.match(source, /Range: 'bytes=0-3'/);
});
