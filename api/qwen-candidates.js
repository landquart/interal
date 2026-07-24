import { normalizeInterfaceLanguage } from './lib/interface-language.js';
import { buildSearchForm } from '../associativvordes/js/search-normalizer.js';

export const maxDuration = 60;

const MAX_BODY_BYTES = 100_000;
const YANDEX_CHAT_COMPLETIONS_URL = 'https://ai.api.cloud.yandex.net/v1/chat/completions';
const QWEN_MODEL = 'qwen3-235b-a22b-fp8/latest';
const CONTROL_LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'ru'];
const MAX_MODELS_PER_LANGUAGE = 5;
const MAX_CANDIDATES_PER_LANGUAGE = 2;
const MAX_KNOWN_CANDIDATE_WORDS_PER_LANGUAGE = 120;
const MAX_KNOWN_MODEL_KEYS_PER_LANGUAGE = 500;
const CANDIDATE_VALIDATION_DECISIONS = new Set(['keep', 'remove_duplicate', 'remove_irrelevant', 'remove_wrong_language']);
const CANDIDATE_VALIDATION_CHECKS = Object.freeze([
  'language_match',
  'dictionary_lemma',
  'root_relation',
  'semantic_relevance',
  'distinct_model'
]);

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

const ROOT_ALLOMORPH_CANDIDATES = Object.freeze({
  alter: Object.freeze({
    en: Object.freeze([
      Object.freeze({ word: 'altruism', root_variant: 'altru' }),
      Object.freeze({ word: 'altruist', root_variant: 'altru' })
    ]),
    de: Object.freeze([
      Object.freeze({ word: 'Altruismus', root_variant: 'altru' }),
      Object.freeze({ word: 'Altruist', root_variant: 'altru' })
    ]),
    fr: Object.freeze([
      Object.freeze({ word: 'altruisme', root_variant: 'altru' }),
      Object.freeze({ word: 'altruiste', root_variant: 'altru' })
    ]),
    es: Object.freeze([
      Object.freeze({ word: 'altruismo', root_variant: 'altru' }),
      Object.freeze({ word: 'altruista', root_variant: 'altru' })
    ]),
    it: Object.freeze([
      Object.freeze({ word: 'altruismo', root_variant: 'altru' }),
      Object.freeze({ word: 'altruista', root_variant: 'altru' })
    ]),
    ru: Object.freeze([
      Object.freeze({ word: 'альтруизм', root_variant: 'альтру' }),
      Object.freeze({ word: 'альтруист', root_variant: 'альтру' })
    ])
  })
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

function candidateWordKey(value) {
  return buildSearchForm(value);
}

function normalizeValidationChecks(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const checks = {};
  for (const key of CANDIDATE_VALIDATION_CHECKS) {
    if (typeof value[key] !== 'boolean') return null;
    checks[key] = value[key];
  }
  return checks;
}

function normalizedValidationDecision(rawDecision, checks) {
  if (!checks) return '';
  if (checks.language_match === false) return 'remove_wrong_language';
  const decision = String(rawDecision || '').trim().toLowerCase();
  if (!CANDIDATE_VALIDATION_DECISIONS.has(decision)) return '';
  if (decision === 'keep' && CANDIDATE_VALIDATION_CHECKS.some(key => checks[key] !== true)) return 'remove_irrelevant';
  return decision;
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

function compactCandidateItem(raw, language, index) {
  const source = typeof raw === 'string' ? { word: raw } : raw;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  const word = normalizeWord(source.word);
  if (!word) return null;
  const item = { word, model_key: normalizeWord(source.model_key ?? source.modelKey, 240), F: finiteScore(source.F ?? source.frequency_score) };
  const rank = Number(source.rank);
  if (Number.isFinite(rank) && rank > 0) item.rank = rank;
  else if (index != null) item.rank = index + 1;
  return item;
}

function normalizeKnownCandidates(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(CONTROL_LANGUAGES.map((language) => {
    const values = Array.isArray(source[language]) ? source[language] : [];
    const seen = new Set();
    const words = [];
    for (const raw of values) {
      const item = compactCandidateItem(raw, language, words.length);
      const key = item && candidateWordKey(item.word);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      words.push(item);
      if (words.length >= MAX_KNOWN_CANDIDATE_WORDS_PER_LANGUAGE) break;
    }
    return [language, words];
  }));
}

function normalizeKnownModelKeys(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(CONTROL_LANGUAGES.map((language) => {
    const values = Array.isArray(source[language]) ? source[language] : [];
    const keys = [...new Set(values.map(item => normalizeWord(item, 240)).filter(Boolean))].slice(0, MAX_KNOWN_MODEL_KEYS_PER_LANGUAGE);
    return [language, keys];
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
      const key = candidateWordKey(word);
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
  const validationStage = body.validationStage === 'final' ? 'final' : 'initial';
  if (!root) throw Object.assign(new Error('root is required'), { status: 400 });
  if (!targetMeaning) throw Object.assign(new Error('targetMeaning is required'), { status: 400 });
  const currentTopModels = normalizeCurrentModels(body.currentTopModels ?? body.currentModels);
  const knownCandidates = normalizeKnownCandidates(body.knownCandidates ?? body.existingCandidates);
  const explicitModelKeys = normalizeKnownModelKeys(body.knownModelKeys);
  const knownModelKeys = Object.fromEntries(CONTROL_LANGUAGES.map(language => {
    const derived = knownCandidates[language].map(candidate => candidate.model_key).filter(Boolean);
    return [language, [...new Set([...(explicitModelKeys[language] || []), ...derived])].slice(0, MAX_KNOWN_MODEL_KEYS_PER_LANGUAGE)];
  }));
  return { root, targetMeaning, interfaceLanguage, validationStage, currentTopModels, knownCandidates, knownModelKeys };
}

function normalizeResult(result) {
  const source = result?.candidates && typeof result.candidates === 'object' ? result.candidates : {};
  const candidates = Object.fromEntries(CONTROL_LANGUAGES.map(language => [language, []]));
  for (const language of CONTROL_LANGUAGES) {
    const seen = new Set();
    for (const rawCandidate of Array.isArray(source[language]) ? source[language] : []) {
      const candidate = normalizeCandidate(rawCandidate, language);
      if (!candidate) continue;
      const key = candidateWordKey(candidate.word);
      if (seen.has(key)) continue;
      seen.add(key);
      candidates[language].push(candidate);
      if (candidates[language].length >= MAX_CANDIDATES_PER_LANGUAGE) break;
    }
  }
  return candidates;
}

export function normalizeCandidateValidationResult(result, input) {
  const source = result?.validation && typeof result.validation === 'object' && !Array.isArray(result.validation)
    ? result.validation
    : {};
  const validation = {};

  for (const language of CONTROL_LANGUAGES) {
    const top = input.currentTopModels[language] || [];
    if (!top.length) {
      validation[language] = [];
      continue;
    }

    const topByWord = new Map(top.map(item => [candidateWordKey(item.word), item]).filter(([key]) => Boolean(key)));
    const rawItems = source[language];
    if (!Array.isArray(rawItems) || topByWord.size !== top.length) {
      validation[language] = null;
      continue;
    }

    const decisions = new Map();
    let invalid = false;
    for (const raw of rawItems) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { invalid = true; break; }
      const word = normalizeWord(raw.word);
      const key = candidateWordKey(word);
      const checks = normalizeValidationChecks(raw.checks);
      const decision = normalizedValidationDecision(raw.decision, checks);
      const sameModelAs = normalizeWord(raw.same_model_as ?? raw.sameModelAs);
      const canonicalLexeme = normalizeWord(raw.canonical_lexeme ?? raw.canonicalLexeme);
      const reason = normalizeWord(raw.reason, 240);
      if (!key || !topByWord.has(key) || decisions.has(key) || !CANDIDATE_VALIDATION_DECISIONS.has(decision)) {
        invalid = true;
        break;
      }
      if (decision === 'keep' && !canonicalLexeme) {
        invalid = true;
        break;
      }
      if (decision === 'remove_duplicate' && (!sameModelAs || checks?.distinct_model !== false)) {
        invalid = true;
        break;
      }
      decisions.set(key, {
        word: topByWord.get(key).word,
        decision,
        checks,
        ...(sameModelAs ? { same_model_as: sameModelAs } : {}),
        ...(canonicalLexeme ? { canonical_lexeme: canonicalLexeme } : {}),
        ...(reason ? { reason } : {})
      });
    }

    if (invalid || decisions.size !== topByWord.size) {
      validation[language] = null;
      continue;
    }

    for (const item of decisions.values()) {
      if (item.decision !== 'remove_duplicate') continue;
      const targetKey = candidateWordKey(item.same_model_as);
      const target = decisions.get(targetKey);
      const removedCandidate = topByWord.get(candidateWordKey(item.word));
      const retainedCandidate = topByWord.get(targetKey);
      const removedFrequency = Number(removedCandidate?.frequency_score);
      const retainedFrequency = Number(retainedCandidate?.frequency_score);
      if (!targetKey || targetKey === candidateWordKey(item.word) || target?.decision !== 'keep') {
        invalid = true;
        break;
      }
      if (Number.isFinite(removedFrequency) && Number.isFinite(retainedFrequency) && retainedFrequency < removedFrequency) {
        invalid = true;
        break;
      }
      item.same_model_as = target.word;
      item.canonical_lexeme = target.canonical_lexeme;
    }

    validation[language] = invalid
      ? null
      : top.map(item => decisions.get(candidateWordKey(item.word)));
  }

  return validation;
}

function allomorphHints(root) {
  const hints = ROOT_ALLOMORPH_HINTS[buildSearchForm(root)] || {};
  return Object.fromEntries(CONTROL_LANGUAGES.map(language => [language, hints[language] || []]));
}

function guaranteedAllomorphCandidates(input) {
  const configured = ROOT_ALLOMORPH_CANDIDATES[buildSearchForm(input.root)] || {};
  return Object.fromEntries(CONTROL_LANGUAGES.map(language => {
    const blocked = new Set([
      ...(input.knownCandidates[language] || []).map(item => item.word),
      ...(input.currentTopModels[language] || []).map(model => model.word)
    ].map(candidateWordKey));
    const candidates = [];
    for (const raw of configured[language] || []) {
      const candidate = normalizeCandidate(raw, language);
      if (!candidate || blocked.has(candidateWordKey(candidate.word))) continue;
      candidates.push(candidate);
      if (candidates.length >= MAX_CANDIDATES_PER_LANGUAGE) break;
    }
    return [language, candidates];
  }));
}

function mergeCandidateMaps(priority, secondary) {
  return Object.fromEntries(CONTROL_LANGUAGES.map(language => {
    const output = [];
    const seen = new Set();
    for (const candidate of [...(priority[language] || []), ...(secondary[language] || [])]) {
      const key = candidateWordKey(candidate.word);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      output.push(candidate);
      if (output.length >= MAX_CANDIDATES_PER_LANGUAGE) break;
    }
    return [language, output];
  }));
}

function buildPrompt(input) {
  const hints = allomorphHints(input.root);
  const finalStage = input.validationStage === 'final';
  return `You perform a conservative set-level audit of lexical associations for each control language in the Interal associative-word procedure.

Validation stage: ${finalStage ? 'FINAL, after independent semantic scoring' : 'INITIAL, before independent semantic scoring'}.
The program has provisionally selected up to five parser-separated candidates per language. The parser can incorrectly split one lexical/derivational model into several candidates, admit a word from another language, or admit a corpus tokenization artefact. Five is a strict upper limit, not a quota: after validation a language may correctly have 0–4 retained models, and removed candidates must not be replaced merely to reach five.

Task A — validate every item in currentTopModels.
Return exactly one validation entry for every currentTopModels item, preserving its exact word spelling. Use only:
- "keep": a genuine, relevant, independent lexical association representing a distinct derivational model;
- "remove_duplicate": the same lexical/derivational model as another retained item; set same_model_as to the exact retained word;
- "remove_wrong_language": the spelling is corpus noise or a word from a different language rather than a dictionary lemma of the requested language;
- "remove_irrelevant": a false root relation, weak/unrelated association, non-independent fragment, corpus/tokenization artefact, proper name, or otherwise unsuitable item.

For every item, independently return all five boolean checks:
- language_match: it is a dictionary word of that exact requested language, not merely an English or other-language token found in its corpus;
- dictionary_lemma: it is a real usable lemma/form, not a name, OCR error, concatenation, or token fragment;
- root_relation: the requested root/allomorph is genuinely present morphologically or historically;
- semantic_relevance: the modern word is a credible association with targetMeaning;
- distinct_model: it is a separate lexical/derivational model from every retained item, not only a gender, adverbial, POS, colloquial, inflectional, spelling, hyphenation, or tokenization variant.

For "keep", all five checks must be true and canonical_lexeme must name the normalized dictionary family shared by its grammatical/POS variants. For "remove_duplicate", distinct_model must be false, same_model_as must name the retained representative, and canonical_lexeme must be the same as that representative. If language_match is false, use "remove_wrong_language". Do not infer language membership from corpus presence alone.

Within one duplicate model, normally keep the representative with the highest F. Part-of-speech, adverbial, gender, colloquial, inflectional, spelling, hyphenation, and tokenization variants do not create a new model by themselves. Apply these concrete precedents:
- English "alternate" and "alternately" are one model; retain only one representative.
- French "alternative" and "alternatif" are one model; retain only one representative.
- Russian "альтернативный" and "альтернативка" are one model; retain only one representative.
- Russian "альтер" occurring as the separated first token of "альтер эго" is not an independent model. Do not count "альтер" together with "альтер-эго"; reject the tokenization artefact.

Task B — ${finalStage ? 'do not propose any new candidates at the final stage; return empty candidate arrays for all languages' : 'propose an important missing model only when all of the following are true'}:
${finalStage ? '' : `
1. it is a real dictionary lemma in the requested language;
2. it contains a historically or morphologically justified reflex or allomorph of the requested root;
3. it represents a distinct derivational model, not an inflectional, grammatical, spelling, or part-of-speech variant of a current model;
4. it is reasonably common, not an obscure technicalism or proper name;
5. it has a credible chance of entering the frequency-selected top five after the program independently checks the word in the local frequency index.`}

${finalStage ? 'Return empty candidate arrays. This final pass may only remove or merge provisional models; it must never backfill removed items.' : 'If the retained models are already adequate, return an empty candidate array for that language. Empty arrays are valid final decisions and must not be filled merely to reach a quota. Do not return a word already present in knownCandidates. Do not return a word belonging to a knownModelKeys model unless it is genuinely a different derivational model. Do not repeat currentTopModels. Do not invent words or propose new phrases.'}

${finalStage ? '' : 'For Latin alter, the historical reflex altru- is mandatory to consider. When absent from currentTopModels, candidates such as English altruism/altruist and Russian альтруизм/альтруист are valid distinct models and should be proposed. The program will still verify every word in its local index and score it independently.'}

Allomorph hints: ${JSON.stringify(hints)}
Candidate audit payload: ${JSON.stringify({ currentTopModels: input.currentTopModels, knownCandidates: input.knownCandidates, knownModelKeys: input.knownModelKeys })}
Current top models with measured scores: ${JSON.stringify(input.currentTopModels)}
All compact known candidates, capped at ${MAX_KNOWN_CANDIDATE_WORDS_PER_LANGUAGE} words per language: ${JSON.stringify(input.knownCandidates)}
All known derivational model keys, capped at ${MAX_KNOWN_MODEL_KEYS_PER_LANGUAGE} per language: ${JSON.stringify(input.knownModelKeys)}
Root: ${JSON.stringify(input.root)}
Target meaning: ${JSON.stringify(input.targetMeaning)}

Return at most ${MAX_CANDIDATES_PER_LANGUAGE} new candidates per language and exactly this JSON shape:
{"validation":{"en":[],"de":[],"fr":[],"es":[],"it":[],"ru":[]},"candidates":{"en":[],"de":[],"fr":[],"es":[],"it":[],"ru":[]}}

Each validation item must be:
{"word":"exact currentTopModels word","decision":"keep|remove_duplicate|remove_irrelevant|remove_wrong_language","checks":{"language_match":true,"dictionary_lemma":true,"root_relation":true,"semantic_relevance":true,"distinct_model":true},"canonical_lexeme":"normalized dictionary family","same_model_as":"exact retained word when remove_duplicate","reason":"brief reason"}

The validation array must be complete whenever currentTopModels for that language is non-empty. Use an empty validation array only when currentTopModels for that language is empty.

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
      { role: 'system', content: 'You are a conservative multilingual historical lexicographer validating an upper-bounded candidate set and proposing only justified missing models. Return only valid JSON. Fewer than five retained models is correct.' },
      { role: 'user', content: buildPrompt(input) }
    ],
    temperature: 0,
    max_tokens: 5000,
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
    const guaranteedCandidates = input.validationStage === 'final'
      ? Object.fromEntries(CONTROL_LANGUAGES.map(language => [language, []]))
      : guaranteedAllomorphCandidates(input);
    let qwenCandidates = Object.fromEntries(CONTROL_LANGUAGES.map(language => [language, []]));
    let candidateValidation = Object.fromEntries(CONTROL_LANGUAGES.map(language => [language, input.currentTopModels[language]?.length ? null : []]));
    let model = null;
    let qwenAuditError = null;
    try {
      const response = await callYandex(input);
      const result = extractJson(response.content);
      qwenCandidates = input.validationStage === 'final'
        ? Object.fromEntries(CONTROL_LANGUAGES.map(language => [language, []]))
        : normalizeResult(result);
      candidateValidation = normalizeCandidateValidationResult(result, input);
      model = response.model;
    } catch (error) {
      const hasGuaranteedCandidates = CONTROL_LANGUAGES.some(language => guaranteedCandidates[language]?.length);
      if (!hasGuaranteedCandidates) throw error;
      qwenAuditError = {
        errorCode: 'QWEN_CANDIDATE_AUDIT_UNAVAILABLE',
        details: String(error.details || error.message || error).slice(0, 1200)
      };
    }
    const incompleteValidationLanguages = CONTROL_LANGUAGES.filter(language => input.currentTopModels[language]?.length && !Array.isArray(candidateValidation[language]));
    const audit = {
      status: qwenAuditError
        ? 'completed_with_fallback'
        : (incompleteValidationLanguages.length ? 'completed_with_incomplete_validation' : 'completed'),
      model,
      error: qwenAuditError ? { code: qwenAuditError.errorCode, details: qwenAuditError.details } : null,
      incompleteValidationLanguages
    };
    return send(res, 200, {
      ok: true,
      candidates: mergeCandidateMaps(guaranteedCandidates, qwenCandidates),
      qwenCandidates,
      candidateValidation,
      guaranteedCandidates,
      audit,
      qwenAuditError,
      model,
      currentTopModels: input.currentTopModels,
      knownCandidates: input.knownCandidates,
      knownModelKeys: input.knownModelKeys
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
