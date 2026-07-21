import assert from 'node:assert/strict';
import { lexicalModelDescriptor, selectHighestFrequencyPerModel } from '../associativvordes/js/candidate-model-family.js';
import { calculateLanguageScore, calculateFinalAssociation, classifyScore, passesWordThreshold, decisionStatusForResult } from '../associativvordes/js/association-analyzer.js';
import { MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE } from '../associativvordes/js/associative-state.js';
import { readFile } from 'node:fs/promises';

function candidate(word, search_form, frequency_score, final_score, rank = null) {
  return {
    word, normalized: word.toLowerCase(), search_form, frequency_score, final_score, rank,
    selected: true, match: { type: 'exact', distance: 0, similarity: 1, fragment: 'alter', index: 0 },
    sources: [{ id: 'test', file: 'test.json', category: 'normative', ipm: frequency_score }]
  };
}

assert.equal(MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE, 5, 'the shared associative-word limit is five per language');

const variants = [
  candidate('альтернатива', 'alternativa', 92, 18, 1),
  candidate('альтернативный', 'alternativnyj', 71, 95, 2),
  candidate('альтернативно', 'alternativno', 55, 88, 3),
  candidate('альтруизм', 'altruizm', 80, 40, 4),
  candidate('альтруист', 'altruist', 75, 45, 5)
];
variants[3].match = { type: 'special', distance: 0, similarity: 1, fragment: 'altru', index: 0 };
variants[4].match = { type: 'special', distance: 0, similarity: 1, fragment: 'altru', index: 0 };

const selection = selectHighestFrequencyPerModel(variants, 'alter', 'ru');
assert.deepEqual(selection.candidates.map(item => item.word).sort(), ['альтернатива', 'альтруизм', 'альтруист'].sort(), 'one highest-frequency representative remains per derivational model');
assert.equal(selection.candidates.find(item => item.word.startsWith('альтернатив')).word, 'альтернатива', 'frequency F, not final P, selects the representative');
assert.equal(lexicalModelDescriptor(variants[0], 'alter', 'ru').key, lexicalModelDescriptor(variants[1], 'alter', 'ru').key, 'part-of-speech variants share one model key');
assert.notEqual(lexicalModelDescriptor(variants[3], 'alter', 'ru').key, lexicalModelDescriptor(variants[4], 'alter', 'ru').key, 'altruism and altruist remain separate derivational models');

assert.equal(passesWordThreshold(1), true, 'a finite low word score is not removed by a threshold');
assert.equal(classifyScore(1), 'evaluated', 'word status is neutral rather than pass/fail');
const language = calculateLanguageScore([
  { selected: true, final_score: 80 },
  { selected: true, final_score: 50 },
  { selected: true, final_score: 20 }
]);
assert.equal(language.normalized, 50, 'low-scoring models remain in the language mean');
const limitedLanguage = calculateLanguageScore([
  { selected: true, final_score: 100 },
  { selected: true, final_score: 90 },
  { selected: true, final_score: 80 },
  { selected: true, final_score: 70 },
  { selected: true, final_score: 60 },
  { selected: true, final_score: 0 }
], { maxModels: MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE });
assert.equal(limitedLanguage.count, 5, 'no more than five words participate in one language result');
assert.equal(limitedLanguage.normalized, 80, 'the sixth selected word is excluded by the five-word limit');

const accepted = calculateFinalAssociation({
  languages: [{ code: 'en', group: 'Germanic' }, { code: 'fr', group: 'Romance' }, { code: 'ru', group: 'Slavic' }],
  languageResults: [
    { normalized: 40, sum: 40, count: 1, semanticConfirmed: true },
    { normalized: 40, sum: 40, count: 1, semanticConfirmed: true },
    { normalized: 40, sum: 40, count: 1, semanticConfirmed: true }
  ],
  languageStatuses: { en: { status: 'completed' }, fr: { status: 'completed' }, ru: { status: 'completed' } }
});
assert.equal(accepted.accepted, true, 'FA threshold plus language and group breadth accepts the result');
assert.equal(decisionStatusForResult(accepted), 'accept');
const rejected = calculateFinalAssociation({
  languages: [{ code: 'en', group: 'Germanic' }, { code: 'fr', group: 'Romance' }, { code: 'ru', group: 'Slavic' }],
  languageResults: [
    { normalized: 34, sum: 34, count: 1, semanticConfirmed: true },
    { normalized: 34, sum: 34, count: 1, semanticConfirmed: true },
    { normalized: 34, sum: 34, count: 1, semanticConfirmed: true }
  ],
  languageStatuses: { en: { status: 'completed' }, fr: { status: 'completed' }, ru: { status: 'completed' } }
});
assert.equal(decisionStatusForResult(rejected), 'reject');

const script = await readFile('associativvordes/script.js', 'utf8');
assert.match(script, /state\.maxModels = MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE/);
assert.match(script, /slice\(0, state\.maxModels \|\| MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE\)/);
assert.match(script, /const candidates = scoringCandidates\(l\.code\)/, 'FA evidence uses only the five scoring candidates');
assert.match(script, /LANGUAGES\.flatMap\(\(\{ code \}\) =>[\s\S]*scoringCandidates\(code\)/, 'JSON card uses the same five-word evidence set as FA');
assert.doesNotMatch(script, /passesWordThreshold/);
assert.doesNotMatch(script, /derivative-model-input/);
assert.match(script, /model_key: candidate\.model_key/);
assert.match(script, /reconcileModelRepresentatives/);
assert.match(script, /window\.InteralAssociativeModels/);
assert.doesNotMatch(script, /function scoringCandidates[\s\S]*state\.languages\[langCode\] = reconciled/, 'render-time scoring must not replace in-flight candidate objects');

const qwen = await readFile('associativvordes/js/qwen-client.js', 'utf8');
assert.match(qwen, /compareFrequencyRepresentatives\(proposed, existing\)/);
assert.doesNotMatch(qwen, /InteralAssociativeModels\?\.reconcile/, 'Qwen insertion waits for analyzeItem to reconcile after scoring');
assert.equal((await import('../associativvordes/js/qwen-client.js')).QWEN_RUNTIME_CONFIG.autoAnalyzeCandidatesPerLanguage, MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE);
assert.match(qwen, /enableReviewModel: true/);

console.log('Associative model-selection and threshold policy tests passed.');
