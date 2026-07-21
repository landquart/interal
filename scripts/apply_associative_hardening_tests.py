from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def write(path, content):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')


ATOMIC_TEST = r'''import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runAssociativeCalculation } from '../associativvordes/js/associative-calculation-runner.js';
import { createEmptyAssociativeState } from '../associativvordes/js/associative-state.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const languages = [{ code: 'en', group: 'Germanic' }];
const candidates = ['a', 'b', 'c', 'd', 'e', 'f'].map((word, index) => ({
  word,
  model_key: word,
  model: word,
  frequency_score: 100 - index * 10,
  selected: false,
  parser_version: '2.0.0',
  morpheme_analysis: { parser_version: '2.0.0', language: 'en', element_type: 'root', model_key: word }
}));

function snapshot(state) {
  return JSON.stringify({
    checked: state.checked,
    globalStatus: state.globalStatus,
    warnings: state.warnings,
    languages: state.languages,
    languageScores: state.languageScores,
    FA: state.FA
  });
}

function makeDependencies({ saveDeferred, auditError, analyzeDeferred, sharedState } = {}) {
  const counts = { translations: 0, indexes: 0, audits: 0, analyses: 0, renders: 0, saves: 0, done: 0 };
  const events = [];
  const button = { loading: false, text: 'Calculate' };
  const dependencies = {
    languages,
    eventLog: events,
    isCurrentRun: () => true,
    buttonStatusController: {
      start(text) { button.loading = true; button.text = text; return 1; },
      progress(_token, text) { button.loading = true; button.text = text; },
      success(_token, text) { counts.done += 1; button.loading = false; button.text = text; },
      abort() { button.loading = false; button.text = 'Calculate'; },
      error() { button.loading = false; button.text = 'Error'; }
    },
    targetTranslator: { async translate() { counts.translations += 1; return { en: 'eye' }; } },
    candidateIndexLoader: { async load() { counts.indexes += 1; return candidates; } },
    candidateAudit: {
      async audit({ candidatesByLanguage }) {
        counts.audits += 1;
        if (auditError) throw auditError;
        return { candidatesByLanguage, warnings: [], diagnostics: { status: 'completed', suggestedCount: 0 } };
      }
    },
    candidateFinalizer: { finalize(_language, pool) { return pool; } },
    candidateAnalyzer: {
      async analyze(_language, candidate) {
        counts.analyses += 1;
        if (analyzeDeferred) await analyzeDeferred.promise;
        return { ...candidate, selected: true, final_score: 40, analysis: { final_score: 40, status: 'completed', association: { semantic_confirmed: true } } };
      }
    },
    renderer: { async renderFinal() { counts.renders += 1; } },
    stateStorage: {
      create() { return sharedState || createEmptyAssociativeState({ languages }); },
      async save() { counts.saves += 1; if (saveDeferred) await saveDeferred.promise; }
    }
  };
  return { dependencies, counts, events, button };
}

const scriptSource = await readFile('associativvordes/script.js', 'utf8');
assert.match(scriptSource, /import \{ runAssociativeCalculation \}/, 'production imports the tested orchestration function');
assert.match(scriptSource, /await runAssociativeCalculation\(/, 'production executes the tested orchestration function');
assert.doesNotMatch(scriptSource, /supplementAfterCompletedCalculation/, 'removed background supplement is absent');

{
  const save = deferred();
  const { dependencies, counts, events, button } = makeDependencies({ saveDeferred: save });
  const run = runAssociativeCalculation({ input: { root: 'ocul', meaning: 'eye' }, dependencies });
  await Promise.resolve();
  assert.equal(button.loading, true, 'loader starts with the production runner');
  for (let index = 0; index < 20 && counts.saves === 0; index += 1) await Promise.resolve();
  assert.equal(counts.saves, 1, 'save stage is reached');
  assert.equal(counts.done, 0, 'Done is blocked while save is pending');
  save.resolve();
  const result = await run;
  assert.equal(counts.done, 1);
  assert.equal(button.loading, false);
  assert.equal(result.state.checked, true);
  assert.ok(events.indexOf('audit:end') < events.indexOf('selection:final'));
  assert.ok(events.indexOf('scores:calculated') < events.indexOf('render:final'));
  assert.ok(events.indexOf('render:final') < events.indexOf('draft:saved'));
  assert.ok(events.indexOf('draft:saved') < events.indexOf('button:done'));
  const frozenState = snapshot(result.state);
  const frozenCounts = { ...counts };
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(snapshot(result.state), frozenState, 'state is immutable after Done');
  assert.deepEqual(counts, frozenCounts, 'no render/save/network work occurs after Done');
}

{
  const state = createEmptyAssociativeState({ languages });
  const first = makeDependencies({ auditError: new Error('audit offline'), sharedState: state });
  const warningResult = await runAssociativeCalculation({ input: { root: 'first' }, state, dependencies: first.dependencies });
  assert.equal(warningResult.state.warnings.run[0].code, 'qwen_candidate_audit_unavailable');
  const second = makeDependencies({ sharedState: state });
  const cleanResult = await runAssociativeCalculation({ input: { root: 'second' }, state, dependencies: second.dependencies });
  assert.deepEqual(cleanResult.state.warnings.run, [], 'a new run does not inherit prior run warnings');
  assert.equal(cleanResult.state.globalStatus, 'completed');
}

{
  const controller = new AbortController();
  const analysis = deferred();
  const { dependencies, counts, events } = makeDependencies({ analyzeDeferred: analysis });
  const run = runAssociativeCalculation({ input: { root: 'abort' }, dependencies, signal: controller.signal }).catch(error => error);
  for (let index = 0; index < 20 && counts.analyses === 0; index += 1) await Promise.resolve();
  controller.abort(new DOMException('cancelled', 'AbortError'));
  analysis.resolve();
  const error = await run;
  assert.equal(error.name, 'AbortError');
  assert.equal(counts.renders, 0);
  assert.equal(counts.saves, 0);
  assert.ok(!events.includes('button:done'));
}

{
  const state = createEmptyAssociativeState({ languages });
  const { dependencies } = makeDependencies({ sharedState: state });
  dependencies.stateStorage.save = async () => { throw new Error('disk full'); };
  const result = await runAssociativeCalculation({ input: { root: 'save-error' }, state, dependencies });
  assert.equal(result.state.warnings.run.at(-1).code, 'final_save_failed');
  assert.equal(result.state.globalStatus, 'completed_with_warnings');
  assert.equal(dependencies.eventLog.at(-2), 'button:done');
}

console.log('Associative production pipeline integration tests passed.');
'''
write('tests/associative-atomic-pipeline.test.mjs', ATOMIC_TEST)


