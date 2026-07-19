import { API_CONFIG } from './swow-client.js';
import { buildSearchForm } from './search-normalizer.js';
import { lexicalModelDescriptor, compareFrequencyRepresentatives } from './candidate-model-family.js';

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
  enableReviewModel: false,
  maxCandidatesPerLanguage: Infinity,
  autoAnalyzeCandidatesPerLanguage: Infinity,
  maxGeneratedCandidatesPerLanguage: 2,
  maxConcurrentQwenRequests: 1,
  maxReviewRequestsPerSearch: 0,
  requestTimeoutMs: 15000
};

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

async function callQwen(prompt, { model, review = false, signal } = {}) {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(new Error('Qwen request timeout')), QWEN_RUNTIME_CONFIG.requestTimeoutMs);
  const abortController = new AbortController();
  const abort = () => abortController.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) throw qwenError(QWEN_ERROR_CODES.ABORTED, 'Qwen request aborted.');
    signal.addEventListener('abort', abort, { once: true });
  }
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
          primary: prompt.input?.primary || null,
          model: model || API_CONFIG.qwenPrimaryModel
        }
      }),
      signal: abortController.signal
    });
  } catch (error) {
    if (timeoutController.signal.aborted) throw qwenError(QWEN_ERROR_CODES.TIMEOUT, 'Qwen request timed out.', { cause: error });
    if (error?.name === 'AbortError') throw qwenError(QWEN_ERROR_CODES.ABORTED, 'Qwen request aborted.', { cause: error });
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
  const requestedModel = review ? API_CONFIG.qwenReviewModel : API_CONFIG.qwenPrimaryModel;
  const parsed = parseQwenPayload(await callQwen(prompt, {
    model: requestedModel,
    review,
    signal
  }));
  return { ...parsed, model: requestedModel };
}

const CONTROL_LANGUAGE_CODES = Object.freeze(['en', 'de', 'fr', 'es', 'it', 'ru']);

function normalizeCandidateWord(value, maxLength = 80) {
  const word = typeof value === 'string' ? value.trim().normalize('NFC') : '';
  return word && word.length <= maxLength && !/[\r\n]/.test(word) ? word : '';
}

export function normalizeQwenCandidateSuggestions(payload, languages = CONTROL_LANGUAGE_CODES, maxPerLanguage = QWEN_RUNTIME_CONFIG.maxGeneratedCandidatesPerLanguage) {
  const source = payload?.candidates && typeof payload.candidates === 'object' ? payload.candidates : {};
  const output = {};
  for (const language of languages) {
    const seen = new Set();
    output[language] = [];
    for (const raw of Array.isArray(source[language]) ? source[language] : []) {
      const item = typeof raw === 'string' ? { word: raw } : raw;
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const word = normalizeCandidateWord(item.word);
      const rootVariant = normalizeCandidateWord(item.root_variant ?? item.rootVariant, 40);
      if (!word) continue;
      const key = word.toLocaleLowerCase(language === 'ru' ? 'ru' : undefined);
      if (seen.has(key)) continue;
      seen.add(key);
      output[language].push({ word, root_variant: rootVariant });
      if (output[language].length >= Math.max(0, Number(maxPerLanguage) || 0)) break;
    }
  }
  return output;
}

function qwenCandidateGenerationUrl() {
  return globalThis.location?.hostname === 'landquart.github.io'
    ? 'https://interal.vercel.app/api/qwen-candidates'
    : '/api/qwen-candidates';
}

