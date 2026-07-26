import { API_CONFIG } from './swow-client.js';
import { buildSearchForm } from './search-normalizer.js';
import { lexicalModelDescriptor, compareFrequencyRepresentatives, compareRootMatchThenFrequency } from './candidate-model-family.js';
import { MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE } from './associative-state.js';

export const ASSOCIATION_SCORE_WEIGHTS = {
  directness: 0.45,
  field_relatedness: 0.35,
  inverse_domain_shift: 0.20
};

export const FINAL_SCORE_WEIGHTS = {
  frequency_score: 0.35,
  association_score: 0.65
};

export const QWEN_RUNTIME_CONFIG = {
  enableCandidateGeneration: true,
  enableReviewModel: true,
  maxCandidatesPerLanguage: Infinity,
  autoAnalyzeCandidatesPerLanguage: MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE,
  maxGeneratedCandidatesPerLanguage: 2,
  maxKnownCandidateWordsPerLanguage: 120,
  maxConcurrentQwenRequests: 1,
  maxReviewRequestsPerSearch: Infinity,
  requestTimeoutMs: 15000,
  candidateRequestTimeoutMs: 70000,
  supplementalAnalysisTimeoutMs: 30000
};

export function createReviewBudget({ enabled = true, maxRequests = Infinity } = {}) {
  const finiteMax = Number(maxRequests);
  const limit = maxRequests === Infinity ? Infinity : Math.max(0, Number.isFinite(finiteMax) ? Math.floor(finiteMax) : 0);
  const state = { used: 0 };
  return {
    enabled: enabled === true && limit !== 0,
    limit,
    canRequest() { return this.enabled && (limit === Infinity || state.used < limit); },
    reserve() { if (!this.canRequest()) return false; state.used += 1; return true; },
    releaseOnAbort() {},
    get used() { return state.used; },
    get remaining() { return limit === Infinity ? Infinity : Math.max(0, limit - state.used); }
  };
}

export const QWEN_ERROR_CODES = Object.freeze({
  HTTP_ERROR: 'QWEN_HTTP_ERROR',
  TIMEOUT: 'QWEN_TIMEOUT',
  INVALID_RESPONSE: 'QWEN_INVALID_RESPONSE',
  SEMANTIC_SCORES_INVALID: 'QWEN_SEMANTIC_SCORES_INVALID',
  ABORTED: 'QWEN_ABORTED',
  BACKEND_ERROR: 'QWEN_BACKEND_ERROR',
  REVIEW_FAILED: 'QWEN_REVIEW_FAILED',
  CANDIDATE_GENERATION_FAILED: 'QWEN_CANDIDATE_GENERATION_FAILED'
});


export function isAbortError(error, signal) {
  return Boolean(
    signal?.aborted
    || error?.name === 'AbortError'
    || error?.code === QWEN_ERROR_CODES.ABORTED
    || error?.code === 'ABORTED'
    || error?.code === 'TARGET_TRANSLATION_ABORTED'
    || error?.code === 'CANDIDATE_INDEX_ABORTED'
    || error instanceof DOMException && error.name === 'AbortError'
    || error?.cause?.name === 'AbortError'
    || error?.cause?.code === QWEN_ERROR_CODES.ABORTED
    || error?.cause?.code === 'ABORTED'
  );
}

export function normalizeAbortError(error, { stage, runId } = {}) {
  const abort = new Error(error?.message || 'Operation aborted.');
  abort.name = 'AbortError';
  abort.code = 'ABORTED';
  if (stage != null) abort.stage = stage;
  if (runId != null) abort.runId = runId;
  if (error != null) abort.cause = error;
  return abort;
}

export function throwIfAbortError(error, { signal, stage, runId } = {}) {
  if (isAbortError(error, signal)) throw normalizeAbortError(error, { stage, runId });
}

export class QwenClientError extends Error {
  constructor(code, message, { status, details, cause } = {}) {
    super(message);
    this.name = 'QwenClientError';
    this.code = code;
    if (status != null) this.status = status;
    if (details != null) this.details = details;
    if (cause != null) this.cause = cause;
  }
}

function qwenError(code, message, options) {
  return new QwenClientError(code, message, options);
}

export function qwenFallback() {
  return {
    directness: null,
    field_relatedness: null,
    domain_shift: null,
    short_explanation: 'Qwen evaluation unavailable'
  };
}

export function getInterfaceLanguage() {
  return document.documentElement.lang?.startsWith('en') ? 'en' : 'ru';
}

export function buildQwenAssociationPrompt({ language, targetMeaning, word, swow, primary, review = false }) {
  return {
    input: { language, targetMeaning, word, swow, primary, review },
    system: 'You are a lexical association evaluator for an international auxiliary language project. Evaluate semantic association between target meaning and associative word. Do not generate candidate words. Do not evaluate the constructed Interal candidate form. Return only valid JSON. Use 0–100 integer scores. directness = how directly the word points to the target meaning. field_relatedness = how strongly the word belongs to the same semantic field as the target meaning. domain_shift = how strongly the word\'s modern meaning belongs to a different competing domain.',
    user: `Language: ${language}\nTarget meaning: ${targetMeaning}\nAssociative word: ${word}\nSWOW evidence: ${JSON.stringify(swow || {})}\nReview mode: ${review ? 'true' : 'false'}\nPrimary evaluation: ${JSON.stringify(primary || null)}\n\nReturn JSON:\n{\n  "word": "...",\n  "target_meaning": "...",\n  "directness": 0-100,\n  "field_relatedness": 0-100,\n  "domain_shift": 0-100,\n  "responseLanguage": "...",\n  "short_explanation": "..."\n}`
  };
}

