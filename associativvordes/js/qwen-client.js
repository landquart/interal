import { API_CONFIG } from './swow-client.js';

export const ASSOCIATION_SCORE_WEIGHTS = {
  directness: 0.50,
  field_relatedness: 0.35,
  inverse_domain_shift: 0.15
};

export const FINAL_SCORE_WEIGHTS = {
  frequency_score: 0.45,
  association_score: 0.55
};

export const QWEN_RUNTIME_CONFIG = {
  enableCandidateGeneration: false,
  enableReviewModel: false,
  maxCandidatesPerLanguage: 5,
  maxConcurrentQwenRequests: 1,
  maxReviewRequestsPerSearch: 0
};

export function qwenFallback() {
  return {
    directness: null,
    field_relatedness: null,
    domain_shift: null,
    short_explanation: 'Qwen evaluation unavailable'
  };
}

export function buildQwenAssociationPrompt({ language, targetMeaning, word, swow }) {
  return {
    system: 'You are a lexical association evaluator for an international auxiliary language project. Evaluate the semantic association between an existing word in a natural language and a target meaning. Do not evaluate the constructed Interal candidate form. Return only valid JSON. Use 0–100 integer scores. directness = how directly the word points to the target meaning. field_relatedness = how strongly the word belongs to the same semantic field as the target meaning. domain_shift = how strongly the word\'s modern meaning belongs to a different competing domain.',
    user: `Language: ${language}\nTarget meaning: ${targetMeaning}\nAssociative word: ${word}\nSWOW evidence: ${JSON.stringify(swow || {})}\n\nReturn JSON:\n{\n  "word": "...",\n  "target_meaning": "...",\n  "directness": 0-100,\n  "field_relatedness": 0-100,\n  "domain_shift": 0-100,\n  "short_explanation": "..."\n}`
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
  const raw = payload?.choices?.[0]?.message?.content ?? payload?.content ?? payload?.text ?? payload;
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
    short_explanation: object.short_explanation || object.explanation || ''
  };
}

function parseCandidatesPayload(payload) {
  const raw = payload?.content ?? payload;
  const object = typeof raw === 'string' ? JSON.parse(extractJsonText(raw)) : raw;
  const candidates = Array.isArray(object) ? object : object?.candidates;
  if (!Array.isArray(candidates)) return [];
  return candidates
    .map(candidate => ({ word: String(candidate.word || '').trim(), reason: String(candidate.reason || '').trim() }))
    .filter(candidate => candidate.word);
}

async function callQwen(prompt, { model, review = false } = {}) {
  const res = await fetch(API_CONFIG.qwenAssociationUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: prompt.system,
      user: prompt.user,
      model: model || API_CONFIG.qwenPrimaryModel,
      review
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

export async function getQwenAssociationScores({ language, targetMeaning, word, swow, review = false }) {
  const prompt = buildQwenAssociationPrompt({ language, targetMeaning, word, swow });
  return parseQwenPayload(await callQwen(prompt, {
    model: review ? API_CONFIG.qwenReviewModel : API_CONFIG.qwenPrimaryModel,
    review
  }));
}

export async function getQwenAssociativeCandidates({ language, targetMeaning, root, max = 20 }) {
  const prompt = {
    system: 'You generate candidate associative words for an international auxiliary language project. Return only valid JSON. Do not invent constructed Interal forms. Return real words in the specified natural language. Words should be associated with the target meaning and, when possible, connected to the candidate root graphically/morphologically/etymologically. Return an array.',
    user: `Language: ${language}\nTarget meaning: ${targetMeaning}\nCandidate root: ${root}\nMaximum candidates: ${max}\n\nReturn JSON:\n{\n  "candidates": [\n    {"word": "...", "reason": "..."}\n  ]\n}`
  };
  return parseCandidatesPayload(await callQwen(prompt, { model: API_CONFIG.qwenPrimaryModel, review: false })).slice(0, max);
}