export async function getQwenCandidateSuggestions({ root, targetMeaning, existingCandidates = {}, signal } = {}) {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(new Error('Qwen candidate request timeout')), QWEN_RUNTIME_CONFIG.requestTimeoutMs);
  const abortController = new AbortController();
  const forwardAbort = () => abortController.abort(signal?.reason);
  const timeoutAbort = () => abortController.abort(timeoutController.signal.reason);
  if (signal) {
    if (signal.aborted) throw qwenError(QWEN_ERROR_CODES.ABORTED, 'Qwen candidate request aborted.');
    signal.addEventListener('abort', forwardAbort, { once: true });
  }
  timeoutController.signal.addEventListener('abort', timeoutAbort, { once: true });
  let response;
  try {
    response = await fetch(qwenCandidateGenerationUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root, targetMeaning, existingCandidates, interfaceLanguage: getInterfaceLanguage() }),
      signal: abortController.signal
    });
  } catch (error) {
    if (timeoutController.signal.aborted) throw qwenError(QWEN_ERROR_CODES.TIMEOUT, 'Qwen candidate generation timed out.', { cause: error });
    if (error?.name === 'AbortError') throw qwenError(QWEN_ERROR_CODES.ABORTED, 'Qwen candidate generation aborted.', { cause: error });
    throw qwenError(QWEN_ERROR_CODES.CANDIDATE_GENERATION_FAILED, 'Qwen candidate generation failed.', { cause: error });
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener?.('abort', forwardAbort);
    timeoutController.signal.removeEventListener('abort', timeoutAbort);
  }
  const payload = await response.json().catch(error => { throw qwenError(QWEN_ERROR_CODES.INVALID_RESPONSE, 'Qwen candidate generation returned invalid JSON.', { cause: error }); });
  if (!response.ok || payload?.ok === false) throw qwenError(payload?.errorCode || QWEN_ERROR_CODES.CANDIDATE_GENERATION_FAILED, 'Qwen candidate generation backend error.', { status: response.status, details: payload });
  return normalizeQwenCandidateSuggestions(payload);
}

