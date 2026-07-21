import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  compareFinalModelCandidates,
  normalizeQwenCandidateSuggestions,
  QWEN_RUNTIME_CONFIG,
  selectBestFinalModels
} from '../associativvordes/js/qwen-client.js';

assert.equal(QWEN_RUNTIME_CONFIG.enableCandidateGeneration, true, 'top-five model refinement is enabled');
assert.equal(QWEN_RUNTIME_CONFIG.maxGeneratedCandidatesPerLanguage, 2, 'candidate generation is strictly bounded per language');
assert.equal(QWEN_RUNTIME_CONFIG.autoAnalyzeCandidatesPerLanguage, 5, 'the initial stage analyzes five frequency-selected models');
assert.ok(QWEN_RUNTIME_CONFIG.candidateRequestTimeoutMs > QWEN_RUNTIME_CONFIG.requestTimeoutMs, 'the multilingual candidate audit has a longer timeout than one word score');

const normalized = normalizeQwenCandidateSuggestions({
  candidates: {
    ru: [
      { word: 'альтруизм', root_variant: 'альтру' },
      { word: ' альтруист ', rootVariant: 'альтру' },
      { word: 'АЛЬТРУИЗМ', root_variant: 'альтру' },
      { word: 'строка\nс переносом', root_variant: 'строка' }
    ],
    en: [{ word: 'altruism', root_variant: 'altru' }, { word: 'altruist', root_variant: 'altru' }, { word: 'alterity', root_variant: 'alter' }]
  }
});

assert.deepEqual(normalized.ru, [
  { word: 'альтруизм', root_variant: 'альтру' },
  { word: 'альтруист', root_variant: 'альтру' }
], 'Russian suggestions preserve native spelling, normalize fields, deduplicate, and obey the limit');
assert.deepEqual(normalized.en, [
  { word: 'altruism', root_variant: 'altru' },
  { word: 'altruist', root_variant: 'altru' }
], 'English suggestions obey the same deterministic limit');
assert.deepEqual(normalized.de, [], 'missing language arrays normalize to empty lists');

const evaluatedModels = [
  { word: 'alternative', model_key: 'm1', frequency_score: 95, final_score: 35, rank: 1 },
  { word: 'alteration', model_key: 'm2', frequency_score: 90, final_score: 50, rank: 2 },
  { word: 'alterity', model_key: 'm3', frequency_score: 85, final_score: 45, rank: 3 },
  { word: 'alternate', model_key: 'm4', frequency_score: 80, final_score: 40, rank: 4 },
  { word: 'alterable', model_key: 'm5', frequency_score: 75, final_score: 30, rank: 5 },
  { word: 'altruism', model_key: 'm6', frequency_score: 60, final_score: 82, rank: 6 },
  { word: 'altruist', model_key: 'm7', frequency_score: 55, final_score: 78, rank: 7 }
];
const finalFive = selectBestFinalModels(evaluatedModels, 5);
assert.deepEqual(finalFive.map(item => item.word), ['alternative', 'alteration', 'alterity', 'alternate', 'alterable'], 'final five are selected by frequency even when lower-F supplemental models have higher P');
assert.ok(compareFinalModelCandidates(evaluatedModels[5], evaluatedModels[0]) > 0, 'final model comparison prioritizes F before P');

const sameModel = selectBestFinalModels([
  { word: 'alternative', model_key: 'same', frequency_score: 90, final_score: 30, rank: 1 },
  { word: 'alternatively', model_key: 'same', frequency_score: 60, final_score: 99, rank: 2 }
], 5);
assert.deepEqual(sameModel.map(item => item.word), ['alternative'], 'one model still uses its most frequent representative even when another form has a higher P');

const clientSource = await readFile('associativvordes/js/qwen-client.js', 'utf8');
const checkboxHookSource = await readFile('associativvordes/js/qwen-checkbox-hook.js', 'utf8');
const swowClientSource = await readFile('associativvordes/js/swow-client.js', 'utf8');
const endpointSource = await readFile('api/qwen-candidates.js', 'utf8');
const endpointModule = await import('../api/qwen-candidates.js');

assert.equal(typeof endpointModule.default, 'function', 'supplemental candidate API exports a loadable Vercel handler');
assert.equal(endpointModule.maxDuration, 60, 'the server allows enough time for one multilingual audit');

