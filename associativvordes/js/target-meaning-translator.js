import { API_CONFIG } from './swow-client.js';
import { normalizeSwowWord } from './swow-client.js';

export const TARGET_TRANSLATION_LANGUAGES = Object.freeze(['en', 'de', 'fr', 'es', 'it', 'ru']);
const LANGUAGE_SET = new Set(TARGET_TRANSLATION_LANGUAGES);
const DEFAULT_TIMEOUT_MS = 15000;

export const TARGET_TRANSLATION_ERROR_CODES = Object.freeze({
  INVALID_INPUT: 'TARGET_TRANSLATION_INVALID_INPUT',
  HTTP_ERROR: 'TARGET_TRANSLATION_HTTP_ERROR',
  TIMEOUT: 'TARGET_TRANSLATION_TIMEOUT',
  ABORTED: 'TARGET_TRANSLATION_ABORTED',
  INVALID_RESPONSE: 'TARGET_TRANSLATION_INVALID_RESPONSE',
  BACKEND_ERROR: 'TARGET_TRANSLATION_BACKEND_ERROR'
});

export const OFFLINE_TARGET_TRANSLATION_CACHE = Object.freeze({
  'ru:правило': Object.freeze({ ru: 'правило', en: 'rule', de: 'Regel', es: 'regla', fr: 'règle', it: 'regola' }),
  'ru:солнце': Object.freeze({ ru: 'солнце', en: 'sun', de: 'Sonne', es: 'sol', fr: 'soleil', it: 'sole' })
});

const runtimeCache = new Map();

export class TargetTranslationError extends Error {
  constructor(code, message, { status, details, cause } = {}) {
    super(message);
    this.name = 'TargetTranslationError';
    this.code = code;
    if (status != null) this.status = status;
    if (details != null) this.details = details;
    if (cause != null) this.cause = cause;
  }
}

function fail(code, message, options) {
  throw new TargetTranslationError(code, message, options);
}

function normalizeLanguageCode(code) {
  return String(code || '').trim().toLowerCase();
}

function normalizeMeaning(value) {
  return String(value || '').trim();
}

function validateLanguages(sourceLanguage, targetLanguages) {
  const source = normalizeLanguageCode(sourceLanguage);
  if (!LANGUAGE_SET.has(source)) fail(TARGET_TRANSLATION_ERROR_CODES.INVALID_INPUT, 'Unsupported source language.');
  const targets = Array.isArray(targetLanguages) ? targetLanguages.map(normalizeLanguageCode) : [];
  if (!targets.length) fail(TARGET_TRANSLATION_ERROR_CODES.INVALID_INPUT, 'targetLanguages must be a non-empty array.');
  if (targets.some((code) => !LANGUAGE_SET.has(code))) fail(TARGET_TRANSLATION_ERROR_CODES.INVALID_INPUT, 'Unsupported target language.');
  return { source, targets: [...new Set(targets)] };
}

function cacheKey(targetMeaning, sourceLanguage) {
  return `${sourceLanguage}:${normalizeSwowWord(targetMeaning)}`;
}

function validateTranslationsPayload(payload, targetLanguages) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) fail(TARGET_TRANSLATION_ERROR_CODES.INVALID_RESPONSE, 'Translation response is not an object.');
  const translations = payload.translations;
  if (!translations || typeof translations !== 'object' || Array.isArray(translations)) fail(TARGET_TRANSLATION_ERROR_CODES.INVALID_RESPONSE, 'Translation response has no translations object.');
  const normalized = {};
  for (const language of targetLanguages) {
    const value = translations[language];
    if (typeof value !== 'string') fail(TARGET_TRANSLATION_ERROR_CODES.INVALID_RESPONSE, `Missing translation for ${language}.`, { details: payload });
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 80 || /[\r\n]/.test(trimmed)) fail(TARGET_TRANSLATION_ERROR_CODES.INVALID_RESPONSE, `Invalid translation for ${language}.`, { details: payload });
    normalized[language] = trimmed;
  }
  return { translations: normalized };
}

