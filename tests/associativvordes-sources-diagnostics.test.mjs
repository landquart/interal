import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { findCandidatesForRoot } from '../associativvordes/js/candidate-finder.js';
import { categoryLabel, matchTypeLabel, renderCandidateEvidenceDetails, summarizeCandidateSources } from '../associativvordes/js/render-results.js';

const script = await readFile('associativvordes/script.js', 'utf8');
const renderSource = await readFile('associativvordes/js/render-results.js', 'utf8');

const manySources = Array.from({ length: 7 }, (_, index) => ({
  file: `/home/runner/work/interal/corpus/source-${index}<x>.json`,
  category: index % 2 ? 'web' : 'subtitles',
  ipm: index + 0.25
}));
const item = {
  word: 'interact',
  match: { type: 'fuzzy', fragment: '<inter>', distance: 1, similarity: 0.8 },
  frequency_score: 42.125,
  sources: manySources,
  warnings: ['duplicate_runtime_entry', '<img src=x onerror=alert(1)>']
};
const html = renderCandidateEvidenceDetails(item, {}, 'ru');
const diagnosticHtml = renderCandidateEvidenceDetails(item, {}, 'ru', { developerDiagnostics: true });

assert.match(html, /Тип совпадения[\s\S]*нечёткое/, 'details shows localized match type');
assert.match(html, /Distance[\s\S]*1/, 'details shows distance');
assert.match(html, /Similarity[\s\S]*80\.0%/, 'details shows formatted similarity');
assert.match(html, /frequency_score[\s\S]*42\.13/, 'details shows frequency_score');
assert.match(html, /Источники[\s\S]*7/, 'details shows source count');
assert.doesNotMatch(html, /\/home\/runner\/work|\/workspace|Codex|GitHub Actions/, 'absolute runner path is hidden');
assert.match(html, /source-0&lt;x&gt;\.json/, 'source filename is escaped');
assert.doesNotMatch(html, /<img|onerror=/, 'warning text is safe in normal details');
assert.match(diagnosticHtml, /&lt;img src=x onerror=alert\(1\)&gt;/, 'warning code is escaped in developer diagnostics when shown');
assert.match(html, /Показано: 5; Ещё: 2/, 'large source lists are visually limited');
assert.equal(summarizeCandidateSources(manySources).ids.length, 7, 'state/helper keeps all source ids');

assert.match(script, /window\.__INTERAL_ASSOCIATIVE_DIAGNOSTICS__ = window\.__INTERAL_ASSOCIATIVE_DIAGNOSTICS__ === true/, 'diagnostics is disabled by default');
assert.match(script, /enable: \(\) => setDiagnosticsEnabled\(true\)/, 'enable() turns diagnostics on');
assert.match(script, /disable: \(\) => setDiagnosticsEnabled\(false\)/, 'disable() turns diagnostics off');
assert.match(script, /JSON\.parse\(JSON\.stringify/, 'snapshot is a copy');
assert.doesNotMatch(script, /apiKey|authorization|Authorization|process\.env|fullPrompt|prompt:/, 'diagnostics does not include secrets or full prompt fields');
assert.doesNotMatch(script, /shardCache:|entries:/, 'snapshot does not include full shard content');
assert.match(script, /inspectedCandidates|matchedCandidates|rejectedCandidates|rejectedByReason/, 'candidate counters are collected');
assert.match(script, /resetRunDiagnostics\(runId\)/, 'new run resets run counters');
assert.doesNotMatch(script, /fields: \{[^}]*diagnostics:/, 'diagnostics is not saved in page state');
assert.equal(matchTypeLabel('exact', 'ru'), 'точное', 'RU exact label exists');
assert.equal(matchTypeLabel('special', 'en'), 'special match', 'EN special label exists');
assert.equal(categoryLabel('normative', 'ru'), 'нормативный корпус', 'RU category label exists');
assert.equal(categoryLabel('web', 'en'), 'web corpus', 'EN category label exists');
assert.match(renderSource, /sourceLimit = 5/, 'source limit is compact by default');

const entries = [
  { word: 'interact', language: 'en', normalized: 'interact', search_form: 'interact', rank: 1, frequency_score: 0, category_breakdown: {}, sources: [{ file: '/tmp/a.json', ipm: 1 }] },
  { word: 'interact', language: 'en', normalized: 'interact', search_form: 'interact', rank: 2, frequency_score: 2, category_breakdown: {}, sources: [{ file: 'b.json', category: 'web', ipm: 2 }] },
  { word: '', language: 'en', normalized: '', search_form: '', rank: 3, frequency_score: 2, sources: [] }
];
const { candidates, diagnostics } = findCandidatesForRoot({ entries, root: 'inter', language: 'en', maxCandidates: 10 });
assert.equal(diagnostics.inspected, 3, 'inspected counter increments');
assert.equal(diagnostics.rejected, 1, 'rejected counter increments');
assert.equal(diagnostics.matched, 1, 'matched counter increments');
assert.ok(candidates[0].warnings.includes('candidate_found_but_frequency_zero'), 'candidate warning is preserved');
assert.ok(candidates[0].warnings.includes('duplicate_runtime_entry'), 'duplicate warning is preserved');
assert.ok(candidates[0].warnings.includes('missing_category'), 'missing category warning is preserved');
assert.equal(candidates[0].sources.length, 1, 'candidate state keeps sources');

console.log('associativvordes sources diagnostics tests passed');
