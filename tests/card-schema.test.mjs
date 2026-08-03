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
  { code: 'FAᵥ', value: 42.5, source_path: 'result.FA' }
);
assert.deepEqual(
  getCardFinalPercentage({ ...base, vord_type: 'av', calculation: { FA: 40 }, FA: 39 }),
  { code: 'FAᵥ', value: 40, source_path: 'calculation.FA' }
);
assert.deepEqual(
  getCardFinalPercentage({ ...base, vord_type: 'av', result: { FAv: 56, FA: 40 } }),
  { code: 'FAᵥ', value: 56, source_path: 'result.FAv' }
);
assert.deepEqual(
  getCardFinalPercentage({ ...base, vord_type: 'af', calculation: { FAa: 18 } }),
  { code: 'FAₐ', value: 18, source_path: 'calculation.FAa' }
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
const associative = {
  version: '1.0',
  card_type: 'vord_card',
  vord_type: 'av',
  interal: { word: 'alter', ipa: 'ˈalter', type: 'root', part_of_speech: 'adjective' },
  translation: { language: 'ru', word: 'альтернативный' },
  analysis_input: { language: 'ru', target_meaning: 'другой' },
  result: { FA: 43.9, TA: 263.4 }
};
assert.doesNotThrow(() => validateCardSchema(associative, { strictAssociative: true }));
assert.throws(
  () => validateCardSchema({ ...associative, interal: { ...associative.interal, ipa: '' } }, { strictAssociative: true }),
  (error) => error instanceof CardSchemaError && error.path === 'interal.ipa'
);
assert.throws(
  () => validateCardSchema({ ...associative, interal: { ...associative.interal, part_of_speech: '' } }, { strictAssociative: true }),
  (error) => error instanceof CardSchemaError && error.path === 'interal.part_of_speech'
);
assert.throws(
  () => validateCardSchema({ ...associative, translation: { language: 'ru', word: '' } }, { strictAssociative: true }),
  (error) => error instanceof CardSchemaError && error.path === 'translation.word'
);
assert.throws(
  () => validateCardSchema({ ...associative, analysis_input: { language: 'ru', target_meaning: '' } }, { strictAssociative: true }),
  (error) => error instanceof CardSchemaError && error.path === 'analysis_input.target_meaning'
);
assert.throws(
  () => validateCardSchema({ ...associative, result: { FA: 43.9, TA: '263.4' } }, { strictAssociative: true }),
  (error) => error instanceof CardSchemaError && error.path === 'result.TA'
);
assert.doesNotThrow(
  () => validateCardSchema({ ...associative, interal: { word: 'inter', ipa: 'ˈinter', type: 'preposition', part_of_speech: 'preposition' } }, { strictAssociative: true })
);
const associativeAffix = {
  version: '1.0',
  card_type: 'affix_card',
  vord_type: 'af',
  form: '-x',
  morpheme_type: 'suffix',
  procedure: 'associativ_affix',
  calculation: { speakersTotal: 1_960_000_000, weightedScoreTotal: 40_000_000_000, FAa: 20.408, threshold: 15, accepted: true }
};
assert.doesNotThrow(() => validateCardSchema(associativeAffix));
assert.deepEqual(normalizeCardSchema(associativeAffix).calculation, associativeAffix.calculation, 'FAa calculation survives card reopening');
assert.throws(
  () => validateCardSchema({ ...associativeAffix, calculation: { ...associativeAffix.calculation, FAa: '20.408' } }),
  (error) => error instanceof CardSchemaError && error.path === 'calculation.FAa'
);
console.log('card-schema tests passed');
