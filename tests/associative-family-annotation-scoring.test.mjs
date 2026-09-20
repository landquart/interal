import assert from 'node:assert/strict';
import { test } from 'node:test';
import { wilson } from '../scripts/lib/associative-annotation-stats.mjs';

test('Wilson interval is finite and contains the observed precision', () => {
  const interval = wilson(97, 100);
  assert.equal(interval.estimate, 0.97);
  assert.ok(interval.lower < 0.97 && interval.upper > 0.97);
  assert.deepEqual(wilson(0, 0), { estimate: null, lower: null, upper: null });
});
