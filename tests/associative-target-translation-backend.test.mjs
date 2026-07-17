import assert from 'node:assert/strict';
import handler from '../api/qwen-analyze.js';

function createRes() {
  return {
    headers: {},
    statusCode: 0,
    body: '',
    setHeader(name, value) { this.headers[name] = value; },
    end(value = '') { this.body = value; }
  };
}

async function post(body) {
  const req = { method: 'POST', headers: {}, body };
  const res = createRes();
  await handler(req, res);
  return { status: res.statusCode, payload: JSON.parse(res.body) };
}

process.env.Qwen3_235B_A22B_Instruct_2507_FP8_Yandex = 'test-key';
process.env.yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8 = 'test-folder';

const offline = await post({ task: 'associative_target_translation', payload: { targetMeaning: 'правило', sourceLanguage: 'ru', targetLanguages: ['en', 'de', 'ru'] } });
assert.equal(offline.status, 200);
assert.deepEqual(offline.payload.translations, { en: 'rule', de: 'Regel', ru: 'правило' });
assert.equal(offline.payload.cached, true);

const unsupported = await post({ task: 'associative_target_translation', payload: { targetMeaning: 'другой', sourceLanguage: 'ru', targetLanguages: ['en', 'ja'] } });
assert.equal(unsupported.status, 400);
assert.equal(unsupported.payload.errorCode, 'TARGET_TRANSLATION_UNSUPPORTED_LANGUAGE');

let fetchCalls = 0;
globalThis.fetch = async (_url, init) => {
  fetchCalls += 1;
  const request = JSON.parse(init.body);
  assert.match(request.messages[1].content, /candidate generation/);
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ translations: { en: 'other', de: 'andere', fr: 'autre', es: 'otro', it: 'altro', ru: 'другой' } }) } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const translated = await post({ task: 'associative_target_translation', payload: { targetMeaning: 'другой', sourceLanguage: 'ru', targetLanguages: ['en', 'de', 'fr', 'es', 'it', 'ru'] } });
assert.equal(translated.status, 200);
assert.deepEqual(translated.payload.translations, { en: 'other', de: 'andere', fr: 'autre', es: 'otro', it: 'altro', ru: 'другой' });
assert.equal(translated.payload.cached, false);
assert.equal(fetchCalls, 1);

const cached = await post({ task: 'associative_target_translation', payload: { targetMeaning: 'другой', sourceLanguage: 'ru', targetLanguages: ['en', 'de'] } });
assert.equal(cached.status, 200);
assert.deepEqual(cached.payload.translations, { en: 'other', de: 'andere' });
assert.equal(cached.payload.cached, true);
assert.equal(fetchCalls, 1);
