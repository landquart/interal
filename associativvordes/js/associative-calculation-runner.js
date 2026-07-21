import { calculateLanguageScore, calculateFinalAssociation, deriveGlobalStatusFromLanguageStatuses } from './association-analyzer.js';
import { finalizeCandidateOrdering, selectBestFinalModels, isAbortError, normalizeAbortError } from './qwen-client.js';
import {
  MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE,
  createEmptyAssociativeState,
  resetAssociativeRunState,
  addRunWarning,
  addLanguageWarning,
  addCandidateWarning,
  hasAnyAssociativeWarnings,
  hasLanguageAssociativeWarnings,
  migrateAssociativeWarnings
} from './associative-state.js';

const DEFAULT_LANGUAGES = [
  { code: 'en', name: 'English', group: 'Germanic' },
  { code: 'de', name: 'German', group: 'Germanic' },
  { code: 'fr', name: 'French', group: 'Romance' },
  { code: 'es', name: 'Spanish', group: 'Romance' },
  { code: 'it', name: 'Italian', group: 'Romance' },
  { code: 'ru', name: 'Russian', group: 'Slavic' }
];

let latestTestRunId = 0;

function status(statusName, patch = {}) {
  return {
    status: statusName,
    errorCode: patch.errorCode || null,
    diagnostics: Array.isArray(patch.diagnostics) ? patch.diagnostics : [],
    candidateCount: Number(patch.candidateCount) || 0,
    analyzedCount: Number(patch.analyzedCount) || 0,
    successfulCount: Number(patch.successfulCount) || 0,
    failedCount: Number(patch.failedCount) || 0
  };
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function scoreOf(item) {
  const value = Number(item?.final_score ?? item?.analysis?.final_score ?? item?.P);
  return Number.isFinite(value) ? value : null;
}

function candidateIdentity(candidate) {
  return candidate?.model_key || candidate?.model_family_key || candidate?.model || candidate?.word || candidate?.normalized || 'unknown_candidate';
}

function normalizeAuditResult(value, fallback) {
  if (!value) return { candidatesByLanguage: fallback, warnings: [], diagnostics: null };
  if (value.candidatesByLanguage && typeof value.candidatesByLanguage === 'object') {
    return {
      candidatesByLanguage: value.candidatesByLanguage,
      warnings: Array.isArray(value.warnings) ? value.warnings : [],
      diagnostics: value.diagnostics || null,
      auditStatus: value.auditStatus || value.status || null,
      auditError: value.auditError || null
    };
  }
  return { candidatesByLanguage: value, warnings: [], diagnostics: null };
}

function throwIfInactive({ signal, runId, isCurrentRun }, stage) {
  if (signal?.aborted || (typeof isCurrentRun === 'function' && !isCurrentRun(runId))) {
    throw normalizeAbortError(signal?.reason, { stage, runId });
  }
}

function defaultLanguageScore(candidates, maxModels) {
  return calculateLanguageScore(candidates, { maxModels, scoreGetter: scoreOf });
}

function defaultFinalScore(state, languages) {
  const languageResults = languages.map(language => state.languageScores?.[language.code] || { sum: null, normalized: null, count: 0 });
  return calculateFinalAssociation({ languages, languageResults, languageStatuses: state.languageStatuses });
}

function finalGlobalStatus(state) {
  const languageStatus = deriveGlobalStatusFromLanguageStatuses(state.languageStatuses);
  return hasAnyAssociativeWarnings(state.warnings) && languageStatus === 'completed'
    ? 'completed_with_warnings'
    : languageStatus;
}

export function resetAssociativeCalculationRunnerForTests() {
  latestTestRunId = 0;
}

export async function restoreAssociativeCalculation({ dependencies = {}, onStateChange } = {}) {
  const saved = await dependencies.stateStorage?.load?.();
  if (!saved || saved.checked !== true || ['loading', 'idle'].includes(saved.globalStatus)) return null;
  onStateChange?.(clone(saved), { event: 'state:restored' });
  await dependencies.renderer?.renderFinal?.(saved, { restored: true });
  return saved;
}

export async function runAssociativeCalculation({
  input = {},
  state: providedState,
  dependencies = {},
  signal,
  runId,
  onProgress,
  onStateChange
} = {}) {
  const effectiveRunId = runId ?? ++latestTestRunId;
  if (runId == null) latestTestRunId = effectiveRunId;
  const languages = dependencies.languages || DEFAULT_LANGUAGES;
  const maxModels = Math.max(1, Number(input.maxModels) || MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE);
  const events = dependencies.eventLog || [];
  const emit = (event, payload) => {
    events.push(event);
    dependencies.onEvent?.(event, payload);
  };
  const active = { signal, runId: effectiveRunId, isCurrentRun: dependencies.isCurrentRun };
  const ensureActive = stage => throwIfInactive(active, stage);
  const currentState = providedState || dependencies.stateStorage?.create?.() || createEmptyAssociativeState({ languages, createLanguageStatus: status });
  resetAssociativeRunState(currentState, { languages, createLanguageStatus: status });
  Object.assign(currentState, {
    root: input.root || input.word || '',
    meaning: input.meaning || input.targetMeaning || '',
    elementType: input.elementType === 'preposition' ? 'preposition' : 'root',
    maxModels,
    checked: false,
    globalStatus: 'loading',
    warnings: migrateAssociativeWarnings(currentState, { languages })
  });
  currentState.languageScores = {};
  const setState = event => onStateChange?.(clone(currentState), { event, runId: effectiveRunId });
  const button = dependencies.buttonStatusController;
  const labels = {
    start: dependencies.buttonTexts?.start || 'Calculating...',
    done: dependencies.buttonTexts?.done || 'Done',
    warnings: dependencies.buttonTexts?.warnings || 'Completed with warnings',
    error: dependencies.buttonTexts?.error || 'Calculation error'
  };
  const buttonToken = button?.start?.(labels.start);
  const progress = text => {
    onProgress?.(text);
    button?.progress?.(buttonToken, text);
  };

  emit('run:start');
  try {
    ensureActive('run_start');
    emit('translation:start');
    progress(dependencies.progressTexts?.translation || 'translation');
    const translations = await dependencies.targetTranslator?.translate?.(input, { signal, runId: effectiveRunId, onProgress: progress }) || {};
    ensureActive('translation');
    emit('translation:end');

    const candidatePools = {};
    emit('index:start');
    for (const language of languages) {
      ensureActive(`index:${language.code}`);
      currentState.languageStatuses[language.code] = status('loading_index');
      setState('status:loading_index');
      try {
        const loaded = await dependencies.candidateIndexLoader?.load?.(language, input, { signal, runId: effectiveRunId, onProgress: progress, translations }) || [];
        ensureActive(`index:${language.code}:after`);
        const candidates = Array.isArray(loaded?.candidates) ? loaded.candidates : (Array.isArray(loaded) ? loaded : []);
        candidatePools[language.code] = candidates;
        if (!candidates.length) {
          currentState.languageStatuses[language.code] = status('no_candidates');
        } else {
          currentState.languageStatuses[language.code] = status('grouping_candidates', { candidateCount: candidates.length });
          setState('status:grouping_candidates');
          currentState.languageStatuses[language.code] = status('candidate_audit', { candidateCount: candidates.length });
        }
      } catch (error) {
        if (isAbortError(error, signal)) throw normalizeAbortError(error, { stage: 'candidate_index', runId: effectiveRunId });
        candidatePools[language.code] = [];
        addLanguageWarning(currentState, language.code, 'language_index_unavailable', error?.message);
        currentState.languageStatuses[language.code] = status('index_error', { errorCode: error?.code || error?.name || 'INDEX_ERROR' });
      }
    }
    ensureActive('index');
    emit('index:end');

    emit('audit:start');
    progress(dependencies.progressTexts?.audit || 'candidate audit');
    let audited = { candidatesByLanguage: candidatePools, warnings: [], diagnostics: null };
    try {
      const response = await dependencies.candidateAudit?.audit?.({
        root: currentState.root,
        targetMeaning: currentState.meaning || currentState.root,
        elementType: currentState.elementType,
        candidatesByLanguage: candidatePools,
        translations,
        input
      }, { signal, runId: effectiveRunId, onProgress: progress });
      audited = normalizeAuditResult(response, candidatePools);
      for (const warning of audited.warnings) {
        const code = String(warning?.code || warning || '').split(':')[0] || 'qwen_candidate_audit_unavailable';
        addRunWarning(currentState, code, warning?.details || warning);
      }
      if (audited.auditError) addRunWarning(currentState, 'qwen_candidate_audit_unavailable', audited.auditError);
      currentState.candidateAuditDiagnostics = audited.diagnostics || null;
    } catch (error) {
      if (isAbortError(error, signal)) throw normalizeAbortError(error, { stage: 'candidate_audit', runId: effectiveRunId });
      addRunWarning(currentState, 'qwen_candidate_audit_unavailable', error?.message);
      audited = { candidatesByLanguage: candidatePools, warnings: [], diagnostics: null };
    }
    ensureActive('candidate_audit');
    emit('audit:end');

    const finalPools = {};
    for (const language of languages) {
      const source = audited.candidatesByLanguage?.[language.code] || candidatePools[language.code] || [];
      const custom = dependencies.candidateFinalizer?.finalize?.(language, source, { maxModels, input, state: currentState });
      finalPools[language.code] = Array.isArray(custom) ? custom : finalizeCandidateOrdering(source, maxModels);
    }
    emit('selection:final');

    const selectedModels = {};
    for (const language of languages) {
      ensureActive(`analysis:${language.code}`);
      const pool = finalPools[language.code] || [];
      if (!pool.length) {
        currentState.languages[language.code] = [];
        if (currentState.languageStatuses[language.code]?.status !== 'index_error') currentState.languageStatuses[language.code] = status('no_candidates');
        selectedModels[language.code] = [];
        continue;
      }
      const selected = dependencies.candidateSelector?.select?.(language, pool, { maxModels, state: currentState }) || selectBestFinalModels(pool, maxModels);
      selectedModels[language.code] = selected.map(candidateIdentity);
      currentState.languageStatuses[language.code] = status('analyzing', { candidateCount: pool.length });
      setState('status:analyzing');
      const analyzed = [];
      for (const candidate of selected) {
        ensureActive(`primary:${language.code}`);
        emit('primary:start');
        progress(`primary:${language.code}`);
        const result = await dependencies.candidateAnalyzer?.analyze?.(language, candidate, {
          signal,
          runId: effectiveRunId,
          input,
          translation: translations?.[language.code] || '',
          onProgress: progress,
          onReviewStart: () => {
            currentState.languageStatuses[language.code] = status('reviewing', { candidateCount: pool.length, analyzedCount: analyzed.length });
            setState('status:reviewing');
            emit('review:start');
          },
          onReviewEnd: () => emit('review:end')
        });
        ensureActive(`primary:${language.code}:after`);
        emit('primary:end');
        const analyzedCandidate = result?.candidate || result || candidate;
        if (Array.isArray(result?.warnings)) {
          for (const warning of result.warnings) addCandidateWarning(currentState, language.code, candidateIdentity(candidate), String(warning?.code || warning).split(':')[0], warning?.details || warning);
        }
        analyzed.push(analyzedCandidate);
      }
      const byIdentity = new Map(analyzed.map(item => [candidateIdentity(item), item]));
      currentState.languages[language.code] = pool.map(item => byIdentity.get(candidateIdentity(item)) || { ...item, selected: false });
      const failedCount = analyzed.filter(item => item?.analysis?.status === 'error' || item?.analysisStatus === 'error' || !Number.isFinite(scoreOf(item))).length;
      const successfulCount = analyzed.length - failedCount;
      if (failedCount && successfulCount) addLanguageWarning(currentState, language.code, 'language_stage_partial', { failedCount, successfulCount });
      if (analyzed.length && !successfulCount) addLanguageWarning(currentState, language.code, 'all_language_candidates_analysis_failed', { analyzedCount: analyzed.length });
      const score = dependencies.languageScore?.calculate?.(language, currentState.languages[language.code], { maxModels, state: currentState }) || defaultLanguageScore(currentState.languages[language.code], maxModels);
      currentState.languageScores[language.code] = score;
      currentState.languageStatuses[language.code] = status(
        analyzed.length && !successfulCount
          ? 'qwen_error'
          : (failedCount || hasLanguageAssociativeWarnings(currentState.warnings, language.code) ? 'completed_with_warnings' : 'completed'),
        { candidateCount: pool.length, analyzedCount: analyzed.length, successfulCount, failedCount, errorCode: failedCount ? (successfulCount ? 'QWEN_PARTIAL_FAILURE' : 'QWEN_FAILED') : null }
      );
      emit('language_score:calculated');
    }

    ensureActive('before_scores');
    currentState.selectedModels = selectedModels;
    const finalResult = dependencies.finalScore?.calculate?.(currentState, languages, { maxModels }) || defaultFinalScore(currentState, languages);
    currentState.finalAssociationResult = finalResult;
    currentState.FA = finalResult?.finalAssociation ?? null;
    currentState.globalStatus = finalGlobalStatus(currentState);
    if (currentState.globalStatus === 'loading') throw new Error('Done blocked for loading global status');
    emit('scores:calculated');

    currentState.checked = true;
    emit('state:checked');
    setState('state:checked');
    await dependencies.renderer?.renderFinal?.(currentState, { runId: effectiveRunId, signal });
    ensureActive('render');
    emit('render:final');

    let saveFailed = false;
    try {
      await Promise.resolve(dependencies.stateStorage?.save?.(currentState, { runId: effectiveRunId, signal }));
      ensureActive('save');
      emit('draft:saved');
    } catch (error) {
      if (isAbortError(error, signal)) throw normalizeAbortError(error, { stage: 'save', runId: effectiveRunId });
      saveFailed = true;
      addRunWarning(currentState, 'final_save_failed', error?.message);
      currentState.globalStatus = finalGlobalStatus(currentState);
      emit('draft:save_failed');
    }

    if (saveFailed) {
      await dependencies.renderer?.renderFinal?.(currentState, { runId: effectiveRunId, signal, saveFailed: true });
      ensureActive('render_after_save_failure');
      emit('render:save_warning');
    }
    currentState.globalStatus = finalGlobalStatus(currentState);
    button?.success?.(buttonToken, currentState.globalStatus === 'completed_with_warnings' ? labels.warnings : labels.done);
    emit('button:done');
    emit('run:end');
    return { ok: true, state: currentState, events, selectedModels };
  } catch (error) {
    if (isAbortError(error, signal) || (typeof dependencies.isCurrentRun === 'function' && !dependencies.isCurrentRun(effectiveRunId))) {
      currentState.globalStatus = 'aborted';
      button?.abort?.(buttonToken);
      emit('run:aborted');
      throw normalizeAbortError(error, { stage: error?.stage || 'run', runId: effectiveRunId });
    }
    currentState.globalStatus = 'error';
    button?.error?.(buttonToken, labels.error);
    emit('run:error');
    throw error;
  }
}
