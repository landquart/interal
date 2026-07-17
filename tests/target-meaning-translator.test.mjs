import assert from 'node:assert/strict';
import { clearTargetMeaningTranslationCache, getTargetMeaningForLanguage, translateTargetMeaning, TARGET_TRANSLATION_ERROR_CODES } from '../associativvordes/js/target-meaning-translator.js';

clearTargetMeaningTranslationCache();
assert.equal(await getTargetMeaningForLanguage('солнце', 'en'), 'sun');

let calls = 0;
globalThis.fetch = async (_url, init) => {
  calls += 1;
  const body = JSON.parse(init.body);
  assert.equal(body.task, 'associative_target_translation');
  assert.deepEqual(body.payload, { targetMeaning: 'другой', sourceLanguage: 'ru', targetLanguages: ['en', 'de'] });
  return new Response(JSON.stringify({ ok: true, translations: { en: 'other', de: 'andere' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const first = await translateTargetMeaning({ targetMeaning: 'другой', sourceLanguage: 'ru', targetLanguages: ['en', 'de'] });
assert.deepEqual(first.translations, { en: 'other', de: 'andere' });
assert.equal(first.cached, false);
const second = await translateTargetMeaning({ targetMeaning: 'другой', sourceLanguage: 'ru', targetLanguages: ['de'] });
assert.deepEqual(second.translations, { de: 'andere' });
assert.equal(second.cached, true);
assert.equal(calls, 1);

await assert.rejects(
  () => translateTargetMeaning({ targetMeaning: 'x', sourceLanguage: 'ru', targetLanguages: ['ja'] }),
  { code: TARGET_TRANSLATION_ERROR_CODES.INVALID_INPUT }
);

clearTargetMeaningTranslationCache();
globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, translations: { en: 'line\nbreak' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
await assert.rejects(
  () => translateTargetMeaning({ targetMeaning: 'новый', sourceLanguage: 'ru', targetLanguages: ['en'] }),
  { code: TARGET_TRANSLATION_ERROR_CODES.INVALID_RESPONSE }
);