function clampIntegerOrNull(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function extractJsonText(raw) {
  if (typeof raw !== 'string') return raw;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1].trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end > start) return raw.slice(start, end + 1);
  return raw.trim();
}

function parseQwenPayload(payload) {
  const raw = payload?.analysis ?? payload?.choices?.[0]?.message?.content ?? payload?.content ?? payload?.text ?? payload;
  let object;
  try {
    object = typeof raw === 'string' ? JSON.parse(extractJsonText(raw)) : raw;
  } catch (_error) {
    throw qwenError(QWEN_ERROR_CODES.INVALID_RESPONSE, 'Qwen returned invalid JSON.', { details: String(raw).slice(0, 500), cause: _error });
  }
  if (!object || typeof object !== 'object') throw qwenError(QWEN_ERROR_CODES.INVALID_RESPONSE, 'Qwen response is not an object.');
  const parsed = {
    word: object.word,
    target_meaning: object.target_meaning,
    directness: clampIntegerOrNull(object.directness),
    field_relatedness: clampIntegerOrNull(object.field_relatedness),
    domain_shift: clampIntegerOrNull(object.domain_shift),
    responseLanguage: object.responseLanguage || '',
    short_explanation: object.short_explanation || object.explanation || '',
    model: payload?.model || payload?.kind || ''
  };
  if (parsed.directness == null || parsed.field_relatedness == null || parsed.domain_shift == null) {
    throw qwenError(QWEN_ERROR_CODES.SEMANTIC_SCORES_INVALID, 'Qwen semantic scores are invalid.', { details: object });
  }
  return parsed;
}

async function callQwen(prompt, { review = false, signal } = {}) {
  if (signal?.aborted) throw normalizeAbortError(signal.reason, { stage: review ? 'review_qwen' : 'primary_qwen' });
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(new Error('Qwen request timeout')), QWEN_RUNTIME_CONFIG.requestTimeoutMs);
  const abortController = new AbortController();
  const abort = () => abortController.abort(signal?.reason);
  if (signal) signal.addEventListener('abort', abort, { once: true });
  const timeoutAbort = () => abortController.abort(timeoutController.signal.reason);
  timeoutController.signal.addEventListener('abort', timeoutAbort, { once: true });
  let res;
  try {
    res = await fetch(API_CONFIG.qwenAssociationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: 'associative_word_score',
        interfaceLanguage: getInterfaceLanguage(),
        payload: {
          language: prompt.input?.language,
          targetMeaning: prompt.input?.targetMeaning,
          word: prompt.input?.word,
          swow: prompt.input?.swow,
          review,
          primary: prompt.input?.primary || null
        }
      }),
      signal: abortController.signal
    });
  } catch (error) {
    if (timeoutController.signal.aborted) throw qwenError(QWEN_ERROR_CODES.TIMEOUT, 'Qwen request timed out.', { cause: error });
    if (signal?.aborted || isAbortError(error)) throw normalizeAbortError(error, { stage: review ? 'review_qwen' : 'primary_qwen' });
    throw qwenError(QWEN_ERROR_CODES.HTTP_ERROR, 'Qwen request failed.', { cause: error });
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener?.('abort', abort);
    timeoutController.signal.removeEventListener('abort', timeoutAbort);
  }
  if (!res.ok) {
    let details = '';
    try {
      const errorPayload = await res.json();
      details = errorPayload.details || errorPayload.error || JSON.stringify(errorPayload);
    } catch {}
    throw qwenError(QWEN_ERROR_CODES.HTTP_ERROR, 'Qwen HTTP error.', { status: res.status, details });
  }
  const payload = await res.json().catch(error => { throw qwenError(QWEN_ERROR_CODES.INVALID_RESPONSE, 'Qwen returned invalid JSON.', { cause: error }); });
  if (payload?.ok === false || payload?.errorCode) throw qwenError(payload.errorCode || QWEN_ERROR_CODES.BACKEND_ERROR, 'Qwen backend error.', { details: payload });
  return payload;
}

export async function getQwenAssociationScores({ language, targetMeaning, word, swow, review = false, primary = null, signal } = {}) {
  const prompt = buildQwenAssociationPrompt({ language, targetMeaning, word, swow, primary, review });
  const fallbackModel = review ? API_CONFIG.qwenReviewModel : API_CONFIG.qwenPrimaryModel;
  const parsed = parseQwenPayload(await callQwen(prompt, {
    review,
    signal
  }));
  return { ...parsed, model: parsed.model || fallbackModel };
}

const CONTROL_LANGUAGE_CODES = Object.freeze(['en', 'de', 'fr', 'es', 'it', 'ru']);
const QWEN_CANDIDATE_DECISIONS = new Set(['keep', 'remove_duplicate', 'remove_irrelevant', 'remove_wrong_language']);
const QWEN_CANDIDATE_CHECKS = Object.freeze([
  'language_match',
  'dictionary_lemma',
  'root_relation',
  'semantic_relevance',
  'distinct_model'
]);
const REQUIRED_QWEN_CANDIDATE_CHECKS = Object.freeze([
  'language_match',
  'dictionary_lemma',
  'root_relation',
  'distinct_model'
]);

function normalizeCandidateWord(value, maxLength = 80) {
  const word = typeof value === 'string' ? value.trim().normalize('NFC') : '';
  return word && word.length <= maxLength && !/[\r\n]/.test(word) ? word : '';
}

function normalizeCandidateChecks(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const checks = {};
  for (const key of QWEN_CANDIDATE_CHECKS) {
    if (typeof value[key] !== 'boolean') return null;
    checks[key] = value[key];
  }
  return checks;
}

