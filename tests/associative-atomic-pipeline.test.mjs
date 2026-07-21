import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runAssociativeCalculation, resetAssociativeCalculationRunnerForTests, restoreAssociativeCalculation } from '../associativvordes/js/associative-calculation-runner.js';
import { refineCandidatesWithQwenAudit, finalizeCandidateOrdering } from '../associativvordes/js/qwen-client.js';
import { addRunWarning, addLanguageWarning, addCandidateWarning, restoreAssociativeState } from '../associativvordes/js/associative-state.js';

function deferred() { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; }
async function tick(times = 1) { for (let i = 0; i < times; i += 1) await Promise.resolve(); }
const languages = [{ code: 'en', group: 'Germanic' }];
const twoLanguages = [{ code: 'en', group: 'Germanic' }, { code: 'de', group: 'Germanic' }];
const baseCandidates = ['a','b','c','d','e','f'].map((word, i) => ({ word, model_key: word, model: word, frequency_score: 100 - i * 10, selected: false, parser_version: 'pv2' }));
function snapshot(state) { return JSON.stringify({ checked: state.checked, languages: state.languages, selectedModels: state.selectedModels, scores: state.languageScores, FA: state.FA, globalStatus: state.globalStatus }); }
function abortError() { return new DOMException('cancelled', 'AbortError'); }

function makeDeps({ defers = {}, events = [], primaryScore = 30, reviewScore = 50, auditAdds = [], auditReject, reviewReject, langs = languages } = {}) {
  const counts = { translationRequests: 0, candidateAuditRequests: 0, candidateVerificationRequests: 0, primaryRequests: 0, reviewRequests: 0, saves: 0, renders: 0, runs: 0 };
  const dom = { disabled: false, ariaBusy: 'false', loading: false, svgVisible: false, text: 'Calculate', snapshots: [] };
  const saved = [];
  const wait = async (name) => defers[name] ? defers[name].promise : undefined;
  const deps = {
    languages: langs,
    eventLog: events,
    targetTranslator: { async translate() { counts.translationRequests++; events.push('mock:translation'); await wait('translation'); return Object.fromEntries(langs.map(lang => [lang.code, 'eye'])); } },
    candidateIndexLoader: { async load() { events.push('mock:index'); await wait('index'); return baseCandidates; } },
    candidateAudit: { async audit({ candidatesByLanguage }) { counts.candidateAuditRequests++; events.push('mock:audit'); await wait('audit'); if (auditReject) throw auditReject; return Object.fromEntries(langs.map(lang => [lang.code, [...(candidatesByLanguage[lang.code] || []), ...auditAdds]])); } },
    candidateVerifier: { async verify({ candidatesByLanguage }) { counts.candidateVerificationRequests++; events.push('mock:verify'); await wait('verify'); return candidatesByLanguage; } },
    primaryAnalyzer: { async analyze({ candidate }) { counts.primaryRequests++; events.push(`mock:primary:${candidate.word}`); await wait(`primary:${candidate.word}`); await wait('primary'); return { final_score: primaryScore, association_score: 90, model: 'primary' }; } },
    reviewAnalyzer: { async analyze({ candidate }) { counts.reviewRequests++; events.push(`mock:review:${candidate.word}`); await wait(`review:${candidate.word}`); await wait('review'); if (reviewReject) throw reviewReject; return { final_score: reviewScore, association_score: 95, model: 'review' }; } },
    renderer: { async renderFinal(state) { counts.renders++; await wait('render'); dom.snapshots.push(snapshot(state)); } },
    stateStorage: { create: undefined, async save(state) { counts.saves++; await wait('save'); saved.push(JSON.parse(JSON.stringify(state))); }, async load() { return saved.at(-1); } },
    buttonStatusController: {
      start(text) { counts.runs++; Object.assign(dom, { disabled: true, ariaBusy: 'true', loading: true, svgVisible: true, text }); return 1; },
      progress(_token, text) { Object.assign(dom, { disabled: true, ariaBusy: 'true', loading: true, svgVisible: true, text }); },
      success(_token, text) { Object.assign(dom, { disabled: false, ariaBusy: 'false', loading: false, svgVisible: false, text }); },
      abort() { Object.assign(dom, { disabled: false, ariaBusy: 'false', loading: false, svgVisible: false, text: 'Calculate' }); },
      error() { Object.assign(dom, { disabled: false, ariaBusy: 'false', loading: false, svgVisible: false, text: 'Error' }); }
    }
  };
  return { deps, counts, dom, saved };
}

