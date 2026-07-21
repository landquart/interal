import assert from 'node:assert/strict';
import { analyzeAssociativeWord } from '../associativvordes/js/association-analyzer.js';

const originalFetch = globalThis.fetch;
const originalDocument = globalThis.document;
globalThis.document = { documentElement: { lang: 'en' } };

async function runCase({ primaryP, reviewScores = { directness: 80, field_relatedness: 70, domain_shift: 20 }, reviewFails = false, reviewAbort = false, reviewAbortCode = null, payloadModel = 'evil-model/latest' }) {
  const primaryA = 30;
  const F = (primaryP - 0.65 * primaryA) / 0.35;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    assert.equal(String(url), '/api/qwen-analyze');
    const request = JSON.parse(init.body);
    calls.push(request);
    assert.equal('model' in request.payload, false, 'client does not send arbitrary model names');
    if (request.payload.review === true) {
      if (reviewAbort) throw new DOMException('aborted', 'AbortError');
      if (reviewAbortCode) { const error = new Error('aborted'); error.code = reviewAbortCode; throw error; }
      if (reviewFails) return new Response(JSON.stringify({ ok: false, errorCode: 'QWEN_REVIEW_FAILED', error: 'boom' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ ok: true, analysis: { ...reviewScores, model: 'gpt://folder/qwen3-235b-a22b-fp8/latest', short_explanation: 'review' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: true, analysis: { directness: primaryA, field_relatedness: primaryA, domain_shift: 100 - primaryA, model: 'gpt://folder/qwen3.6-35b-a3b/latest', short_explanation: payloadModel } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const progress = [];
  let reviewCount = 0;
  const result = await analyzeAssociativeWord({
    language: 'en',
    targetMeaning: 'target',
    localizedTargetMeaning: '',
    word: 'word',
    frequencyProfile: { frequency_score: F, category_breakdown: {}, warnings: [] },
    onProgress: (text) => progress.push(text),
    onReviewRequest: () => { reviewCount += 1; }
  });
  return { result, calls, progress, reviewCount };
}

for (const primaryP of [24.9, 35.1]) {
  const { result, calls, reviewCount } = await runCase({ primaryP });
  assert.equal(calls.length, 1, `primary P=${primaryP} does not call review`);
  assert.equal(reviewCount, 0, `primary P=${primaryP} has no review diagnostic callback`);
  assert.equal(result.review, null, `primary P=${primaryP} leaves review null`);
  assert.equal(result.association.combination_method, 'primary_only');
}

for (const primaryP of [25, 30, 35]) {
  const { result, calls, progress, reviewCount } = await runCase({ primaryP });
  assert.equal(calls.length, 2, `primary P=${primaryP} calls review`);
  assert.equal(calls[0].payload.review, false, 'first request is primary');
  assert.equal(calls[1].payload.review, true, 'second request is review');
  assert.equal(reviewCount, 1, 'review diagnostic callback fires once');
  assert.match(progress.join('\n'), /Qwen3\.6/, 'primary progress shows Qwen3.6');
  assert.match(progress.join('\n'), /Qwen3-235B/, 'review progress shows Qwen3-235B');
  assert.equal(result.association.combination_method, 'review_override');
}

{
  const { result } = await runCase({ primaryP: 30, reviewScores: { directness: 90, field_relatedness: 50, domain_shift: 10 } });
  const expectedA = 0.45 * 90 + 0.35 * 50 + 0.20 * (100 - 10);
  const expectedP = 0.65 * expectedA + 0.35 * result.frequency.frequency_score;
  assert.equal(result.association.Di, 90, 'review Di replaces final');
  assert.equal(result.association.Pr, 50, 'review Pr replaces final');
  assert.equal(result.association.Sh, 10, 'review Sh replaces final');
  assert.equal(result.association.A_final, expectedA, 'review A replaces final');
  assert.equal(result.final_score, expectedP, 'review P replaces final');
  assert.notEqual(result.primary.final_score, result.final_score, 'primary is retained separately');
  assert.equal(result.review.final_score, result.final_score, 'review is retained separately');
}


{
  await assert.rejects(
    () => runCase({ primaryP: 30, reviewAbort: true }),
    error => error?.name === 'AbortError' && error?.code === 'ABORTED' && error?.stage === 'review_qwen',
    'AbortError review is propagated as normalized abort'
  );
}

{
  await assert.rejects(
    () => runCase({ primaryP: 30, reviewAbortCode: 'QWEN_ABORTED' }),
    error => error?.name === 'AbortError' && error?.code === 'ABORTED' && error?.stage === 'review_qwen',
    'QWEN_ERROR_CODES.ABORTED review is propagated as normalized abort'
  );
}

{
  const { result } = await runCase({ primaryP: 30, reviewFails: true });
  assert.equal(result.review, null, 'failed review stays null');
  assert.equal(result.association.combination_method, 'primary_fallback_after_review_error');
  assert.equal(Math.round(result.final_score * 10) / 10, 30, 'review failure preserves primary final score');
  assert.ok(result.warnings.includes('review_failed'), 'review failure warning is present');
  assert.ok(result.warnings.some(warning => String(warning).startsWith('review_failed:')), 'ordinary review error keeps diagnostic warning');
}

{
  let abortResult = null;
  try {
    abortResult = await runCase({ primaryP: 30, reviewAbort: true });
  } catch (error) {
    assert.equal(error.name, 'AbortError', 'aborted review rejects instead of returning fallback');
  }
  assert.equal(abortResult, null, 'aborted review has no returned result and therefore no review_failed warning');
}

globalThis.fetch = originalFetch;
globalThis.document = originalDocument;
console.log('associativvordes qwen review tests passed');
