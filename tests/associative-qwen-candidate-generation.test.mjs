import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  normalizeQwenCandidateSuggestions,
  QWEN_RUNTIME_CONFIG
} from '../associativvordes/js/qwen-client.js';

assert.equal(QWEN_RUNTIME_CONFIG.enableCandidateGeneration, true, 'supplemental candidate generation is enabled');
assert.equal(QWEN_RUNTIME_CONFIG.maxGeneratedCandidatesPerLanguage, 2, 'candidate generation is strictly bounded per language');

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
assert.deepEqual(normalized.de, [], 'missing language arrays normalize to an empty list');

const clientSource = await readFile('associativvordes/js/qwen-client.js', 'utf8');
const checkboxHookSource = await readFile('associativvordes/js/qwen-checkbox-hook.js', 'utf8');
const swowClientSource = await readFile('associativvordes/js/swow-client.js', 'utf8');
const endpointSource = await readFile('api/qwen-candidates.js', 'utf8');
const endpointModule = await import('../api/qwen-candidates.js');

assert.equal(typeof endpointModule.default, 'function', 'supplemental candidate API exports a loadable Vercel handler');

const previousFetch = globalThis.fetch;
const previousApiKey = process.env.Qwen3_235B_A22B_Instruct_2507_FP8_Yandex;
const previousFolderId = process.env.yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8;
process.env.Qwen3_235B_A22B_Instruct_2507_FP8_Yandex = 'test-key';
process.env.yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8 = 'test-folder';
let qwenRequestCount = 0;
globalThis.fetch = async () => {
  qwenRequestCount += 1;
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            candidates: {
              en: [
                { word: 'altruism', root_variant: 'altru' },
                { word: 'altruist', root_variant: 'altru' },
                { word: 'charity', root_variant: 'altru' },
                { word: 'alterity', root_variant: '' }
              ],
              ru: [
                { word: 'альтруизм', root_variant: 'altru' },
                { word: 'альтруист', root_variant: 'альтру' },
                { word: 'благотворительность', root_variant: 'альтру' }
              ]
            }
          })
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
await endpointModule.default({
  method: 'POST',
  headers: {},
  body: { root: 'alter', targetMeaning: 'other', interfaceLanguage: 'en', existingCandidates: {} }
}, response);
const endpointPayload = JSON.parse(responseText);
assert.equal(response.statusCode, 200, 'supplemental endpoint accepts a valid request');
assert.deepEqual(endpointPayload.candidates.en, [
  { word: 'altruism', root_variant: 'altru' },
  { word: 'altruist', root_variant: 'altru' }
], 'endpoint retains only bounded English lemmas with a visible allomorph');
assert.deepEqual(endpointPayload.candidates.ru, [
  { word: 'альтруизм', root_variant: 'altru' },
  { word: 'альтруист', root_variant: 'альтру' }
], 'Russian candidates accept either native or canonical search transliteration for root_variant');
assert.equal(qwenRequestCount, 2, 'one repair request is made for languages left empty by the first response');
assert.deepEqual(endpointPayload.repairedLanguages.sort(), ['de', 'es', 'fr', 'it']);
assert.equal(responseHeaders['Cache-Control'], 'no-store', 'candidate responses are not cached');

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
assert.match(checkboxHookSource, /candidateRequestSignature\(\)[\s\S]*resultStillVisible/, 'supplemental responses are discarded after the search inputs or visible result change');
assert.match(checkboxHookSource, /emptyCandidateResponse\(\)/, 'a stale candidate response becomes an empty successful response instead of mutating new results');
assert.match(swowClientSource, /import '\.\/qwen-checkbox-hook\.js'/, 'the checkbox and stale-request guards are installed by the normal runtime module graph');
assert.match(clientSource, /loadCandidateEntries\(language, suggestion\.word/, 'generated words must be found in the local static index');
assert.match(clientSource, /buildSearchForm\(entry\.word\) === requested/, 'local verification requires an exact normalized lemma');
assert.match(clientSource, /qwen_suggestion_verified_in_local_index/, 'only locally verified suggestions are marked for insertion');
assert.match(clientSource, /window\.updateItem\(language, index, 'frequencyProfile'/, 'verified frequency evidence is attached before semantic analysis');
assert.match(clientSource, /window\.updateItem\(language, index, 'word', entry\.word\)/, 'inserting the verified word triggers the existing SWOW and Qwen analysis pipeline');
assert.match(clientSource, /await delay\(4000\)/, 'supplemental analyses are staggered instead of launching an uncontrolled burst');

assert.match(endpointSource, /Never invent candidate words|never invent candidate words/i, 'server prompt explicitly forbids invented candidates');
assert.match(endpointSource, /morphological and etymological discovery task/, 'candidate discovery no longer filters out words because of semantic drift');
assert.match(endpointSource, /SWOW and a separate Qwen scoring stage evaluate semantics later/, 'semantic evaluation is deferred to the actual scoring stage');
assert.match(endpointSource, /English altruism\/altruist and Russian альтруизм\/альтруист/, 'prompt covers historically transformed root reflexes such as alter → altru-');
assert.match(endpointSource, /ROOT_ALLOMORPH_HINTS/, 'known historical allomorphs are supplied as generation hints');
assert.match(endpointSource, /missingLanguages[\s\S]*repair: true/, 'empty languages receive one bounded repair pass');
assert.match(endpointSource, /buildSearchForm\(word\)[\s\S]*buildSearchForm\(rootVariant\)/, 'native and transliterated root variants are compared in one canonical search form');
assert.match(endpointSource, /MAX_CANDIDATES_PER_LANGUAGE = 2/, 'server and client enforce the same candidate limit');
assert.match(endpointSource, /!word \|\| !rootVariant/, 'server rejects candidates without an explicit transformed-root segment');

console.log('Associative Qwen candidate generation tests passed.');
