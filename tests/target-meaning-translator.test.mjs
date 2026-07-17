import assert from 'node:assert/strict';
import { clearTargetMeaningTranslationCache, getTargetMeaningForLanguage, translateTargetMeaning, TARGET_TRANSLATION_ERROR_CODES, TARGET_TRANSLATION_LANGUAGES } from '../associativvordes/js/target-meaning-translator.js';

clearTargetMeaningTranslationCache();
assert.equal(await getTargetMeaningForLanguage('солнце', 'en'), 'sun');

const another = await translateTargetMeaning({ targetMeaning: 'другой', sourceLanguage: 'ru', targetLanguages: TARGET_TRANSLATION_LANGUAGES });
assert.deepEqual(another.translations, { en: 'other', de: 'andere', fr: 'autre', es: 'otro', it: 'altro', ru: 'другой' });
assert.equal(another.cached, true);

let calls = 0;
globalThis.fetch = async (_url, init) => {
  calls += 1;
  const body = JSON.parse(init.body);
  assert.equal(body.task, 'associative_target_translation');
  assert.deepEqual(body.payload, { targetMeaning: 'новый', sourceLanguage: 'ru', targetLanguages: ['en', 'de'] });
  return new Response(JSON.stringify({ ok: true, translations: { en: 'new', de: 'neu' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const first = await translateTargetMeaning({ targetMeaning: 'новый', sourceLanguage: 'ru', targetLanguages: ['en', 'de'] });
assert.deepEqual(first.translations, { en: 'new', de: 'neu' });
assert.equal(first.cached, false);
const second = await translateTargetMeaning({ targetMeaning: 'новый', sourceLanguage: 'ru', targetLanguages: ['de'] });
assert.deepEqual(second.translations, { de: 'neu' });
assert.equal(second.cached, true);
assert.equal(calls, 1);

await assert.rejects(
  () => translateTargetMeaning({ targetMeaning: 'x', sourceLanguage: 'ru', targetLanguages: ['ja'] }),
  { code: TARGET_TRANSLATION_ERROR_CODES.INVALID_INPUT }
);

clearTargetMeaningTranslationCache();
globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, translations: { en: 'line\nbreak' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
await assert.rejects(
  () => translateTargetMeaning({ targetMeaning: 'значение', sourceLanguage: 'ru', targetLanguages: ['en'] }),
  { code: TARGET_TRANSLATION_ERROR_CODES.INVALID_RESPONSE }
);
