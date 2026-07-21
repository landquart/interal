from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, content):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


def replace_between(text, start_marker, end_marker, replacement, label):
    start = text.find(start_marker)
    if start < 0:
        raise RuntimeError(f'{label}: start marker not found')
    end = text.find(end_marker, start)
    if end < 0:
        raise RuntimeError(f'{label}: end marker not found')
    return text[:start] + replacement + text[end:]


RUNNER = r'''import { calculateLanguageScore, calculateFinalAssociation, deriveGlobalStatusFromLanguageStatuses } from './association-analyzer.js';
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
'''
write('associativvordes/js/associative-calculation-runner.js', RUNNER)


SWOW = r'''import { normalizeWord } from './frequency-loader.js';
import { normalizeAbortError, isAbortError } from './qwen-client.js';
import './qwen-checkbox-hook.js';

export const API_CONFIG = {
  swowBasePath: './swow_association_strength',
  qwenAssociationUrl: '/api/qwen-analyze',
  qwenPrimaryModel: 'qwen3.6-35b-a3b/latest',
  qwenReviewModel: 'qwen3-235b-a22b-fp8/latest'
};

const SWOW_LANGUAGE_FILES = {
  en: { path: 'en', r1: 'strength.SWOW-EN.R1.20180827.csv', r123: 'strength.SWOW-EN.R123.20180827.csv' },
  de: { path: 'de', r1: 'strength.SWOW-DE.2025.R1.csv', r123: 'strength.SWOW-DE.2025.R123.csv' },
  es: { path: 'es-rp', r1: 'strength.SWOWRP.R1.20220426.csv', r123: 'strength.SWOWRP.R123.20220426.csv' }
};

// Cache only completed data. A run-specific AbortSignal must never poison future runs.
const swowCache = new Map();

export function normalizeSwowWord(value) {
  return String(value || '').trim().toLowerCase().normalize('NFC');
}

function throwIfAborted(signal, stage) {
  if (signal?.aborted) throw normalizeAbortError(signal.reason, { stage });
}

function emptyAssociation(language, cue, response, extra = {}) {
  return { found: false, language, cue: normalizeSwowWord(cue), response: normalizeSwowWord(response), r1_strength: 0, r123_strength: 0, source: 'local_swow', ...extra };
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function swowUrl(langConfig, fileName) {
  return `${API_CONFIG.swowBasePath}/${encodeURIComponent(langConfig.path)}/${encodeURIComponent(fileName)}`;
}

function splitCsvLine(line, delimiter) {
  const result = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { result.push(cell); cell = ''; }
    else cell += char;
  }
  result.push(cell);
  return result;
}

function parseStrengthCsv(text, strengthKey) {
  const lines = String(text || '').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return new Map();
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = splitCsvLine(lines[0], delimiter).map(h => normalizeWord(h));
  const cueIndex = headers.indexOf('cue');
  const responseIndex = headers.indexOf('response');
  let strengthIndex = headers.findIndex(h => h === `${strengthKey}.strength` || h === `${strengthKey}_strength`);
  if (strengthIndex === -1) strengthIndex = headers.findIndex(h => h === strengthKey);
  const map = new Map();
  for (const line of lines.slice(1)) {
    const columns = splitCsvLine(line, delimiter);
    const cue = normalizeSwowWord(columns[cueIndex]);
    const response = normalizeSwowWord(columns[responseIndex]);
    if (!cue || !response) continue;
    map.set(`${cue}\u0000${response}`, numberOrZero(columns[strengthIndex]));
  }
  return map;
}

async function loadStrengthFile(langConfig, fileName, strengthKey, { signal } = {}) {
  throwIfAborted(signal, 'swow_fetch');
  const url = swowUrl(langConfig, fileName);
  let response;
  try {
    response = await fetch(url, { cache: 'force-cache', signal });
  } catch (error) {
    if (isAbortError(error, signal)) throw normalizeAbortError(error, { stage: 'swow_fetch' });
    throw error;
  }
  throwIfAborted(signal, 'swow_fetch');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  throwIfAborted(signal, 'swow_parse');
  return { url, data: parseStrengthCsv(text, strengthKey) };
}

async function loadSwowLanguage(language, { signal } = {}) {
  const lang = normalizeWord(language);
  throwIfAborted(signal, 'swow_load');
  if (swowCache.has(lang)) return swowCache.get(lang);
  const langConfig = SWOW_LANGUAGE_FILES[lang];
  if (!langConfig) {
    return { available: false, language: lang, swowPath: `${API_CONFIG.swowBasePath}/${lang}`, warning: `SWOW local file not found for language: ${lang}`, r1: new Map(), r123: new Map() };
  }
  const swowPath = `${API_CONFIG.swowBasePath}/${langConfig.path}`;
  try {
    const [r1, r123] = await Promise.all([
      loadStrengthFile(langConfig, langConfig.r1, 'r1', { signal }),
      loadStrengthFile(langConfig, langConfig.r123, 'r123', { signal })
    ]);
    throwIfAborted(signal, 'swow_load');
    const result = { available: true, language: lang, swowPath, files: { r1: r1.url, r123: r123.url }, r1: r1.data, r123: r123.data };
    swowCache.set(lang, result);
    return result;
  } catch (error) {
    if (isAbortError(error, signal)) throw normalizeAbortError(error, { stage: 'swow_load' });
    return { available: false, language: lang, swowPath, warning: `SWOW local file not found for language: ${lang}`, details: error.message, r1: new Map(), r123: new Map() };
  }
}

export async function getSwowAssociation(language, cue, response, { signal } = {}) {
  const lang = normalizeWord(language);
  const normalizedCue = normalizeSwowWord(cue);
  const normalizedResponse = normalizeSwowWord(response);
  const loaded = await loadSwowLanguage(lang, { signal });
  throwIfAborted(signal, 'swow_lookup');
  if (!loaded.available) {
    return emptyAssociation(lang, normalizedCue, normalizedResponse, {
      warning: 'SWOW file unavailable for language',
      diagnostic: { swowPath: loaded.swowPath, swowFileLoaded: false, swowPairFound: false, swowTargetMeaning: normalizedCue }
    });
  }
  const key = `${normalizedCue}\u0000${normalizedResponse}`;
  const r1Strength = loaded.r1.get(key) || 0;
  const r123Strength = loaded.r123.get(key) || 0;
  const found = r1Strength > 0 || r123Strength > 0;
  return {
    found, language: lang, cue: normalizedCue, response: normalizedResponse,
    r1_strength: r1Strength, r123_strength: r123Strength, source: 'local_swow',
    warning: found ? undefined : 'No SWOW pair found, association not penalized',
    diagnostic: { swowPath: loaded.swowPath, swowFileLoaded: true, swowPairFound: found, swowTargetMeaning: normalizedCue }
  };
}

export async function getBidirectionalSwow(language, target, word, { signal } = {}) {
  const [targetToWord, wordToTarget] = await Promise.all([
    getSwowAssociation(language, target, word, { signal }),
    getSwowAssociation(language, word, target, { signal })
  ]);
  throwIfAborted(signal, 'swow_bidirectional');
  return { target_to_word: targetToWord, word_to_target: wordToTarget };
}

export function clearSwowCacheForTests() {
  swowCache.clear();
}
'''
write('associativvordes/js/swow-client.js', SWOW)


