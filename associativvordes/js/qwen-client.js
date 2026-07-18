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
  maxConcurrentQwenRequests: 1,
  maxReviewRequestsPerSearch: 5,
  requestTimeoutMs: 15000
};

export const QWEN_ERROR_CODES = Object.freeze({
  HTTP_ERROR: 'QWEN_HTTP_ERROR',
  TIMEOUT: 'QWEN_TIMEOUT',
  INVALID_RESPONSE: 'QWEN_INVALID_RESPONSE',
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
  return start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
}

export function parseQwenAssociationResponse(raw) {
  let data;
  try {
    data = typeof raw === 'string' ? JSON.parse(extractJsonText(raw)) : raw;
  } catch (cause) {
    throw qwenError(QWEN_ERROR_CODES.INVALID_RESPONSE, 'Qwen returned invalid JSON.', { cause });
  }
  const directness = clampIntegerOrNull(data?.directness);
  const field_relatedness = clampIntegerOrNull(data?.field_relatedness);
  const domain_shift = clampIntegerOrNull(data?.domain_shift);
  if ([directness, field_relatedness, domain_shift].some(value => value == null)) {
    throw qwenError(QWEN_ERROR_CODES.INVALID_RESPONSE, 'Qwen response is missing valid semantic scores.', { details: data });
  }
  return {
    word: typeof data.word === 'string' ? data.word : '',
    target_meaning: typeof data.target_meaning === 'string' ? data.target_meaning : '',
    directness,
    field_relatedness,
    domain_shift,
    responseLanguage: typeof data.responseLanguage === 'string' ? data.responseLanguage : '',
    short_explanation: typeof data.short_explanation === 'string' ? data.short_explanation : ''
  };
}

async function postQwen(payload, { signal } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('Qwen timeout')), QWEN_RUNTIME_CONFIG.requestTimeoutMs);
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(API_CONFIG.qwenEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!response.ok) throw qwenError(QWEN_ERROR_CODES.HTTP_ERROR, `Qwen HTTP ${response.status}`, { status: response.status });
    return await response.json();
  } catch (error) {
    if (controller.signal.aborted) {
      if (signal?.aborted) throw qwenError(QWEN_ERROR_CODES.ABORTED, 'Qwen request aborted.', { cause: error });
      throw qwenError(QWEN_ERROR_CODES.TIMEOUT, 'Qwen request timed out.', { cause: error });
    }
    if (error instanceof QwenClientError) throw error;
    throw qwenError(QWEN_ERROR_CODES.BACKEND_ERROR, 'Qwen request failed.', { cause: error });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export async function requestQwenAssociation(input, options = {}) {
  const payload = buildQwenAssociationPrompt(input);
  const raw = await postQwen({ task: 'associative_semantic_evaluation', ...payload }, options);
  return parseQwenAssociationResponse(raw?.result ?? raw?.output ?? raw);
}
