const fs = require('fs/promises');
const path = require('path');

const { getQwenLanguageInstruction, normalizeInterfaceLanguage } = require('./lib/interface-language.cjs');

const MODEL_NAME = 'qwen3.6-35b-a3b/latest';
const MAX_BODY_BYTES = 1024 * 1024;

const ZONES = [
  { id: 'full_compositionality', ru: 'Полная композиционность', en: 'Full compositionality', range: { P: [4, 4], R: [4, 4], C: [0, 0], E: [0, 0] } },
  { id: 'partial_compositionality', ru: 'Частичная композиционность', en: 'Partial compositionality', range: { P: [3, 4], R: [4, 4], C: [1, 1], E: [0, 1] } },
  { id: 'semantic_extension', ru: 'Семантическое расширение', en: 'Semantic extension', range: { P: [2, 3], R: [3, 4], C: [1, 2], E: [0, 2] } },
  { id: 'transfer', ru: 'Перенос', en: 'Transfer', range: { P: [1, 2], R: [2, 4], C: [2, 3], E: [0, 2] } },
  { id: 'semantic_conventionalization', ru: 'Семантическая конвенционализация', en: 'Semantic conventionalization', range: { P: [0, 1], R: [1, 3], C: [3, 4], E: [3, 4] } },
  { id: 'lexicalization', ru: 'Лексикализованность', en: 'Lexicalization', range: { P: [0, 0], R: [0, 1], C: [5, 5], E: null } }
];

function setCors(req, res) {
  const origin = req.headers.origin || '';
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

function clampScore(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(Math.round(n), min), max);
}

function clampConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(Math.max(n, 0), 1);
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

function normalizeAiResult(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const chain = Array.isArray(data.chain) ? data.chain.map((item) => String(item)).filter(Boolean).slice(0, 8) : [];
  const analogies = Array.isArray(data.analogies_used) ? data.analogies_used.map((item) => String(item)).filter(Boolean).slice(0, 8) : [];
  return {
    responseLanguage: normalizeInterfaceLanguage(data.responseLanguage || 'ru'),
    chain,
    chain_type: String(data.chain_type || 'semantic_extension'),
    P: clampScore(data.P, 0, 4),
    R: clampScore(data.R, 0, 4),
    C: clampScore(data.C, 0, 5),
    E: data.E === null ? null : clampScore(data.E, 0, 4),
    zone_hint: String(data.zone_hint || ''),
    confidence: clampConfidence(data.confidence),
    explanation: String(data.explanation || ''),
    analogies_used: analogies
  };
}

function distanceToRange(value, range) {
  if (range === null) return 0;
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 1;
  if (value < range[0]) return range[0] - value;
  if (value > range[1]) return value - range[1];
  return 0;
}

function distanceToZone(scores, zone) {
  return ['P', 'R', 'C', 'E'].reduce((sum, key) => sum + distanceToRange(scores[key], zone.range[key]), 0);
}

function getBorderlineZones(scores) {
  const distances = ZONES.map((zone) => ({ zone, distance: distanceToZone(scores, zone) })).sort((a, b) => a.distance - b.distance);
  const best = distances[0]?.distance ?? 0;
  return distances
    .filter((item) => item.distance > best && item.distance <= best + 1)
    .slice(0, 3)
    .map((item) => ({ zone_id: item.zone.id, zone_ru: item.zone.ru, zone_en: item.zone.en, distance: item.distance }));
}

function classifyByPRECE(scores) {
  const normalizedScores = {
    P: clampScore(scores.P, 0, 4),
    R: clampScore(scores.R, 0, 4),
    C: clampScore(scores.C, 0, 5),
    E: scores.E === null ? null : clampScore(scores.E, 0, 4)
  };
  const exact = ZONES.find((zone) => distanceToZone(normalizedScores, zone) === 0);
  const distances = ZONES.map((zone) => ({ zone, distance: distanceToZone(normalizedScores, zone) })).sort((a, b) => a.distance - b.distance);
  const selected = exact || distances[0].zone;
  const selectedDistance = exact ? 0 : distances[0].distance;
  const borderline_zones = getBorderlineZones(normalizedScores).filter((item) => item.zone_id !== selected.id);
  const confidence = selectedDistance === 0 && borderline_zones.length === 0 ? 'high' : selectedDistance <= 1 ? 'medium' : 'low';
  return {
    zone_id: selected.id,
    zone_ru: selected.ru,
    zone_en: selected.en,
    scores: normalizedScores,
    confidence,
    borderline_zones,
    warnings: []
  };
}

