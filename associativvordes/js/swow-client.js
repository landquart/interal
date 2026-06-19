import { normalizeWord } from './frequency-loader.js';

export const API_CONFIG = {
  swowBaseUrl: 'https://201.51.22.180/interal/swow',
  qwenAssociationUrl: '/api/qwen-association',
  qwenPrimaryModel: 'qwen3.6-35b-a3b/latest',
  qwenReviewModel: 'qwen3-235b-a22b-fp8/latest'
};

const SWOW_LANGUAGE_MAP = {
  en: 'en',
  de: 'de',
  es: 'es-rp',
  fr: null,
  it: null,
  ru: null
};

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function parseSwowAssociation(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const source = Array.isArray(payload) ? payload[0] : payload.data || payload.result || payload;
  if (!source || typeof source !== 'object') return null;
  return {
    language: source.language,
    cue: source.cue,
    response: source.response,
    r1_strength: numberOrZero(source.r1_strength ?? source.r1 ?? source.R1),
    r123_strength: numberOrZero(source.r123_strength ?? source.r123 ?? source.R123)
  };
}

export async function getSwowAssociation(language, cue, response) {
  const swowLanguage = SWOW_LANGUAGE_MAP[normalizeWord(language)];
  if (!swowLanguage) return null;

  const params = new URLSearchParams({
    language: swowLanguage,
    cue: normalizeWord(cue),
    response: normalizeWord(response)
  });
  try {
    const res = await fetch(`${API_CONFIG.swowBaseUrl}?${params}`);
    if (!res.ok) return null;
    return parseSwowAssociation(await res.json());
  } catch {
    return null;
  }
}

export async function getBidirectionalSwow(language, target, word) {
  const [targetToWord, wordToTarget] = await Promise.all([
    getSwowAssociation(language, target, word),
    getSwowAssociation(language, word, target)
  ]);
  return { target_to_word: targetToWord, word_to_target: wordToTarget };
}
