import { readFileSync } from 'node:fs';
import { normalizeInterfaceLanguage } from './lib/interface-language.js';
import {
  buildAltervordesSystemPrompt,
  buildAltervordesUserPrompt
} from './lib/altervordes-prompts.js';

const DERIVATION_CONTEXT = JSON.parse(
  readFileSync(new URL('./interal-derivation-context.json', import.meta.url), 'utf8')
);

const MAX_BODY_BYTES = 50_000;
const YANDEX_CHAT_COMPLETIONS_URL = 'https://ai.api.cloud.yandex.net/v1/chat/completions';
const MODEL_NAME = 'qwen3-235b-a22b-fp8/latest';
const MODEL_ENV = 'Qwen3_235B_A22B_Instruct_2507_FP8_Yandex';
const FOLDER_ENV = 'yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8';
const POS_VALUES = new Set(['noun', 'adjective', 'verb', 'adverb', 'pronoun', 'numeral', 'interjection', 'function_word', 'other']);
const DECISIONS = new Set(['accepted', 'rejected', 'needs_manual_review']);
const CONTROL_CODES = ['en', 'de', 'fr', 'es', 'it', 'ru', 'el'];
const AUXILIARY_CODES = ['pl', 'sv', 'ca', 'oc', 'ro'];
const CONCLUSION_CODES = ['en', 'de', 'fr', 'es', 'it', 'ru'];

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
  const source = String(text || '').trim();
  try { return JSON.parse(source); } catch {}
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch {}
  }
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(source.slice(start, end + 1));
  throw Object.assign(new Error('AI returned invalid JSON'), { status: 502 });
}

function validateInput(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const input = {
    translation: String(source.translation || '').trim(),
    interfaceLanguage: normalizeInterfaceLanguage(source.interfaceLanguage),
    partOfSpeech: String(source.partOfSpeech || '').trim(),
    candidate: String(source.candidate || '').trim(),
    comment: String(source.comment || '').trim()
  };
  if (!input.translation) throw Object.assign(new Error('translation is required'), { status: 400 });
  if (!POS_VALUES.has(input.partOfSpeech)) throw Object.assign(new Error('Invalid partOfSpeech'), { status: 400 });
  if (!input.candidate) throw Object.assign(new Error('candidate is required'), { status: 400 });
  return input;
}

function normalizeStringMap(value, codes) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(codes.map((code) => [code, String(source[code] || '').trim()]));
}

function normalizeShortConclusion(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw Object.assign(new Error('AI returned shortConclusion in an invalid format'), { status: 502 });
  }
  const result = {};
  for (const code of CONCLUSION_CODES) {
    const text = value[code];
    if (typeof text !== 'string' || !text.trim()) {
      throw Object.assign(new Error(`AI returned missing shortConclusion translation for ${code}`), { status: 502 });
    }
    result[code] = text.trim().slice(0, 1600);
  }
  return result;
}

function getAiText(responseJson, fallbackText) {
  const message = responseJson?.choices?.[0]?.message?.content;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.map((part) => part?.text || part?.content || '').join('\n').trim();
  return fallbackText;
}

async function callYandex(messages, withResponseFormat = true) {
  const apiKey = process.env[MODEL_ENV];
  const folderId = process.env[FOLDER_ENV];
  if (!apiKey) throw Object.assign(new Error(`Missing Yandex API key: ${MODEL_ENV}`), { status: 500 });
  if (!folderId) throw Object.assign(new Error(`Missing Yandex folder id: ${FOLDER_ENV}`), { status: 500 });

  const payload = {
    model: `gpt://${folderId}/${MODEL_NAME}`,
    messages,
    temperature: 0,
    max_tokens: 3200
  };
  if (withResponseFormat) payload.response_format = { type: 'json_object' };

  const response = await fetch(YANDEX_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`Yandex AI Studio error: ${response.status} ${response.statusText}`);
    error.status = response.status;
    error.details = text.slice(0, 1200);
    throw error;
  }
  let responseJson;
  try { responseJson = text ? JSON.parse(text) : {}; }
  catch { responseJson = { text }; }
  return { content: getAiText(responseJson, text), model: payload.model };
}

