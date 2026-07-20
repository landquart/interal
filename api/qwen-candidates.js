import { normalizeInterfaceLanguage } from './lib/interface-language.js';
import { buildSearchForm } from '../associativvordes/js/search-normalizer.js';

export const maxDuration = 60;

const MAX_BODY_BYTES = 100_000;
const YANDEX_CHAT_COMPLETIONS_URL = 'https://ai.api.cloud.yandex.net/v1/chat/completions';
const QWEN_MODEL = 'qwen3-235b-a22b-fp8/latest';
const CONTROL_LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'ru'];
const MAX_MODELS_PER_LANGUAGE = 5;
const MAX_CANDIDATES_PER_LANGUAGE = 2;

const ROOT_ALLOMORPH_HINTS = Object.freeze({
  alter: {
    en: ['altru'],
    de: ['altru'],
    fr: ['altru', 'autrui'],
    es: ['altru', 'otr'],
    it: ['altru', 'altrui'],
    ru: ['altru', 'альтру']
  }
});

function cors(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readRawBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('Payload too large'), { status: 413 });
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const raw = await readRawBody(req);
  return raw ? JSON.parse(raw) : {};
}

function extractJson(text) {
  const value = String(text || '').trim();
  try { return JSON.parse(value); } catch {}
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch {}
  }
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(value.slice(start, end + 1));
  throw Object.assign(new Error('AI returned invalid JSON'), { status: 502 });
}

function normalizeWord(value, maxLength = 80) {
  const word = typeof value === 'string' ? value.trim().normalize('NFC') : '';
  if (!word || word.length > maxLength || /[\r\n]/.test(word)) return '';
  return word;
}

function finiteScore(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : null;
}

function languageLower(value, language) {
  return String(value || '').toLocaleLowerCase(language === 'ru' ? 'ru' : undefined);
}

function rootVariantIsVisible(word, rootVariant, language) {
  if (languageLower(word, language).includes(languageLower(rootVariant, language))) return true;
  const normalizedWord = buildSearchForm(word);
  const normalizedVariant = buildSearchForm(rootVariant);
  return Boolean(normalizedVariant && normalizedWord.includes(normalizedVariant));
}

function normalizeCandidate(value, language) {
  const source = typeof value === 'string' ? { word: value } : value;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  const word = normalizeWord(source.word);
  const rootVariant = normalizeWord(source.root_variant ?? source.rootVariant, 40);
  if (!word || !rootVariant || !rootVariantIsVisible(word, rootVariant, language)) return null;
  return { word, root_variant: rootVariant };
}

function normalizeExistingCandidates(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(CONTROL_LANGUAGES.map((language) => {
    const values = Array.isArray(source[language]) ? source[language] : [];
    const words = [...new Set(values.map((item) => normalizeWord(item)).filter(Boolean))].slice(0, 80);
    return [language, words];
  }));
}

function normalizeCurrentModels(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(CONTROL_LANGUAGES.map(language => {
    const values = Array.isArray(source[language]) ? source[language] : [];
    const models = [];
    const seen = new Set();
    for (const raw of values) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const word = normalizeWord(raw.word);
      if (!word) continue;
      const modelKey = normalizeWord(raw.model_key ?? raw.modelKey, 240);
      const key = modelKey || languageLower(word, language);
      if (seen.has(key)) continue;
      seen.add(key);
      models.push({
        word,
        model_key: modelKey,
        frequency_score: finiteScore(raw.frequency_score ?? raw.F),
        final_score: finiteScore(raw.final_score ?? raw.P),
        association_score: finiteScore(raw.association_score ?? raw.A)
      });
      if (models.length >= MAX_MODELS_PER_LANGUAGE) break;
    }
    return [language, models];
  }));
}

function validateInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw Object.assign(new Error('Invalid body'), { status: 400 });
  const root = normalizeWord(body.root, 60);
  const targetMeaning = normalizeWord(body.targetMeaning, 160);
  const interfaceLanguage = normalizeInterfaceLanguage(body.interfaceLanguage);
  if (!root) throw Object.assign(new Error('root is required'), { status: 400 });
  if (!targetMeaning) throw Object.assign(new Error('targetMeaning is required'), { status: 400 });
  return {
    root,
    targetMeaning,
    interfaceLanguage,
    existingCandidates: normalizeExistingCandidates(body.existingCandidates),
    currentModels: normalizeCurrentModels(body.currentModels)
  };
}