FREQUENCY = r'''import { BASE_CATEGORY_WEIGHTS, CATEGORY_ORDER, FREQUENCY_LIST_BASE_PATH, LANGUAGE_SOURCES } from './config-frequency-sources.js';
import { normalizeLanguageSource } from './language-source-descriptor.js';
import { isAbortError, normalizeAbortError } from './qwen-client.js';

// Cache only fully loaded maps so cancellation of one run cannot poison another run.
const frequencyCache = new Map();
export const SCORE_CONFIG = { ipmRef: 300 };

export function meanNonZero(values) {
  const valid = values.filter(v => typeof v === 'number' && v > 0);
  if (!valid.length) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function ipmToScore(ipm) {
  if (!ipm || ipm <= 0) return 0;
  return Math.min(100, (Math.log10(1 + ipm) / Math.log10(1 + SCORE_CONFIG.ipmRef)) * 100);
}

export function normalizeWord(value) {
  return String(value || '').trim().toLowerCase().normalize('NFC');
}

function sourceUrl(language, fileName) {
  return `${FREQUENCY_LIST_BASE_PATH}/${encodeURIComponent(language)}/${encodeURIComponent(fileName)}`;
}

function throwIfAborted(signal, stage) {
  if (signal?.aborted) throw normalizeAbortError(signal.reason, { stage });
}

function addIpm(map, word, value) {
  const key = normalizeWord(word);
  const number = Number(value);
  if (key && Number.isFinite(number) && number > 0) map.set(key, number);
}

export function normalizeFrequencyData(data) {
  const map = new Map();
  if (!data || typeof data !== 'object') return map;
  if (Array.isArray(data)) {
    for (const record of data) {
      if (!record || typeof record !== 'object') continue;
      addIpm(map, record.word ?? record.lemma ?? record.form, record.ipm ?? record.IPM ?? record.frequency ?? record.freq);
    }
    return map;
  }
  for (const [key, record] of Object.entries(data)) {
    if (typeof record === 'number') { addIpm(map, key, record); continue; }
    if (!record || typeof record !== 'object') continue;
    const explicitWord = record.word ?? record.lemma ?? record.form;
    const explicitValue = record.ipm ?? record.IPM ?? record.frequency ?? record.freq;
    if (explicitValue != null) { addIpm(map, explicitWord || key, explicitValue); continue; }
    for (const [nestedWord, nestedValue] of Object.entries(record)) {
      if (typeof nestedValue === 'number') addIpm(map, nestedWord, nestedValue);
      else if (nestedValue && typeof nestedValue === 'object') addIpm(map, nestedWord, nestedValue.ipm ?? nestedValue.IPM ?? nestedValue.frequency ?? nestedValue.freq);
    }
  }
  return map;
}

async function loadFrequencyFile(language, fileName, { signal } = {}) {
  const key = `${language}/${fileName}`;
  throwIfAborted(signal, 'frequency_fetch');
  if (frequencyCache.has(key)) return frequencyCache.get(key);
  let response;
  try {
    response = await fetch(sourceUrl(language, fileName), { cache: 'force-cache', signal });
  } catch (error) {
    if (isAbortError(error, signal)) throw normalizeAbortError(error, { stage: 'frequency_fetch' });
    throw error;
  }
  throwIfAborted(signal, 'frequency_fetch');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  throwIfAborted(signal, 'frequency_parse');
  const normalized = normalizeFrequencyData(payload);
  frequencyCache.set(key, normalized);
  return normalized;
}

function extractIpm(data, word) {
  if (!data) return 0;
  const key = normalizeWord(word);
  if (data instanceof Map) return data.get(key) ?? data.get(key.normalize('NFD').replace(/[\u0300-\u036f]/g, '')) ?? 0;
  return normalizeFrequencyData(data).get(key) || 0;
}

export function getLanguageCategoryWeights(language) {
  const sources = LANGUAGE_SOURCES[normalizeWord(language)] || {};
  const available = CATEGORY_ORDER.filter(category => Array.isArray(sources[category]) && sources[category].length > 0);
  const totalBase = available.reduce((sum, category) => sum + (BASE_CATEGORY_WEIGHTS[category] || 0), 0);
  if (!totalBase) return {};
  return Object.fromEntries(available.map(category => [category, (BASE_CATEGORY_WEIGHTS[category] || 0) / totalBase]));
}

export async function getFrequencyProfile(language, word, { signal } = {}) {
  const lang = normalizeWord(language);
  const sources = LANGUAGE_SOURCES[lang] || {};
  const categoryWeights = getLanguageCategoryWeights(lang);
  const category_breakdown = {};
  const warnings = [];
  let frequency_score = 0;
  for (const category of CATEGORY_ORDER) {
    throwIfAborted(signal, `frequency:${category}`);
    const files = Array.isArray(sources[category]) ? sources[category] : [];
    if (!files.length) { warnings.push(`No ${category} source for ${lang}`); continue; }
    const ipm_values = [];
    for (const source of files) {
      throwIfAborted(signal, `frequency:${category}`);
      let descriptor;
      try {
        descriptor = normalizeLanguageSource(category, source);
      } catch (error) {
        warnings.push(`Invalid frequency source descriptor for ${lang}/${category}: ${error.message}`);
        ipm_values.push(0);
        continue;
      }
      const { fileName, sourceId, optional } = descriptor;
      try {
        const data = await loadFrequencyFile(lang, fileName, { signal });
        throwIfAborted(signal, `frequency:${category}`);
        ipm_values.push(extractIpm(data, word));
      } catch (error) {
        if (isAbortError(error, signal)) throw normalizeAbortError(error, { stage: `frequency:${category}` });
        const requiredness = optional ? 'Optional' : 'Required';
        warnings.push(`${requiredness} frequency file unavailable: ${lang}/${sourceId} (${error.message})`);
        ipm_values.push(0);
      }
    }
    const category_ipm = meanNonZero(ipm_values);
    if (category_ipm === 0) warnings.push(`Word not found in ${category} corpus for ${lang}`);
    const category_score = ipmToScore(category_ipm);
    const category_weight = categoryWeights[category] || 0;
    frequency_score += category_weight * category_score;
    category_breakdown[category] = { available: true, files_count: files.length, ipm_values, category_ipm, category_score, category_weight };
  }
  return { frequency_score, category_breakdown, warnings };
}

export function clearFrequencyCacheForTests() {
  frequencyCache.clear();
}
'''
write('associativvordes/js/frequency-loader.js', FREQUENCY)


