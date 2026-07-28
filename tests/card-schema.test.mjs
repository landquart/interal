import assert from 'node:assert/strict';
import {
  CardSchemaError,
  VORD_TYPE_LABELS,
  getCardFinalPercentage,
  getCardPiPercent,
  normalizeCardSchema,
  validateCardSchema
} from '../shared/card-schema.mjs';

const base = { version: '1.0', card_type: 'vord_card', vord_type: 'iv', interal: { word: 'test' } };
assert.equal(VORD_TYPE_LABELS.iv, 'indoeuropan vordes');
assert.equal(getCardPiPercent({ ...base, result: { pi_percent: 0 } }), 0);
assert.equal(getCardPiPercent({ ...base, calculation: { pi_percent: 12.5 } }), 12.5);
assert.equal(getCardPiPercent({ ...base, pi_percent: 7 }), 7);
assert.equal(getCardPiPercent(base), undefined);
assert.deepEqual(
  getCardFinalPercentage({ ...base, result: { pi_percent: 12.5 } }),
  { code: 'PI', value: 12.5, source_path: 'result.pi_percent' }
);
assert.deepEqual(
  getCardFinalPercentage({ ...base, vord_type: 'av', result: { TA: 90, FA: 42.5 } }),
  { code: 'FA', value: 42.5, source_path: 'result.FA' }
);
assert.deepEqual(
  getCardFinalPercentage({ ...base, vord_type: 'av', calculation: { FA: 40 }, FA: 39 }),
  { code: 'FA', value: 40, source_path: 'calculation.FA' }
);
assert.equal(getCardFinalPercentage({ ...base, vord_type: 'av', result: { TA: 90 } }), undefined);
assert.equal(getCardFinalPercentage({ ...base, vord_type: 'in', pi_percent: 50 }), undefined);
const normalizedLegacyPi = normalizeCardSchema({ ...base, calculation: { pi_percent: '12.5' } });
assert.equal(normalizedLegacyPi.calculation.pi_percent, 12.5);
assert.equal(normalizedLegacyPi.result, undefined);
assert.doesNotThrow(() => validateCardSchema(base));
assert.doesNotThrow(() => validateCardSchema({ ...base, author: { display_name: 'Landquart' } }));
assert.doesNotThrow(() => validateCardSchema({ ...base, author: { contacts: [{ type: 'telegram', url: 'https://t.me/quinarta' }] } }));
assert.throws(() => validateCardSchema({ ...base, author: {} }), /author: must not be empty/);
assert.throws(() => validateCardSchema({ ...base, vord_type: 'xx' }), (error) => error instanceof CardSchemaError && error.path === 'vord_type');
assert.throws(() => validateCardSchema({ ...base, result: { pi_percent: '0' } }), /result\.pi_percent/);
assert.throws(
  () => validateCardSchema({ ...base, vord_type: 'av', calculation: { FA: 'not-a-number' } }),
  (error) => error instanceof CardSchemaError && error.path === 'calculation.FA'
);
console.log('card-schema tests passed');