function normalizeResult(result) {
  const source = result?.candidates && typeof result.candidates === 'object' ? result.candidates : {};
  const candidates = Object.fromEntries(CONTROL_LANGUAGES.map(language => [language, []]));
  for (const language of CONTROL_LANGUAGES) {
    const seen = new Set();
    for (const rawCandidate of Array.isArray(source[language]) ? source[language] : []) {
      const candidate = normalizeCandidate(rawCandidate, language);
      if (!candidate) continue;
      const key = languageLower(candidate.word, language);
      if (seen.has(key)) continue;
      seen.add(key);
      candidates[language].push(candidate);
      if (candidates[language].length >= MAX_CANDIDATES_PER_LANGUAGE) break;
    }
  }
  return candidates;
}

function allomorphHints(root) {
  const hints = ROOT_ALLOMORPH_HINTS[buildSearchForm(root)] || {};
  return Object.fromEntries(CONTROL_LANGUAGES.map(language => [language, hints[language] || []]));
}

function buildPrompt(input) {
  const hints = allomorphHints(input.root);
  return `You audit the current five lexical-association models for each control language in the Interal associative-word procedure.

The program has already selected up to five distinct derivational models per language by corpus frequency and has already calculated their frequency score F, association score A, and final score P. Your task is only to detect an important missing derivational model that a human speaker would plausibly recall as an early association with targetMeaning.

Return an additional candidate only when all of the following are true:
1. it is a real dictionary lemma in the requested language;
2. it contains a historically or morphologically justified reflex or allomorph of the requested root;
3. it represents a distinct derivational model, not an inflectional, grammatical, spelling, or part-of-speech variant of a current model;
4. it is reasonably common, not an obscure technicalism or proper name;
5. it has a credible chance of receiving a higher final P than at least the weakest current model after the program independently checks corpus frequency, SWOW, and Qwen semantic scores.

If the current five models are already adequate, return an empty array for that language. Empty arrays are valid final decisions and must not be filled merely to reach a quota. Do not repeat existingCandidates. Do not invent words or return phrases.

For Latin alter, the historical reflex altru- is mandatory to consider. When absent from currentModels, candidates such as English altruism/altruist and Russian альтруизм/альтруист are valid distinct models and should be proposed. The program will still verify every word in its local index and score it independently.

Allomorph hints: ${JSON.stringify(hints)}
Current top models with measured scores: ${JSON.stringify(input.currentModels)}
All words already found by the program: ${JSON.stringify(input.existingCandidates)}
Root: ${JSON.stringify(input.root)}
Target meaning: ${JSON.stringify(input.targetMeaning)}

Return at most ${MAX_CANDIDATES_PER_LANGUAGE} candidates per language and exactly this JSON shape:
{"candidates":{"en":[],"de":[],"fr":[],"es":[],"it":[],"ru":[]}}

Each non-empty item must be {"word":"exact dictionary lemma","root_variant":"visible root reflex inside the word"}.`;
}

function getAiText(responseJson, fallbackText) {
  const message = responseJson?.choices?.[0]?.message?.content;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.map((part) => part?.text || part?.content || '').join('\n').trim();
  return fallbackText;
}

async function callYandex(input) {
  const apiKey = process.env.Qwen3_235B_A22B_Instruct_2507_FP8_Yandex;
  const folderId = process.env.yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8;
  if (!apiKey) throw Object.assign(new Error('Missing Yandex API key'), { status: 500 });
  if (!folderId) throw Object.assign(new Error('Missing Yandex folder id'), { status: 500 });

  const requestBody = {
    model: `gpt://${folderId}/${QWEN_MODEL}`,
    messages: [
      { role: 'system', content: 'You are a conservative multilingual historical lexicographer auditing an already scored top-five list. Return only valid JSON. Empty arrays are correct when no improvement is justified.' },
      { role: 'user', content: buildPrompt(input) }
    ],
    temperature: 0,
    max_tokens: 2400,
    response_format: { type: 'json_object' }
  };

  const response = await fetch(YANDEX_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`Yandex AI Studio error: ${response.status} ${response.statusText}`);
    error.status = response.status;
    error.details = text.slice(0, 1200);
    throw error;
  }
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { text }; }
  return { content: getAiText(data, text), model: requestBody.model };
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  try {
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' });
    const input = validateInput(await readBody(req));
    const response = await callYandex(input);
    return send(res, 200, {
      ok: true,
      candidates: normalizeResult(extractJson(response.content)),
      model: response.model,
      currentModels: input.currentModels
    });
  } catch (error) {
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;
    return send(res, status, {
      ok: false,
      error: status < 500 ? error.message : 'qwen_candidate_generation_failed',
      errorCode: status < 500 ? 'QWEN_CANDIDATE_INVALID_REQUEST' : 'QWEN_CANDIDATE_GENERATION_FAILED',
      details: String(error.details || error.message || error).slice(0, 1200)
    });
  }
}
