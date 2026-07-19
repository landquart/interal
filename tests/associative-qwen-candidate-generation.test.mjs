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
    en: ['altruism', { word: 'altruist', root_variant: 'altru' }, { word: 'alterity', root_variant: 'alter' }]
  }
});

assert.deepEqual(normalized.ru, [
  { word: 'альтруизм', root_variant: 'альтру' },
  { word: 'альтруист', root_variant: 'альтру' }
], 'Russian suggestions preserve native spelling, normalize fields, deduplicate, and obey the limit');
assert.deepEqual(normalized.en, [
  { word: 'altruism', root_variant: '' },
  { word: 'altruist', root_variant: 'altru' }
], 'English suggestions obey the same deterministic limit');
assert.deepEqual(normalized.de, [], 'missing language arrays normalize to an empty list');

const clientSource = await readFile('associativvordes/js/qwen-client.js', 'utf8');
const checkboxHookSource = await readFile('associativvordes/js/qwen-checkbox-hook.js', 'utf8');
const swowClientSource = await readFile('associativvordes/js/swow-client.js', 'utf8');
const endpointSource = await readFile('api/qwen-candidates.js', 'utf8');

assert.match(clientSource, /key === 'selected' && value === true/, 'checking an unscored word activates the Qwen-analysis hook');
assert.match(clientSource, /stateCandidateHasQwen\(candidate\)/, 'the checkbox hook does not repeat an existing Qwen score');
assert.match(checkboxHookSource, /persistedCandidate[\s\S]*if \(persistedCandidate\) return result/, 'the overflow hook complements rather than duplicates the primary checkbox hook');
assert.match(checkboxHookSource, /input\.word-select\[data-lang=/, 'visible rows beyond the compact-state limit are located directly in the table');
assert.match(checkboxHookSource, /await window\.analyzeItem\(language, index\)/, 'checking an unscored row beyond the first 80 still runs analysis');
assert.match(swowClientSource, /import '\.\/qwen-checkbox-hook\.js'/, 'the overflow checkbox hook is installed by the normal runtime module graph');
assert.match(clientSource, /loadCandidateEntries\(language, suggestion\.word/, 'generated words must be found in the local static index');
assert.match(clientSource, /buildSearchForm\(entry\.word\) === requested/, 'local verification requires an exact normalized lemma');
assert.match(clientSource, /qwen_suggestion_verified_in_local_index/, 'only locally verified suggestions are marked for insertion');
assert.match(clientSource, /window\.updateItem\(language, index, 'frequencyProfile'/, 'verified frequency evidence is attached before semantic analysis');
assert.match(clientSource, /window\.updateItem\(language, index, 'word', entry\.word\)/, 'inserting the verified word triggers the existing SWOW and Qwen analysis pipeline');
assert.match(clientSource, /await delay\(4000\)/, 'supplemental analyses are staggered instead of launching an uncontrolled burst');

assert.match(endpointSource, /Never invent candidate words/, 'server prompt explicitly forbids invented candidates');
assert.match(endpointSource, /English altruism\/altruist and Russian альтруизм\/альтруист/, 'prompt covers historically transformed root reflexes such as alter → altru-');
assert.match(endpointSource, /MAX_CANDIDATES_PER_LANGUAGE = 2/, 'server and client enforce the same candidate limit');
assert.match(endpointSource, /exact native spelling, including Cyrillic for Russian/, 'server requests dictionary spelling suitable for exact local lookup');

console.log('Associative Qwen candidate generation tests passed.');
