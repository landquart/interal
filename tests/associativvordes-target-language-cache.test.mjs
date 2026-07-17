import assert from 'node:assert/strict';
import {
  clearTargetMeaningTranslationCache,
  getTargetMeaningTranslationCacheSize,
  resolveTargetMeaningSourceLanguage,
  translateTargetMeaning
} from '../associativvordes/js/target-meaning-translator.js';

const originalLocalStorage = globalThis.localStorage;
const originalDocument = globalThis.document;
const originalFetch = globalThis.fetch;

function setInterfaceLanguage(language) {
  globalThis.localStorage = { getItem: key => key === 'interal.lang' ? language : null };
  globalThis.document = { documentElement: { lang: language } };
}

try {
  clearTargetMeaningTranslationCache({ force: true });

  setInterfaceLanguage('ru');
  assert.equal(resolveTargetMeaningSourceLanguage('другой', 'ru'), 'ru');
  const russian = await translateTargetMeaning({
    targetMeaning: 'другой',
    sourceLanguage: 'ru',
    targetLanguages: ['en', 'ru']
  });
  assert.equal(russian.sourceLanguage, 'ru');
  assert.equal(russian.networkRequest, false);
  assert.deepEqual(russian.translations, { en: 'other', ru: 'другой' });

  setInterfaceLanguage('en');
  assert.equal(resolveTargetMeaningSourceLanguage('other', 'ru'), 'en', 'legacy hardcoded ru follows the English UI');
  const english = await translateTargetMeaning({
    targetMeaning: 'other',
    sourceLanguage: 'ru',
    targetLanguages: ['en', 'de']
  });
  assert.equal(english.sourceLanguage, 'en');
  assert.equal(english.networkRequest, false);
  assert.deepEqual(english.translations, { en: 'other', de: 'andere' });

  clearTargetMeaningTranslationCache({ force: true });
  setInterfaceLanguage('en');
  let requests = 0;
  globalThis.fetch = async (_url, init) => {
    requests += 1;
    const request = JSON.parse(init.body);
    assert.equal(request.task, 'associative_target_translation');
    assert.equal(request.payload.sourceLanguage, 'en');
    return new Response(JSON.stringify({
      ok: true,
      translations: { en: 'new', de: 'neu' }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const first = await translateTargetMeaning({
    targetMeaning: 'new',
    sourceLanguage: 'ru',
    targetLanguages: ['en', 'de']
  });
  assert.equal(first.networkRequest, true);
  assert.equal(requests, 1);

  // This is the call still made by the current calculation start. It must not
  // discard the useful key-based cache.
  clearTargetMeaningTranslationCache();
  const second = await translateTargetMeaning({
    targetMeaning: 'new',
    sourceLanguage: 'ru',
    targetLanguages: ['de']
  });
  assert.equal(second.cached, true);
  assert.equal(second.networkRequest, false);
  assert.equal(requests, 1, 'the second calculation reuses the client cache');
  assert.ok(getTargetMeaningTranslationCacheSize() > 0);

  setInterfaceLanguage('ru');
  globalThis.fetch = async (_url, init) => {
    requests += 1;
    const request = JSON.parse(init.body);
    assert.equal(request.payload.sourceLanguage, 'ru');
    return new Response(JSON.stringify({
      ok: true,
      translations: { en: 'novel' }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const differentSource = await translateTargetMeaning({
    targetMeaning: 'new',
    sourceLanguage: 'ru',
    targetLanguages: ['en']
  });
  assert.equal(differentSource.sourceLanguage, 'ru');
  assert.equal(differentSource.networkRequest, true, 'same text with a different source language uses another cache key');
  assert.equal(requests, 2);
} finally {
  clearTargetMeaningTranslationCache({ force: true });
  globalThis.localStorage = originalLocalStorage;
  globalThis.document = originalDocument;
  globalThis.fetch = originalFetch;
}

console.log('associativvordes target language and cache tests passed');
