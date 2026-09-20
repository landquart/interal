import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cohensKappa, confusionMatrix, weightedPrecision, wilson } from '../scripts/lib/associative-annotation-stats.mjs';

test('Wilson interval is finite and contains the observed precision', () => {
  const interval = wilson(97, 100);
  assert.equal(interval.estimate, 0.97);
  assert.ok(interval.lower < 0.97 && interval.upper > 0.97);
  assert.deepEqual(wilson(0, 0), { estimate: null, lower: null, upper: null });
});

test('agreement statistics preserve uncertain as its own category', () => {
  const categories = ['true_positive', 'false_positive', 'uncertain'];
  const left = ['true_positive', 'false_positive', 'uncertain', 'true_positive'];
  const right = ['true_positive', 'uncertain', 'uncertain', 'false_positive'];
  assert.equal(confusionMatrix(left, right, categories).uncertain.uncertain, 1);
  assert.ok(Number.isFinite(cohensKappa(left, right, categories)));
  assert.equal(cohensKappa(categories, categories, categories), 1);
});

test('weighted precision reports resolved, conservative and optimistic estimates', () => {
  const result = weightedPrecision([
    { sample_id: 'a', sampling_weight: 2, final_membership_verdict: 'true_positive' },
    { sample_id: 'b', sampling_weight: 1, final_membership_verdict: 'false_positive' },
    { sample_id: 'c', sampling_weight: 1, final_membership_verdict: 'uncertain' }
  ]);
  assert.equal(result.precision_resolved, 2 / 3);
  assert.equal(result.precision_conservative, 1 / 2);
  assert.equal(result.precision_optimistic, 3 / 4);
  assert.equal(result.effective_sample_size, 16 / 6);
});
