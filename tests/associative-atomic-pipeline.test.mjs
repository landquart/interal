import assert from 'node:assert/strict';
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
  const counts = { paints: 0, translations: 0, indexes: 0, audits: 0, analyses: 0, renders: 0, saves: 0, done: 0 };
  const events = [];
  const button = { loading: false, text: 'Calculate' };
  const dependencies = {
    languages,
    eventLog: events,
    isCurrentRun: () => true,
    async waitForPaint() {
      counts.paints += 1;
      events.push('button:painted');
    },
    buttonStatusController: {
      start(text) { button.loading = true; button.text = text; return 1; },
      progress(_token, text) { button.loading = true; button.text = text; },
      success(_token, text) { counts.done += 1; button.loading = false; button.text = text; },
      abort() { button.loading = false; button.text = 'Calculate'; },
      error() { button.loading = false; button.text = 'Error'; }
    },
    targetTranslator: { async translate() { counts.translations += 1; events.push('translation:called'); return { en: 'eye' }; } },
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
  assert.equal(counts.paints, 1, 'the loading state is painted exactly once before the calculation');
  assert.ok(events.indexOf('button:painted') < events.indexOf('translation:called'), 'the browser receives a paint opportunity before translation and index work');
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
  const { dependencies, counts } = makeDependencies();
  dependencies.candidateAudit.audit = async ({ candidatesByLanguage }) => ({
    candidatesByLanguage: {
      en: candidatesByLanguage.en.map((candidate, index) => ({
        ...candidate,
        automatic_selection_eligible: index === 0
      }))
    },
    warnings: [],
    diagnostics: { status: 'completed', validationKeptCount: 1, validationRemovedDuplicateCount: 1 }
  });
  const result = await runAssociativeCalculation({ input: { root: 'validated', maxModels: 5 }, dependencies });
  assert.equal(counts.analyses, 1, 'the five-model value is a cap and Qwen validation may authorize fewer analyses');
  assert.deepEqual(result.selectedModels.en, ['a'], 'an ineligible lower-ranked model cannot backfill a removed model');
  assert.equal(result.state.languages.en.filter(candidate => candidate.selected).length, 1);
}

{
  const { dependencies, counts } = makeDependencies();
  dependencies.candidatePostValidator = {
    async validate({ candidatesByLanguage }) {
      return {
        candidatesByLanguage: {
          en: candidatesByLanguage.en.map((candidate, index) => ({
            ...candidate,
            selected: index === 0,
            automatic_selection_eligible: index === 0,
            qwen_final_validation: {
              word: candidate.word,
              decision: index === 0 ? 'keep' : 'remove_irrelevant'
            }
          }))
        },
        warnings: [],
        diagnostics: { status: 'completed' }
      };
    }
  };
  const result = await runAssociativeCalculation({ input: { root: 'post-validated', maxModels: 5 }, dependencies });
  assert.equal(counts.analyses, 5, 'five is only the provisional analysis cap');
  assert.deepEqual(result.selectedModels.en, ['a'], 'the final validator may retain fewer models without backfilling');
  assert.deepEqual(result.state.languages.en.filter(candidate => candidate.selected).map(candidate => candidate.word), ['a']);
  assert.ok(dependencies.eventLog.indexOf('final_validation:end') < dependencies.eventLog.indexOf('language_score:calculated'));
}

{
  const { dependencies } = makeDependencies();
  dependencies.candidatePostValidator = { async validate() { throw new Error('final audit unavailable'); } };
  const result = await runAssociativeCalculation({ input: { root: 'fail-open', maxModels: 5 }, dependencies });
  assert.equal(result.state.languages.en.filter(candidate => candidate.selected).length, 5, 'a final-validator outage preserves independently analyzed candidates');
  assert.equal(result.state.languageStatuses.en.status, 'completed');
  assert.equal(result.state.globalStatus, 'completed_with_warnings');
  assert.equal(result.state.warnings.run.at(-1).code, 'qwen_final_candidate_validation_unavailable');
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
