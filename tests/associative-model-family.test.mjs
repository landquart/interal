import assert from 'node:assert/strict';
import { lexicalModelFamilyKey, selectHighestFrequencyPerModel } from '../associativvordes/js/candidate-model-family.js';
import { findCandidatesForRoot } from '../associativvordes/js/candidate-finder.js';

function entry(word, searchForm, ipm, rank) {
  return {
    word,
    normalized: word.toLowerCase(),
    search_form: searchForm,
    rank,
    frequency_score: Math.min(100, ipm),
    category_breakdown: {},
    sources: [{ id: 'normative/test.json', file: 'test.json', category: 'normative', ipm }]
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
assert.equal(lexicalModelFamilyKey(matched[0], 'alter', 'ru'), lexicalModelFamilyKey(matched[1], 'alter', 'ru'));
assert.equal(lexicalModelFamilyKey(matched[0], 'alter', 'ru'), lexicalModelFamilyKey(matched[2], 'alter', 'ru'));
assert.notEqual(lexicalModelFamilyKey(matched[3], 'alter', 'ru'), lexicalModelFamilyKey(matched[4], 'alter', 'ru'));

const frequencySelection = selectHighestFrequencyPerModel(matched.slice(0, 3), 'alter', 'ru');
assert.deepEqual(frequencySelection.candidates.map(candidate => candidate.word), ['альтернатива']);

console.log('Associative lexical model family tests passed.');
