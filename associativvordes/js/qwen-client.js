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

function parseQwenPayload(payload) {
  const raw = payload?.choices?.[0]?.message?.content ?? payload?.content ?? payload?.text ?? payload;
  const object = typeof raw === 'string' ? JSON.parse(raw.replace(/^```json\s*|\s*```$/g, '')) : raw;
  return {
    word: object.word,
    target_meaning: object.target_meaning,
    directness: clampIntegerOrNull(object.directness),
    field_relatedness: clampIntegerOrNull(object.field_relatedness),
    domain_shift: clampIntegerOrNull(object.domain_shift),
    short_explanation: object.short_explanation || ''
  };
}

export async function getQwenAssociationScores({ language, targetMeaning, word, swow, review = false }) {
  const prompt = buildQwenAssociationPrompt({ language, targetMeaning, word, swow });
  const res = await fetch(API_CONFIG.qwenAssociationUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...prompt,
      model: review ? API_CONFIG.qwenReviewModel : API_CONFIG.qwenPrimaryModel,
      primaryEnv: 'Qwen3_6_35B_Yandex',
      primaryFolderEnv: 'yandex_folder_Qwen3_6_35B',
      reviewEnv: 'Qwen3_235B_A22B_Instruct_2507_FP8_Yandex',
      reviewFolderEnv: 'yandex_folder_Qwen3_235B_A22B_Instruct_2507_FP8'
    })
  });
  if (!res.ok) throw new Error(`Qwen HTTP ${res.status}`);
  return parseQwenPayload(await res.json());
}