HARDENING_TEST = r'''import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getFrequencyProfile, clearFrequencyCacheForTests } from '../associativvordes/js/frequency-loader.js';
import { getBidirectionalSwow, clearSwowCacheForTests } from '../associativvordes/js/swow-client.js';
import { getQwenCandidateSuggestions } from '../associativvordes/js/qwen-client.js';
import { normalizeForMorphology, mapNormalizedRangeToOriginal } from '../associativvordes/js/morphology/normalizer.js';
import { registerLexicalRootsFromEntries, clearLexicalRootIndexForTests } from '../associativvordes/js/morphology/lexical-root-index.js';
import { getLanguageConfig } from '../associativvordes/js/morphology/languages/index.js';
import { parseDerivationalModel, MORPHEME_PARSER_VERSION } from '../associativvordes/js/morpheme-model-parser.js';
import { compactAssociativeState, restoreAssociativeState, createEmptyAssociativeState } from '../associativvordes/js/associative-state.js';

const originalFetch = globalThis.fetch;
const originalDocument = globalThis.document;
const originalLocation = globalThis.location;
globalThis.document = { documentElement: { lang: 'en' } };
globalThis.location = { hostname: 'localhost' };

try {
  {
    clearFrequencyCacheForTests();
    const controller = new AbortController();
    globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true });
    });
    const request = getFrequencyProfile('en', 'test', { signal: controller.signal });
    controller.abort();
    await assert.rejects(request, error => error.name === 'AbortError');
  }

  {
    clearSwowCacheForTests();
    const controller = new AbortController();
    globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true });
    });
    const request = getBidirectionalSwow('en', 'eye', 'ocular', { signal: controller.signal });
    controller.abort();
    await assert.rejects(request, error => error.name === 'AbortError');
  }

  {
    globalThis.fetch = async () => ({
      ok: true,
      async json() {
        return {
          ok: true,
          candidates: { en: [{ word: 'altruism', root_variant: 'altru' }], de: [], fr: [], es: [], it: [], ru: [] },
          audit: { status: 'completed_with_fallback', model: null, error: { code: 'QWEN_CANDIDATE_AUDIT_UNAVAILABLE', details: 'offline' } },
          guaranteedCandidates: { en: [{ word: 'altruism', root_variant: 'altru' }] },
          qwenCandidates: { en: [] }
        };
      }
    });
    const result = await getQwenCandidateSuggestions({ root: 'alter', targetMeaning: 'other' });
    assert.equal(result.auditStatus, 'completed_with_fallback');
    assert.equal(result.auditError.code, 'QWEN_CANDIDATE_AUDIT_UNAVAILABLE');
    assert.equal(result.suggestions.en[0].word, 'altruism');
  }

  {
    const normalized = normalizeForMorphology('Régul ation', 'en');
    assert.equal(normalized.normalized, 'regulation');
    const range = mapNormalizedRangeToOriginal(normalized, 0, 5);
    assert.equal('Régul ation'.slice(range.start, range.end).toLowerCase(), 'régul');
    const russian = normalizeForMorphology('Ёлочный', 'ru');
    assert.equal(russian.normalized.startsWith('ел'), true);
  }

  {
    clearLexicalRootIndexForTests();
    const config = getLanguageConfig('en');
    registerLexicalRootsFromEntries('en', [
      { word: 'intercontinental', frequency_score: 70 },
      { word: 'intergovernmental', frequency_score: 65 },
      { word: 'interlinguistic', frequency_score: 60 }
    ], { prefix: 'inter', config });
    const continental = parseDerivationalModel({ language: 'en', elementType: 'preposition', word: 'intercontinental', canonicalRoot: 'inter' });
    const governmental = parseDerivationalModel({ language: 'en', elementType: 'preposition', word: 'intergovernmental', canonicalRoot: 'inter' });
    const linguistic = parseDerivationalModel({ language: 'en', elementType: 'preposition', word: 'interlinguistic', canonicalRoot: 'inter' });
    assert.equal(continental.model_key, 'en|preposition|inter|continent');
    assert.equal(governmental.model_key, 'en|preposition|inter|government');
    assert.equal(linguistic.model_key, 'en|preposition|inter|lingu');
    assert.equal(continental.best_analysis.morphotacticsValid, true);
    assert.ok(Array.isArray(continental.best_analysis.morphotacticViolations));
  }

  {
    const languages = [{ code: 'en', group: 'Germanic' }];
    const state = createEmptyAssociativeState({ languages });
    state.root = 'regul';
    state.checked = true;
    state.globalStatus = 'completed';
    state.languages.en = [{
      word: 'regulation', selected: true, final_score: 40, model: 'regul-ation', model_label: 'regul-ation', model_key: 'en|root||regul|ation', parser_version: MORPHEME_PARSER_VERSION,
      morpheme_analysis: { parser_version: MORPHEME_PARSER_VERSION, language: 'en', element_type: 'root', canonical_root: 'regul', matched_root_variant: 'regul', prefix_chain: [], first_meaningful_derivational_element: 'ation', first_lexical_root_after_preposition: '', model_key: 'en|root||regul|ation', model_label: 'regul-ation', analysis_confidence: 'high', diagnostic_reason: 'exact_morpheme_parse', warnings: [] }
    }];
    const saved = compactAssociativeState(state, { languages });
    assert.equal(saved.version, 2);
    assert.equal(saved.state.languages.en[0].parser_version, MORPHEME_PARSER_VERSION);
    assert.equal(saved.state.languages.en[0].morpheme_analysis.model_key, 'en|root||regul|ation');
    const restored = restoreAssociativeState(saved, { languages });
    assert.equal(restored.state.languages.en[0].parser_version, MORPHEME_PARSER_VERSION);
  }

  const familySource = await readFile('associativvordes/js/candidate-model-family.js', 'utf8');
  assert.doesNotMatch(familySource, /stemRoot === ['"]alternativ['"]/, 'algorithmic special case is removed');
  const analyzerSource = await readFile('associativvordes/js/morphology/analyzer.js', 'utf8');
  assert.doesNotMatch(analyzerSource, /morphotacticsValid:\s*true/, 'morphotactics is calculated rather than hard-coded');
  const segmentationSource = await readFile('associativvordes/js/morphology/segmentation-engine.js', 'utf8');
  assert.match(segmentationSource, /topK\(out, maxAnalyses\)/, 'N-best candidates are ranked before truncation');
} finally {
  globalThis.fetch = originalFetch;
  globalThis.document = originalDocument;
  globalThis.location = originalLocation;
}

console.log('Associative hardening regression tests passed.');
'''
write('tests/associative-production-hardening.test.mjs', HARDENING_TEST)

print('Applied associative hardening tests.')
