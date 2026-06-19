import { getFrequencyProfile } from './frequency-loader.js';
import { getBidirectionalSwow, normalizeSwowWord } from './swow-client.js';
import { ASSOCIATION_SCORE_WEIGHTS, FINAL_SCORE_WEIGHTS, QWEN_RUNTIME_CONFIG, getQwenAssociationScores, qwenFallback } from './qwen-client.js';

export const THRESHOLDS = {
  main: 40,
  reviewMin: 30,
  reviewMax: 40,
  rejectBelow: 30
};

const TARGET_MEANING_TRANSLATIONS = {
  'правило': { ru: 'правило', en: 'rule', de: 'Regel', es: 'regla', fr: 'règle', it: 'regola' },
  'солнце': { ru: 'солнце', en: 'sun', de: 'Sonne', es: 'sol', fr: 'soleil', it: 'sole' }
};

export function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export async function getTargetMeaningForLanguage(targetMeaning, language) {
  const key = normalizeSwowWord(targetMeaning);
  const lang = normalizeSwowWord(language);
  return TARGET_MEANING_TRANSLATIONS[key]?.[lang] || targetMeaning;
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

function normalizeSwowStrength(value) {
  const number = Number(value) || 0;
  return number > 1 ? number / 100 : number;
}

export function calculateSwowBonus(swow) {
  if (!swow) return 0;
  const strongest = Math.max(
    normalizeSwowStrength(swow.target_to_word?.r1_strength),
    normalizeSwowStrength(swow.target_to_word?.r123_strength),
    normalizeSwowStrength(swow.word_to_target?.r1_strength),
    normalizeSwowStrength(swow.word_to_target?.r123_strength)
  );
  return clamp(strongest * 100, 0, 15);
}

export function calculateFinalScore({ frequency_score, association_score }) {
  if (frequency_score == null && association_score == null) return null;
  if (frequency_score == null) return association_score;
  if (association_score == null) return frequency_score;
  return clamp(
    FINAL_SCORE_WEIGHTS.association_score * association_score +
    FINAL_SCORE_WEIGHTS.frequency_score * frequency_score,
    0,
    100
  );
}

export function classifyScore(final_score) {
  if (final_score == null) return 'unavailable';
  if (final_score >= THRESHOLDS.main) return 'accepted';
  if (final_score >= THRESHOLDS.reviewMin && final_score < THRESHOLDS.reviewMax) return 'needs_review';
  return 'rejected';
}

function buildEvaluation(qwen, frequencyScore, swowBonus) {
  const association_score_base = calculateAssociationScore(qwen);
  const association_score = association_score_base == null ? null : clamp(association_score_base + swowBonus, 0, 100);
  const final_score = calculateFinalScore({ frequency_score: frequencyScore, association_score });
  return {
    model: qwen.model,
    directness: qwen.directness,
    field_relatedness: qwen.field_relatedness,
    domain_shift: qwen.domain_shift,
    association_score_base,
    association_score,
    final_score,
    classification: classifyScore(final_score),
    explanation: qwen.short_explanation
  };
}

export async function analyzeAssociativeWord({ language, targetMeaning, word }) {
  const warnings = [];
  const frequency = await getFrequencyProfile(language, word).catch(error => {
    warnings.push(`Frequency unavailable: ${error.message}`);
    return { frequency_score: null, category_breakdown: {}, warnings: ['Frequency unavailable'] };
  });
  warnings.push(...(frequency.warnings || []));

  const swowTargetMeaning = await getTargetMeaningForLanguage(targetMeaning, language).catch(() => {
    warnings.push('Target meaning translation unavailable');
    return targetMeaning;
  });

  const bidirectionalSwow = await getBidirectionalSwow(language, swowTargetMeaning, word).catch(error => {
    warnings.push(`SWOW unavailable: ${error.message}`);
    return { target_to_word: null, word_to_target: null };
  });
  const swowPairFound = Boolean(bidirectionalSwow.target_to_word?.found || bidirectionalSwow.word_to_target?.found);
  if (!swowPairFound) warnings.push('No SWOW pair found, association not penalized');
  for (const side of [bidirectionalSwow.target_to_word, bidirectionalSwow.word_to_target]) {
    if (side?.warning && !warnings.includes(side.warning)) warnings.push(side.warning);
  }

  const swow_bonus = calculateSwowBonus(bidirectionalSwow);
  const swow = {
    ...bidirectionalSwow,
    bonus: swow_bonus,
    source: 'local_swow'
  };

  let primaryQwen;
  try {
    primaryQwen = await getQwenAssociationScores({ language, targetMeaning, word, swow, review: false });
  } catch (error) {
    warnings.push(`Qwen evaluation unavailable: ${error.message}`);
    primaryQwen = qwenFallback();
  }

  const primary = buildEvaluation(primaryQwen, frequency.frequency_score, swow_bonus);
  if (primary.association_score == null) warnings.push('Association score unavailable');
  if (frequency.frequency_score == null) warnings.push('Frequency score unavailable');

  let review = null;
  let classification = primary.classification;
  let final_score = primary.final_score;

  if (QWEN_RUNTIME_CONFIG.enableReviewModel && primary.classification === 'needs_review') {
    try {
      const reviewQwen = await getQwenAssociationScores({ language, targetMeaning, word, swow, review: true });
      review = buildEvaluation(reviewQwen, frequency.frequency_score, swow_bonus);
      classification = review.final_score >= THRESHOLDS.main ? 'accepted_after_review' : 'rejected_after_review';
      final_score = review.final_score;
    } catch (error) {
      warnings.push(`Review Qwen unavailable: ${error.message}`);
    }
  }

  const diagnostics = {
    swowPath: swow.target_to_word?.diagnostic?.swowPath || swow.word_to_target?.diagnostic?.swowPath || null,
    swowFileLoaded: Boolean(swow.target_to_word?.diagnostic?.swowFileLoaded || swow.word_to_target?.diagnostic?.swowFileLoaded),
    swowPairFound,
    swowTargetMeaning,
    targetToWord: swow.target_to_word,
    wordToTarget: swow.word_to_target
  };
  console.debug('Associativ vordes SWOW diagnostics', diagnostics);

  return {
    language,
    target_meaning: targetMeaning,
    swow_target_meaning: swowTargetMeaning,
    word,
    frequency: {
      frequency_score: frequency.frequency_score,
      category_breakdown: frequency.category_breakdown
    },
    swow,
    association: {
      directness: primary.directness,
      field_relatedness: primary.field_relatedness,
      domain_shift: primary.domain_shift,
      association_score_base: primary.association_score_base,
      association_score: primary.association_score,
      explanation: primary.explanation
    },
    primary,
    final_score,
    classification,
    review,
    diagnostics,
    warnings
  };
}
