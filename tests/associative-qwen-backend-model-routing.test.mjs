import assert from 'node:assert/strict';
import handler from '../api/qwen-analyze.js';

const oldFetch = globalThis.fetch;
const oldKey = process.env.Qwen3_235B_A22B_Instruct_2507_FP8_Yandex;
const oldFolder = process.env.yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8;
process.env.Qwen3_235B_A22B_Instruct_2507_FP8_Yandex = 'test-key';
process.env.yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8 = 'test-folder';

async function call(payload) {
  let responseBody = '';
  const req = { method: 'POST', headers: {}, body: { task: 'associative_word_score', interfaceLanguage: 'en', payload } };
  const res = { setHeader() {}, end(chunk) { responseBody = String(chunk || ''); } };
  await handler(req, res);
  return { status: res.statusCode, body: JSON.parse(responseBody) };
}

const yandexBodies = [];
globalThis.fetch = async (_url, init = {}) => {
  const body = JSON.parse(init.body);
  yandexBodies.push(body);
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ word: 'w', target_meaning: 't', directness: 1, field_relatedness: 2, domain_shift: 3, responseLanguage: 'en', short_explanation: 'ok' }) } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

let response = await call({ language: 'en', targetMeaning: 't', word: 'w', review: false, model: 'attacker/latest' });
assert.equal(response.status, 200);
assert.match(yandexBodies.at(-1).model, /qwen3\.6-35b-a3b\/latest$/, 'backend chooses Qwen3.6 for primary');
assert.doesNotMatch(yandexBodies.at(-1).model, /attacker/, 'backend ignores arbitrary client model for primary');
assert.equal(response.body.modelRole, 'primary');

response = await call({ language: 'en', targetMeaning: 't', word: 'w', review: true, primary: { final_score: 30 }, model: 'attacker/latest' });
assert.equal(response.status, 200);
assert.match(yandexBodies.at(-1).model, /qwen3-235b-a22b-fp8\/latest$/, 'backend chooses Qwen3-235B for review');
assert.doesNotMatch(yandexBodies.at(-1).model, /attacker/, 'backend ignores arbitrary client model for review');
assert.equal(response.body.modelRole, 'review');

if (oldKey == null) delete process.env.Qwen3_235B_A22B_Instruct_2507_FP8_Yandex;
else process.env.Qwen3_235B_A22B_Instruct_2507_FP8_Yandex = oldKey;
if (oldFolder == null) delete process.env.yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8;
else process.env.yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8 = oldFolder;
globalThis.fetch = oldFetch;
console.log('associative qwen backend model routing tests passed');
