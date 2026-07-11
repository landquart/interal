import { API_CONFIG } from './swow-client.js';

export const ASSOCIATION_SCORE_WEIGHTS = {
  directness: 0.45,
  field_relatedness: 0.35,
  inverse_domain_shift: 0.20
};

export const FINAL_SCORE_WEIGHTS = {
  frequency_score: 0.35,
  association_score: 0.65
};

export const QWEN_RUNTIME_CONFIG = {
  enableCandidateGeneration: false,
  enableReviewModel: true,
  maxCandidatesPerLanguage: 5,
  maxConcurrentQwenRequests: 1,
  maxReviewRequestsPerSearch: 5
};

export function qwenFallback() {
  return {
    directness: null,
    field_relatedness: null,
    domain_shift: null,
    short_explanation: 'Qwen evaluation unavailable'
  };
}

export function getInterfaceLanguage() {
  return document.documentElement.lang?.startsWith('en') ? 'en' : 'ru';
}

export function buildQwenAssociationPrompt({ language, targetMeaning, word, swow, primary, review = false }) {
  return {
    input: { language, targetMeaning, word, swow, primary, review },
    system: 'You are a lexical association evaluator for an international auxiliary language project. Evaluate semantic association between target meaning and associative word. Do not generate candidate words. Do not evaluate the constructed Interal candidate form. Return only valid JSON. Use 0–100 integer scores. directness = how directly the word points to the target meaning. field_relatedness = how strongly the word belongs to the same semantic field as the target meaning. domain_shift = how strongly the word\'s modern meaning belongs to a different competing domain.',
    user: `Language: ${language}\nTarget meaning: ${targetMeaning}\nAssociative word: ${word}\nSWOW evidence: ${JSON.stringify(swow || {})}\nReview mode: ${review ? 'true' : 'false'}\nPrimary evaluation: ${JSON.stringify(primary || null)}\n\nReturn JSON:\n{\n  "word": "...",\n  "target_meaning": "...",\n  "directness": 0-100,\n  "field_relatedness": 0-100,\n  "domain_shift": 0-100,\n  "responseLanguage": "...",\n  "short_explanation": "..."\n}`
  };
}

function clampIntegerOrNull(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function extractJsonText(raw) {
  if (typeof raw !== 'string') return raw;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1].trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end > start) return raw.slice(start, end + 1);
  return raw.trim();
}

function parseQwenPayload(payload) {
  const raw = payload?.analysis ?? payload?.choices?.[0]?.message?.content ?? payload?.content ?? payload?.text ?? payload;
  let object;
  try {
    object = typeof raw === 'string' ? JSON.parse(extractJsonText(raw)) : raw;
  } catch (_error) {
    throw new Error(`Could not parse Qwen JSON: ${String(raw).slice(0, 500)}`);
  }
  return {
    word: object.word,
    target_meaning: object.target_meaning,
    directness: clampIntegerOrNull(object.directness),
    field_relatedness: clampIntegerOrNull(object.field_relatedness),
    domain_shift: clampIntegerOrNull(object.domain_shift),
    responseLanguage: object.responseLanguage || '',
    short_explanation: object.short_explanation || object.explanation || '',
    model: payload?.model || payload?.kind || ''
  };
}

async function callQwen(prompt, { model, review = false } = {}) {
  const res = await fetch(API_CONFIG.qwenAssociationUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task: 'associative_word_score',
      interfaceLanguage: getInterfaceLanguage(),
      payload: {
        language: prompt.input?.language,
        targetMeaning: prompt.input?.targetMeaning,
        word: prompt.input?.word,
        swow: prompt.input?.swow,
        review,
        primary: prompt.input?.primary || null,
        model: model || API_CONFIG.qwenPrimaryModel
      }
    })
  });
  if (!res.ok) {
    let details = '';
    try {
      const errorPayload = await res.json();
      details = errorPayload.details || errorPayload.error || JSON.stringify(errorPayload);
    } catch {}
    throw new Error(`Qwen HTTP ${res.status}: ${details}`);
  }
  return res.json();
}

export async function getQwenAssociationScores({ language, targetMeaning, word, swow, review = false, primary = null }) {
  const prompt = buildQwenAssociationPrompt({ language, targetMeaning, word, swow, primary, review });
  const requestedModel = review ? API_CONFIG.qwenReviewModel : API_CONFIG.qwenPrimaryModel;
  const parsed = parseQwenPayload(await callQwen(prompt, {
    model: requestedModel,
    review
  }));
  return { ...parsed, model: requestedModel };
}