function shouldWarn(result) {
  const warnings = [];
  if (!result.ai.chain.length) warnings.push('Модель не вернула объяснительную цепочку. Проверьте оценку вручную.');
  if (result.ai.chain_type === 'lexicalized_no_working_chain' && result.computed.zone_id !== 'lexicalization') {
    warnings.push('Тип цепочки указывает на лексикализацию, но P/R/C/E попали в другую зону. Итоговая зона рассчитана по P/R/C/E.');
  }
  if (result.ai.zone_hint && !result.ai.zone_hint.toLowerCase().includes(result.computed.zone_ru.toLowerCase())) {
    warnings.push('Подсказка модели по зоне отличается от зоны, вычисленной по P/R/C/E. Использована вычисленная зона.');
  }
  return warnings;
}

function buildFormRecommendation(zone, input) {
  const separate = !['full_compositionality', 'partial_compositionality'].includes(zone.zone_id);
  const natural = input.naturalisticWord || 'натуралистическая форма';
  const regular = input.regularWord || 'регулярная форма';
  if (!separate) {
    return {
      strategy: 'regular_form_usually_enough',
      text: `Обычно достаточно логической/регулярной формы: ${regular}. Отдельная интернациональная маркировка не обязательна.`
    };
  }
  return {
    strategy: 'separate_international_marking_recommended',
    text: `Рекомендуется отдельная интернациональная маркировка: для существительного — -u (${natural}), для интернациональных прилагательных — -al/-ari/-ic, для логических прилагательных — -i; глаголы с интернациональным значением сохраняют консервативный корень, а логические — изменённую корневую основу, если она есть.`
  };
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  return normalizeText(value).split(' ').filter((token) => token.length > 1);
}

function tokenOverlapScore(a, b) {
  const aSet = new Set(tokenize(a));
  const bSet = new Set(tokenize(b));
  if (!aSet.size || !bSet.size) return 0;
  let score = 0;
  for (const token of aSet) if (bSet.has(token)) score += 1;
  return score / Math.max(aSet.size, 1);
}

function suffixes(value) {
  const clean = normalizeText(value).replace(/\s+/g, '');
  return ['ion', 'u', 'al', 'ic', 'ari', 'i'].filter((suffix) => clean.endsWith(suffix));
}

function getExampleForms(example) {
  const forms = [example.word, example.id];
  for (const key of ['logical_entries', 'international_entries']) {
    for (const entry of example[key] || []) forms.push(entry.form, entry.word, entry.term);
  }
  return forms.filter(Boolean).join(' ');
}

function getExampleChain(example) {
  const chain = example.chain || example.draft_explanatory_chain_ru || [];
  return Array.isArray(chain) ? chain.join(' ') : String(chain || '');
}

function scoreExampleSimilarity(input, example) {
  const forms = getExampleForms(example);
  const logical = (example.logical_entries || []).map((entry) => entry.meaning_ru || entry.meaning || '').join(' ');
  const international = (example.international_entries || []).map((entry) => entry.meaning_ru || entry.meaning || '').join(' ');
  const components = (input.components || []).map((item) => `${item.form || ''} ${item.meaning || ''}`).join(' ');
  const exampleChain = `${example.chain_type || ''} ${getExampleChain(example)}`;

  let score = 0;
  score += 4 * tokenOverlapScore(`${input.regularWord} ${input.naturalisticWord}`, forms);
  score += 3 * tokenOverlapScore(input.logicalMeaning, logical);
  score += 3 * tokenOverlapScore(input.internationalMeaning, international);
  score += 2 * tokenOverlapScore(components, `${forms} ${logical}`);
  const inputSuffixes = suffixes(`${input.regularWord} ${input.naturalisticWord}`);
  const exampleSuffixes = suffixes(forms);
  score += inputSuffixes.filter((suffix) => exampleSuffixes.includes(suffix)).length * 0.75;
  if (input.explanationChain) score += 1.5 * tokenOverlapScore(input.explanationChain, exampleChain);
  if (example.zone_id) score += 0.05;
  return score;
}

