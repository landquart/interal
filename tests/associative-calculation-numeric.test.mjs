import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLanguageScore, calculateFinalAssociation, isFiniteScore } from '../associativvordes/js/association-analyzer.js';
import { compactAssociativeState, restoreAssociativeState } from '../associativvordes/js/associative-state.js';
import { renderLanguageCalculationRows, formatMetric, formatCount, formatSimilarity } from '../associativvordes/js/render-results.js';
import { CONTROL_LANGUAGES, requireSpeakerCount } from '../shared/control-language-demographics.mjs';
import { finiteNumberOrNull } from '../shared/finite-number.mjs';
const item = (P, A, review = false, word = 'word') => ({ word, selected: true, final_score: P, association_score: A, analysis: { methodology_version: '2026-09-09', review_required: review } });
const statuses = Object.fromEntries(CONTROL_LANGUAGES.map(x => [x.code, { status: 'completed' }]));
const final = rows => calculateFinalAssociation({ languages: CONTROL_LANGUAGES, languageResults: rows, languageStatuses: statuses });

test('AC-003: maximum P and same representative A; missing A and required review remain distinct', () => {
  const complete = calculateLanguageScore([item(40, 90, false, 'first'), item(70, 60, false, 'best')]);
  assert.equal(complete.normalized, 70); assert.equal(complete.associationNormalized, 60);
  const onlyA = final([calculateLanguageScore([item(null, 85)])]);
  assert.equal(onlyA.counts.primaryALanguages, 1); assert.equal(onlyA.counts.scoredPLanguages, 0);
  assert.equal(complete.selectedCount, 2); assert.equal(complete.representative, 'best');
  const missing = calculateLanguageScore([item(70, null)]);
  assert.equal(missing.normalized, 70); assert.equal(missing.associationNormalized, null);
  assert.deepEqual(missing.incompleteReasons.map(r => r.code), ['missing_A']);
  const pending = calculateLanguageScore([item(70, 60, true)]);
  assert.equal(pending.associationPreliminary, 60); assert.equal(pending.associationNormalized, null);
  assert.deepEqual(pending.incompleteReasons.map(r => r.code), ['review_required']);
});

test('AC-002/003/010 regul fixed fixture: five derivatives per language, positive P and pending review', () => {
  const scores = [74.87, 48.66, 35.24, 56.71, 94.08, 52.64];
  const rows = scores.map(P => calculateLanguageScore(Array.from({ length: 5 }, (_, i) => item(P - i, 85, true, `regul-${i}`))));
  const result = final(rows);
  assert.equal(result.finalAssociation, null); assert.equal(result.averageAssociation, null);
  assert.equal(result.coverage, 0); assert.equal(result.accepted, false);
  assert.deepEqual(result.counts, { foundLanguages: 6, selectedLanguages: 6, scoredPLanguages: 6, primaryALanguages: 6, verifiedALanguages: 0, completedLanguages: 6, includedLanguages: 0, includedGroups: 0 });
  assert.equal(result.decisionDiagnostics.pendingReview, true);
  result.languageScores.forEach(row => { assert.equal(row.speakers, requireSpeakerCount(row.lang.code)); assert.equal(row.weightedScore, null); });
  const html = renderLanguageCalculationRows(result.languageScores);
  assert.match(html, /Обязательная|обязательная/); assert.match(html, /Первичная A: 85.00/);
  assert.doesNotMatch(html, /NaN|Infinity|undefined|не число/);
});

test('AC-002/010: complete regul fixture uses unchanged direct demographic formulas', () => {
  const P = [74.87, 48.66, 35.24, 56.71, 94.08, 52.64];
  const result = final(P.map(x => calculateLanguageScore([item(x, 85)])));
  const N = CONTROL_LANGUAGES.reduce((s, x) => s + x.speakers, 0);
  const expected = CONTROL_LANGUAGES.reduce((s, x, i) => s + x.speakers * P[i], 0) / N;
  assert.equal(result.finalAssociation, expected); assert.equal(result.averageAssociation, 85);
  assert.equal(result.coverage, 1); assert.equal(result.groups, 3); assert.equal(result.accepted, true);
  assert.equal(result.counts.includedLanguages, 6);
});

