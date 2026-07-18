import { API_CONFIG } from './swow-client.js';

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
  enableCandidateGeneration: false,
  enableReviewModel: true,
  maxCandidatesPerLanguage: Infinity,
  autoAnalyzeCandidatesPerLanguage: 5,
  maxConcurrentQwenRequests: 1,
  maxReviewRequestsPerSearch: 5,
  requestTimeoutMs: 15000
};

export const QWEN_ERROR_CODES = Object.freeze({
  HTTP_ERROR: 'QWEN_HTTP_ERROR',
  TIMEOUT: 'QWEN_TIMEOUT',
  INVALID_RESPONSE: 'QWEN_INVALID_RESPONSE',
  SEMANTIC_SCORES_INVALID: 'QWEN_SEMANTIC_SCORES_INVALID',
  ABORTED: 'QWEN_ABORTED',
  BACKEND_ERROR: 'QWEN_BACKEND_ERROR',
  REVIEW_FAILED: 'QWEN_REVIEW_FAILED'
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