# Make frequency and SWOW fallbacks abort-aware.
path = 'associativvordes/js/association-analyzer.js'
text = read(path)
old = r'''  const hasFrequencyProfile = frequencyProfile && typeof frequencyProfile === 'object' && Number.isFinite(Number(frequencyProfile.frequency_score));
  if (!hasFrequencyProfile) onProgress?.('Загрузка частотных списков...');
  const frequency = hasFrequencyProfile ? { ...frequencyProfile, warnings: Array.isArray(frequencyProfile.warnings) ? frequencyProfile.warnings : [] } : await getFrequencyProfile(language, word).catch(error => {
    warnings.push(`Frequency unavailable: ${error.message}`);
    return { frequency_score: null, category_breakdown: {}, warnings: ['Frequency unavailable'] };
  });
  warnings.push(...(frequency.warnings || []));

  let swowTargetMeaning = typeof localizedTargetMeaning === 'string' ? localizedTargetMeaning.trim() : '';
  if (!swowTargetMeaning && arguments[0] && !Object.prototype.hasOwnProperty.call(arguments[0], 'localizedTargetMeaning')) {
    swowTargetMeaning = await translateTargetMeaningForLanguage(targetMeaning, language).catch(() => '');
  }
  let bidirectionalSwow = { target_to_word: null, word_to_target: null };
  if (!swowTargetMeaning) {
    warnings.push('target_translation_unavailable');
  } else {
    onProgress?.(`SWOW: ${language} — ${word}`);
    bidirectionalSwow = await getBidirectionalSwow(language, swowTargetMeaning, word).catch(error => {
      warnings.push(`SWOW unavailable: ${error.message}`);
      return { target_to_word: null, word_to_target: null };
    });
  }
'''
new = r'''  const hasFrequencyProfile = frequencyProfile && typeof frequencyProfile === 'object' && Number.isFinite(Number(frequencyProfile.frequency_score));
  if (!hasFrequencyProfile) onProgress?.('Загрузка частотных списков...');
  let frequency;
  if (hasFrequencyProfile) {
    frequency = { ...frequencyProfile, warnings: Array.isArray(frequencyProfile.warnings) ? frequencyProfile.warnings : [] };
  } else {
    try {
      frequency = await getFrequencyProfile(language, word, { signal });
      throwIfAborted(signal, 'frequency_profile');
    } catch (error) {
      if (isAbortError(error, signal)) throw normalizeAbortError(error, { stage: 'frequency_profile', runId });
      warnings.push(`Frequency unavailable: ${error.message}`);
      frequency = { frequency_score: null, category_breakdown: {}, warnings: ['Frequency unavailable'] };
    }
  }
  warnings.push(...(frequency.warnings || []));

  let swowTargetMeaning = typeof localizedTargetMeaning === 'string' ? localizedTargetMeaning.trim() : '';
  if (!swowTargetMeaning && arguments[0] && !Object.prototype.hasOwnProperty.call(arguments[0], 'localizedTargetMeaning')) {
    try {
      swowTargetMeaning = await translateTargetMeaningForLanguage(targetMeaning, language, { signal });
      throwIfAborted(signal, 'target_translation');
    } catch (error) {
      if (isAbortError(error, signal)) throw normalizeAbortError(error, { stage: 'target_translation', runId });
      swowTargetMeaning = '';
    }
  }
  let bidirectionalSwow = { target_to_word: null, word_to_target: null };
  if (!swowTargetMeaning) {
    warnings.push('target_translation_unavailable');
  } else {
    onProgress?.(`SWOW: ${language} — ${word}`);
    try {
      bidirectionalSwow = await getBidirectionalSwow(language, swowTargetMeaning, word, { signal });
      throwIfAborted(signal, 'swow');
    } catch (error) {
      if (isAbortError(error, signal)) throw normalizeAbortError(error, { stage: 'swow', runId });
      warnings.push(`SWOW unavailable: ${error.message}`);
      bidirectionalSwow = { target_to_word: null, word_to_target: null };
    }
  }
'''
text = replace_once(text, old, new, 'association abort-aware resources')
write(path, text)