export function clearTargetMeaningTranslationCache() {
  runtimeCache.clear();
}

export async function translateTargetMeaning({ targetMeaning, sourceLanguage = 'ru', targetLanguages = TARGET_TRANSLATION_LANGUAGES, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const meaning = normalizeMeaning(targetMeaning);
  if (!meaning) fail(TARGET_TRANSLATION_ERROR_CODES.INVALID_INPUT, 'targetMeaning is required.');
  const { source, targets } = validateLanguages(sourceLanguage, targetLanguages);
  const key = cacheKey(meaning, source);
  const cached = runtimeCache.get(key) || OFFLINE_TARGET_TRANSLATION_CACHE[key];
  if (cached && targets.every((language) => typeof cached[language] === 'string' && cached[language].trim())) {
    const translations = Object.fromEntries(targets.map((language) => [language, cached[language].trim()]));
    runtimeCache.set(key, { ...(runtimeCache.get(key) || {}), ...translations });
    return { translations, cached: true };
  }

  const timeoutController = new AbortController();
  const requestController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(new Error('Target translation timeout')), timeoutMs);
  const abort = () => requestController.abort(signal?.reason);
  const timeoutAbort = () => requestController.abort(timeoutController.signal.reason);
  if (signal) {
    if (signal.aborted) fail(TARGET_TRANSLATION_ERROR_CODES.ABORTED, 'Target translation aborted.');
    signal.addEventListener('abort', abort, { once: true });
  }
  timeoutController.signal.addEventListener('abort', timeoutAbort, { once: true });

  let response;
  try {
    response = await fetch(API_CONFIG.qwenAssociationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'associative_target_translation', payload: { targetMeaning: meaning, sourceLanguage: source, targetLanguages: targets } }),
      signal: requestController.signal
    });
  } catch (error) {
    if (timeoutController.signal.aborted) fail(TARGET_TRANSLATION_ERROR_CODES.TIMEOUT, 'Target translation timed out.', { cause: error });
    if (error?.name === 'AbortError') fail(TARGET_TRANSLATION_ERROR_CODES.ABORTED, 'Target translation aborted.', { cause: error });
    fail(TARGET_TRANSLATION_ERROR_CODES.HTTP_ERROR, 'Target translation request failed.', { cause: error });
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener?.('abort', abort);
    timeoutController.signal.removeEventListener('abort', timeoutAbort);
  }

  let payload = null;
  try { payload = await response.json(); } catch (error) { fail(TARGET_TRANSLATION_ERROR_CODES.INVALID_RESPONSE, 'Target translation returned invalid JSON.', { cause: error }); }
  if (!response.ok) fail(payload?.errorCode || TARGET_TRANSLATION_ERROR_CODES.HTTP_ERROR, payload?.error || 'Target translation HTTP error.', { status: response.status, details: payload });
  if (payload?.ok === false || payload?.errorCode) fail(payload.errorCode || TARGET_TRANSLATION_ERROR_CODES.BACKEND_ERROR, payload.error || 'Target translation backend error.', { details: payload });
  const parsed = validateTranslationsPayload(payload, targets);
  runtimeCache.set(key, { ...(runtimeCache.get(key) || {}), ...parsed.translations });
  return { ...parsed, cached: false };
}

export async function getTargetMeaningForLanguage(targetMeaning, language, options = {}) {
  const lang = normalizeLanguageCode(language);
  const result = await translateTargetMeaning({ targetMeaning, sourceLanguage: options.sourceLanguage || 'ru', targetLanguages: [lang], signal: options.signal, timeoutMs: options.timeoutMs });
  return result.translations[lang];
}

export function hasOfflineTargetMeaningTranslation(targetMeaning, language, sourceLanguage = 'ru') {
  const lang = normalizeLanguageCode(language);
  const key = cacheKey(targetMeaning, normalizeLanguageCode(sourceLanguage));
  return Boolean(OFFLINE_TARGET_TRANSLATION_CACHE[key]?.[lang]);
}
