import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { QWEN_RUNTIME_CONFIG, QWEN_ERROR_CODES, getQwenAssociationScores } from '../associativvordes/js/qwen-client.js';
import { THRESHOLDS } from '../associativvordes/js/association-analyzer.js';

const script = await readFile('associativvordes/script.js', 'utf8');
const qwen = await readFile('associativvordes/js/qwen-client.js', 'utf8');
const analyzer = await readFile('associativvordes/js/association-analyzer.js', 'utf8');

assert.equal(QWEN_RUNTIME_CONFIG.enableCandidateGeneration, true, 'bounded supplemental Qwen candidate generation is enabled');
assert.equal(QWEN_RUNTIME_CONFIG.maxGeneratedCandidatesPerLanguage, 2, 'candidate generation cannot create an unbounded result set');
assert.deepEqual(THRESHOLDS, { main: 35 }, 'only the final association threshold remains');
assert.equal(QWEN_RUNTIME_CONFIG.enableReviewModel, false, 'score-triggered per-word review is disabled');
assert.equal(QWEN_RUNTIME_CONFIG.autoAnalyzeCandidatesPerLanguage, Infinity, 'every model representative is analyzed');
assert.equal(QWEN_RUNTIME_CONFIG.maxReviewRequestsPerSearch, 0, 'no per-word review request budget remains');
assert.match(script, /languageStatuses/, 'per-language statuses are persisted in state');
assert.match(script, /createLanguageStatus\('no_candidates'\)[\s\S]*continue;/, 'no_candidates path skips ordinary candidate Qwen analysis');
assert.match(script, /createLanguageStatus\('index_error'[\s\S]*continue;/, 'index_error path skips ordinary candidate Qwen analysis');
assert.match(script, /isValidRuntimeCandidate[\s\S]*sources\.length === 0[\s\S]*frequency_score[\s\S]*!item\.match/, 'candidates are validated before Qwen');
assert.match(script, /word: item\.word/, 'original candidate word is sent to Qwen');
assert.doesNotMatch(script, /word: item\.search_form/, 'search_form is not sent to Qwen as word');
assert.match(script, /failedAnalysis[\s\S]*final_score: null[\s\S]*selected: false/, 'Qwen error does not become final_score 0');
assert.match(script, /state\.languages = \{ \.\.\.state\.languages, \.\.\.nextLangs \}/, 'one failed language does not clear previous language results');
assert.match(analyzer, /const finalEvaluation = \{ \.\.\.primary, combination_method: 'primary_only' \}/, 'all words use one uniform primary evaluation path');
assert.doesNotMatch(analyzer, /reviewMin|reviewMax|primary\.final_score >=/, 'no per-word score interval triggers a second evaluation');
assert.match(qwen, /requestTimeoutMs: 15000/, 'single Qwen request has bounded timeout');
assert.match(qwen, /AbortController/, 'Qwen timeout uses AbortController');
assert.match(qwen, /qwen_suggestion_verified_in_local_index/, 'generated candidates must be verified in the local index before analysis');
assert.match(script, /buttonController\?\.success[\s\S]*Done[\s\S]*Готово/, 'successful calculation shows localized completion status');
const searchDerivativesBlock = script.match(/async function searchDerivatives\(\) \{[\s\S]*?\n    \}/)?.[0] || '';
assert.doesNotMatch(searchDerivativesBlock, /finally[\s\S]*setCalculateButtonStatus\(defaultCalculateButtonText\(\), false, \{ loading: false \}\)/, 'finally does not immediately overwrite the completion status');
assert.match(script, /completed_with_warnings/, 'global status supports completed with warnings');
assert.match(script, /normalizeRestoredLanguageStatuses[\s\S]*loading_index[\s\S]*analyzing[\s\S]*aborted/, 'interrupted restore becomes aborted');
assert.match(script, /InteralAssociativDiagnostics/, 'developer diagnostics are available behind explicit diagnostics function');
assert.match(script, /qwenPrimaryRequestCount|qwenReviewRequestCount|qwenFailedRequestCount|abortedRequestCount|indexFetchCount|candidateCount/, 'request diagnostics are counted');
assert.match(script, /mapWithConcurrency\([\s\S]*QWEN_RUNTIME_CONFIG\.maxConcurrentQwenRequests/, 'maxConcurrentQwenRequests is honored');
assert.doesNotMatch(script, /Promise\.all\(LANGUAGES|LANGUAGES\.map\(async/, 'languages are not launched with Promise.all');
assert.match(qwen, /QWEN_HTTP_ERROR|QWEN_TIMEOUT|QWEN_INVALID_RESPONSE|QWEN_SEMANTIC_SCORES_INVALID|QWEN_ABORTED|QWEN_REVIEW_FAILED|QWEN_CANDIDATE_GENERATION_FAILED/, 'stable Qwen error codes are defined');

const previousDocument = globalThis.document;
globalThis.document = { documentElement: { lang: 'en' } };
const previousFetch = globalThis.fetch;
globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({ error: 'down' }) });
await assert.rejects(
  getQwenAssociationScores({ language: 'en', targetMeaning: 'rule', word: 'rule', swow: {} }),
  error => error.code === QWEN_ERROR_CODES.HTTP_ERROR,
  'HTTP errors use QWEN_HTTP_ERROR'
);

globalThis.fetch = async () => ({ ok: true, json: async () => ({ analysis: '{bad' }) });
await assert.rejects(
  getQwenAssociationScores({ language: 'en', targetMeaning: 'rule', word: 'rule', swow: {} }),
  error => error.code === QWEN_ERROR_CODES.INVALID_RESPONSE,
  'invalid JSON uses QWEN_INVALID_RESPONSE'
);

globalThis.fetch = async () => ({ ok: true, json: async () => ({ analysis: { directness: 'nope', field_relatedness: 50, domain_shift: 20 } }) });
await assert.rejects(
  getQwenAssociationScores({ language: 'en', targetMeaning: 'rule', word: 'rule', swow: {} }),
  error => error.code === QWEN_ERROR_CODES.SEMANTIC_SCORES_INVALID,
  'invalid semantic scores use QWEN_SEMANTIC_SCORES_INVALID'
);

QWEN_RUNTIME_CONFIG.requestTimeoutMs = 1;
globalThis.fetch = (_url, options) => new Promise((resolve, reject) => {
  options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
});
await assert.rejects(
  getQwenAssociationScores({ language: 'en', targetMeaning: 'rule', word: 'rule', swow: {} }),
  error => error.code === QWEN_ERROR_CODES.TIMEOUT,
  'timeouts use QWEN_TIMEOUT'
);
QWEN_RUNTIME_CONFIG.requestTimeoutMs = 15000;
globalThis.fetch = previousFetch;
globalThis.document = previousDocument;

console.log('associativvordes error-handling tests passed');
