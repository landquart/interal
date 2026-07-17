import assert from 'node:assert/strict';
import { finiteNumericRange } from '../scripts/build-associative-candidate-index.mjs';

function* largeValues(count) {
  for (let index = 0; index < count; index += 1) {
    yield index % 1000;
  }
}

const range = finiteNumericRange(largeValues(500_000));
assert.deepEqual(range, { min: 0, max: 999, count: 500_000 });

const filtered = finiteNumericRange([null, undefined, Number.NaN, Infinity, -Infinity, 0, 2.5]);
assert.deepEqual(filtered, { min: 0, max: 2.5, count: 2 });

const empty = finiteNumericRange([Number.NaN, Infinity], 0);
assert.deepEqual(empty, { min: 0, max: 0, count: 0 });

console.log('associative index large numeric range tests passed');
