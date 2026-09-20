import assert from 'node:assert/strict';
import { test } from 'node:test';
import { percentile } from '../scripts/benchmark-associative-family-runtime.mjs';

test('runtime benchmark percentiles are deterministic nearest-rank values', () => {
  assert.equal(percentile([5, 1, 4, 2, 3], 0.5), 3);
  assert.equal(percentile([5, 1, 4, 2, 3], 0.95), 5);
  assert.equal(percentile([], 0.99), 0);
});