function safeParsePythonString(value) {
  if (!value) return '';
  return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
}

function splitTopLevelArgs(source) {
  const args = [];
  let current = '';
  let depth = 0;
  let quote = null;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const prev = source[i - 1];
    if (quote) {
      current += ch;
      if (ch === quote && prev !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; current += ch; continue; }
    if (ch === '[' || ch === '(' || ch === '{') depth += 1;
    if (ch === ']' || ch === ')' || ch === '}') depth -= 1;
    if (ch === ',' && depth === 0) { args.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function parseEntries(arg) {
  const entries = [];
  const re = /entry\(\s*(["'][\s\S]*?["'])\s*,\s*(["'][\s\S]*?["'])\s*\)/g;
  let match;
  while ((match = re.exec(arg))) {
    entries.push({ form: safeParsePythonString(match[1]), meaning_ru: safeParsePythonString(match[2]) });
  }
  return entries;
}

function parseStringList(arg) {
  const items = [];
  const re = /(["'])(.*?)(?<!\\)\1/g;
  let match;
  while ((match = re.exec(arg))) items.push(match[2]);
  return items;
}

function parseExamplesFromPython(text) {
  const examples = [];
  let index = 0;
  while (index < text.length) {
    const start = text.indexOf('ex(', index);
    if (start === -1) break;
    let i = start + 3;
    let depth = 1;
    let quote = null;
    for (; i < text.length; i += 1) {
      const ch = text[i];
      const prev = text[i - 1];
      if (quote) { if (ch === quote && prev !== '\\') quote = null; continue; }
      if (ch === '"' || ch === "'") { quote = ch; continue; }
      if (ch === '(') depth += 1;
      if (ch === ')') depth -= 1;
      if (depth === 0) break;
    }
    const args = splitTopLevelArgs(text.slice(start + 3, i));
    if (args.length >= 7) {
      const zoneId = safeParsePythonString(args[2]);
      examples.push({
        id: safeParsePythonString(args[0]),
        word: safeParsePythonString(args[0]),
        number: safeParsePythonString(args[1]),
        zone_id: zoneId,
        logical_entries: parseEntries(args[3]),
        international_entries: parseEntries(args[4]),
        chain: parseStringList(args[5]),
        chain_type: safeParsePythonString(args[6]),
        scores: null
      });
    }
    index = i + 1;
  }
  return { examples };
}

async function loadExamples() {
  const filePath = path.join(process.cwd(), 'determinatorofvalentyp', 'examples.json');
  const text = await fs.readFile(filePath, 'utf8');
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? { examples: parsed } : parsed;
  } catch (_error) {
    return parseExamplesFromPython(text);
  }
}

function pickExamples(input, examples) {
  return examples
    .map((example) => ({ ...example, similarity_score: scoreExampleSimilarity(input, example) }))
    .sort((a, b) => b.similarity_score - a.similarity_score)
    .slice(0, 8)
    .map((example) => ({
      word: example.word || example.id,
      id: example.id || example.word,
      zone_id: example.zone_id,
      logical_entries: example.logical_entries,
      international_entries: example.international_entries,
      chain: example.chain || example.draft_explanatory_chain_ru || [],
      chain_type: example.chain_type,
      similarity_score: Number(example.similarity_score.toFixed(3))
    }));
}

function buildPrompt(input, examplesUsed) {
  const interfaceLanguage = normalizeInterfaceLanguage(input.interfaceLanguage);
  const system = `You classify Interal derivatives by the P/R/C/E semantic transparency spectrum.\n\n${getQwenLanguageInstruction(interfaceLanguage)}\n\nТы классифицируешь дериваты Интераля по спектру семантической прозрачности P/R/C/E.\nОцени P Predictabilitá 0–4, R Relationalitá 0–4, C Complexitá of cheyn 0–5, E External cognoscentian dependentia 0–4 или null для полной лексикализации.\nПредложи объяснительную цепочку, но не придумывай искусственную цепочку: если рабочей цепочки нет, выбери lexicalized_no_working_chain. Если связь требует исторического/этимологического знания, повышай E. Если цепочка не помогает обычному человеку понять слово, выбирай lexicalized_no_working_chain. zone_hint — только подсказка: окончательную зону считает код.\nВерни только JSON без Markdown в формате {"responseLanguage":"ru | en","chain":["шаг 1"],"chain_type":"direct_composition | slight_focus_shift | semantic_extension | metaphorical_transfer | metonymic_transfer | historical_conventionalization | lexicalized_no_working_chain","P":0,"R":0,"C":0,"E":0,"zone_hint":"","confidence":0.0,"explanation":"","analogies_used":[]}.`;
  const user = JSON.stringify({ task: 'Классифицируй входной дериват по P/R/C/E.', input, reference_examples: examplesUsed }, null, 2);
  return { system, user };
}

function getAiText(responseJson, fallbackText) {
  const message = responseJson?.choices?.[0]?.message?.content;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) {
    return message.map((part) => part?.text || part?.content || '').join('\n').trim();
  }
  return fallbackText;
}

async function callYandex(modelUri, apiKey, messages, withResponseFormat = true) {
  const body = {
    model: modelUri,
    messages,
    temperature: 0.1,
    max_tokens: 800
  };
  if (withResponseFormat) body.response_format = { type: 'json_object' };

  const response = await fetch('https://ai.api.cloud.yandex.net/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`Yandex AI Studio error: ${response.status} ${response.statusText}`);
    error.statusCode = response.status;
    error.details = text.slice(0, 1000);
    throw error;
  }
  return text;
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  try {
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'Method not allowed', details: 'Use POST.' });
    if (!process.env.Qwen3_6_35B_Yandex) return sendJson(res, 500, { ok: false, error: 'Missing Yandex API key', details: 'Set Qwen3_6_35B_Yandex in Vercel Environment Variables.' });
    if (!process.env.yandex_folder_Qwen3_6_35B) return sendJson(res, 500, { ok: false, error: 'Missing Yandex folder id', details: 'Set yandex_folder_Qwen3_6_35B in Vercel Environment Variables.' });

    const input = await getRequestBody(req);
    const safeInput = {
      regularWord: String(input.regularWord || '').slice(0, 300),
      naturalisticWord: String(input.naturalisticWord || '').slice(0, 300),
      logicalMeaning: String(input.logicalMeaning || '').slice(0, 1000),
      internationalMeaning: String(input.internationalMeaning || '').slice(0, 1000),
      explanationChain: String(input.explanationChain || '').slice(0, 1000),
      components: Array.isArray(input.components) ? input.components.slice(0, 30).map((item) => ({ form: String(item.form || '').slice(0, 100), meaning: String(item.meaning || '').slice(0, 300), category: String(item.category || item.label || '').slice(0, 100) })) : [],
      manualScores: input.manualScores || null,
      interfaceLanguage: normalizeInterfaceLanguage(input.interfaceLanguage)
    };

    const modelUri = `gpt://${process.env.yandex_folder_Qwen3_6_35B}/${MODEL_NAME}`;
    const data = await loadExamples();
    const examplesUsed = pickExamples(safeInput, data.examples || []);
    const prompt = buildPrompt(safeInput, examplesUsed);
    const messages = [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }];

    let responseText;
    try {
      responseText = await callYandex(modelUri, process.env.Qwen3_6_35B_Yandex, messages, true);
    } catch (error) {
      if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
        responseText = await callYandex(modelUri, process.env.Qwen3_6_35B_Yandex, messages, false);
      } else {
        throw error;
      }
    }

    const responseJson = JSON.parse(responseText);
    const aiText = getAiText(responseJson, responseText);
    const ai = normalizeAiResult(extractJsonFromText(aiText));
    const computed = classifyByPRECE({ P: ai.P, R: ai.R, C: ai.C, E: ai.E });
    const result = { ok: true, model: modelUri, ai, computed, retrieval: { examples_used: examplesUsed } };
    computed.warnings = shouldWarn(result);
    computed.formRecommendation = buildFormRecommendation(computed, safeInput);
    return sendJson(res, 200, result);
  } catch (error) {
    const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
    return sendJson(res, status, { ok: false, error: 'determine_valen_type_failed', details: String(error.details || error.message || error).slice(0, 1200) });
  }
};

module.exports._private = {
  clampScore,
  normalizeAiResult,
  extractJsonFromText,
  classifyByPRECE,
  distanceToRange,
  distanceToZone,
  getBorderlineZones,
  buildFormRecommendation,
  shouldWarn,
  scoreExampleSimilarity,
  parseExamplesFromPython
};