# Candidate audit must retain backend metadata.
path = 'associativvordes/js/qwen-client.js'
text = read(path)
start = 'export async function getQwenCandidateSuggestions('
end = '\nfunction hasFiniteScore(value)'
replacement = r'''export async function getQwenCandidateSuggestions({ root, targetMeaning, currentTopModels = {}, knownCandidates = {}, knownModelKeys = {}, signal } = {}) {
  if (signal?.aborted) throw normalizeAbortError(signal.reason, { stage: 'candidate_audit' });
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(new Error('Qwen candidate request timeout')), QWEN_RUNTIME_CONFIG.candidateRequestTimeoutMs);
  const abortController = new AbortController();
  const forwardAbort = () => abortController.abort(signal?.reason);
  const timeoutAbort = () => abortController.abort(timeoutController.signal.reason);
  if (signal) signal.addEventListener('abort', forwardAbort, { once: true });
  timeoutController.signal.addEventListener('abort', timeoutAbort, { once: true });
  let response;
  try {
    response = await fetch(qwenCandidateGenerationUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root, targetMeaning, currentTopModels, knownCandidates, knownModelKeys, interfaceLanguage: getInterfaceLanguage() }),
      signal: abortController.signal
    });
  } catch (error) {
    if (timeoutController.signal.aborted) throw qwenError(QWEN_ERROR_CODES.TIMEOUT, 'Qwen candidate generation timed out.', { cause: error });
    if (signal?.aborted || isAbortError(error)) throw normalizeAbortError(error, { stage: 'candidate_audit' });
    throw qwenError(QWEN_ERROR_CODES.CANDIDATE_GENERATION_FAILED, 'Qwen candidate generation failed.', { cause: error });
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener?.('abort', forwardAbort);
    timeoutController.signal.removeEventListener('abort', timeoutAbort);
  }
  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw qwenError(QWEN_ERROR_CODES.INVALID_RESPONSE, 'Qwen candidate generation returned invalid JSON.', { cause: error });
  }
  if (!response.ok || payload?.ok === false) throw qwenError(payload?.errorCode || QWEN_ERROR_CODES.CANDIDATE_GENERATION_FAILED, 'Qwen candidate generation backend error.', { status: response.status, details: payload });
  const audit = payload.audit || {
    status: payload.qwenAuditError ? 'completed_with_fallback' : 'completed',
    model: payload.model || null,
    error: payload.qwenAuditError || null
  };
  return {
    suggestions: normalizeQwenCandidateSuggestions(payload),
    auditStatus: audit.status || 'completed',
    auditError: audit.error || null,
    model: audit.model || payload.model || null,
    guaranteedCandidates: payload.guaranteedCandidates || {},
    qwenCandidates: payload.qwenCandidates || {}
  };
}
'''
text = replace_between(text, start, end, replacement, 'structured candidate audit client')
old = r'''    suggestions = await getQwenCandidateSuggestions({ root, targetMeaning: targetMeaning || root, currentTopModels, knownCandidates, knownModelKeys, signal });
'''
new = r'''    const auditResponse = await getQwenCandidateSuggestions({ root, targetMeaning: targetMeaning || root, currentTopModels, knownCandidates, knownModelKeys, signal });
    suggestions = auditResponse.suggestions;
    diagnostics.status = auditResponse.auditStatus;
    diagnostics.model = auditResponse.model;
    diagnostics.usedGuaranteedFallback = auditResponse.auditStatus === 'completed_with_fallback';
    diagnostics.backendErrorCode = auditResponse.auditError?.code || auditResponse.auditError?.errorCode || null;
    diagnostics.backendErrorDetails = auditResponse.auditError?.details || null;
    if (auditResponse.auditError) {
      const warning = 'qwen_candidate_audit_unavailable';
      warnings.push(warning);
      onWarning?.(warning, auditResponse.auditError);
    }
'''
text = replace_once(text, old, new, 'candidate audit response metadata')
old = r'''    auditRetryCount: 0
  };
'''
new = r'''    auditRetryCount: 0,
    status: 'pending',
    model: null,
    usedGuaranteedFallback: false,
    backendErrorCode: null,
    backendErrorDetails: null
  };
'''
text = replace_once(text, old, new, 'candidate audit diagnostics metadata')
write(path, text)


