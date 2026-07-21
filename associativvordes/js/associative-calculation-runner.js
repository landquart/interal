import { calculateLanguageScore, calculateFinalAssociation, deriveGlobalStatusFromLanguageStatuses, shouldReviewPrimaryScore } from './association-analyzer.js';
import { finalizeCandidateOrdering, selectBestFinalModels, isAbortError, normalizeAbortError, QWEN_RUNTIME_CONFIG, createReviewBudget } from './qwen-client.js';
import { MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE, createEmptyAssociativeState, addRunWarning, addCandidateWarning, hasAnyAssociativeWarnings, hasLanguageAssociativeWarnings, migrateAssociativeWarnings } from './associative-state.js';

const DEFAULT_LANGUAGES = [
  { code: 'en', name: 'English', group: 'Germanic' },
  { code: 'de', name: 'German', group: 'Germanic' },
  { code: 'fr', name: 'French', group: 'Romance' },
  { code: 'es', name: 'Spanish', group: 'Romance' },
  { code: 'it', name: 'Italian', group: 'Romance' },
  { code: 'ru', name: 'Russian', group: 'Slavic' }
];

let latestRunId = 0;

function status(status, patch = {}) { return { status, errorCode: patch.errorCode || null, diagnostics: patch.diagnostics || [], candidateCount: patch.candidateCount || 0, analyzedCount: patch.analyzedCount || 0, successfulCount: patch.successfulCount || 0, failedCount: patch.failedCount || 0 }; }
function abortErr(error, stage, runId) { return normalizeAbortError?.(error, { stage, runId }) || Object.assign(new Error('Operation aborted.'), { name: 'AbortError', code: 'ABORTED', stage, runId }); }
function throwIfInactive(run, stage) { if (run.signal?.aborted || run.runId !== latestRunId) throw abortErr(run.signal?.reason, stage, run.runId); }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function scoreOf(item) { return Number(item?.final_score ?? item?.analysis?.final_score ?? item?.P); }
function associationScore(result) { return Number(result?.association_score ?? result?.analysis?.association?.association_score ?? result?.P ?? result?.final_score); }
function withAnalysis(candidate, analysis) { const p = Number(analysis?.final_score ?? analysis?.P ?? associationScore(analysis)); return { ...candidate, analysis, association_score: associationScore(analysis), final_score: Number.isFinite(p) ? p : candidate.final_score, selected: Number.isFinite(p), analysisStatus: null }; }
function candidateId(candidate) { return candidate?.model_key || candidate?.model || candidate?.word || candidate?.normalized || 'unknown_candidate'; }
function createReviewDiagnostics(budget) { return { reviewEligibleCount: 0, reviewStartedCount: 0, reviewCompletedCount: 0, reviewFailedCount: 0, reviewAbortedCount: 0, reviewSkippedDisabledCount: 0, reviewSkippedBudgetCount: 0, reviewBudgetLimit: budget.limit }; }

export function resetAssociativeCalculationRunnerForTests() { latestRunId = 0; }

export async function restoreAssociativeCalculation({ dependencies = {}, onStateChange } = {}) {
  const storage = dependencies.stateStorage;
  const renderer = dependencies.renderer;
  const saved = await storage?.load?.();
  if (!saved || saved.checked !== true || ['loading', 'idle'].includes(saved.globalStatus)) return null;
  onStateChange?.(clone(saved), { event: 'state:restored' });
  await renderer?.renderFinal?.(saved, { restored: true });
  return saved;
}

