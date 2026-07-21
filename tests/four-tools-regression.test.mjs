import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const assocAnalyzer = await readFile('associativvordes/js/association-analyzer.js','utf8');
const assocScript = await readFile('associativvordes/script.js','utf8');
const assocClient = await readFile('associativvordes/js/qwen-client.js','utf8');
const qwenApi = await readFile('api/qwen-analyze.js','utf8');
const det = await readFile('determinatorofvalentyp/app.js','utf8');
const vc = await readFile('vordesofcommunites/script.js','utf8');
const gv = await readFile('grammaticebrevivordes/script.js','utf8');

assert.match(qwenApi, /associative_word_score/);
assert.match(assocClient, /task: 'associative_word_score'/);
assert.doesNotMatch(assocClient, /qwen-association/);
assert.match(assocAnalyzer, /association_score == null\) return null/);
assert.match(assocAnalyzer, /THRESHOLDS = \{ main: 35 \}/, 'associative procedure has one final numerical threshold');
assert.doesNotMatch(assocAnalyzer, /reviewMin|reviewMax|primary\.final_score[\s\S]*THRESHOLDS/, 'per-word scores do not trigger threshold-specific review');
assert.match(assocAnalyzer, /let finalEvaluation = \{ \.\.\.primary, combination_method: 'primary_only' \}/, 'associative candidates default to the primary scoring path');
assert.match(assocScript, /analysis\.association \|\| \{\}/);
assert.match(assocScript, /procedure: 'associative_word'/);
assert.match(assocScript, /semantic_confirmed/);

assert.match(qwenApi, /determine_valen_type/);
assert.match(det, /Automatic analysis is unavailable|Автоматический анализ недоступен/);
assert.doesNotMatch(det, /frontend_error'[\s\S]*P: 2, R: 3, C: 2, E: 1/);
assert.match(det, /externalKnowledgeMode = 'non_explanatory'/);

assert.match(vc, /function validateForm/);
assert.match(vc, /answer === 'yes' \|\| answer === 'partially'/);
assert.match(vc, /procedure:'community_word'/);
assert.doesNotMatch(vc, /crit_\$\{i\}/);

assert.match(gv, /aiChecked/);
assert.match(gv, /manuallyEdited/);
assert.match(gv, /finalized/);
assert.match(gv, /REQUIRED_CRITERIA_COUNT = 3/);
assert.match(gv, /procedure:'grammar_short_word'/);
console.log('four tool regression tests passed');
