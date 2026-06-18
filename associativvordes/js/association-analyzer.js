import { getFrequencyProfile } from './frequency-loader.js';
import { getBidirectionalSwow } from './swow-client.js';
import { ASSOCIATION_SCORE_WEIGHTS, FINAL_SCORE_WEIGHTS, getQwenAssociationScores, qwenFallback } from './qwen-client.js';

export function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function calculateAssociationScore({ directness, field_relatedness, domain_shift }) {
  if (directness == null || field_relatedness == null || domain_shift == null) return null;
  return clamp(
    ASSOCIATION_SCORE_WEIGHTS.directness * directness +
    ASSOCIATION_SCORE_WEIGHTS.field_relatedness * field_relatedness +
    ASSOCIATION_SCORE_WEIGHTS.inverse_domain_shift * (100 - domain_shift),
    0,
    100
  );
}

export function calculateFinalScore({ frequency_score, association_score }) {
  if (frequency_score == null && association_score == null) return null;
  if (frequency_score == null) return association_score;
  if (association_score == null) return frequency_score;
  return clamp(
    FINAL_SCORE_WEIGHTS.frequency_score * frequency_score +
    FINAL_SCORE_WEIGHTS.association_score * association_score,
    0,
    100
  );
}

export async function analyzeAssociativeWord({ language, targetMeaning, word }) {
  const warnings = [];
  const frequency = await getFrequencyProfile(language, word).catch(error => {
    warnings.push(`Frequency unavailable: ${error.message}`);
    return { frequency_score: null, category_breakdown: {}, warnings: ['Frequency unavailable'] };
  });
  warnings.push(...(frequency.warnings || []));

  const swow = await getBidirectionalSwow(language, targetMeaning, word).catch(() => {
    warnings.push('SWOW unavailable');
    return { target_to_word: null, word_to_target: null };
  });
  if (!swow.target_to_word && !swow.word_to_target) warnings.push('No direct SWOW pair');

  const qwen = await getQwenAssociationScores({ language, targetMeaning, word, swow }).catch(() => {
    warnings.push('Qwen evaluation unavailable');
    return qwenFallback();
  });

  const association_score = calculateAssociationScore(qwen);
  const final_score = calculateFinalScore({
    frequency_score: frequency.frequency_score,
    association_score
  });

  return {
    language,
    target_meaning: targetMeaning,
    word,
    frequency,
    swow,
    association: {
      directness: qwen.directness,
      field_relatedness: qwen.field_relatedness,
      domain_shift: qwen.domain_shift,
      association_score,
      explanation: qwen.short_explanation
    },
    final_score,
    warnings
  };
}
