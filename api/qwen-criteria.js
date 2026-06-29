const { getQwenLanguageInstruction, normalizeInterfaceLanguage } = require('./lib/interface-language-common.cjs');

const MODEL_NAME = 'qwen3-235b-a22b-fp8/latest';
const YANDEX_CHAT_COMPLETIONS_URL = 'https://ai.api.cloud.yandex.net/v1/chat/completions';
const MAX_BODY_BYTES = 1024 * 1024;

function setCors(req, res) {
  const origin = req.headers?.origin || '';
  const allowed = origin === 'https://landquart.github.io'
    || origin === 'http://localhost:3000'
    || origin === 'http://localhost:5173'
    || /^https:\/\/[-a-z0-9]+\.vercel\.app$/i.test(origin);

  if (allowed) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readRawBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error('Request body is too large.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function getRequestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const raw = await readRawBody(req);
  return raw ? JSON.parse(raw) : {};
}

function extractJsonFromText(text) {
  const source = String(text || '').trim();
  if (!source) throw new Error('Empty AI response.');
  try { return JSON.parse(source); } catch (_error) {}
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch (_error) {}
  }
  const first = source.indexOf('{');
  const last = source.lastIndexOf('}');
  if (first >= 0 && last > first) return JSON.parse(source.slice(first, last + 1));
  throw new Error('Could not extract JSON from AI response.');
}

function getAiText(responseJson, fallbackText) {
  const message = responseJson?.choices?.[0]?.message?.content;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.map((part) => part?.text || part?.content || '').join('\n').trim();
  return fallbackText;
}

function normalizeCriteria(data, limit) {
  const criteria = Array.isArray(data?.criteria) ? data.criteria : [];
  return criteria.slice(0, limit).map((item) => ({
    answer: ['yes', 'partially', 'no'].includes(item?.answer) ? item.answer : undefined,
    passed: Boolean(item?.passed ?? item?.value),
    value: Boolean(item?.value ?? item?.passed),
    comment: String(item?.comment || '').slice(0, 800)
  }));
}

function buildPrompt(input) {
  const interfaceLanguage = normalizeInterfaceLanguage(input.interfaceLanguage);
  const type = String(input.type || '');
  const isGrammar = type === 'grammar_short_word';
  const system = isGrammar
    ? `You evaluate a candidate Interal grammar/short word.\n${getQwenLanguageInstruction(interfaceLanguage)}\nReturn only JSON without Markdown.`
    : `You evaluate a candidate Interal domain/community word.\n${getQwenLanguageInstruction(interfaceLanguage)}\nReturn only JSON without Markdown.`;
  const schema = isGrammar
    ? { responseLanguage: interfaceLanguage, criteria: [{ name: 'criterion name', value: true, passed: true, comment: 'short justification' }] }
    : { responseLanguage: interfaceLanguage, criteria: [{ question: 'question text', answer: 'yes | partially | no', passed: true, comment: 'short justification' }] };

  const user = JSON.stringify({
    task: isGrammar ? 'Evaluate each criterion for a grammar_short_word card.' : 'Answer each question for a community_word card.',
    output_schema: schema,
    input
  }, null, 2);
  return { system, user };
}

async function callYandex(messages, withResponseFormat = true) {
  const apiKey = process.env.Qwen3_235B_A22B_Instruct_2507_FP8_Yandex;
  const folderId = process.env.yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8;
  const body = {
    model: `gpt://${folderId}/${MODEL_NAME}`,
    messages,
    temperature: 0,
    max_tokens: 1000
  };
  if (withResponseFormat) body.response_format = { type: 'json_object' };

  const response = await fetch(YANDEX_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`Yandex AI Studio error: ${response.status} ${response.statusText}`);
    error.statusCode = response.status;
    error.details = text.slice(0, 1200);
    throw error;
  }
  return { text, model: body.model };
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  try {
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'Method not allowed', details: 'Use POST.' });
    if (!process.env.Qwen3_235B_A22B_Instruct_2507_FP8_Yandex) return sendJson(res, 500, { ok: false, error: 'Missing Yandex API key', details: 'Set Qwen3_235B_A22B_Instruct_2507_FP8_Yandex in Vercel Environment Variables.' });
    if (!process.env.yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8) return sendJson(res, 500, { ok: false, error: 'Missing Yandex folder id', details: 'Set yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8 in Vercel Environment Variables.' });

    const input = await getRequestBody(req);
    const prompt = buildPrompt(input);
    const messages = [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }];
    let result;
    try {
      result = await callYandex(messages, true);
    } catch (error) {
      if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) result = await callYandex(messages, false);
      else throw error;
    }

    const responseJson = JSON.parse(result.text);
    const aiText = getAiText(responseJson, result.text);
    const parsed = extractJsonFromText(aiText);
    const limit = input.type === 'grammar_short_word' ? 4 : 3;
    return sendJson(res, 200, { ok: true, model: result.model, criteria: normalizeCriteria(parsed, limit) });
  } catch (error) {
    const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
    return sendJson(res, status, { ok: false, error: 'qwen_criteria_failed', details: String(error.details || error.message || error).slice(0, 1200) });
  }
};

module.exports._private = { getRequestBody, extractJsonFromText, normalizeCriteria, buildPrompt };