export async function runAssociativeCalculation({ input = {}, dependencies = {}, signal, onProgress, onStateChange } = {}) {
  const runId = ++latestRunId;
  const languages = dependencies.languages || DEFAULT_LANGUAGES;
  const maxModels = input.maxModels || MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE;
  const events = dependencies.eventLog || [];
  const emit = (event, payload) => { events.push(event); dependencies.onEvent?.(event, payload); };
  const reviewBudget = createReviewBudget({ enabled: QWEN_RUNTIME_CONFIG.enableReviewModel === true, maxRequests: QWEN_RUNTIME_CONFIG.maxReviewRequestsPerSearch });
  const reviewDiagnostics = createReviewDiagnostics(reviewBudget);
  const state = dependencies.stateStorage?.create?.() || createEmptyAssociativeState({ languages, createLanguageStatus: status });
  state.languageScores ||= {};
  state.reviewDiagnostics = reviewDiagnostics;
  Object.assign(state, { root: input.root || input.word || '', meaning: input.meaning || input.targetMeaning || '', elementType: input.elementType || 'root', maxModels, checked: false, globalStatus: 'loading', warnings: migrateAssociativeWarnings(state, { languages }) });
  const run = { runId, signal };
  const button = dependencies.buttonStatusController;
  const token = button?.start?.('translation');
  const progress = (text) => { onProgress?.(text); button?.progress?.(token, text); };
  const setState = (event) => onStateChange?.(clone(state), { event, runId });
  emit('run:start');
  try {
    emit('translation:start'); progress('translation');
    const translations = await dependencies.targetTranslator?.translate?.(input, { signal, runId }) || {};
    throwIfInactive(run, 'translation'); emit('translation:end');

    emit('index:start'); progress('index');
    const pools = {};
    for (const lang of languages) {
      state.languageStatuses[lang.code] = status('loading_index'); setState('status:loading_index');
      pools[lang.code] = await dependencies.candidateIndexLoader?.load?.(lang.code, input, { signal, runId }) || [];
      state.languageStatuses[lang.code] = status('candidate_audit', { candidateCount: pools[lang.code].length });
    }
    throwIfInactive(run, 'index'); emit('index:end');

    let refined = pools;
    emit('audit:start'); progress('candidate audit');
    try {
      refined = await dependencies.candidateAudit?.audit?.({ candidatesByLanguage: pools, input, translations }, { signal, runId }) || pools;
    } catch (error) {
      if (isAbortError(error, signal)) throw abortErr(error, 'candidate_audit', runId);
      addRunWarning(state, 'qwen_candidate_audit_unavailable', error?.message);
      refined = pools;
    }
    throwIfInactive(run, 'candidate_audit'); emit('audit:end');

    const verified = await dependencies.candidateVerifier?.verify?.({ candidatesByLanguage: refined, input }, { signal, runId }) || refined;
    throwIfInactive(run, 'candidate_verification');
    const finalPools = {};
    for (const lang of languages) finalPools[lang.code] = finalizeCandidateOrdering(verified[lang.code] || [], maxModels);
    emit('selection:final');

    const selectedModels = {};
    for (const lang of languages) {
      const selected = selectBestFinalModels(finalPools[lang.code] || [], maxModels);
      selectedModels[lang.code] = selected.map(c => c.model_key || c.model || c.word);
      if (!selected.length) { state.languages[lang.code] = finalPools[lang.code] || []; state.languageStatuses[lang.code] = status('no_candidates'); continue; }
      state.languageStatuses[lang.code] = status('analyzing', { candidateCount: finalPools[lang.code].length }); setState('status:analyzing');
      const analyzed = [];
      for (const candidate of selected) {
        emit('primary:start'); progress(`primary:${lang.code}`);
        const primary = await dependencies.primaryAnalyzer?.analyze?.({ language: lang.code, candidate, input, translation: translations[lang.code] }, { signal, runId });
        throwIfInactive(run, 'primary'); emit('primary:end');
        let final = primary;
        const p = Number(primary?.final_score ?? primary?.P ?? associationScore(primary));
        if (shouldReviewPrimaryScore(p)) {
          reviewDiagnostics.reviewEligibleCount += 1;
          throwIfInactive(run, 'before_review');
          if (QWEN_RUNTIME_CONFIG.enableReviewModel !== true || reviewBudget.enabled !== true) {
            reviewDiagnostics.reviewSkippedDisabledCount += 1;
          } else if (!reviewBudget.canRequest()) {
            reviewDiagnostics.reviewSkippedBudgetCount += 1;
            addCandidateWarning(state, lang.code, candidateId(candidate), 'review_budget_exhausted');
            final = { ...primary, combination_method: 'primary_only_review_budget_exhausted' };
          } else {
            state.languageStatuses[lang.code] = status('reviewing', { candidateCount: finalPools[lang.code].length }); setState('status:reviewing');
            emit('review:start'); progress(`review:${lang.code}`);
            reviewBudget.reserve(); reviewDiagnostics.reviewStartedCount += 1;
            try {
              final = await dependencies.reviewAnalyzer?.analyze?.({ language: lang.code, candidate, primary, input }, { signal, runId });
              throwIfInactive(run, 'review'); reviewDiagnostics.reviewCompletedCount += 1; emit('review:end');
            } catch (error) {
              if (isAbortError(error, signal)) { reviewDiagnostics.reviewAbortedCount += 1; throw abortErr(error, 'review', runId); }
              reviewDiagnostics.reviewFailedCount += 1; addCandidateWarning(state, lang.code, candidateId(candidate), 'review_failed', error?.message); final = primary; emit('review:end');
            }
          }
        }
        analyzed.push(withAnalysis(candidate, final));
      }
      const byKey = new Map(analyzed.map(c => [c.model_key || c.model || c.word, c]));
      state.languages[lang.code] = (finalPools[lang.code] || []).map(c => byKey.get(c.model_key || c.model || c.word) || { ...c, selected: false });
      state.languageScores[lang.code] = calculateLanguageScore(state.languages[lang.code], { maxModels, scoreGetter: scoreOf });
      state.languageStatuses[lang.code] = status(hasLanguageAssociativeWarnings(state.warnings, lang.code) ? 'completed_with_warnings' : 'completed', { candidateCount: finalPools[lang.code].length, analyzedCount: analyzed.length, successfulCount: analyzed.length });
      emit('language_score:calculated');
    }
    throwIfInactive(run, 'before_scores'); emit('scores:calculated');
    state.selectedModels = selectedModels;
    state.finalAssociationResult = calculateFinalAssociation({ languages, languageResults: languages.map(l => state.languageScores[l.code]), languageStatuses: state.languageStatuses });
    state.FA = state.finalAssociationResult.finalAssociation;
    state.globalStatus = hasAnyAssociativeWarnings(state.warnings) && deriveGlobalStatusFromLanguageStatuses(state.languageStatuses) === 'completed' ? 'completed_with_warnings' : deriveGlobalStatusFromLanguageStatuses(state.languageStatuses);
    if (state.globalStatus === 'loading') throw new Error('Done blocked for loading global status');
    await dependencies.renderer?.renderFinal?.(state, { runId, signal });
    throwIfInactive(run, 'render'); emit('render:final');
    state.checked = true; emit('state:checked'); setState('state:checked');
    try {
      await dependencies.stateStorage?.save?.(state, { runId, signal });
    } catch (error) {
      if (isAbortError(error, signal)) throw abortErr(error, 'save', runId);
      addRunWarning(state, 'final_save_failed', error?.message);
    }
    throwIfInactive(run, 'save'); emit('draft:saved');
    if (hasAnyAssociativeWarnings(state.warnings) && state.globalStatus === 'completed') state.globalStatus = 'completed_with_warnings';
    button?.success?.(token, state.globalStatus === 'completed_with_warnings' ? 'completed_with_warnings' : 'Done'); emit('button:done');
    emit('run:end');
    return { ok: true, state, events, selectedModels };
  } catch (error) {
    if (isAbortError(error, signal) || runId !== latestRunId) { state.globalStatus = 'aborted'; button?.abort?.(token); emit('run:aborted'); throw abortErr(error, error.stage || 'run', runId); }
    state.globalStatus = 'error'; button?.error?.(token, 'Calculation error'); emit('run:error'); throw error;
  }
}
