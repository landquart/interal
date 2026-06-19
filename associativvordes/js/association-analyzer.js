import { getFrequencyProfile } from './frequency-loader.js';
import { getBidirectionalSwow } from './swow-client.js';
import { ASSOCIATION_SCORE_WEIGHTS, FINAL_SCORE_WEIGHTS, QWEN_RUNTIME_CONFIG, getQwenAssociationScores, qwenFallback } from './qwen-client.js';

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


function isControversial(qwen, association_score) {
  const inRange = (value, min, max) => value != null && value >= min && value <= max;
  return inRange(qwen.directness, 35, 70) ||
    inRange(qwen.field_relatedness, 35, 70) ||
    inRange(qwen.domain_shift, 35, 75) ||
    inRange(association_score, 45, 75) ||
    !String(qwen.short_explanation || '').trim() ||
    qwen.important === true;
}

function averageQwen(primary, review) {
  return {
    ...primary,
    directness: Math.round((primary.directness + review.directness) / 2),
    field_relatedness: Math.round((primary.field_relatedness + review.field_relatedness) / 2),
    domain_shift: Math.round((primary.domain_shift + review.domain_shift) / 2),
    short_explanation: review.short_explanation || primary.short_explanation || ''
  };
}

async function getReviewedQwen({ language, targetMeaning, word, swow, warnings }) {
  const primary = await getQwenAssociationScores({ language, targetMeaning, word, swow });
  const primaryAssociation = calculateAssociationScore(primary);
  const result = { primary, review: null, used_review: false, final: primary };

  const hasValidPrimaryScores = primary.directness != null && primary.field_relatedness != null && primary.domain_shift != null;
  if (!QWEN_RUNTIME_CONFIG.enableReviewModel || !hasValidPrimaryScores || !isControversial(primary, primaryAssociation)) return result;

  try {
    const review = await getQwenAssociationScores({ language, targetMeaning, word, swow, review: true });
    if (review.directness == null || review.field_relatedness == null || review.domain_shift == null) throw new Error('Incomplete review scores');
    result.review = review;
    result.used_review = true;
    result.final = averageQwen(primary, review);
    return result;
  } catch (error) {
    warnings.push(`Review Qwen unavailable: ${error.message}`);
    return result;
  }
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

  const qwenResult = await getReviewedQwen({ language, targetMeaning, word, swow, warnings }).catch((error) => {
    warnings.push(`Qwen evaluation unavailable: ${error.message}`);
    return { primary: null, review: null, used_review: false, final: qwenFallback() };
  });
  const qwen = qwenResult.final;

  const association_score = calculateAssociationScore(qwen);
  if (association_score == null) warnings.push('Association score unavailable');
  if (frequency.frequency_score == null) warnings.push('Frequency score unavailable');
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
      explanation: qwen.short_explanation,
      primary: qwenResult.primary,
      review: qwenResult.review,
      used_review: qwenResult.used_review
    },
    final_score,
    warnings
  };
}
