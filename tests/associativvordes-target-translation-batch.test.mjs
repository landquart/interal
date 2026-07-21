import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyzeAssociativeWord } from '../associativvordes/js/association-analyzer.js';

const script = await readFile('associativvordes/script.js', 'utf8');
const analyzer = await readFile('associativvordes/js/association-analyzer.js', 'utf8');

assert.match(script, /translateTargetMeaning\(\{[\s\S]*targetLanguages: TARGET_TRANSLATION_LANGUAGES/, 'run requests all target translations in one batch');
assert.match(script, /targetTranslationRequestCount/, 'developer diagnostics include a single batch translation request counter');
assert.match(script, /clearTargetMeaningTranslationCache\(\);[\s\S]*getRunTargetTranslations/, 'new run invalidates target translation cache before translating the current meaning');
assert.match(script, /analyzeCandidateItem\(language\.code, candidate, context\.onProgress, runId, context\.translation\)/, 'the unified production adapter passes the prepared localized target meaning to the analyzer');
assert.match(analyzer, /localizedTargetMeaning/, 'analyzer accepts localizedTargetMeaning');
assert.match(analyzer, /target_translation_unavailable/, 'missing translation produces the stable warning');
assert.doesNotMatch(analyzer, /using original targetMeaning/, 'SWOW no longer falls back to the original targetMeaning');

let qwenBody = null;
globalThis.fetch = async (url, init = {}) => {
  if (String(url).includes('/api/qwen-analyze')) {
    qwenBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ ok: true, analysis: { directness: 40, field_relatedness: 40, domain_shift: 20, short_explanation: 'ok' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  throw new Error(`unexpected fetch ${url}`);
};

globalThis.document = { documentElement: { lang: 'en' } };
const result = await analyzeAssociativeWord({
  language: 'en',
  targetMeaning: 'другой',
  localizedTargetMeaning: '',
  word: 'other',
  frequencyProfile: { frequency_score: 50, category_breakdown: {}, warnings: [] }
});

assert.equal(result.swow.bonus, 0, 'missing translation gives zero SWOW bonus');
assert.equal(result.swow.target_to_word, null, 'SWOW lookup is skipped without a translation');
assert.ok(result.warnings.includes('target_translation_unavailable'), 'stable missing-translation warning is present');
assert.equal(qwenBody.payload.targetMeaning, 'другой', 'Qwen semantic evaluator still receives the original targetMeaning');
assert.equal(qwenBody.payload.word, 'other', 'Qwen semantic evaluator still receives the candidate word');

console.log('associativvordes target translation batch tests passed');
