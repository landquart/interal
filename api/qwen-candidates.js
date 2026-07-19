import { normalizeInterfaceLanguage } from './lib/interface-language.js';
import { buildSearchForm } from '../associativvordes/js/search-normalizer.js';

const MAX_BODY_BYTES = 50_000;
const YANDEX_CHAT_COMPLETIONS_URL = 'https://ai.api.cloud.yandex.net/v1/chat/completions';
const QWEN_MODEL = 'qwen3-235b-a22b-fp8/latest';
const CONTROL_LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'ru'];
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

function validateInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw Object.assign(new Error('Invalid body'), { status: 400 });
  const root = normalizeWord(body.root, 60);
  const targetMeaning = normalizeWord(body.targetMeaning, 160);
  const interfaceLanguage = normalizeInterfaceLanguage(body.interfaceLanguage);
  if (!root) throw Object.assign(new Error('root is required'), { status: 400 });
  if (!targetMeaning) throw Object.assign(new Error('targetMeaning is required'), { status: 400 });
  return { root, targetMeaning, interfaceLanguage, existingCandidates: normalizeExistingCandidates(body.existingCandidates) };
}

function normalizeResult(result, languages = CONTROL_LANGUAGES) {
  const source = result?.candidates && typeof result.candidates === 'object' ? result.candidates : {};
  const candidates = Object.fromEntries(CONTROL_LANGUAGES.map(language => [language, []]));
  for (const language of languages) {
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

function mergeCandidateMaps(primary, repair) {
  const output = {};
  for (const language of CONTROL_LANGUAGES) {
    const seen = new Set();
    output[language] = [];
    for (const candidate of [...(primary[language] || []), ...(repair[language] || [])]) {
      const key = languageLower(candidate.word, language);
      if (seen.has(key)) continue;
      seen.add(key);
      output[language].push(candidate);
      if (output[language].length >= MAX_CANDIDATES_PER_LANGUAGE) break;
    }
  }
  return output;
}

function allomorphHints(root, languages) {
  const hints = ROOT_ALLOMORPH_HINTS[buildSearchForm(root)] || {};
  return Object.fromEntries(languages.map(language => [language, hints[language] || []]));
}

function buildPrompt(input, languages = CONTROL_LANGUAGES, repair = false) {
  const hints = allomorphHints(input.root, languages);
  return `You generate supplemental lexical candidates for the Interal associative-word procedure.

This is a morphological and etymological discovery task, not a semantic filtering task. Return real dictionary lemmas that contain a historically or morphologically transformed reflex of the requested root. Do not reject a word merely because its modern meaning has shifted far from targetMeaning: SWOW and a separate Qwen scoring stage evaluate semantics later.

The ordinary local root search has already run. Do not repeat words from existingCandidates. Do not invent words, names, phrases, inflected forms, spelling variants, or unrelated translations. Prefer dictionary headwords and distinct derivational models. Historical allomorphy is explicitly required when justified.

For Latin alter, transformed reflexes such as altru- must produce candidates such as English altruism/altruist and Russian альтруизм/альтруист when those words are absent from existingCandidates. The allomorph hints below are search directions, not permission to invent words.

Requested languages: ${JSON.stringify(languages)}
Allomorph hints: ${JSON.stringify(hints)}
Repair pass: ${repair ? 'true' : 'false'}

For every requested language, return up to ${MAX_CANDIDATES_PER_LANGUAGE} additional lemmas when genuine words exist. root_variant is mandatory. It may be written in the word's native script or in the same Latin search transliteration; it must correspond to a visible segment after normalization. Use exact native spelling for word, including Cyrillic for Russian.

Input:
${JSON.stringify(input, null, 2)}

Return exactly this JSON shape:
{"candidates":{"en":[],"de":[],"fr":[],"es":[],"it":[],"ru":[]}}`;
}

function getAiText(responseJson, fallbackText) {
  const message = responseJson?.choices?.[0]?.message?.content;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.map((part) => part?.text || part?.content || '').join('\n').trim();
  return fallbackText;
}

async function callYandex(input, { languages = CONTROL_LANGUAGES, repair = false } = {}) {
  const apiKey = process.env.Qwen3_235B_A22B_Instruct_2507_FP8_Yandex;
  const folderId = process.env.yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8;
  if (!apiKey) throw Object.assign(new Error('Missing Yandex API key'), { status: 500 });
  if (!folderId) throw Object.assign(new Error('Missing Yandex folder id'), { status: 500 });

  const requestBody = {
    model: `gpt://${folderId}/${QWEN_MODEL}`,
    messages: [
      { role: 'system', content: 'You are a conservative multilingual historical lexicographer. Return only valid JSON and never invent candidate words.' },
      { role: 'user', content: buildPrompt(input, languages, repair) }
    ],
    temperature: 0,
    max_tokens: 1800,
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
    const first = await callYandex(input);
    const primaryCandidates = normalizeResult(extractJson(first.content));
    const missingLanguages = CONTROL_LANGUAGES.filter(language => primaryCandidates[language].length === 0);
    let repairCandidates = Object.fromEntries(CONTROL_LANGUAGES.map(language => [language, []]));
    let repairModel = null;
    if (missingLanguages.length) {
      const repair = await callYandex(input, { languages: missingLanguages, repair: true });
      repairCandidates = normalizeResult(extractJson(repair.content), missingLanguages);
      repairModel = repair.model;
    }
    return send(res, 200, {
      ok: true,
      candidates: mergeCandidateMaps(primaryCandidates, repairCandidates),
      model: first.model,
      repairModel,
      repairedLanguages: missingLanguages
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