function normalizeResult(raw, input, model) {
  const decision = DECISIONS.has(raw?.decision) ? raw.decision : 'needs_manual_review';
  const eligible = decision === 'accepted' && raw?.eligible === true;
  return {
    section: 'altervordes',
    procedure: 'alter-vordes-step-6',
    responseLanguage: normalizeInterfaceLanguage(raw?.responseLanguage || input.interfaceLanguage),
    eligible,
    decision,
    recommendedForm: String(raw?.recommendedForm || input.candidate),
    partOfSpeech: POS_VALUES.has(raw?.partOfSpeech) ? raw.partOfSpeech : input.partOfSpeech,
    inputTranslation: String(raw?.inputTranslation || input.translation),
    translations: {
      controlLanguages: normalizeStringMap(raw?.translations?.controlLanguages, CONTROL_CODES),
      auxiliaryLanguages: normalizeStringMap(raw?.translations?.auxiliaryLanguages, AUXILIARY_CODES)
    },
    analysis: {
      brevity: String(raw?.analysis?.brevity || ''),
      pronounceability: String(raw?.analysis?.pronounceability || ''),
      conflicts: String(raw?.analysis?.conflicts || ''),
      neutrality: String(raw?.analysis?.neutrality || ''),
      controlAndAuxiliaryEvidence: String(raw?.analysis?.controlAndAuxiliaryEvidence || ''),
      partOfSpeechSuitability: String(raw?.analysis?.partOfSpeechSuitability || ''),
      derivationalPotential: String(raw?.analysis?.derivationalPotential || ''),
      interalRuleCompatibility: String(raw?.analysis?.interalRuleCompatibility || '')
    },
    derivation: {
      canFormVerb: Boolean(raw?.derivation?.canFormVerb),
      canFormNoun: Boolean(raw?.derivation?.canFormNoun),
      canFormAdjective: Boolean(raw?.derivation?.canFormAdjective),
      possibleDerivations: Array.isArray(raw?.derivation?.possibleDerivations)
        ? raw.derivation.possibleDerivations.map(String).slice(0, 24)
        : [],
      appliedRules: Array.isArray(raw?.derivation?.appliedRules)
        ? raw.derivation.appliedRules.map(String).slice(0, 20)
        : [],
      deWahlRuleNotes: String(raw?.derivation?.deWahlRuleNotes || ''),
      suffixAndEndingNotes: String(raw?.derivation?.suffixAndEndingNotes || ''),
      ruleSourceVersion: String(raw?.derivation?.ruleSourceVersion || DERIVATION_CONTEXT.version || '')
    },
    risks: Array.isArray(raw?.risks) ? raw.risks.map(String).slice(0, 12) : [],
    suggestedSaferForms: Array.isArray(raw?.suggestedSaferForms)
      ? raw.suggestedSaferForms.map(String).slice(0, 2)
      : [],
    shortConclusion: normalizeShortConclusion(raw?.shortConclusion),
    finalDecisionByHuman: true,
    model: { name: model, role: 'advisory evaluator', finalDecisionByHuman: true }
  };
}

async function runAnalysis(payload, interfaceLanguage) {
  const input = validateInput({ ...payload, interfaceLanguage });
  const options = { multilingualShortConclusion: true };
  const messages = [
    { role: 'system', content: buildAltervordesSystemPrompt(input.interfaceLanguage, DERIVATION_CONTEXT, options) },
    { role: 'user', content: buildAltervordesUserPrompt(input, options) }
  ];

  let result;
  try { result = await callYandex(messages, true); }
  catch (error) {
    if (error.status && error.status >= 400 && error.status < 500) result = await callYandex(messages, false);
    else throw error;
  }
  return { ok: true, analysis: normalizeResult(extractJson(result.content), input, result.model) };
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  try {
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' });
    const request = await readBody(req);
    const payload = request?.payload && typeof request.payload === 'object' ? request.payload : request;
    const interfaceLanguage = normalizeInterfaceLanguage(request?.interfaceLanguage || payload.interfaceLanguage);
    return send(res, 200, await runAnalysis(payload, interfaceLanguage));
  } catch (error) {
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;
    return send(res, status, {
      ok: false,
      error: status < 500 ? error.message : 'altervordes_analyze_failed',
      errorCode: status < 500 ? 'ALTERVORDES_INVALID_REQUEST' : 'ALTERVORDES_ANALYZE_FAILED',
      details: String(error.details || error.message || error).slice(0, 1200)
    });
  }
}
