import assert from 'node:assert/strict';
import {
  normalizeAssociativeCard,
  normalizeCardSchema,
  validateCardSchema
} from '../shared/card-schema.mjs';

const brokenRuntimeCard = {
  version: '1.0',
  card_type: 'vord_card',
  vord_type: 'av',
  procedure: 'associative_word',
  interal: { word: 'alter', type: 'root' },
  translation: 'другой',
  supported_groups: [],
  calculation: {
    TA: 120,
    FA: 40,
    represented_languages: null,
    represented_groups: null
  },
  language_results: [
    { code: 'en', word: 'alternative', final_score: 42 },
    { code: 'de', word: 'Alternative', final_score: 39 },
    { code: 'fr', word: 'alternatif', final_score: 41 }
  ]
};

{
  const normalized = normalizeAssociativeCard(brokenRuntimeCard);
  assert.deepEqual(normalized.supported_groups, ['Germanic', 'Romance']);
  assert.equal(normalized.result.represented_languages, 3);
  assert.equal(normalized.result.represented_groups, 2);
  assert.equal(normalized.result.TA, 120);
  assert.equal(normalized.result.FA, 40);
  assert.equal(normalized.calculation.represented_languages, 3);
  assert.equal(normalized.calculation.represented_groups, 2);
  assert.equal(normalized.result.FAv, 40, 'legacy FA is exposed as FAv when a card is reopened');
  assert.equal(normalized.result.representedLanguages, 3);
  assert.equal(normalized.result.representedLanguageGroups, 2);
  assert.deepEqual(brokenRuntimeCard.supported_groups, [], 'normalization does not mutate the original card');
}

{
  const normalized = normalizeCardSchema({
    version: '1.0',
    card_type: 'vord_card',
    vord_type: 'av',
    procedure: 'associative_word',
    interal: { word: 'alter', ipa: 'ˈalter', type: 'root' },
    translation: { language: 'ru', word: 'альтернативный' },
    analysis_input: { language: 'ru', target_meaning: 'другой' },
    supported_groups: ['Romance', 'Romance'],
    result: { TA: 80, FA: 40, represented_languages: 3, represented_groups: 2 },
    language_evidence: [
      { language: 'en', word: 'alternative' },
      { language: 'fr', word: 'alternatif' },
      { language: 'es', word: 'alternativo' }
    ]
  });
  assert.deepEqual(normalized.supported_groups, ['Germanic', 'Romance']);
  assert.equal(normalized.result.represented_languages, 3, 'existing correct count is retained');
  assert.equal(normalized.result.represented_groups, 2, 'existing correct group count is retained');
  assert.equal(validateCardSchema(normalized, { expectedType: 'av', strictAssociative: true }), true);
  assert.equal(normalized.translation.word, 'альтернативный');
  assert.equal(normalized.analysis_input.target_meaning, 'другой');
}

{
  const noData = normalizeAssociativeCard({
    version: '1.0',
    card_type: 'vord_card',
    vord_type: 'av',
    procedure: 'associative_word',
    interal: { word: 'unused', type: 'root' },
    translation: 'none',
    result: { TA: null, FA: null },
    language_evidence: []
  });
  assert.equal(noData.result.represented_languages, 0);
  assert.equal(noData.result.represented_groups, 0);
  assert.deepEqual(noData.supported_groups, []);
}

console.log('associativvordes card normalization tests passed');
