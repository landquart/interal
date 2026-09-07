import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const assocAnalyzer = await readFile('associativvordes/js/association-analyzer.js','utf8');
const assocScript = await readFile('associativvordes/script.js','utf8');
const assocClient = await readFile('associativvordes/js/qwen-client.js','utf8');
const qwenApi = await readFile('api/qwen-analyze.js','utf8');
const vc = await readFile('vordesofcommunites/script.js','utf8');
const gv = await readFile('grammaticebrevivordes/script.js','utf8');
const intlHtml = await readFile('internationalismes/index.html','utf8');
const intl = await readFile('internationalismes/script.js','utf8');

assert.match(qwenApi, /associative_word_score/);
assert.match(assocClient, /task: 'associative_word_score'/);
assert.doesNotMatch(assocClient, /qwen-association/);
assert.match(assocAnalyzer, /association_score == null\) return null/);
assert.match(assocAnalyzer, /THRESHOLDS = \{ main: 35, association: 35 \}/, 'associative procedure uses the agreed FAv and A thresholds');
assert.doesNotMatch(assocAnalyzer, /reviewMin|reviewMax|primary\.final_score[\s\S]*THRESHOLDS/, 'per-word scores do not trigger threshold-specific review');
assert.match(assocAnalyzer, /let finalEvaluation = \{ \.\.\.primary, combination_method: 'primary_only' \}/, 'associative candidates default to the primary scoring path');
assert.match(assocScript, /analysis\.association \|\| \{\}/);
assert.match(assocScript, /procedure: 'associative_word'/);
assert.match(assocScript, /semantic_confirmed/);


assert.match(vc, /function validateForm/);
assert.match(vc, /answer === 'yes' \|\| answer === 'partially'/);
assert.match(vc, /procedure:'community_word'/);
assert.doesNotMatch(vc, /crit_\$\{i\}/);

assert.match(gv, /aiChecked/);
assert.match(gv, /manuallyEdited/);
assert.match(gv, /finalized/);
assert.match(gv, /REQUIRED_CRITERIA_COUNT = 3/);
assert.match(gv, /MANDATORY_CRITERIA_IDS = new Set\(\['brevity', 'pronounceability', 'no_conflict'\]\)/);
assert.match(gv, /procedure:'grammar_short_word'/);
assert.match(intlHtml, /id="semanticConfirmed"/);
assert.match(intl, /е:'e'/);
assert.match(intl, /ё:'e'/);
assert.match(intl, /ъ:''/);
assert.match(intl, /ь:''/);
assert.match(intl, /ю:'yu'/);
assert.match(intl, /я:'ya'/);
assert.match(intl, /const semanticConfirmed = state\.semanticConfirmed === true/);
assert.match(intl, /accepted: coverageAccepted && semanticConfirmed/);
assert.match(intl, /semantic_correspondence_confirmed: r\.semanticConfirmed/);
assert.match(intl, /resultSection\.hidden = !checked/);
assert.ok(intl.includes(".replace(/[^a-z0-9]/g, '')"), 'normalization uses the original internationalism comparison form');

console.log('tool regression tests passed');
