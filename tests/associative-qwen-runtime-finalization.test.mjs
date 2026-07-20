import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { finalizeCandidateOrdering } from '../associativvordes/js/qwen-client.js';

const initial = [
  { word: 'alternative', model_key: 'm1', frequency_score: 95, final_score: 35, selected: true },
  { word: 'alteration', model_key: 'm2', frequency_score: 90, final_score: 50, selected: true },
  { word: 'alterity', model_key: 'm3', frequency_score: 85, final_score: 45, selected: true },
  { word: 'alternate', model_key: 'm4', frequency_score: 80, final_score: 40, selected: true },
  { word: 'alterable', model_key: 'm5', frequency_score: 75, final_score: 30, selected: true },
  ...Array.from({ length: 100 }, (_, index) => ({ word: 'unscored-' + index, model_key: 'unscored-' + index, frequency_score: 10, final_score: null, selected: false })),
  { word: 'altruism', model_key: 'm6', frequency_score: 60, final_score: 82, selected: false },
  { word: 'altruist', model_key: 'm7', frequency_score: 55, final_score: 78, selected: false }
];

const finalized = finalizeCandidateOrdering(initial, 5);
assert.deepEqual(finalized.slice(0, 5).map(candidate => candidate.word), ['altruism', 'altruist', 'alteration', 'alterity', 'alternate'], 'supplemental winners are moved into the visible top five in final-P order');
assert.equal(finalized.filter(candidate => candidate.selected).length, 5, 'exactly five scored models remain selected');
assert.ok(finalized.findIndex(candidate => candidate.word === 'altruism') < 5, 'a supplement originally below the first 100 rows is promoted into view');
assert.equal(initial[0].selected, true, 'finalization does not mutate the caller array');
assert.notStrictEqual(finalized[0], initial.at(-2), 'finalization returns safe candidate copies');

const source = await readFile('associativvordes/js/qwen-client.js', 'utf8');
assert.doesNotMatch(source, /function candidateCountFromPanel/, 'runtime insertion no longer derives a state index from localized UI text');
assert.doesNotMatch(source, /function activateLanguageTab/, 'runtime insertion no longer changes the active language tab');
assert.doesNotMatch(source, /originalUpdateItem\(language, index, 'word'/, 'supplement insertion cannot trigger the normal word-change analysis hook');
assert.match(source, /candidates\.push\(verifiedCandidatePatch/, 'new supplements are appended directly to the runtime state');
assert.match(source, /candidates\.splice\(0, candidates\.length, \.\.\.finalized\)/, 'the final top five are physically reordered before rendering');

const analyzeStart = source.indexOf('async function analyzeRuntimeCandidate');
const analyzeEnd = source.indexOf('async function addVerifiedCandidateToRuntime', analyzeStart);
assert.ok(analyzeStart >= 0 && analyzeEnd > analyzeStart, 'runtime analysis function is present');
const analyzeBlock = source.slice(analyzeStart, analyzeEnd);
assert.equal((analyzeBlock.match(/window\.analyzeItem/g) || []).length, 1, 'each supplemental candidate has one explicit analysis entry point');

console.log('Associative Qwen runtime finalization tests passed.');
