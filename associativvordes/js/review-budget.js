import { QWEN_RUNTIME_CONFIG } from './qwen-client.js';

export function createReviewBudget({ enabled = QWEN_RUNTIME_CONFIG.enableReviewModel, maxRequests = QWEN_RUNTIME_CONFIG.maxReviewRequestsPerSearch } = {}) {
  const limit = maxRequests === Infinity ? Infinity : Math.max(0, Math.floor(Number(maxRequests) || 0));
  let used = 0;
  return {
    get used() { return used; },
    get remaining() { return limit === Infinity ? Infinity : Math.max(0, limit - used); },
    get limit() { return limit; },
    get enabled() { return Boolean(enabled) && limit !== 0; },
    canRequest() { return Boolean(enabled) && (limit === Infinity || used < limit); },
    reserve() { if (!this.canRequest()) return false; used += 1; return true; },
    releaseOnAbort() { /* started review API calls remain counted for this run-scoped budget. */ }
  };
}
