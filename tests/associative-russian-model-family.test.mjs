import assert from 'node:assert/strict';
import {
  lexicalModelDescriptor,
  selectHighestFrequencyPerModel
} from '../associativvordes/js/candidate-model-family.js';

const root = 'alter';
const adjective = {
  word: 'альтернативный',
  match: { type: 'exact', fragment: 'alter', index: 0 },
  frequency_score: 51.3,
  rank: 1,
  selected: true
};
const agentNoun = {
  word: 'альтернативщик',
  match: { type: 'exact', fragment: 'alter', index: 0 },
  frequency_score: 6.45,
  rank: 2,
  selected: true
};

const adjectiveModel = lexicalModelDescriptor(adjective, root, 'ru');
const agentModel = lexicalModelDescriptor(agentNoun, root, 'ru');

assert.equal(adjectiveModel.stem, 'alternativ');
assert.equal(agentModel.stem, 'alternativ');
assert.equal(agentModel.key, adjectiveModel.key);

const selection = selectHighestFrequencyPerModel([agentNoun, adjective], root, 'ru');
assert.equal(selection.groups.length, 1);
assert.equal(selection.candidates.length, 1);
assert.equal(selection.candidates[0].word, 'альтернативный');
assert.equal(selection.dropped.length, 1);
assert.equal(selection.dropped[0].word, 'альтернативщик');

const distinctSelection = selectHighestFrequencyPerModel([
  adjective,
  { word: 'альтер', match: { type: 'exact', fragment: 'alter', index: 0 }, frequency_score: 10 },
  { word: 'безальтернативный', match: { type: 'exact', fragment: 'alter', index: 3 }, frequency_score: 7 }
], root, 'ru');

assert.equal(distinctSelection.groups.length, 3);

console.log('Russian associative model-family deduplication tests passed');