function normalizedValidationDecision(rawDecision, checks) {
  if (!checks) return '';
  if (checks.language_match === false) return 'remove_wrong_language';
  const decision = String(rawDecision || '').trim().toLowerCase();
  if (!QWEN_CANDIDATE_DECISIONS.has(decision)) return '';
  if (decision === 'keep' && REQUIRED_QWEN_CANDIDATE_CHECKS.some(key => checks[key] !== true)) return 'remove_irrelevant';
  if (
    decision === 'remove_irrelevant'
    && REQUIRED_QWEN_CANDIDATE_CHECKS.every(key => checks[key] === true)
    && checks.semantic_relevance === false
  ) return 'keep';
  return decision;
}

export function normalizeQwenCandidateSuggestions(payload, languages = CONTROL_LANGUAGE_CODES, maxPerLanguage = QWEN_RUNTIME_CONFIG.maxGeneratedCandidatesPerLanguage) {
  const source = payload?.candidates && typeof payload.candidates === 'object' ? payload.candidates : {};
  const output = {};
  for (const language of languages) {
    output[language] = [];
    for (const raw of Array.isArray(source[language]) ? source[language] : []) {
      const item = typeof raw === 'string' ? { word: raw } : raw;
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const word = normalizeCandidateWord(item.word);
      const rootVariant = normalizeCandidateWord(item.root_variant ?? item.rootVariant, 40);
      if (!word || !rootVariant) continue;
      output[language].push({ word, root_variant: rootVariant });
      if (output[language].length >= Math.max(0, Number(maxPerLanguage) || 0)) break;
    }
  }
  return output;
}

export function normalizeQwenCandidateValidation(payload, currentTopModels = {}, languages = CONTROL_LANGUAGE_CODES) {
  const source = payload?.candidateValidation && typeof payload.candidateValidation === 'object'
    ? payload.candidateValidation
    : (payload?.validation && typeof payload.validation === 'object' ? payload.validation : {});
  const output = {};

  for (const language of languages) {
    const top = Array.isArray(currentTopModels[language]) ? currentTopModels[language] : [];
    if (!top.length) {
      output[language] = [];
      continue;
    }

    const topByWord = new Map(top.map(item => [buildSearchForm(item?.word), item]).filter(([key]) => Boolean(key)));
    const values = source[language];
    if (!Array.isArray(values) || topByWord.size !== top.length) {
      output[language] = null;
      continue;
    }

    const decisions = new Map();
    let invalid = false;
    for (const raw of values) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { invalid = true; break; }
      const word = normalizeCandidateWord(raw.word);
      const key = buildSearchForm(word);
      const checks = normalizeCandidateChecks(raw.checks);
      const decision = normalizedValidationDecision(raw.decision, checks);
      const sameModelAs = normalizeCandidateWord(raw.same_model_as ?? raw.sameModelAs);
      const canonicalLexeme = normalizeCandidateWord(raw.canonical_lexeme ?? raw.canonicalLexeme) || (decision === 'keep' ? word : '');
      const reason = normalizeCandidateWord(raw.reason, 240);
      if (!key || !topByWord.has(key) || decisions.has(key) || !QWEN_CANDIDATE_DECISIONS.has(decision)) {
        invalid = true;
        break;
      }
      if (decision === 'remove_duplicate' && (!sameModelAs || checks?.distinct_model !== false)) {
        invalid = true;
        break;
      }
      decisions.set(key, {
        word: topByWord.get(key).word,
        decision,
        checks,
        ...(sameModelAs ? { same_model_as: sameModelAs } : {}),
        ...(canonicalLexeme ? { canonical_lexeme: canonicalLexeme } : {}),
        ...(reason ? { reason } : {})
      });
    }

    if (invalid || decisions.size !== topByWord.size) {
      output[language] = null;
      continue;
    }

    for (const item of decisions.values()) {
      if (item.decision !== 'remove_duplicate') continue;
      const targetKey = buildSearchForm(item.same_model_as);
      const target = decisions.get(targetKey);
      const removedCandidate = topByWord.get(buildSearchForm(item.word));
      const retainedCandidate = topByWord.get(targetKey);
      const removedFrequency = Number(removedCandidate?.F ?? removedCandidate?.frequency_score);
      const retainedFrequency = Number(retainedCandidate?.F ?? retainedCandidate?.frequency_score);
      if (!targetKey || targetKey === buildSearchForm(item.word) || target?.decision !== 'keep') {
        invalid = true;
        break;
      }
      if (Number.isFinite(removedFrequency) && Number.isFinite(retainedFrequency) && retainedFrequency < removedFrequency) {
        invalid = true;
        break;
      }
      item.same_model_as = target.word;
      item.canonical_lexeme = target.canonical_lexeme;
    }

    output[language] = invalid
      ? null
      : top.map(item => decisions.get(buildSearchForm(item.word)));
  }

  return output;
}

function qwenCandidateGenerationUrl() {
  return globalThis.location?.hostname === 'landquart.github.io'
    ? 'https://interal.vercel.app/api/qwen-candidates'
    : '/api/qwen-candidates';
}

export async function getQwenCandidateSuggestions({ root, targetMeaning, currentTopModels = {}, knownCandidates = {}, knownModelKeys = {}, validationStage = 'initial', signal } = {}) {
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
      body: JSON.stringify({ root, targetMeaning, currentTopModels, knownCandidates, knownModelKeys, validationStage, interfaceLanguage: getInterfaceLanguage() }),
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
    validation: normalizeQwenCandidateValidation(payload, currentTopModels),
    auditStatus: audit.status || 'completed',
    auditError: audit.error || null,
    model: audit.model || payload.model || null,
    guaranteedCandidates: payload.guaranteedCandidates || {},
    qwenCandidates: payload.qwenCandidates || {}
  };
}

