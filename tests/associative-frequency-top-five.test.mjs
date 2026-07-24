import assert from 'node:assert/strict';
import { compareFrequencyRepresentatives, selectHighestFrequencyPerModel } from '../associativvordes/js/candidate-model-family.js';
import { finalizeCandidateOrdering, selectBestFinalModels } from '../associativvordes/js/qwen-client.js';

function candidate(word, model, frequency, finalScore, rank = 100, ipm = frequency, matchType = 'fuzzy') {
  return {
    word,
    model_key: model,
    model_family_key: model,
    model,
    frequency_score: frequency,
    final_score: finalScore,
    association_score: finalScore,
    rank,
    sources: [{ ipm }],
    match: { type: matchType, index: 0, fragment: 'root' }
  };
}

assert.deepEqual(
  selectBestFinalModels([
    candidate('high-f-low-p', 'm-high', 80, 20),
    candidate('low-f-high-p', 'm-low', 60, 95)
  ], 5).map(item => item.word),
  ['high-f-low-p', 'low-f-high-p'],
  'F=80/P=20 is ordered before F=60/P=95'
);

const sixModels = [
  candidate('m1', 'm1', 100, 10),
  candidate('m2', 'm2', 90, 10),
  candidate('m3', 'm3', 80, 10),
  candidate('m4', 'm4', 70, 10),
  candidate('m5', 'm5', 60, 10),
  candidate('m6-high-p', 'm6', 50, 99)
];
assert.equal(selectBestFinalModels(sixModels, 5).some(item => item.word === 'm6-high-p'), false, 'sixth model with higher P but lower F is excluded');

const qwenLowF = [...sixModels.slice(0, 5), candidate('qwen-low-f', 'qwen-low', 55, 100)];
assert.equal(finalizeCandidateOrdering(qwenLowF, 5).slice(0, 5).some(item => item.word === 'qwen-low-f'), false, 'Qwen candidate with insufficient F does not enter top five');
const qwenHighF = [...sixModels.slice(0, 5), candidate('qwen-high-f', 'qwen-high', 95, 5)];
assert.ok(finalizeCandidateOrdering(qwenHighF, 5).slice(0, 5).some(item => item.word === 'qwen-high-f'), 'Qwen candidate enters top five only with high enough F');

assert.deepEqual(
  selectBestFinalModels([
    candidate('exact-low', 'exact-model', 20, 90, 1, 20, 'exact'),
    candidate('fuzzy-high', 'fuzzy-model', 80, 10, 999, 80, 'fuzzy')
  ], 5).map(item => item.word),
  ['exact-low', 'fuzzy-high'],
  'an exact derivative is selected before a more frequent fuzzy candidate from another model'
);

const closeFuzzy = candidate('close-fuzzy', 'close', 20, 1, 20, 20, 'fuzzy');
closeFuzzy.match = { ...closeFuzzy.match, distance: 1, similarity: 0.9 };
const distantFuzzy = candidate('distant-fuzzy', 'distant', 99, 1, 1, 99, 'fuzzy');
distantFuzzy.match = { ...distantFuzzy.match, distance: 2, similarity: 0.8 };
assert.deepEqual(
  selectBestFinalModels([distantFuzzy, closeFuzzy], 5).map(item => item.word),
  ['close-fuzzy', 'distant-fuzzy'],
  'distance and similarity are compared before corpus frequency'
);

const sameModel = selectHighestFrequencyPerModel([
  { ...candidate('rooted', 'same', 40, 99, 1, 100), search_form: 'rooted' },
  { ...candidate('rooting', 'same', 90, 10, 2, 50), search_form: 'rooting' }
], 'root', 'en');
assert.deepEqual(sameModel.candidates.map(item => item.word), ['rooting'], 'one model keeps the derivative with maximum F');

const sameModelMixedQuality = selectHighestFrequencyPerModel([
  { ...candidate('rooted', 'same', 20, 1, 2, 20, 'exact'), search_form: 'rooted' },
  { ...candidate('rooting', 'same', 99, 1, 1, 99, 'fuzzy'), search_form: 'rooting' }
], 'root', 'en');
assert.deepEqual(sameModelMixedQuality.candidates.map(item => item.word), ['rooted'], 'a fuzzy form cannot replace an exact representative of the same model by frequency alone');

assert.equal(compareFrequencyRepresentatives(candidate('rank-one', 'a', 50, 1, 1, 10), candidate('rank-two', 'b', 50, 1, 2, 100)) < 0, true, 'lower rank wins after equal F');
assert.equal(compareFrequencyRepresentatives(candidate('ipm-high', 'a', 50, 1, 1, 20), candidate('ipm-low', 'b', 50, 1, 1, 10)) < 0, true, 'higher total IPM wins after equal F and rank');
assert.equal(compareFrequencyRepresentatives(candidate('alpha', 'a', 50, 1, 1, 10), candidate('beta', 'b', 50, 1, 1, 10)) < 0, true, 'stable lexicographic ordering wins after equal F/rank/IPM');

console.log('Associative match-quality-first top-five tests passed.');