# Backend returns explicit audit status while retaining compatibility fields.
path = 'api/qwen-candidates.js'
text = read(path)
old = r'''    return send(res, 200, {
      ok: true,
      candidates: mergeCandidateMaps(guaranteedCandidates, qwenCandidates),
      qwenCandidates,
      guaranteedCandidates,
      qwenAuditError,
      model,
      currentTopModels: input.currentTopModels,
      knownCandidates: input.knownCandidates,
      knownModelKeys: input.knownModelKeys
    });
'''
new = r'''    const audit = {
      status: qwenAuditError ? 'completed_with_fallback' : 'completed',
      model,
      error: qwenAuditError ? { code: qwenAuditError.errorCode, details: qwenAuditError.details } : null
    };
    return send(res, 200, {
      ok: true,
      candidates: mergeCandidateMaps(guaranteedCandidates, qwenCandidates),
      qwenCandidates,
      guaranteedCandidates,
      audit,
      qwenAuditError,
      model,
      currentTopModels: input.currentTopModels,
      knownCandidates: input.knownCandidates,
      knownModelKeys: input.knownModelKeys
    });
'''
text = replace_once(text, old, new, 'backend audit metadata')
write(path, text)


# Structured run reset and versioned morpheme persistence.
path = 'associativvordes/js/associative-state.js'
text = read(path)
text = replace_once(text, "const PAGE_STATE_VERSION = 1;", "const PAGE_STATE_VERSION = 2;", 'state version')
insert_after = r'''export function createEmptyAssociativeState({ languages = DEFAULT_LANGUAGE_CODES, createLanguageStatus = defaultLanguageStatus } = {}) {
  const codes = languageCodes(languages);
  return {
    root: '', meaning: '', elementType: 'root', maxModels: MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE,
    languages: Object.fromEntries(codes.map(code => [code, []])),
    checked: false,
    languageStatuses: Object.fromEntries(codes.map(code => [code, createLanguageStatus('idle')])),
    warnings: createEmptyWarnings({ languages: codes }),
    globalStatus: 'idle'
  };
}
'''
addition = insert_after + r'''

export function resetAssociativeRunState(state, { languages = DEFAULT_LANGUAGE_CODES, createLanguageStatus = defaultLanguageStatus } = {}) {
  const codes = languageCodes(languages);
  state.languages = Object.fromEntries(codes.map(code => [code, []]));
  state.languageStatuses = Object.fromEntries(codes.map(code => [code, createLanguageStatus('idle')]));
  state.warnings = createEmptyWarnings({ languages: codes });
  state.languageScores = {};
  state.reviewDiagnostics = null;
  state.candidateAuditDiagnostics = null;
  state.finalAssociationResult = null;
  state.selectedModels = {};
  state.FA = null;
  state.checked = false;
  state.globalStatus = 'idle';
  return state;
}
'''
text = replace_once(text, insert_after, addition, 'run reset helper')
old = r'''           model: String(item.model || ''), model_key: String(item.model_key || item.model_family_key || ''), selected: Boolean(item.selected), association_score: finiteOrNull(item.association_score), final_score: finiteOrNull(item.final_score), analysisStatus: item.analysisStatus || null,
'''
new = r'''           model: String(item.model || ''), model_label: String(item.model_label || item.model || ''), model_key: String(item.model_key || item.model_family_key || ''), parser_version: String(item.parser_version || item.morpheme_analysis?.parser_version || ''), morpheme_analysis: item.morpheme_analysis && typeof item.morpheme_analysis === 'object' ? {
             parser_version: String(item.morpheme_analysis.parser_version || item.parser_version || ''), language: String(item.morpheme_analysis.language || ''), element_type: String(item.morpheme_analysis.element_type || ''), canonical_root: String(item.morpheme_analysis.canonical_root || ''), matched_root_variant: String(item.morpheme_analysis.matched_root_variant || ''), prefix_chain: Array.isArray(item.morpheme_analysis.prefix_chain) ? item.morpheme_analysis.prefix_chain.map(String) : [], first_meaningful_derivational_element: String(item.morpheme_analysis.first_meaningful_derivational_element || ''), first_lexical_root_after_preposition: String(item.morpheme_analysis.first_lexical_root_after_preposition || ''), model_key: String(item.morpheme_analysis.model_key || item.model_key || ''), model_label: String(item.morpheme_analysis.model_label || item.model_label || item.model || ''), analysis_confidence: String(item.morpheme_analysis.analysis_confidence || ''), diagnostic_reason: String(item.morpheme_analysis.diagnostic_reason || ''), warnings: Array.isArray(item.morpheme_analysis.warnings) ? item.morpheme_analysis.warnings.slice(0, 8).map(String) : []
           } : null, selected: Boolean(item.selected), association_score: finiteOrNull(item.association_score), final_score: finiteOrNull(item.final_score), analysisStatus: item.analysisStatus || null,
'''
text = replace_once(text, old, new, 'persist morpheme fields')
old = r'''  if (saved.version === PAGE_STATE_VERSION && saved.page === PAGE_STATE_NAME && saved.state && typeof saved.state === 'object') return saved.state;
  if (saved.version === 2 && saved.fields && typeof saved.fields === 'object') return { ...saved.fields, activeLang: saved.ui?.activeLanguageTab, checked: Boolean(saved.flags?.checked || saved.checked || saved.result), result: saved.result || null };
'''
new = r'''  if ([1, PAGE_STATE_VERSION].includes(saved.version) && saved.page === PAGE_STATE_NAME && saved.state && typeof saved.state === 'object') return saved.state;
  if (saved.version === 2 && saved.fields && typeof saved.fields === 'object') return { ...saved.fields, activeLang: saved.ui?.activeLanguageTab, checked: Boolean(saved.flags?.checked || saved.checked || saved.result), result: saved.result || null };
'''
text = replace_once(text, old, new, 'state version migration')
write(path, text)