async function complete(defers) { for (const d of Object.values(defers)) d.resolve?.(); await tick(4); }

// Secondary architecture checks kept deliberately small; behavior assertions below execute code.
const scriptSource = await readFile('associativvordes/script.js', 'utf8');
const clientSource = await readFile('associativvordes/js/qwen-client.js', 'utf8');
assert.doesNotMatch(clientSource, /supplementAfterCompletedCalculation/, 'no removed background supplement helper remains');
assert.match(clientSource, /export async function refineCandidatesWithQwenAudit/, 'candidate audit remains an exported pipeline step');
assert.match(scriptSource, /activeRunAbortController\?\.abort\?\.\(/, 'browser runner still aborts previous active runs');

{
  resetAssociativeCalculationRunnerForTests();
  const events = [];
  const defers = Object.fromEntries(['translation','index','audit','verify','primary','review','render','save'].map(k => [k, deferred()]));
  const { deps, counts, dom, saved } = makeDeps({ defers, events, auditAdds: [{ word: 'g', model_key: 'g', model: 'g', frequency_score: 150, parser_version: 'pv2' }] });
  const run = runAssociativeCalculation({ input: { root: 'ocul', meaning: 'eye' }, dependencies: deps, onStateChange: (state, meta) => { if (meta.event.startsWith('status')) assert.equal(state.checked, false); } });
  await tick(); assert.equal(dom.disabled, true); assert.equal(dom.ariaBusy, 'true'); assert.equal(dom.loading, true); assert.equal(dom.svgVisible, true); assert.match(dom.text, /translation/);
  for (const name of ['translation','index','audit','verify','primary','review','render','save']) { defers[name].resolve(); await tick(4); if (!events.includes('button:done')) assert.equal(dom.loading, true, `loader remains on during ${name}`); }
  const result = await run;
  assert.deepEqual(events.filter(e => !e.startsWith('mock:')), ['run:start','translation:start','translation:end','index:start','index:end','audit:start','audit:end','selection:final','primary:start','primary:end','review:start','review:end','primary:start','primary:end','review:start','review:end','primary:start','primary:end','review:start','review:end','primary:start','primary:end','review:start','review:end','primary:start','primary:end','review:start','review:end','language_score:calculated','scores:calculated','render:final','state:checked','draft:saved','button:done','run:end']);
  assert.ok(events.indexOf('audit:end') < events.indexOf('selection:final'));
  assert.ok(events.indexOf('selection:final') < events.indexOf('primary:start'));
  assert.ok(events.lastIndexOf('review:end') < events.indexOf('language_score:calculated'));
  assert.ok(events.indexOf('scores:calculated') < events.indexOf('render:final'));
  assert.ok(events.indexOf('render:final') < events.indexOf('draft:saved'));
  assert.ok(events.indexOf('draft:saved') < events.indexOf('button:done'));
  assert.equal(result.state.checked, true); assert.equal(dom.text, 'Done'); assert.equal(counts.saves, 1); assert.equal(saved[0].languages.en[0].parser_version, 'pv2'); assert.equal(saved[0].languages.en[0].model_key, 'g');
  const frozen = snapshot(result.state); const domFrozen = JSON.stringify(dom.snapshots); const countsFrozen = { ...counts };
  await complete(defers); await tick(5);
  assert.equal(snapshot(result.state), frozen, 'state/result do not change after Done');
  assert.equal(JSON.stringify(dom.snapshots), domFrozen, 'DOM snapshot does not change after Done');
  assert.deepEqual(counts, countsFrozen, 'no extra network/save/render calls after Done');
}

{
  resetAssociativeCalculationRunnerForTests();
  const aReview = deferred();
  const a = makeDeps({ defers: { review: aReview }, events: [] });
  const runA = runAssociativeCalculation({ input: { root: 'A' }, dependencies: a.deps, signal: new AbortController().signal }).catch(e => e);
  await tick(10);
  const b = makeDeps({ events: [] });
  const runB = runAssociativeCalculation({ input: { root: 'B' }, dependencies: b.deps });
  aReview.resolve(); await tick(5);
  const resultB = await runB;
  const resultA = await runA;
  assert.equal(resultA.name, 'AbortError');
  assert.equal(resultB.state.root, 'B');
  assert.equal(a.counts.renders, 0); assert.equal(a.counts.saves, 0); assert.ok(!a.deps.eventLog.includes('button:done'));
}

{
  resetAssociativeCalculationRunnerForTests();
  const events = [];
  const { deps, counts } = makeDeps({ events, auditReject: new Error('audit down') });
  const result = await runAssociativeCalculation({ input: { root: 'warn' }, dependencies: deps });
  assert.deepEqual(result.state.warnings.run.map(w => w.code), ['qwen_candidate_audit_unavailable']);
  assert.deepEqual(result.state.warnings.languages.en, [], 'audit warning is not bound to en');
  assert.deepEqual(result.state.warnings.candidates.en, {}, 'audit warning is not bound to a candidate');
  assert.equal(result.state.globalStatus, 'completed_with_warnings', 'globalStatus sees run warnings');
  assert.equal(result.state.languageStatuses.en.status, 'completed', 'language is not completed_with_warnings because of run warning');
  assert.deepEqual(result.state.selectedModels.en, ['a','b','c','d','e']);
  assert.ok(events.indexOf('audit:end') < events.indexOf('button:done'));
  assert.equal(counts.candidateAuditRequests, 1);
}

{
  resetAssociativeCalculationRunnerForTests();
  const { deps } = makeDeps({ langs: twoLanguages, auditReject: new Error('audit down') });
  const result = await runAssociativeCalculation({ input: { root: 'warn2' }, dependencies: deps });
  assert.deepEqual(result.state.warnings.run.map(w => w.code), ['qwen_candidate_audit_unavailable']);
  assert.deepEqual(result.state.warnings.languages.en, [], 'audit warning is not attached to first completed language');
  assert.deepEqual(result.state.warnings.languages.de, [], 'audit warning is not attached to any completed language');
  assert.equal(result.state.languageStatuses.en.status, 'completed');
  assert.equal(result.state.languageStatuses.de.status, 'completed');
}

{
  resetAssociativeCalculationRunnerForTests();
  const { deps } = makeDeps({ reviewReject: new Error('review failed'), primaryScore: 30 });
  const result = await runAssociativeCalculation({ input: { root: 'reviewfail' }, dependencies: deps });
  assert.deepEqual(result.state.warnings.run, []);
  assert.deepEqual(result.state.warnings.languages.en, []);
  assert.equal(result.state.warnings.candidates.en.a[0].code, 'review_failed');
  assert.equal(result.state.languages.en[0].analysis.model, 'primary');
  assert.equal(result.state.checked, true);
}

{
  resetAssociativeCalculationRunnerForTests();
  const { deps } = makeDeps({ reviewReject: abortError(), primaryScore: 30 });
  await assert.rejects(() => runAssociativeCalculation({ input: { root: 'abortreview' }, dependencies: deps }), /Operation aborted|cancelled/);
  assert.ok(!deps.eventLog.includes('button:done'));
}

{
  resetAssociativeCalculationRunnerForTests();
  const seen = [];
  const { deps } = makeDeps({ reviewReject: new Error('review failed'), primaryScore: 30 });
  const result = await runAssociativeCalculation({ input: { root: 'statuses' }, dependencies: deps, onStateChange: s => seen.push(JSON.stringify(s.languageStatuses.en)) });
  assert.ok(seen.some(s => s.includes('loading_index'))); assert.ok(seen.some(s => s.includes('analyzing'))); assert.ok(seen.some(s => s.includes('reviewing')));
  assert.equal(result.state.languageStatuses.en.status, 'completed_with_warnings');
  assert.notEqual(result.state.globalStatus, 'loading');
  assert.ok(deps.eventLog.includes('button:done'));
}

{
  const state = { languages: { en: [], de: [] }, languageStatuses: { en: {}, de: {} }, warnings: undefined };
  assert.equal(addRunWarning(state, 'qwen_candidate_audit_unavailable'), true);
  assert.equal(addRunWarning(state, 'qwen_candidate_audit_unavailable'), false);
  assert.equal(addLanguageWarning(state, 'de', 'language_index_unavailable', '404'), true);
  assert.equal(addLanguageWarning(state, 'de', 'language_index_unavailable', '404'), false);
  assert.equal(addCandidateWarning(state, 'en', 'a', 'review_failed', 'timeout'), true);
  assert.equal(addCandidateWarning(state, 'en', 'a', 'review_failed', 'timeout'), false);
  assert.equal(state.warnings.run.length, 1, 'repeat run warning is deduplicated');
  assert.equal(state.warnings.languages.de.length, 1, 'language index error is stored on its language');
  assert.equal(state.warnings.candidates.en.a.length, 1, 'candidate review failure is stored on its candidate');
}

{
  const restored = restoreAssociativeState({ version: 1, page: 'associativvordes', state: { root: 'old', languages: {}, languageStatuses: {}, globalStatus: 'completed', checked: true, warnings: ['qwen_candidate_audit_unavailable', 'qwen_candidate_audit_unavailable'] } }, { languages: twoLanguages });
  assert.deepEqual(restored.state.warnings.run.map(w => w.code), ['qwen_candidate_audit_unavailable'], 'legacy flat warnings migrate safely and deduplicate');
  assert.deepEqual(restored.state.warnings.languages.en, []);
  assert.deepEqual(restored.state.warnings.candidates.de, {});
}

{
  resetAssociativeCalculationRunnerForTests();
  const qwenSeventh = { word: 'g', model_key: 'g', model: 'g', frequency_score: 95, final_score: 1, parser_version: 'pv2' };
  const include = await runAssociativeCalculation({ input: { root: 'select' }, dependencies: makeDeps({ auditAdds: [qwenSeventh], primaryScore: 1 }).deps });
  assert.deepEqual(include.state.selectedModels.en, ['a','g','b','c','d'], 'frequency controls top five, not semantic P');
  const exclude = await runAssociativeCalculation({ input: { root: 'select' }, dependencies: makeDeps({ auditAdds: [{ ...qwenSeventh, frequency_score: 1 }], primaryScore: 99 }).deps });
  assert.deepEqual(exclude.state.selectedModels.en, ['a','b','c','d','e']);
}

for (const [score, expected] of [[24.99, 0], [25, 5], [30, 5], [35, 5], [35.01, 0]]) {
  resetAssociativeCalculationRunnerForTests();
  const { deps, counts } = makeDeps({ primaryScore: score });
  await runAssociativeCalculation({ input: { root: `range${score}` }, dependencies: deps });
  assert.equal(counts.reviewRequests, expected, `review count for ${score}`);
}

{
  resetAssociativeCalculationRunnerForTests();
  const h = makeDeps();
  const result = await runAssociativeCalculation({ input: { root: 'persist' }, dependencies: h.deps });
  assert.equal(h.counts.saves, 1); assert.equal(h.saved[0].checked, true); assert.equal(h.saved[0].languages.en[0].parser_version, 'pv2'); assert.ok(h.saved[0].languages.en[0].model_key);
  const restored = await restoreAssociativeCalculation({ dependencies: h.deps });
  assert.equal(restored.root, result.state.root); assert.equal(h.counts.primaryRequests, 5, 'restore does not start background requests');
  const before = snapshot(restored); await tick(5); assert.equal(snapshot(restored), before);
  h.saved.push({ ...result.state, checked: false, globalStatus: 'loading' });
  assert.equal(await restoreAssociativeCalculation({ dependencies: h.deps }), null);
}

{
  resetAssociativeCalculationRunnerForTests();
  const { deps, counts } = makeDeps();
  await runAssociativeCalculation({ input: { root: 'click' }, dependencies: deps });
  assert.equal(counts.runs, 1); assert.equal(counts.candidateAuditRequests, 1); assert.equal(counts.primaryRequests, 5); assert.equal(counts.candidateVerificationRequests, 1); assert.doesNotMatch(clientSource, /supplementAfterCompletedCalculation/); assert.equal(counts.candidateAuditRequests, 1);
}

// Existing qwen-client behavioral checks: no real network, mocked fetch only.
const originalFetch = globalThis.fetch; const originalDocument = globalThis.document; const originalLocation = globalThis.location;
globalThis.document = { documentElement: { lang: 'en' } }; globalThis.location = { hostname: 'localhost' };
let fetchCount = 0;
globalThis.fetch = async (_url, options) => { fetchCount++; assert.ok(options.signal); return { ok: true, async json() { return { candidates: { en: [{ word: 'zeta', root_variant: 'zet' }] } }; } }; };
const loader = { async loadCandidateEntries(language, word, { signal } = {}) { assert.ok(signal); return [{ word, normalized: word, search_form: word, frequency_score: 99, sources: [{ id: 'test' }] }]; } };
const refined = await refineCandidatesWithQwenAudit({ root: 'zet', targetMeaning: 'test', candidatesByLanguage: { en: [{ word: 'alpha', model_key: 'a', frequency_score: 10, sources: [{ id: 'base' }], match: {} }] }, loader, languages: ['en'], signal: new AbortController().signal });
assert.equal(fetchCount, 1); assert.ok(refined.candidatesByLanguage.en.some(c => c.word === 'zeta')); assert.equal(finalizeCandidateOrdering(refined.candidatesByLanguage.en, 1)[0].word, 'zeta');
globalThis.fetch = originalFetch; globalThis.document = originalDocument; globalThis.location = originalLocation;

{
  resetAssociativeCalculationRunnerForTests();
  const { QWEN_RUNTIME_CONFIG } = await import('../associativvordes/js/qwen-client.js');
  const originalLimit = QWEN_RUNTIME_CONFIG.maxReviewRequestsPerSearch;
  QWEN_RUNTIME_CONFIG.maxReviewRequestsPerSearch = 2;
  const { deps, counts } = makeDeps({ langs: twoLanguages, primaryScore: 30 });
  const result = await runAssociativeCalculation({ input: { root: 'budget2' }, dependencies: deps });
  QWEN_RUNTIME_CONFIG.maxReviewRequestsPerSearch = originalLimit;
  assert.equal(counts.reviewRequests, 2, 'budget 2 limits deterministic final-model order across languages');
  assert.equal(result.state.reviewDiagnostics.reviewEligibleCount, 10);
  assert.equal(result.state.reviewDiagnostics.reviewStartedCount, counts.reviewRequests);
  assert.equal(result.state.reviewDiagnostics.reviewCompletedCount, counts.reviewRequests);
  assert.equal(result.state.reviewDiagnostics.reviewSkippedBudgetCount, 8);
}

console.log('Associative atomic pipeline integration tests passed.');
