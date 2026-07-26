import assert from 'node:assert/strict';
import { lexicalModelFamilyKey, selectHighestFrequencyPerModel } from '../associativvordes/js/candidate-model-family.js';
import { findCandidatesForRoot } from '../associativvordes/js/candidate-finder.js';

function entry(word, searchForm, ipm, rank, match = null) {
  return {
    word,
    normalized: word.toLowerCase(),
    search_form: searchForm,
    rank,
    frequency_score: Math.min(100, ipm),
    category_breakdown: {},
    sources: [{ id: 'normative/test.json', file: 'test.json', category: 'normative', ipm }],
    ...(match ? { match } : {})
  };
}

const russianVariants = [
  entry('альтернатива', 'alternativa', 90, 1),
  entry('альтернативно', 'alternativno', 25, 2),
  entry('альтернативный', 'alternativnyj', 60, 3),
  entry('альтруизм', 'altruizm', 70, 4),
  entry('альтруист', 'altruist', 65, 5)
];

const result = findCandidatesForRoot({
  entries: russianVariants,
  root: 'alter',
  language: 'ru',
  specialRootMatcher: (_language, searchForm) => searchForm.startsWith('altru')
    ? { fragment: 'altru', index: 0 }
    : null
});

assert.ok(result.candidates.some(candidate => candidate.word === 'альтернатива'), 'the most frequent alternative-family lemma remains');
assert.equal(result.candidates.some(candidate => candidate.word === 'альтернативно'), false, 'a lower-frequency adverb from the same model is removed');
assert.equal(result.candidates.some(candidate => candidate.word === 'альтернативный'), false, 'a lower-frequency adjective from the same model is removed');
assert.ok(result.candidates.some(candidate => candidate.word === 'альтруизм'), 'altruism remains a distinct derivational model');
assert.ok(result.candidates.some(candidate => candidate.word === 'альтруист'), 'altruist remains a distinct derivational model');
assert.equal(result.diagnostics.modelDuplicates, 2);

const matched = russianVariants.map(item => ({
  ...item,
  total_ipm: item.sources[0].ipm,
  match: { type: 'exact', distance: 0, similarity: 1, index: 0, fragment: 'alter' }
}));
matched[3].match = { type: 'special', distance: 0, similarity: 1, index: 0, fragment: 'altru' };
matched[4].match = { type: 'special', distance: 0, similarity: 1, index: 0, fragment: 'altru' };
assert.equal(lexicalModelFamilyKey(matched[0], 'alter', 'ru'), lexicalModelFamilyKey(matched[1], 'alter', 'ru'));
assert.equal(lexicalModelFamilyKey(matched[0], 'alter', 'ru'), lexicalModelFamilyKey(matched[2], 'alter', 'ru'));
assert.notEqual(lexicalModelFamilyKey(matched[3], 'alter', 'ru'), lexicalModelFamilyKey(matched[4], 'alter', 'ru'));

const frequencySelection = selectHighestFrequencyPerModel(matched.slice(0, 3), 'alter', 'ru');
assert.deepEqual(frequencySelection.candidates.map(candidate => candidate.word), ['альтернатива']);

const russianQualityPair = [
  entry('безальтернативный', 'bezalternativnyj', 55, 1, { type: 'exact', distance: 0, similarity: 1, index: 3, fragment: 'alter' }),
  entry('безальтернативность', 'bezalternativnost', 35, 2, { type: 'exact', distance: 0, similarity: 1, index: 3, fragment: 'alter' })
];
assert.equal(
  lexicalModelFamilyKey(russianQualityPair[0], 'alter', 'ru'),
  lexicalModelFamilyKey(russianQualityPair[1], 'alter', 'ru'),
  'Russian -ный adjective and -ность quality noun share one lexical model'
);
assert.deepEqual(
  selectHighestFrequencyPerModel(russianQualityPair, 'alter', 'ru').candidates.map(candidate => candidate.word),
  ['безальтернативный'],
  'one Russian adjectival-quality model keeps only its highest-frequency representative'
);

const languageFamilies = {
  en: [
    entry('alternative', 'alternative', 90, 1),
    entry('alternatives', 'alternatives', 60, 2),
    entry('alternatively', 'alternatively', 40, 3)
  ],
  de: [
    entry('Alternative', 'alternative', 90, 1),
    entry('Alternativen', 'alternativen', 60, 2),
    entry('alternativer', 'alternativer', 40, 3)
  ],
  fr: [
    entry('alternative', 'alternative', 90, 1),
    entry('alternatives', 'alternatives', 60, 2),
    entry('alternativement', 'alternativement', 40, 3)
  ],
  es: [
    entry('alternativa', 'alternativa', 90, 1),
    entry('alternativas', 'alternativas', 60, 2),
    entry('alternativamente', 'alternativamente', 40, 3)
  ],
  it: [
    entry('alternativa', 'alternativa', 90, 1),
    entry('alternative', 'alternative', 60, 2),
    entry('alternativamente', 'alternativamente', 40, 3)
  ],
  ru: russianVariants.slice(0, 3)
};

for (const [language, candidates] of Object.entries(languageFamilies)) {
  const withMatches = candidates.map(candidate => ({
    ...candidate,
    match: { type: 'exact', distance: 0, similarity: 1, index: 0, fragment: 'alter' }
  }));
  const grouped = selectHighestFrequencyPerModel(withMatches, 'alter', language);
  assert.equal(grouped.candidates.length, 1, `${language} grammatical/POS variants form one model`);
  assert.equal(grouped.candidates[0].frequency_score, 90, `${language} keeps the highest-F representative`);
}

const rootForms = [
  entry('alter', 'alter', 90, 1, { type: 'exact', distance: 0, similarity: 1, index: 0, fragment: 'alter' }),
  entry('altered', 'altered', 50, 2, { type: 'exact', distance: 0, similarity: 1, index: 0, fragment: 'alter' }),
  entry('altering', 'altering', 40, 3, { type: 'exact', distance: 0, similarity: 1, index: 0, fragment: 'alter' })
];
assert.equal(selectHighestFrequencyPerModel(rootForms, 'alter', 'en').candidates.length, 1, 'root protection keeps alter/altered/altering in one model');

console.log('Associative lexical model family tests passed.');
