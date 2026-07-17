import assert from 'node:assert/strict';
import {
  finiteNumericRange,
  scanForInvalidData
} from '../scripts/build-associative-candidate-index.mjs';

function* largeValues(count) {
  for (let index = 0; index < count; index += 1) {
    yield index % 1000;
  }
}

const range = finiteNumericRange(largeValues(500_000));
assert.deepEqual(range, { min: 0, max: 999, count: 500_000 });

const filtered = finiteNumericRange([
  null,
  undefined,
  '',
  '   ',
  false,
  true,
  Number.NaN,
  Infinity,
  -Infinity,
  0,
  '2.5'
]);
assert.deepEqual(filtered, { min: 0, max: 2.5, count: 2 });

const empty = finiteNumericRange([null, '', false, Number.NaN, Infinity], 0);
assert.deepEqual(empty, { min: 0, max: 0, count: 0 });

let deeplyNested = { ipm: 1 };
for (let index = 0; index < 1_500; index += 1) {
  deeplyNested = { child: deeplyNested };
}
assert.doesNotThrow(
  () => scanForInvalidData(deeplyNested, 'fixture/deep.json'),
  'deep validation must not depend on recursive calls'
);

let invalidNested = { ipm: null };
for (let index = 0; index < 500; index += 1) {
  invalidNested = { child: invalidNested };
}
assert.throws(
  () => scanForInvalidData(invalidNested, 'fixture/invalid.json'),
  /Invalid IPM in fixture\/invalid\.json/,
  'deep invalid values are still rejected'
);

console.log('associative index large numeric range tests passed');
