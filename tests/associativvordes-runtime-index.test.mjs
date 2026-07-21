import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { findCandidatesForRoot } from '../associativvordes/js/candidate-finder.js';
import { lexicalModelDescriptor } from '../associativvordes/js/candidate-model-family.js';

const script = await readFile('associativvordes/script.js', 'utf8');
const html = await readFile('associativvordes/index.html', 'utf8');

assert.match(script, /createCandidateIndexLoader\(\)/, 'runtime creates one candidate-index loader');
assert.match(script, /candidateIndexLoader\.loadCandidateEntries\(langCode, root, \{ signal \}\)/, 'getLanguageCandidates uses loader with AbortSignal');
assert.match(script, /findCandidatesForRoot\(\{[\s\S]*maxCandidates: QWEN_RUNTIME_CONFIG\.maxCandidatesPerLanguage/, 'finder applies runtime limit after sorting');
assert.doesNotMatch(script, /DEFAULT_DERIVATIVES|DEFAULT_FREQUENCIES|loadJsonFilesFromDirectory|derivativeData|frequencyData/, 'demo arrays and legacy JSON loader are not used');
assert.doesNotMatch(script, /fetch\(`\.\/\$\{lang\.code\}\.json`|\.\/en\.json/, 'legacy per-language JSON files are not loaded');
assert.match(script, /status: 'no_candidates', candidates: \[\]/, 'no_candidates status is structured');
assert.match(script, /status: 'index_error', errorCode:/, 'index_error status is structured');
assert.match(script, /isCurrentRun\(runId\)/, 'runId guard remains in runtime');
assert.match(script, /activeRunAbortController/, 'stale candidate loads are abortable');
assert.match(script, /frequencyProfile: frequencyProfileFromCandidate\(candidate\)/, 'frequency profile is derived from index candidate');
assert.match(script, /frequencyProfile: item\.frequencyProfile/, 'analysis receives precomputed frequency profile');
assert.match(script, /lexicalModelDescriptor\(\{ \.\.\.item, word \}, root, language\)/, 'runtime model inference delegates to the canonical descriptor');
assert.match(script, /model_key: candidate\.model_key \|\| candidate\.model_family_key/, 'canonical model identity is preserved from candidate search');
assert.match(script, /reconcileModelRepresentatives\(validCandidates, root, lang\.code\)/, 'one representative per model is selected before Qwen analysis');
assert.match(script, /window\.InteralPageStateExport|window\.InteralPageStateImport/, 'page state persistence hooks remain');
assert.match(script, /sources: sourceState\.sources/, 'saved state includes sources without storing shard payloads');
assert.doesNotMatch(script, /manifestLoaded|loadedShards|shardCache/, 'localStorage compaction does not persist manifest or shards');
assert.match(html, /script\.js\?v=associative-index-runtime-20260716-1/, 'fixed cache busting is updated');

const fixtureEntries = [
  { word: 'alter', language: 'en', normalized: 'alter', search_form: 'alter', rank: 1, frequency_score: 91, category_breakdown: { fixture: 91 }, sources: [{ source: 'fixture', ipm: 10 }] },
  { word: 'inter', language: 'en', normalized: 'inter', search_form: 'inter', rank: 2, frequency_score: 90, sources: [{ source: 'fixture', ipm: 9 }] },
  { word: 'ghost', language: 'en', normalized: 'ghost', search_form: 'alterghost', rank: 3, frequency_score: 80, sources: [] },
  { word: 'альтернативный', normalized: 'альтернативный', search_form: 'alternativnyj', language: 'ru', rank: 4, frequency_score: 70, sources: [{ source: 'fixture', ipm: 7 }] }
];
const alter = findCandidatesForRoot({ entries: fixtureEntries, root: 'alter', language: 'en', maxCandidates: 10 }).candidates;
assert.deepEqual(alter.map(item => item.word), ['alter'], 'alter receives real fixture candidate and inter is absent');
assert.equal(alter[0].frequency_score, 91, 'frequency_score comes from index');
assert.deepEqual(alter[0].sources, [{ source: 'fixture', ipm: 10 }], 'candidate contains sources');
assert.equal(findCandidatesForRoot({ entries: fixtureEntries, root: 'alter', language: 'ru' }).candidates[0].word, 'альтернативный', 'Russian original word is preserved');
assert.equal(findCandidatesForRoot({ entries: fixtureEntries, root: 'alter', language: 'en' }).diagnostics.rejectedByReason.sources_empty, 1, 'candidate without sources is rejected before analysis');

const modelFromSearchForm = lexicalModelDescriptor({ word: 'неважно', search_form: 'alternativnyj', match: { type: 'exact', fragment: 'alter', index: 0 } }, 'alter', 'ru');
assert.equal(modelFromSearchForm.key, 'ru|root||alter|н', 'canonical model descriptor uses the v2 derivational model from search_form');
const modelFromMatch = lexicalModelDescriptor({ word: 'realteration', search_form: 'realteration', match: { type: 'exact', fragment: 'alter', index: 2 } }, 'alter', 'en');
assert.equal(modelFromMatch.key, 'en|root|re|alter|ation', 'canonical model descriptor preserves prefix position without including the whole word');

const analyzerSource = await readFile('associativvordes/js/association-analyzer.js', 'utf8');
assert.match(analyzerSource, /hasFrequencyProfile \? \{ \.\.\.frequencyProfile/, 'analyzer uses supplied frequencyProfile');
assert.match(analyzerSource, /: await getFrequencyProfile\(language, word\)/, 'manual words still use runtime frequency lookup when no profile is supplied');
