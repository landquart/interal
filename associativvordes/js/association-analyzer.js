import { getFrequencyProfile } from './frequency-loader.js';
import { getBidirectionalSwow, normalizeSwowWord } from './swow-client.js';
import { ASSOCIATION_SCORE_WEIGHTS, FINAL_SCORE_WEIGHTS, getQwenAssociationScores, qwenFallback } from './qwen-client.js';

export const THRESHOLDS = {
  word: 35,
  main: 35,
  reviewMin: 25,
  reviewMax: 35,
  rejectBelow: 25
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
  const translated = TARGET_MEANING_TRANSLATIONS[key]?.[lang];

  if (translated) return translated;

  return targetMeaning;
}

function hasTargetMeaningTranslation(targetMeaning, language) {
  const key = normalizeSwowWord(targetMeaning);
  const lang = normalizeSwowWord(language);
  return Boolean(TARGET_MEANING_TRANSLATIONS[key]?.[lang]);
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
  if (association_score == null) return null;
  if (frequency_score == null) return null;
  return clamp(
    FINAL_SCORE_WEIGHTS.association_score * association_score +
    FINAL_SCORE_WEIGHTS.frequency_score * frequency_score,
    0,
    100
  );
}

export function passesWordThreshold(score) {
  return Number.isFinite(Number(score)) && Number(score) >= THRESHOLDS.word;
}

export function classifyScore(final_score) {
  if (final_score == null) return 'unavailable';
  const score = Number(final_score);
  if (!Number.isFinite(score)) return 'unavailable';
  return passesWordThreshold(score) ? 'passed_threshold' : 'below_threshold';
}

export function finalAssociationPassesThreshold(finalAssociation) {
  return Number.isFinite(Number(finalAssociation)) && Number(finalAssociation) >= THRESHOLDS.main;
}

function semanticConfirmedFromQwen(qwen) {
  return Number.isFinite(Number(qwen?.directness)) && Number.isFinite(Number(qwen?.field_relatedness)) && Number.isFinite(Number(qwen?.domain_shift));
}

function buildEvaluation(qwen, frequencyScore, swowBonus) {
  const semantic_confirmed = semanticConfirmedFromQwen(qwen);
  const association_score_base = semantic_confirmed ? calculateAssociationScore(qwen) : null;
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
    semantic_confirmed,
    explanation: qwen.short_explanation
  };
}

export async function analyzeAssociativeWord({ language, targetMeaning, word, onProgress } = {}) {
  const warnings = [];
  onProgress?.('Загрузка частотных списков...');
  const frequency = await getFrequencyProfile(language, word).catch(error => {
    warnings.push(`Frequency unavailable: ${error.message}`);
    return { frequency_score: null, category_breakdown: {}, warnings: ['Frequency unavailable'] };
  });
  warnings.push(...(frequency.warnings || []));

  const swowTargetMeaning = await getTargetMeaningForLanguage(targetMeaning, language).catch(() => {
    warnings.push('Target meaning translation unavailable');
    return targetMeaning;
  });
  if (!hasTargetMeaningTranslation(targetMeaning, language)) {
    warnings.push(`No target meaning translation for ${language}; using original targetMeaning`);
  }

  onProgress?.(`SWOW: ${language} — ${word}`);
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
    onProgress?.(`Qwen3.6: ${language} — ${word}`);
    primaryQwen = await getQwenAssociationScores({ language, targetMeaning, word, swow, review: false });
  } catch (error) {
    warnings.push(`Qwen evaluation unavailable: ${error.message}`);
    primaryQwen = qwenFallback();
  }

  const primary = buildEvaluation(primaryQwen, frequency.frequency_score, swow_bonus);
  if (primary.association_score == null) warnings.push('Association score unavailable');
  if (frequency.frequency_score == null) warnings.push('Frequency score unavailable');

  let review = null;
  let finalEvaluation = primary;
  if (Number.isFinite(Number(primary.final_score)) && primary.final_score >= THRESHOLDS.reviewMin && primary.final_score <= THRESHOLDS.reviewMax) {
    try {
      onProgress?.(`Qwen review: ${language} — ${word}`);
      const reviewQwen = await getQwenAssociationScores({ language, targetMeaning, word, swow, review: true, primary });
      const averagedQwen = {
        ...reviewQwen,
        directness: (Number(primary.directness) + Number(reviewQwen.directness)) / 2,
        field_relatedness: (Number(primary.field_relatedness) + Number(reviewQwen.field_relatedness)) / 2,
        domain_shift: (Number(primary.domain_shift) + Number(reviewQwen.domain_shift)) / 2,
        short_explanation: reviewQwen.short_explanation || primary.explanation
      };
      review = buildEvaluation(reviewQwen, frequency.frequency_score, swow_bonus);
      if (review.semantic_confirmed) {
        finalEvaluation = buildEvaluation(averagedQwen, frequency.frequency_score, swow_bonus);
        finalEvaluation.combination_method = 'arithmetic_mean';
      } else {
        warnings.push('Review model returned invalid semantic scores; primary evaluation kept');
        finalEvaluation.combination_method = 'primary_only';
      }
    } catch (error) {
      warnings.push(`Review model unavailable: ${error.message}`);
      review = { status: 'review_unavailable', error: error.message };
      finalEvaluation.combination_method = 'primary_only';
    }
  } else {
    finalEvaluation.combination_method = 'primary_only';
  }
  const classification = finalEvaluation.classification;
  const final_score = finalEvaluation.final_score;

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
      Di: finalEvaluation.directness,
      Pr: finalEvaluation.field_relatedness,
      Sh: finalEvaluation.domain_shift,
      A_base: finalEvaluation.association_score_base,
      swow_bonus,
      A_final: finalEvaluation.association_score,
      F: frequency.frequency_score,
      P: final_score,
      directness: finalEvaluation.directness,
      field_relatedness: finalEvaluation.field_relatedness,
      domain_shift: finalEvaluation.domain_shift,
      association_score_base: finalEvaluation.association_score_base,
      association_score: finalEvaluation.association_score,
      explanation: finalEvaluation.explanation,
      semantic_confirmed: finalEvaluation.semantic_confirmed,
      combination_method: finalEvaluation.combination_method || 'primary_only'
    },
    primary,
    final_score,
    classification,
    review,
    diagnostics,
    warnings
  };
}