# Production script: use the same exported runner as tests and remove duplicate orchestration.
path = 'associativvordes/script.js'
text = read(path)
old = "import { MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE, createEmptyAssociativeState, invalidateSearchResult as invalidateAssociativeSearchResult, invalidateFinalCalculation as invalidateAssociativeFinalCalculation, addManualCandidate, updateCandidate, deleteCandidate, compactAssociativeState, restoreAssociativeState, addRunWarning, addLanguageWarning, addCandidateWarning, hasAnyAssociativeWarnings, hasLanguageAssociativeWarnings } from './js/associative-state.js';\n"
new = "import { MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE, createEmptyAssociativeState, resetAssociativeRunState, invalidateSearchResult as invalidateAssociativeSearchResult, invalidateFinalCalculation as invalidateAssociativeFinalCalculation, addManualCandidate, updateCandidate, deleteCandidate, compactAssociativeState, restoreAssociativeState, addRunWarning, addLanguageWarning, addCandidateWarning, hasAnyAssociativeWarnings, hasLanguageAssociativeWarnings } from './js/associative-state.js';\nimport { runAssociativeCalculation } from './js/associative-calculation-runner.js';\n"
text = replace_once(text, old, new, 'script runner import')
run_replacement = r'''    async function runCalculation({ runId } = {}) {
      const root = normalizeText(document.getElementById('rootInput').value);
      const meaning = document.getElementById('meaningInput').value.trim();
      const elementType = document.getElementById('elementType').value;
      if (!root) {
        alert(textGroup('alerts').rootRequired);
        return false;
      }
      const signal = currentRunSignal();
      const languageScore = (language, candidates) => {
        const selected = candidates
          .filter(item => item.selected && Number.isFinite(wordWeight(item)))
          .sort(compareFrequencyRepresentatives)
          .slice(0, MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE);
        return calculateLanguageScore(selected, { maxModels: MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE, scoreGetter: wordWeight });
      };
      const result = await runAssociativeCalculation({
        input: { root, meaning, targetMeaning: meaning || root, elementType, maxModels: MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE },
        state,
        runId,
        signal,
        dependencies: {
          languages: LANGUAGES,
          isCurrentRun,
          buttonStatusController: getCalculateButtonController(),
          buttonTexts: {
            start: currentLang() === 'en' ? 'Calculating...' : 'Расчёт...',
            done: currentLang() === 'en' ? 'Done' : 'Готово',
            warnings: textGroup('errors').completedWithWarnings,
            error: currentLang() === 'en' ? 'Calculation error' : 'Ошибка расчёта'
          },
          targetTranslator: {
            translate: async (_input, context) => getRunTargetTranslations(meaning || root, runId, context.onProgress)
          },
          candidateIndexLoader: {
            load: async (language, _input, context) => {
              const languageName = textGroup('languages')[language.code] || language.name;
              context.onProgress?.(`${currentLang() === 'en' ? 'Searching similar roots' : 'Поиск похожих корней'}: ${languageName}`);
              const candidates = await getLanguageCandidates(language.code, root, { signal: context.signal });
              throwIfStaleRun(runId, 'candidate_index_after_await', context.signal);
              const seenWords = new Set();
              const valid = candidates.filter(candidate => isValidRuntimeCandidate(candidate, root, language.code, seenWords));
              return reconcileModelRepresentatives(valid, root, language.code).map(item => ({ ...item, selected: false, analysisStatus: 'pending' }));
            }
          },
          candidateAudit: {
            audit: async (payload, context) => {
              const auditWarnings = [];
              const response = await refineCandidatesWithQwenAudit({
                root,
                targetMeaning: meaning || root,
                candidatesByLanguage: payload.candidatesByLanguage,
                loader: candidateIndexLoader,
                signal: context.signal,
                elementType,
                onProgress: context.onProgress,
                onWarning: warning => auditWarnings.push(warning),
                languages: LANGUAGES.map(language => language.code)
              });
              if (response.diagnostics) {
                state.candidateAuditDiagnostics = response.diagnostics;
                Object.assign(diagnosticsState.run, {
                  candidateAuditSuggestedCount: response.diagnostics.suggestedCount || 0,
                  candidateAuditDuplicateWordCount: response.diagnostics.duplicateWordCount || 0,
                  candidateAuditDuplicateModelCount: response.diagnostics.duplicateModelCount || 0,
                  candidateAuditLocallyMissingCount: response.diagnostics.locallyMissingCount || 0,
                  candidateAuditVerifiedNewModelCount: response.diagnostics.verifiedNewModelCount || 0,
                  candidateAuditRejectedInvalidCount: response.diagnostics.rejectedInvalidCount || 0,
                  candidateAuditStatus: response.diagnostics.status || null,
                  candidateAuditBackendErrorCode: response.diagnostics.backendErrorCode || null
                });
              }
              return { ...response, warnings: [...(response.warnings || []), ...auditWarnings] };
            }
          },
          candidateFinalizer: {
            finalize: (language, candidates) => finalizeCandidateOrdering(reconcileModelRepresentatives(candidates, root, language.code), MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE)
              .map(item => ({ ...item, analysisStatus: item.selected ? 'pending' : item.analysisStatus || 'pending' }))
          },
          candidateAnalyzer: {
            analyze: async (language, candidate, context) => {
              const analyzed = await analyzeCandidateItem(language.code, candidate, context.onProgress, runId, context.translation);
              if (analyzed.analysis?.review) {
                context.onReviewStart?.();
                context.onReviewEnd?.();
              }
              return analyzed;
            }
          },
          languageScore: { calculate: languageScore },
          finalScore: {
            calculate: current => {
              const languageResults = LANGUAGES.map(language => {
                const candidates = (current.languages[language.code] || []).filter(item => item.selected && Number.isFinite(wordWeight(item)));
                const score = calculateLanguageScore(candidates, { maxModels: current.maxModels, scoreGetter: wordWeight });
                const semanticConfirmed = Number.isFinite(Number(score.normalized)) && candidates.some(item => item.analysis?.association?.semantic_confirmed === true);
                return { ...score, semanticConfirmed };
              });
              return calculateFinalAssociation({ languages: LANGUAGES, languageResults, languageStatuses: current.languageStatuses });
            }
          },
          renderer: { renderFinal: async () => renderAll() },
          stateStorage: { save: async () => Promise.resolve(window.InteralFormDraft?.save?.()) }
        },
        onProgress: text => { if (isCurrentRun(runId)) getCalculateButtonController()?.progress?.(undefined, text); }
      });
      state = result.state;
      return true;
    }

'''
text = replace_between(text, '    async function runCalculation({ runId, onProgress } = {}) {', '    async function searchDerivatives()', run_replacement, 'production runCalculation')
search_replacement = r'''    async function searchDerivatives() {
      const runId = nextRunId();
      resetRunDiagnostics(runId);
      try {
        await runCalculation({ runId });
      } catch (error) {
        if (isAbortError(error, currentRunSignal()) || !isCurrentRun(runId)) return;
        console.error(error);
      }
    }

'''
text = replace_between(text, '    async function searchDerivatives()', '    function scoringCandidates', search_replacement, 'production searchDerivatives')
# Persist parser metadata in JSON-card evidence.
old = r'''          code: item.code,
          word: item.word,
          final_score: item.final_score,
'''
new = r'''          code: item.code,
          word: item.word,
          parser_version: item.parser_version || item.morpheme_analysis?.parser_version || null,
          model_key: item.model_key || item.model_family_key || null,
          model_label: item.model_label || item.model || null,
          final_score: item.final_score,
'''
text = replace_once(text, old, new, 'json card parser fields')
# Expose audit diagnostics.
old = r'''        targetTranslationRequestCount: 0,
        durationByStage: {},
'''
new = r'''        targetTranslationRequestCount: 0,
        candidateAuditSuggestedCount: 0,
        candidateAuditDuplicateWordCount: 0,
        candidateAuditDuplicateModelCount: 0,
        candidateAuditLocallyMissingCount: 0,
        candidateAuditVerifiedNewModelCount: 0,
        candidateAuditRejectedInvalidCount: 0,
        candidateAuditStatus: null,
        candidateAuditBackendErrorCode: null,
        durationByStage: {},
'''
text = replace_once(text, old, new, 'audit diagnostics defaults')
old = r'''        targetTranslationRequestCount: run.targetTranslationRequestCount,
        durationByStage: run.durationByStage,
'''
new = r'''        targetTranslationRequestCount: run.targetTranslationRequestCount,
        candidateAuditSuggestedCount: run.candidateAuditSuggestedCount,
        candidateAuditDuplicateWordCount: run.candidateAuditDuplicateWordCount,
        candidateAuditDuplicateModelCount: run.candidateAuditDuplicateModelCount,
        candidateAuditLocallyMissingCount: run.candidateAuditLocallyMissingCount,
        candidateAuditVerifiedNewModelCount: run.candidateAuditVerifiedNewModelCount,
        candidateAuditRejectedInvalidCount: run.candidateAuditRejectedInvalidCount,
        candidateAuditStatus: run.candidateAuditStatus,
        candidateAuditBackendErrorCode: run.candidateAuditBackendErrorCode,
        durationByStage: run.durationByStage,
'''
text = replace_once(text, old, new, 'audit diagnostics snapshot')
write(path, text)

# Bust module cache.
path = 'associativvordes/index.html'
text = read(path)
text = replace_once(text, '<script type="module" src="./script.js?v=associative-index-runtime-20260716-1"></script>', '<script type="module" src="./script.js?v=associative-production-hardening-20260721-1"></script>', 'script cache version')
write(path, text)

print('Applied associative core hardening.')