function hasFiniteScore(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function stateCandidateHasQwen(candidate) {
  return hasFiniteScore(candidate?.analysis?.association?.association_score)
    || hasFiniteScore(candidate?.association_score)
    || candidate?.analysisStatus === 'analyzing';
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function candidateCountFromPanel() {
  const paragraphs = [...(document.getElementById('languagePanel')?.querySelectorAll('p.muted') || [])];
  const countText = paragraphs.map(element => element.textContent || '').find(text => /(?:Показано|Showing)/i.test(text));
  const match = countText?.match(/(?:из|of)\s+(\d+)\s+(?:кандидатов|candidates)/i);
  return match ? Number(match[1]) : null;
}

function activateLanguageTab(language) {
  const index = CONTROL_LANGUAGE_CODES.indexOf(language);
  const tab = document.querySelectorAll('#tabs .tab')[index];
  tab?.click();
  return Boolean(tab);
}

function modelForGeneratedCandidate(entry, suggestion, canonicalRoot, language) {
  const searchForm = entry.search_form || entry.word;
  const variant = suggestion.root_variant || canonicalRoot;
  const variantIndex = buildSearchForm(searchForm).indexOf(buildSearchForm(variant));
  const match = { type: 'special', distance: 0, similarity: 1, fragment: buildSearchForm(variant), index: Math.max(0, variantIndex) };
  return lexicalModelDescriptor({ ...entry, match }, canonicalRoot, language);
}

async function verifySuggestionInLocalIndex(loader, language, suggestion, buildSearchForm, signal) {
  const requested = buildSearchForm(suggestion.word);
  if (!requested) return null;
  const entries = await loader.loadCandidateEntries(language, suggestion.word, { signal });
  return entries.find(entry => buildSearchForm(entry.word) === requested || buildSearchForm(entry.normalized) === requested) || null;
}

async function addVerifiedCandidateToRuntime(language, suggestion, entry, root, buildSearchForm) {
  const descriptor = modelForGeneratedCandidate(entry, suggestion, root, language);
  const proposed = { ...entry, model_key: descriptor.key, model: descriptor.label, frequencyProfile: { frequency_score: entry.frequency_score } };
  const existing = window.InteralAssociativeModels?.findRepresentative?.(language, descriptor.key);
  if (existing && compareFrequencyRepresentatives(proposed, existing) >= 0) return false;
  if (!activateLanguageTab(language)) return false;
  window.addRow(language);
  const total = candidateCountFromPanel();
  if (!Number.isInteger(total) || total < 1) return false;
  const index = total - 1;
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

  window.updateItem(language, index, 'normalized', entry.normalized || entry.word);
  window.updateItem(language, index, 'search_form', searchForm);
  window.updateItem(language, index, 'match', match);
  window.updateItem(language, index, 'rank', entry.rank ?? null);
  window.updateItem(language, index, 'category_breakdown', entry.category_breakdown || {});
  window.updateItem(language, index, 'sources', Array.isArray(entry.sources) ? entry.sources : []);
  window.updateItem(language, index, 'frequencyProfile', frequencyProfile);
  window.updateItem(language, index, 'warnings', ['qwen_suggestion_verified_in_local_index']);
  window.updateItem(language, index, 'word', entry.word);
  window.updateItem(language, index, 'model_key', descriptor.key);
  window.updateItem(language, index, 'model', descriptor.label);
  return true;
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

    if (!QWEN_RUNTIME_CONFIG.enableCandidateGeneration) return;
    const calculateButton = document.getElementById('calculateBtn');
    if (!calculateButton) return;
    let generationToken = 0;
    let generationAbortController = null;
    let loaderPromise = null;
    let normalizerPromise = null;

    async function supplementAfterCompletedCalculation(token, rootAtClick, meaningAtClick) {
      const deadline = Date.now() + 30 * 60 * 1000;
      while (token === generationToken && Date.now() < deadline) {
        await delay(500);
        const snapshot = window.InteralPageStateExport?.();
        const sectionVisible = document.getElementById('languagesSection')?.hidden === false;
        const buttonReady = document.getElementById('calculateBtn')?.disabled === false;
        const sameRoot = String(document.getElementById('rootInput')?.value || '').trim() === rootAtClick;
        if (snapshot?.state?.checked && sectionVisible && buttonReady && sameRoot) break;
      }
      if (token !== generationToken || Date.now() >= deadline) return;

      const snapshot = window.InteralPageStateExport?.();
      if (!snapshot?.state?.checked) return;
      const existingCandidates = Object.fromEntries(CONTROL_LANGUAGE_CODES.map(language => [
        language,
        (snapshot.state.languages?.[language] || []).map(candidate => candidate.word).filter(Boolean)
      ]));
      let suggestions;
      try {
        suggestions = await getQwenCandidateSuggestions({
          root: rootAtClick,
          targetMeaning: meaningAtClick || rootAtClick,
          existingCandidates,
          signal: generationAbortController?.signal
        });
      } catch (error) {
        if (error?.code !== QWEN_ERROR_CODES.ABORTED) console.warn('Supplemental Qwen candidates unavailable:', error);
        return;
      }
      if (token !== generationToken) return;

      loaderPromise ||= import('./candidate-index-loader.js').then(module => module.createCandidateIndexLoader());
      normalizerPromise ||= import('./search-normalizer.js');
      const [loader, normalizer] = await Promise.all([loaderPromise, normalizerPromise]);
      const buildSearchForm = normalizer.buildSearchForm;
      const existingKeys = Object.fromEntries(CONTROL_LANGUAGE_CODES.map(language => [
        language,
        new Set((existingCandidates[language] || []).map(buildSearchForm))
      ]));

      for (const language of CONTROL_LANGUAGE_CODES) {
        for (const suggestion of suggestions[language] || []) {
          if (token !== generationToken) return;
          const suggestionKey = buildSearchForm(suggestion.word);
          if (!suggestionKey || existingKeys[language].has(suggestionKey)) continue;
          let entry;
          try {
            entry = await verifySuggestionInLocalIndex(loader, language, suggestion, buildSearchForm, generationAbortController?.signal);
          } catch (error) {
            if (error?.code === 'ABORTED') return;
            console.warn(`Could not verify supplemental candidate ${language}:${suggestion.word}`, error);
            continue;
          }
          if (!entry) continue;
          existingKeys[language].add(suggestionKey);
          await addVerifiedCandidateToRuntime(language, suggestion, entry, rootAtClick, buildSearchForm);
          await delay(4000);
        }
      }
    }

    calculateButton.addEventListener('click', () => {
      generationToken += 1;
      generationAbortController?.abort?.();
      generationAbortController = new AbortController();
      const token = generationToken;
      const rootAtClick = String(document.getElementById('rootInput')?.value || '').trim();
      const meaningAtClick = String(document.getElementById('meaningInput')?.value || '').trim();
      if (!rootAtClick) return;
      void supplementAfterCompletedCalculation(token, rootAtClick, meaningAtClick);
    }, { capture: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else setTimeout(install, 0);
}

installAssociativeBrowserEnhancements();