const previousFetch = globalThis.fetch;
const previousApiKey = process.env.Qwen3_235B_A22B_Instruct_2507_FP8_Yandex;
const previousFolderId = process.env.yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8;
process.env.Qwen3_235B_A22B_Instruct_2507_FP8_Yandex = 'test-key';
process.env.yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8 = 'test-folder';
let qwenRequestCount = 0;
let sentPrompt = '';
globalThis.fetch = async (_url, options) => {
  qwenRequestCount += 1;
  const request = JSON.parse(options.body);
  sentPrompt = request.messages?.[1]?.content || '';
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({ candidates: { en: [], de: [], fr: [], es: [], it: [], ru: [] } })
        }
      }]
    })
  };
};

const responseHeaders = {};
let responseText = '';
const response = {
  statusCode: 0,
  setHeader(name, value) { responseHeaders[name] = value; },
  end(value = '') { responseText = String(value); }
};
const currentModels = {
  en: [{ word: 'alternative', model_key: 'en|alternative', frequency_score: 95, association_score: 20, final_score: 46 }],
  ru: [{ word: 'альтернатива', model_key: 'ru|alternativ', frequency_score: 92, association_score: 18, final_score: 44 }]
};
await endpointModule.default({
  method: 'POST',
  headers: {},
  body: { root: 'alter', targetMeaning: 'other', interfaceLanguage: 'en', existingCandidates: { en: ['alternative'], ru: ['альтернатива'] }, currentModels }
}, response);
const endpointPayload = JSON.parse(responseText);
assert.equal(response.statusCode, 200, 'supplemental endpoint accepts a scored top-five audit request');
assert.deepEqual(endpointPayload.qwenCandidates, { en: [], de: [], fr: [], es: [], it: [], ru: [] }, 'the test models an empty Qwen generation result');
assert.deepEqual(endpointPayload.candidates.en, [
  { word: 'altruism', root_variant: 'altru' },
  { word: 'altruist', root_variant: 'altru' }
]);
assert.deepEqual(endpointPayload.candidates.de, [
  { word: 'Altruismus', root_variant: 'altru' },
  { word: 'Altruist', root_variant: 'altru' }
]);
assert.deepEqual(endpointPayload.candidates.fr, [
  { word: 'altruisme', root_variant: 'altru' },
  { word: 'altruiste', root_variant: 'altru' }
]);
assert.deepEqual(endpointPayload.candidates.es, [
  { word: 'altruismo', root_variant: 'altru' },
  { word: 'altruista', root_variant: 'altru' }
]);
assert.deepEqual(endpointPayload.candidates.it, [
  { word: 'altruismo', root_variant: 'altru' },
  { word: 'altruista', root_variant: 'altru' }
]);
assert.deepEqual(endpointPayload.candidates.ru, [
  { word: 'альтруизм', root_variant: 'альтру' },
  { word: 'альтруист', root_variant: 'альтру' }
]);
assert.equal(qwenRequestCount, 1, 'the audit still performs one Qwen request');
assert.equal(endpointPayload.currentModels.en[0].final_score, 46, 'measured current-model scores reach the server prompt');
assert.match(sentPrompt, /Current top models with measured scores/);
assert.match(sentPrompt, /Empty arrays are valid final decisions/);
assert.equal(responseHeaders['Cache-Control'], 'no-store', 'candidate responses are not cached');

let fallbackResponseText = '';
const fallbackResponse = {
  statusCode: 0,
  setHeader() {},
  end(value = '') { fallbackResponseText = String(value); }
};
globalThis.fetch = async () => { throw new Error('simulated Qwen outage'); };
await endpointModule.default({
  method: 'POST',
  headers: {},
  body: { root: 'alter', targetMeaning: 'other', interfaceLanguage: 'en', existingCandidates: {}, currentModels: {} }
}, fallbackResponse);
const fallbackPayload = JSON.parse(fallbackResponseText);
assert.equal(fallbackResponse.statusCode, 200, 'known allomorph candidates survive a Qwen transport failure');
assert.deepEqual(fallbackPayload.candidates.en, [
  { word: 'altruism', root_variant: 'altru' },
  { word: 'altruist', root_variant: 'altru' }
]);
assert.equal(fallbackPayload.qwenAuditError.errorCode, 'QWEN_CANDIDATE_AUDIT_UNAVAILABLE');

