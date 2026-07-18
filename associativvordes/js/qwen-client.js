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

export async function getQwenAssociationScores({ language, targetMeaning, word, swow, review = false, signal } = {}) {
  if (!language || !targetMeaning || !word) throw qwenError(QWEN_ERROR_CODES.INVALID_RESPONSE, 'language, targetMeaning, and word are required');
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, QWEN_RUNTIME_CONFIG.requestTimeoutMs);
  const abort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  }
  try {
    const response = await fetch(API_CONFIG.qwenEndpoint || '/api/qwen-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: 'associative_word_score',
        payload: { language, targetMeaning, word, swow: swow || {}, review }
      }),
      signal: controller.signal
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw qwenError(QWEN_ERROR_CODES.HTTP_ERROR, data?.error || `Qwen request failed with HTTP ${response.status}`, { status: response.status, details: data });
    const result = data?.result ?? data;
    const scores = {
      model: result?.model || null,
      directness: Number(result?.directness),
      field_relatedness: Number(result?.field_relatedness),
      domain_shift: Number(result?.domain_shift),
      short_explanation: typeof result?.short_explanation === 'string' ? result.short_explanation : ''
    };
    if (![scores.directness, scores.field_relatedness, scores.domain_shift].every(value => Number.isFinite(value) && value >= 0 && value <= 100)) {
      throw qwenError(QWEN_ERROR_CODES.SEMANTIC_SCORES_INVALID, 'Qwen returned invalid semantic scores.', { details: data });
    }
    return scores;
  } catch (error) {
    if (error instanceof QwenClientError) throw error;
    if (error?.name === 'AbortError') {
      if (timedOut) throw qwenError(QWEN_ERROR_CODES.TIMEOUT, 'Qwen request timed out.', { cause: error });
      throw qwenError(QWEN_ERROR_CODES.ABORTED, 'Qwen request was aborted.', { cause: error });
    }
    throw qwenError(QWEN_ERROR_CODES.BACKEND_ERROR, error?.message || 'Qwen request failed.', { cause: error });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener?.('abort', abort);
  }
}
