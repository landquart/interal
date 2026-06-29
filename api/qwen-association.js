const { getQwenLanguageInstruction, normalizeInterfaceLanguage } = require('./lib/interface-language.cjs');

const PRIMARY_MODEL = 'qwen3.6-35b-a3b/latest';
const REVIEW_MODEL = 'qwen3-235b-a22b-fp8/latest';
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

function modelConfig(model, review) {
  const useReview = review === true || model === REVIEW_MODEL;
  return useReview
    ? {
        kind: 'review',
        model: REVIEW_MODEL,
        apiKey: process.env.Qwen3_235B_A22B_Instruct_2507_FP8_Yandex,
        folderId: process.env.yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8
      }
    : {
        kind: 'primary',
        model: PRIMARY_MODEL,
        apiKey: process.env.Qwen3_6_35B_Yandex,
        folderId: process.env.yandex_folder_Qwen3_6_35B
      };
}

function getAiText(responseJson) {
  const message = responseJson?.choices?.[0]?.message?.content;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) {
    return message.map((part) => part?.text || part?.content || '').join('\n').trim();
  }
  return '';
}

async function callYandex(selected, system, user, withResponseFormat = true) {
  const body = {
    model: `gpt://${selected.folderId}/${selected.model}`,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0,
    max_tokens: 1200
  };
  if (withResponseFormat) body.response_format = { type: 'json_object' };

  const response = await fetch(YANDEX_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${selected.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`Yandex AI Studio error: ${response.status} ${response.statusText}`);
    error.statusCode = response.status;
    error.details = text.slice(0, 1200);
    throw error;
  }

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_error) {
    data = { text };
  }

  return {
    content: getAiText(data),
    raw: data,
    model: body.model,
    kind: selected.kind
  };
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  try {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed', details: 'Use POST.' });

    let body;
    try {
      body = await getRequestBody(req);
    } catch (error) {
      return sendJson(res, 400, {
        error: 'Invalid request body',
        details: String(error.message || error).slice(0, 1200)
      });
    }
    const interfaceLanguage = normalizeInterfaceLanguage(body.interfaceLanguage);
    const system = `${getQwenLanguageInstruction(interfaceLanguage)}\n${String(body.system || '')}`;
    const user = String(body.user || '');
    const model = body.model || PRIMARY_MODEL;
    const review = body.review === true;

    if (!system || !user) return sendJson(res, 400, { error: 'Missing system or user prompt' });

    const selected = modelConfig(model, review);
    if (!selected.apiKey) return sendJson(res, 500, { error: `Missing Yandex API key for ${selected.kind} model` });
    if (!selected.folderId) return sendJson(res, 500, { error: `Missing Yandex folder ID for ${selected.kind} model` });

    let result;
    try {
      result = await callYandex(selected, system, user, true);
    } catch (error) {
      if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
        result = await callYandex(selected, system, user, false);
      } else {
        throw error;
      }
    }

    return sendJson(res, 200, result);
  } catch (error) {
    const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
    if (error.statusCode) {
      return sendJson(res, status, {
        error: 'Yandex AI Studio error',
        status,
        details: String(error.details || error.message || error).slice(0, 1200)
      });
    }
    return sendJson(res, status, { error: 'qwen_association_failed', details: String(error.message || error).slice(0, 1200) });
  }
};

module.exports._private = {
  readRawBody,
  getRequestBody,
  modelConfig,
  getAiText,
  callYandex
};