globalThis.fetch = previousFetch;
if (previousApiKey == null) delete process.env.Qwen3_235B_A22B_Instruct_2507_FP8_Yandex;
else process.env.Qwen3_235B_A22B_Instruct_2507_FP8_Yandex = previousApiKey;
if (previousFolderId == null) delete process.env.yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8;
else process.env.yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8 = previousFolderId;

assert.match(clientSource, /key === 'selected' && value === true/, 'checking an unscored word activates the Qwen-analysis hook');
assert.match(clientSource, /stateCandidateHasQwen\(candidate\)/, 'the checkbox hook does not repeat an existing Qwen score');
assert.match(checkboxHookSource, /persistedCandidate[\s\S]*if \(persistedCandidate\) return result/, 'the overflow hook complements rather than duplicates the primary checkbox hook');
assert.match(checkboxHookSource, /input\.word-select\[data-lang=/, 'visible rows beyond the compact-state limit are located directly in the table');
assert.match(checkboxHookSource, /await window\.analyzeItem\(language, index\)/, 'checking an unscored row beyond the first 80 still runs analysis');
assert.match(swowClientSource, /import '\.\/qwen-checkbox-hook\.js'/, 'the checkbox guard remains in the normal runtime module graph');
assert.match(clientSource, /currentModels[\s\S]*getQwenCandidateSuggestions/, 'the candidate audit receives the measured current five models');
assert.match(clientSource, /loadCandidateEntries\(language, suggestion\.word/, 'generated words must be found in the local static index');
assert.match(clientSource, /buildSearchForm\(entry\.word\) === requested/, 'local verification requires an exact normalized lemma');
assert.match(clientSource, /qwen_suggestion_verified_in_local_index/, 'only locally verified suggestions are marked for insertion');
assert.match(clientSource, /waitForCandidateAnalysis/, 'every verified supplement is scored before final selection');
assert.match(clientSource, /selectBestFinalModels[\s\S]*candidateFrequencyScore/, 'the final five are ranked by measured F');
assert.match(clientSource, /rebalanceSelectedModels/, 'supplements can replace weaker members of the original five');
assert.match(clientSource, /existingCandidates = Object\.fromEntries[\s\S]*currentModels\[language\]/, 'the audit excludes only the current five, not every lower-ranked local candidate');
assert.match(clientSource, /findIndexByWord/, 'a suggested word already present lower in the full result is located instead of discarded');
assert.match(clientSource, /findIndexByModel/, 'an existing representative of the suggested model is reused');
assert.match(clientSource, /allCandidates/, 'final rebalancing uses the full runtime candidate list rather than the truncated saved-state snapshot');
assert.doesNotMatch(clientSource, /existingKeys\[language\]\.has\(suggestionKey\)/, 'an already-found but unselected word is not silently skipped');

assert.match(endpointSource, /already selected up to five distinct derivational models per language by corpus frequency/, 'server understands the two-stage selection policy');
assert.match(endpointSource, /credible chance of entering the frequency-selected top five/, 'Qwen proposes plausible frequency improvements');
assert.match(endpointSource, /If the current five models are already adequate, return an empty array/, 'Qwen may correctly propose nothing outside the configured high-confidence allomorphs');
assert.match(endpointSource, /ROOT_ALLOMORPH_CANDIDATES/, 'known high-confidence allomorph models are guaranteed after the audit');
assert.match(endpointSource, /mergeCandidateMaps\(guaranteedCandidates, qwenCandidates\)/, 'guaranteed allomorph candidates cannot be suppressed by an empty model response');
assert.match(endpointSource, /QWEN_CANDIDATE_AUDIT_UNAVAILABLE/, 'known allomorph candidates survive Qwen transport and parsing failures');
assert.match(endpointSource, /English altruism\/altruist and Russian альтруизм\/альтруист/, 'prompt explicitly covers alter → altru-');
assert.match(endpointSource, /ROOT_ALLOMORPH_HINTS/, 'historical allomorph hints remain available');
assert.doesNotMatch(endpointSource, /missingLanguages[\s\S]*repair/, 'empty arrays are no longer treated as a second model request');
assert.match(endpointSource, /buildSearchForm\(word\)[\s\S]*buildSearchForm\(rootVariant\)/, 'native and transliterated root variants share one canonical search form');

console.log('Associative Qwen top-five refinement tests passed.');