function hasFiniteScore(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function candidateFinalScore(candidate) {
  const direct = Number(candidate?.final_score);
  if (Number.isFinite(direct)) return direct;
  const nested = Number(candidate?.analysis?.final_score);
  return Number.isFinite(nested) ? nested : null;
}

function candidateFrequencyScore(candidate) {
  const values = [candidate?.frequency_score, candidate?.analysis?.frequency?.frequency_score, candidate?.frequencyProfile?.frequency_score];
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return Number.NEGATIVE_INFINITY;
}

export function compareFinalModelCandidates(left, right) {
  return compareRootMatchThenFrequency(left, right);
}

export function selectBestFinalModels(candidates, limit = MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE) {
  const representatives = new Map();
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    if (candidate?.automatic_selection_eligible === false) continue;
    if (!hasFiniteScore(candidateFrequencyScore(candidate))) continue;
    const key = String(candidate?.model_key || candidate?.model_family_key || candidate?.model || buildSearchForm(candidate?.word));
    if (!key) continue;
    const current = representatives.get(key);
    if (!current || compareFinalModelCandidates(candidate, current) < 0) representatives.set(key, candidate);
  }
  return [...representatives.values()]
    .sort(compareFinalModelCandidates)
    .slice(0, Math.max(0, Number(limit) || 0));
}

export function finalizeCandidateOrdering(candidates, limit = MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE) {
  const source = Array.isArray(candidates) ? candidates : [];
  const best = selectBestFinalModels(source, limit);
  const selected = new Set(best.map(candidateIdentity));
  const remaining = source.filter(candidate => !selected.has(candidateIdentity(candidate)));
  return [...best, ...remaining].map(candidate => ({
    ...candidate,
    selected: selected.has(candidateIdentity(candidate))
  }));
}