test('AC-003/010: partial languages and exact acceptance boundaries', () => {
  const rows = [calculateLanguageScore([item(35, 35)]), calculateLanguageScore([item(35, 35)]), calculateLanguageScore([item(35, 35)]), calculateLanguageScore([item(70, null)]), calculateLanguageScore([]), calculateLanguageScore([])];
  const partial = final(rows);
  assert.equal(partial.finalAssociation, 35); assert.equal(partial.groups, 2);
  assert.equal(partial.accepted, false); assert.equal(partial.counts.scoredPLanguages, 4);
  rows[3] = calculateLanguageScore([]);
  const boundary = final(rows); assert.equal(boundary.accepted, true);
  rows[2] = calculateLanguageScore([item(34.9, 35)]); assert.equal(final(rows).accepted, false);
  rows[2] = calculateLanguageScore([]); assert.equal(final(rows).accepted, false);
});

test('AC-002: supported empty rows have N; unknown represented language throws', () => {
  assert.equal(final(CONTROL_LANGUAGES.map(() => calculateLanguageScore([]))).languageScores[0].speakers, 1493000000);
  assert.throws(() => calculateFinalAssociation({ languages: [{ code: 'xx' }], languageResults: [calculateLanguageScore([item(50, 50)])] }), { code: 'MISSING_LANGUAGE_SPEAKERS' });
});

test('AC-005: numeric persistence keeps absence, zero and review diagnostics', () => {
  for (const value of [null, undefined, '', ' ', false, {}, NaN, Infinity]) {
    assert.equal(finiteNumberOrNull(value), null); assert.equal(isFiniteScore(value), false);
    assert.equal(formatMetric(value), '—'); assert.equal(formatCount(value), '—'); assert.equal(formatSimilarity(value), '—');
  }
  assert.equal(formatMetric(0), '0.0'); assert.equal(formatCount(0), '0');
  const state = { languages: { en: [item(null, null), item(0, 0)] }, languageStatuses: {}, checked: false };
  const saved = compactAssociativeState(state, { languages: ['en'] });
  assert.equal(saved.state.numeric_schema_version, 1);
  const restored = restoreAssociativeState(saved, { languages: ['en'] }).state;
  assert.equal(restored.languages.en[0].final_score, null); assert.equal(restored.languages.en[1].final_score, 0);
  delete saved.state.numeric_schema_version;
  const legacy = restoreAssociativeState(saved, { languages: ['en'] }).state;
  assert.equal(legacy.languages.en[1].final_score, null); assert.equal(legacy.languages.en[1].selected, false);
  assert.ok(legacy.languages.en[1].warnings.includes('legacy_numeric_recalculation_required'));
  saved.state.languages.en[1].analysis.primary = { final_score: 0, association_score: 0 };
  assert.equal(restoreAssociativeState(saved, { languages: ['en'] }).state.languages.en[1].association_score, 0, 'proven primary zero survives legacy import');
});

test('AC-010/015: actual page adapter counts all found rows without changing five-model scoring', async () => {
  const { readFile }=await import('node:fs/promises'); const vm=await import('node:vm');
  const source=await readFile('associativvordes/script.js','utf8');
  const start=source.indexOf('    function calculateFinal()'); const end=source.indexOf('    function renderTabs()',start);
  const all=Array.from({length:7},(_,i)=>item(70-i,85,false,`regul-${i}`)); all[6].selected=false;
  const context={LANGUAGES:[CONTROL_LANGUAGES[0]],state:{languages:{en:all},languageStatuses:{en:{status:'completed'}},maxModels:5},scoringCandidates:()=>all.filter(x=>x.selected).slice(0,5),calculateLanguageScore,calculateFinalAssociation,wordWeight:x=>x.final_score};
  vm.createContext(context); vm.runInContext(source.slice(start,end),context);
  const result=context.calculateFinal(); assert.equal(result.languageScores[0].foundCount,7); assert.equal(result.languageScores[0].selectedCount,6); assert.equal(result.languageScores[0].count,5); assert.equal(result.languageScores[0].normalized,70);
});