function stateCandidateHasQwen(candidate) {
  return hasFiniteScore(candidate?.analysis?.association?.association_score)
    || hasFiniteScore(candidate?.association_score)
    || candidate?.analysisStatus === 'analyzing';
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function modelForGeneratedCandidate(entry, suggestion, canonicalRoot, language) {
  const searchForm = entry.search_form || entry.word;
  const variant = suggestion.root_variant || canonicalRoot;
  const variantIndex = buildSearchForm(searchForm).indexOf(buildSearchForm(variant));
  const match = { type: 'special', distance: 0, similarity: 1, fragment: buildSearchForm(variant), index: Math.max(0, variantIndex) };
  return lexicalModelDescriptor({ ...entry, match }, canonicalRoot, language, suggestion.elementType || 'root');
}

export async function verifySuggestionInLocalIndex(loader, language, suggestion, signal) {
  const requested = buildSearchForm(suggestion.word);
  if (!requested) return null;
  const entries = await loader.loadCandidateEntries(language, suggestion.word, { signal });
  return entries.find(entry => buildSearchForm(entry.word) === requested || buildSearchForm(entry.normalized) === requested) || null;
}

function candidateIdentity(candidate) {
  return `${String(candidate?.model_key || candidate?.model_family_key || candidate?.model || '')}|${buildSearchForm(candidate?.word)}`;
}


function compactCandidateEvidence(candidate, index) {
  const evidence = {
    word: candidate.word,
    model_key: candidate.model_key || candidate.model_family_key || candidate.model || '',
    F: candidateFrequencyScore(candidate),
    rank: candidate.rank ?? index + 1
  };
  const associationScore = Number(candidate?.association_score ?? candidate?.analysis?.association?.association_score);
  const finalScore = candidateFinalScore(candidate);
  if (Number.isFinite(associationScore)) evidence.association_score = associationScore;
  if (Number.isFinite(finalScore)) evidence.final_score = finalScore;
  if (candidate?.match?.type === 'exact') evidence.root_match_type = 'exact';
  return evidence;
}

export function buildQwenCandidateAuditPayload(candidatesByLanguage = {}, languages = CONTROL_LANGUAGE_CODES, limit = QWEN_RUNTIME_CONFIG.maxKnownCandidateWordsPerLanguage) {
  const wordLimit = Math.max(0, Number(limit) || 0);
  const currentTopModels = {};
  const knownCandidates = {};
  const knownModelKeys = {};
  for (const language of languages) {
    const source = Array.isArray(candidatesByLanguage[language]) ? candidatesByLanguage[language] : [];
    const sorted = source.slice().sort(compareFrequencyRepresentatives);
    currentTopModels[language] = selectBestFinalModels(source, MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE).map(compactCandidateEvidence);
    const seenWords = new Set();
    knownCandidates[language] = [];
    for (const candidate of sorted) {
      const key = buildSearchForm(candidate.word);
      if (!key || seenWords.has(key)) continue;
      seenWords.add(key);
      if (knownCandidates[language].length < wordLimit) knownCandidates[language].push(compactCandidateEvidence(candidate, knownCandidates[language].length));
    }
    knownModelKeys[language] = [...new Set(source.map(candidate => String(candidate?.model_key || candidate?.model_family_key || candidate?.model || '').trim()).filter(Boolean))];
  }
  return { currentTopModels, knownCandidates, knownModelKeys };
}

export function createQwenCandidateAuditDiagnostics() {
  return {
    suggestedCount: 0,
    duplicateWordCount: 0,
    duplicateModelCount: 0,
    locallyMissingCount: 0,
    verifiedNewModelCount: 0,
    rejectedInvalidCount: 0,
    auditRetryCount: 0,
    validatedLanguageCount: 0,
    validationIncompleteLanguageCount: 0,
    validationKeptCount: 0,
    validationRemovedDuplicateCount: 0,
    validationRemovedIrrelevantCount: 0,
    validationRemovedWrongLanguageCount: 0,
    validationCanonicalDuplicateCount: 0,
    validationFailClosedCount: 0,
    validationIncompleteLanguages: [],
    validationFailClosedLanguages: [],
    status: 'pending',
    model: null,
    usedGuaranteedFallback: false,
    backendErrorCode: null,
    backendErrorDetails: null
  };
}

export function applyQwenCandidateValidation(
  candidatesByLanguage = {},
  validation = {},
  currentTopModels = {},
  languages = CONTROL_LANGUAGE_CODES,
  { failClosed = false, validationField = 'qwen_candidate_validation' } = {}
) {
  const output = {};
  const diagnostics = {
    validatedLanguageCount: 0,
    validationIncompleteLanguageCount: 0,
    validationKeptCount: 0,
    validationRemovedDuplicateCount: 0,
    validationRemovedIrrelevantCount: 0,
    validationRemovedWrongLanguageCount: 0,
    validationCanonicalDuplicateCount: 0,
    validationFailClosedCount: 0,
    validationIncompleteLanguages: [],
    validationFailClosedLanguages: []
  };

  for (const language of languages) {
    const candidates = Array.isArray(candidatesByLanguage[language]) ? candidatesByLanguage[language] : [];
    const top = Array.isArray(currentTopModels[language]) ? currentTopModels[language] : [];
    const decisions = validation?.[language];
    if (!top.length) {
      output[language] = candidates.slice();
      continue;
    }
    if (!Array.isArray(decisions) || decisions.length !== top.length) {
      diagnostics.validationIncompleteLanguageCount += 1;
      diagnostics.validationIncompleteLanguages.push(language);
      if (failClosed) diagnostics.validationFailClosedLanguages.push(language);
      output[language] = candidates.map(candidate => {
        if (!failClosed) return { ...candidate };
        diagnostics.validationFailClosedCount += candidate?.selected || candidate?.automatic_selection_eligible !== false ? 1 : 0;
        return {
          ...candidate,
          automatic_selection_eligible: false,
          selected: false,
          [validationField]: { decision: 'unvalidated', reason: 'incomplete_qwen_validation' }
        };
      });
      continue;
    }

    const byWord = new Map(decisions.map(item => [buildSearchForm(item?.word), item]).filter(([key]) => Boolean(key)));
    if (byWord.size !== top.length || top.some(item => !byWord.has(buildSearchForm(item?.word)))) {
      diagnostics.validationIncompleteLanguageCount += 1;
      diagnostics.validationIncompleteLanguages.push(language);
      if (failClosed) diagnostics.validationFailClosedLanguages.push(language);
      output[language] = candidates.map(candidate => {
        if (!failClosed) return { ...candidate };
        diagnostics.validationFailClosedCount += candidate?.selected || candidate?.automatic_selection_eligible !== false ? 1 : 0;
        return {
          ...candidate,
          automatic_selection_eligible: false,
          selected: false,
          [validationField]: { decision: 'unvalidated', reason: 'mismatched_qwen_validation' }
        };
      });
      continue;
    }

    diagnostics.validatedLanguageCount += 1;
    for (const decision of decisions) {
      if (decision.decision === 'keep') diagnostics.validationKeptCount += 1;
      else if (decision.decision === 'remove_duplicate') diagnostics.validationRemovedDuplicateCount += 1;
      else if (decision.decision === 'remove_irrelevant') diagnostics.validationRemovedIrrelevantCount += 1;
      else if (decision.decision === 'remove_wrong_language') diagnostics.validationRemovedWrongLanguageCount += 1;
    }

    const validated = candidates.map(candidate => {
      const decision = byWord.get(buildSearchForm(candidate?.word));
      if (!decision) return { ...candidate, automatic_selection_eligible: false };
      return {
        ...candidate,
        automatic_selection_eligible: candidate?.automatic_selection_eligible !== false && decision.decision === 'keep',
        selected: Boolean(candidate?.selected) && candidate?.automatic_selection_eligible !== false && decision.decision === 'keep',
        [validationField]: { ...decision }
      };
    });

    const canonicalRepresentatives = new Map();
    for (const candidate of validated) {
      if (candidate.automatic_selection_eligible === false) continue;
      const canonical = buildSearchForm(candidate?.[validationField]?.canonical_lexeme);
      if (!canonical) continue;
      const current = canonicalRepresentatives.get(canonical);
      if (!current || compareFinalModelCandidates(candidate, current) < 0) canonicalRepresentatives.set(canonical, candidate);
    }
    output[language] = validated.map(candidate => {
      if (candidate.automatic_selection_eligible === false) return candidate;
      const canonical = buildSearchForm(candidate?.[validationField]?.canonical_lexeme);
      const representative = canonical && canonicalRepresentatives.get(canonical);
      if (!representative || candidateIdentity(representative) === candidateIdentity(candidate)) return candidate;
      diagnostics.validationCanonicalDuplicateCount += 1;
      diagnostics.validationRemovedDuplicateCount += 1;
      diagnostics.validationKeptCount = Math.max(0, diagnostics.validationKeptCount - 1);
      return {
        ...candidate,
        automatic_selection_eligible: false,
        selected: false,
        [validationField]: {
          ...candidate[validationField],
          decision: 'remove_duplicate',
          same_model_as: representative.word,
          reason: candidate[validationField]?.reason || 'canonical_lexeme_duplicate'
        }
      };
    });
  }

  return { candidatesByLanguage: output, diagnostics };
}

function currentModelEvidence(snapshot) {
  return Object.fromEntries(CONTROL_LANGUAGE_CODES.map(language => {
    const candidates = snapshot?.state?.languages?.[language] || [];
    const selected = candidates.filter(candidate => candidate.selected && hasFiniteScore(candidateFrequencyScore(candidate)));
    const best = selectBestFinalModels(selected.length ? selected : candidates, MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE);
    return [language, best.map(candidate => ({
      word: candidate.word,
      model_key: candidate.model_key || candidate.model_family_key || candidate.model || '',
      frequency_score: candidateFrequencyScore(candidate),
      association_score: Number(candidate?.association_score ?? candidate?.analysis?.association?.association_score),
      final_score: candidateFinalScore(candidate)
    }))];
  }));
}

async function waitForCandidateAnalysis(language, word, tokenIsCurrent) {
  const deadline = Date.now() + QWEN_RUNTIME_CONFIG.supplementalAnalysisTimeoutMs;
  while (Date.now() < deadline && tokenIsCurrent()) {
    await delay(250);
    const index = window.InteralAssociativeModels?.findIndexByWord?.(language, word) ?? -1;
    const candidate = index >= 0 ? window.InteralAssociativeModels?.candidateAt?.(language, index) : null;
    if (!candidate) continue;
    if (hasFiniteScore(candidateFinalScore(candidate))) return candidate;
    if (candidate.analysisStatus === 'error' || candidate.analysis?.status === 'error') return null;
  }
  return null;
}

function runtimeCandidates(language) {
  const candidates = window.InteralAssociativeModels?.allCandidates?.(language);
  return Array.isArray(candidates) ? candidates : null;
}

function verifiedCandidatePatch(suggestion, entry, root, descriptor, { resetAnalysis = false } = {}) {
  const searchForm = entry.search_form || buildSearchForm(entry.word);
  const variant = buildSearchForm(suggestion.root_variant || root);
  const variantIndex = variant ? searchForm.indexOf(variant) : -1;
  const fragment = variantIndex >= 0 ? variant : buildSearchForm(suggestion.word);
  const match = { type: 'special', distance: 0, similarity: 1, fragment, index: Math.max(0, variantIndex) };
  const frequencyProfile = {
    frequency_score: entry.frequency_score,
    category_breakdown: entry.category_breakdown || {},
    rank: entry.rank ?? null,
    sources: Array.isArray(entry.sources) ? entry.sources : [],
    warnings: []
  };
  const patch = {
    ...entry,
    word: entry.word,
    normalized: entry.normalized || entry.word,
    search_form: searchForm,
    match,
    rank: entry.rank ?? null,
    category_breakdown: entry.category_breakdown || {},
    sources: Array.isArray(entry.sources) ? entry.sources : [],
    frequencyProfile,
    warnings: [...new Set([...(Array.isArray(entry.warnings) ? entry.warnings : []), 'qwen_suggestion_verified_in_local_index'])],
    automatic_selection_eligible: true,
    qwen_candidate_validation: { word: entry.word, decision: 'keep', reason: 'verified_qwen_suggestion' },
    model_key: descriptor.key,
    model_family_key: descriptor.key,
    model: descriptor.label,
    model_label: descriptor.label,
    morpheme_analysis: descriptor.analysis,
    parser_version: descriptor.analysis?.parser_version || null
  };
  if (resetAnalysis) {
    Object.assign(patch, {
      analysis: null,
      analysisStatus: 'pending',
      association_score: null,
      final_score: null,
      selected: false
    });
  }
  return patch;
}

function applyVerifiedCandidateData(language, index, suggestion, entry, root, descriptor, options) {
  const candidates = runtimeCandidates(language);
  const current = candidates?.[index];
  if (!current) return null;
  Object.assign(current, verifiedCandidatePatch(suggestion, entry, root, descriptor, options));
  return current;
}

async function analyzeRuntimeCandidate(language, index, word, tokenIsCurrent) {
  if (!Number.isInteger(index) || index < 0 || !tokenIsCurrent()) return null;
  const current = runtimeCandidates(language)?.[index];
  if (!current) return null;
  if (!hasFiniteScore(candidateFinalScore(current))) await window.analyzeItem(language, index);
  return await waitForCandidateAnalysis(language, word || current.word, tokenIsCurrent);
}

async function addVerifiedCandidateToRuntime(language, suggestion, entry, root, tokenIsCurrent) {
  const descriptor = modelForGeneratedCandidate(entry, suggestion, root, language);
  const proposed = verifiedCandidatePatch(suggestion, entry, root, descriptor);
  const exactIndex = window.InteralAssociativeModels?.findIndexByWord?.(language, entry.word) ?? -1;
  if (exactIndex >= 0) {
    applyVerifiedCandidateData(language, exactIndex, suggestion, entry, root, descriptor, { resetAnalysis: false });
    return await analyzeRuntimeCandidate(language, exactIndex, entry.word, tokenIsCurrent);
  }

  const modelIndex = window.InteralAssociativeModels?.findIndexByModel?.(language, descriptor.key) ?? -1;
  if (modelIndex >= 0) {
    const existing = runtimeCandidates(language)?.[modelIndex];
    if (existing && compareFinalModelCandidates(proposed, existing) < 0) {
      applyVerifiedCandidateData(language, modelIndex, suggestion, entry, root, descriptor, { resetAnalysis: true });
      return await analyzeRuntimeCandidate(language, modelIndex, entry.word, tokenIsCurrent);
    }
    return await analyzeRuntimeCandidate(language, modelIndex, existing?.word, tokenIsCurrent);
  }

  if (!tokenIsCurrent()) return null;
  const candidates = runtimeCandidates(language);
  if (!candidates) return null;
  candidates.push(verifiedCandidatePatch(suggestion, entry, root, descriptor, { resetAnalysis: true }));
  const index = candidates.length - 1;
  return await analyzeRuntimeCandidate(language, index, entry.word, tokenIsCurrent);
}

function rebalanceSelectedModels(originalUpdateItem) {
  let renderTarget = null;
  for (const language of CONTROL_LANGUAGE_CODES) {
    const candidates = runtimeCandidates(language);
    if (!candidates?.length) continue;
    const finalized = finalizeCandidateOrdering(candidates, MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE);
    candidates.splice(0, candidates.length, ...finalized);
    renderTarget ||= [language, 0];
  }
  if (!renderTarget) return;
  const [language, index] = renderTarget;
  const candidate = runtimeCandidates(language)?.[index];
  if (candidate) originalUpdateItem(language, index, 'selected', Boolean(candidate.selected));
}

export async function refineCandidatesWithQwenAudit({ root, targetMeaning, candidatesByLanguage = {}, loader, signal, onProgress, onWarning, languages = CONTROL_LANGUAGE_CODES, elementType = 'root' } = {}) {
  const output = Object.fromEntries(languages.map(language => [language, Array.isArray(candidatesByLanguage[language]) ? candidatesByLanguage[language].slice() : []]));
  if (!QWEN_RUNTIME_CONFIG.enableCandidateGeneration || !loader || !root) return { candidatesByLanguage: output, warnings: [] };

  const { currentTopModels, knownCandidates, knownModelKeys } = buildQwenCandidateAuditPayload(output, languages);
  const knownWordSets = Object.fromEntries(languages.map(language => [language, new Set((output[language] || []).map(candidate => buildSearchForm(candidate.word)).filter(Boolean))]));
  const knownModelSets = Object.fromEntries(languages.map(language => [language, new Set((knownModelKeys[language] || []).filter(Boolean))]));
  const diagnostics = createQwenCandidateAuditDiagnostics();
  const warnings = [];
  let suggestions;
  let validation;
  try {
    onProgress?.(getInterfaceLanguage() === 'en' ? 'Qwen3-235B: candidate audit...' : 'Qwen3-235B: аудит кандидатов...');
    const auditResponse = await getQwenCandidateSuggestions({ root, targetMeaning: targetMeaning || root, currentTopModels, knownCandidates, knownModelKeys, signal });
    suggestions = auditResponse.suggestions;
    validation = auditResponse.validation;
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
  } catch (error) {
    throwIfAbortError(error, { signal, stage: 'candidate_audit' });
    const warning = 'qwen_candidate_audit_unavailable';
    warnings.push(warning);
    onWarning?.(warning, error);
    return { candidatesByLanguage: output, warnings };
  }

  const validationResult = applyQwenCandidateValidation(output, validation, currentTopModels, languages);
  for (const language of languages) output[language] = validationResult.candidatesByLanguage[language] || [];
  Object.assign(diagnostics, validationResult.diagnostics);
  if (diagnostics.validationIncompleteLanguageCount > 0 && !diagnostics.backendErrorCode) {
    const warning = 'qwen_candidate_validation_incomplete';
    warnings.push(warning);
    onWarning?.(warning, { incompleteLanguages: diagnostics.validationIncompleteLanguageCount });
  }

  for (const language of languages) {
    const seen = knownWordSets[language] || new Set();
    const models = knownModelSets[language] || new Set();
    const processed = new Set();
    for (const suggestion of suggestions?.[language] || []) {
      diagnostics.suggestedCount += 1;
      if (signal?.aborted) throw normalizeAbortError(signal.reason, { stage: 'candidate_verification' });
      const key = buildSearchForm(suggestion.word);
      if (!key) { diagnostics.rejectedInvalidCount += 1; continue; }
      if (processed.has(key) || seen.has(key)) { diagnostics.duplicateWordCount += 1; continue; }
      processed.add(key);
      try {
        onProgress?.(`${getInterfaceLanguage() === 'en' ? 'Verifying Qwen candidate' : 'Проверка кандидата Qwen'}: ${language} — ${suggestion.word}`);
        const entry = await verifySuggestionInLocalIndex(loader, language, suggestion, signal);
        if (!entry) { diagnostics.locallyMissingCount += 1; continue; }
        const descriptor = modelForGeneratedCandidate(entry, { ...suggestion, elementType }, root, language);
        if (models.has(descriptor.key)) { diagnostics.duplicateModelCount += 1; continue; }
        output[language].push(verifiedCandidatePatch(suggestion, entry, root, descriptor, { resetAnalysis: true }));
        seen.add(key);
        models.add(descriptor.key);
        diagnostics.verifiedNewModelCount += 1;
      } catch (error) {
        throwIfAbortError(error, { signal, stage: 'candidate_verification' });
        const warning = `qwen_candidate_verification_failed:${language}:${suggestion.word}`;
        warnings.push(warning);
        diagnostics.rejectedInvalidCount += 1;
        onWarning?.(warning, error);
      }
    }
  }
  return { candidatesByLanguage: output, warnings, diagnostics };
}

export function buildFinalQwenValidationPayload(candidatesByLanguage = {}, languages = CONTROL_LANGUAGE_CODES, limit = MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE) {
  const currentTopModels = {};
  const knownCandidates = {};
  const knownModelKeys = {};
  const maxModels = Math.max(0, Number(limit) || 0);
  for (const language of languages) {
    const selected = (Array.isArray(candidatesByLanguage?.[language]) ? candidatesByLanguage[language] : [])
      .filter(candidate => candidate?.selected && hasFiniteScore(candidateFinalScore(candidate)))
      .sort(compareFinalModelCandidates)
      .slice(0, maxModels);
    currentTopModels[language] = selected.map(compactCandidateEvidence);
    knownCandidates[language] = selected.map(compactCandidateEvidence);
    knownModelKeys[language] = [...new Set(selected
      .map(candidate => String(candidate?.model_key || candidate?.model_family_key || candidate?.model || '').trim())
      .filter(Boolean))];
  }
  return { currentTopModels, knownCandidates, knownModelKeys };
}

function finalizeStrictlyValidatedModels(candidatesByLanguage, languages, limit) {
  const output = {};
  for (const language of languages) {
    const source = Array.isArray(candidatesByLanguage?.[language]) ? candidatesByLanguage[language] : [];
    const best = selectBestFinalModels(source.filter(candidate => candidate?.selected), limit);
    const selected = new Set(best.map(candidateIdentity));
    output[language] = source.map(candidate => ({
      ...candidate,
      selected: selected.has(candidateIdentity(candidate))
    }));
  }
  return output;
}

export async function validateFinalCandidatesWithQwen({
  root,
  targetMeaning,
  candidatesByLanguage = {},
  languages = CONTROL_LANGUAGE_CODES,
  limit = MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE,
  signal,
  onProgress,
  onWarning
} = {}) {
  const fallback = Object.fromEntries(languages.map(language => [
    language,
    Array.isArray(candidatesByLanguage?.[language]) ? candidatesByLanguage[language].map(candidate => ({ ...candidate })) : []
  ]));
  const payload = buildFinalQwenValidationPayload(fallback, languages, limit);
  const hasSelectedCandidates = languages.some(language => payload.currentTopModels[language]?.length);
  if (!hasSelectedCandidates) {
    return {
      candidatesByLanguage: fallback,
      warnings: [],
      diagnostics: { status: 'not_required', validationStage: 'final', validationIncompleteLanguageCount: 0, validationFailClosedCount: 0 }
    };
  }

  let validation = {};
  let auditStatus = 'fallback';
  let auditError = null;
  const warnings = [];
  try {
    onProgress?.(getInterfaceLanguage() === 'en' ? 'Qwen3-235B: final model validation...' : 'Qwen3-235B: финальная проверка моделей...');
    const response = await getQwenCandidateSuggestions({
      root,
      targetMeaning: targetMeaning || root,
      ...payload,
      validationStage: 'final',
      signal
    });
    validation = response.validation;
    auditStatus = response.auditStatus;
    auditError = response.auditError;
  } catch (error) {
    throwIfAbortError(error, { signal, stage: 'final_candidate_validation' });
    auditError = error;
    const warning = 'qwen_final_candidate_validation_unavailable';
    warnings.push(warning);
    onWarning?.(warning, error);
  }

  const applied = applyQwenCandidateValidation(
    fallback,
    validation,
    payload.currentTopModels,
    languages,
    { failClosed: false, validationField: 'qwen_final_validation' }
  );
  const candidates = finalizeStrictlyValidatedModels(applied.candidatesByLanguage, languages, limit);
  const incomplete = applied.diagnostics.validationIncompleteLanguageCount > 0;
  if (incomplete) {
    const warning = 'qwen_final_candidate_validation_incomplete';
    if (!warnings.includes(warning)) warnings.push(warning);
    onWarning?.(warning, { incompleteLanguages: applied.diagnostics.validationIncompleteLanguageCount });
  }
  if (auditError && !warnings.includes('qwen_final_candidate_validation_unavailable')) {
    warnings.push('qwen_final_candidate_validation_unavailable');
  }

  return {
    candidatesByLanguage: candidates,
    warnings,
    diagnostics: {
      ...applied.diagnostics,
      status: incomplete || auditError ? 'fallback' : auditStatus,
      validationStage: 'final',
      model: null,
      backendErrorCode: auditError?.code || auditError?.errorCode || null,
      backendErrorDetails: auditError?.details || auditError?.message || null
    }
  };
}

function installAssociativeBrowserEnhancements() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  let attempts = 0;
  const install = () => {
    attempts += 1;
    if (typeof window.updateItem !== 'function'
      || typeof window.analyzeItem !== 'function'
      || typeof window.addRow !== 'function'
      || typeof window.InteralPageStateExport !== 'function') {
      if (attempts < 100) setTimeout(install, 100);
      return;
    }
    if (window.updateItem.__interalQwenCandidateEnhancements) return;

    const originalUpdateItem = window.updateItem;
    const pendingCheckboxAnalyses = new Set();
    const enhancedUpdateItem = function enhancedUpdateItem(language, index, key, value) {
      const result = originalUpdateItem.apply(this, arguments);
      if (key === 'selected' && value === true) {
        const analysisKey = `${language}:${index}`;
        queueMicrotask(async () => {
          const snapshot = window.InteralPageStateExport?.();
          const candidate = snapshot?.state?.languages?.[language]?.[index];
          if (!candidate || stateCandidateHasQwen(candidate) || pendingCheckboxAnalyses.has(analysisKey)) return;
          pendingCheckboxAnalyses.add(analysisKey);
          try { await window.analyzeItem(language, index); }
          finally { pendingCheckboxAnalyses.delete(analysisKey); }
        });
      }
      return result;
    };
    enhancedUpdateItem.__interalQwenCandidateEnhancements = true;
    window.updateItem = enhancedUpdateItem;

  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else setTimeout(install, 0);
}

installAssociativeBrowserEnhancements();
