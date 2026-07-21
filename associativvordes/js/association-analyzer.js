import { getFrequencyProfile } from './frequency-loader.js';
import { getBidirectionalSwow } from './swow-client.js';
import { getTargetMeaningForLanguage as translateTargetMeaningForLanguage } from './target-meaning-translator.js';
import { ASSOCIATION_SCORE_WEIGHTS, FINAL_SCORE_WEIGHTS, getQwenAssociationScores, QWEN_ERROR_CODES } from './qwen-client.js';

export const THRESHOLDS = { main: 35 };
export const REVIEW_SCORE_RANGE = Object.freeze({ min: 25, max: 35 });

export async function getTargetMeaningForLanguage(targetMeaning, language, options) {
  return translateTargetMeaningForLanguage(targetMeaning, language, options);
}

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
  return isFiniteScore(score);
}

export function shouldReviewPrimaryScore(score) {
  return isFiniteScore(score) && Number(score) >= REVIEW_SCORE_RANGE.min && Number(score) <= REVIEW_SCORE_RANGE.max;
}

export const LANGUAGE_STATUSES = ['idle', 'loading_index', 'no_candidates', 'analyzing', 'completed', 'index_error', 'qwen_error', 'incomplete', 'aborted'];
export const TERMINAL_LANGUAGE_STATUSES = ['completed', 'no_candidates', 'index_error', 'qwen_error', 'incomplete', 'aborted'];
export const INTERMEDIATE_LANGUAGE_STATUSES = ['idle', 'loading_index', 'analyzing'];
export const CRITICAL_DECISION_REASONS = ['no_calculated_data', 'final_association_below_35', 'fewer_than_3_languages', 'fewer_than_2_groups'];
export const WARNING_DECISION_REASONS = ['semantic_not_confirmed', 'some_languages_no_candidates', 'some_languages_index_error', 'some_languages_qwen_error', 'calculation_incomplete'];
export const UNAVAILABLE_REASONS = ['no_candidates', 'index_error', 'qwen_error', 'incomplete', 'aborted', 'no_calculated_data'];

export function isFiniteScore(value) {
  if (value == null || value === '') return false;
  return Number.isFinite(Number(value));
}

export function normalizeLanguageStatus(entry = {}) {
  const status = LANGUAGE_STATUSES.includes(entry?.status) ? entry.status : 'idle';
  return {
    status,
    errorCode: entry?.errorCode || null,
    candidateCount: Number.isFinite(Number(entry?.candidateCount)) ? Number(entry.candidateCount) : 0,
    analyzedCount: Number.isFinite(Number(entry?.analyzedCount)) ? Number(entry.analyzedCount) : 0,
    successfulCount: Number.isFinite(Number(entry?.successfulCount)) ? Number(entry.successfulCount) : 0,
    failedCount: Number.isFinite(Number(entry?.failedCount)) ? Number(entry.failedCount) : 0
  };
}

export function isLanguageTerminal(status) {
  const value = typeof status === 'string' ? status : status?.status;
  return TERMINAL_LANGUAGE_STATUSES.includes(value);
}

export function summarizeLanguageStatuses(languageStatuses = {}) {
  const statuses = Object.fromEntries(Object.entries(languageStatuses || {}).map(([code, entry]) => [code, normalizeLanguageStatus(entry)]));
  const values = Object.values(statuses);
  const allTerminal = values.length > 0 && values.every(isLanguageTerminal);
  const hasIntermediate = values.some(entry => INTERMEDIATE_LANGUAGE_STATUSES.includes(entry.status));
  const warnings = [];
  if (values.some(entry => entry.status === 'no_candidates')) warnings.push('some_languages_no_candidates');
  if (values.some(entry => entry.status === 'index_error')) warnings.push('some_languages_index_error');
  if (values.some(entry => entry.status === 'qwen_error')) warnings.push('some_languages_qwen_error');
  if (values.some(entry => entry.status === 'completed' && entry.failedCount > 0)) warnings.push('partial_qwen_failure');
  if (values.some(entry => ['incomplete', 'aborted'].includes(entry.status)) || hasIntermediate) warnings.push('calculation_incomplete');
  return { statuses, allTerminal, hasIntermediate, warnings: [...new Set(warnings)] };
}

export function calculateLanguageScore(items = [], { maxModels = Infinity, scoreGetter = (item) => item?.final_score } = {}) {
  const selected = (Array.isArray(items) ? items : [])
    .filter((item) => item?.selected)
    .slice(0, maxModels);
  const scores = selected
    .map(scoreGetter)
    .map(Number)
    .filter(Number.isFinite);
  const sum = scores.reduce((acc, score) => acc + score, 0);
  return {
    sum: scores.length ? sum : null,
    normalized: scores.length ? sum / scores.length : null,
    count: scores.length
  };
}

export function unavailableReasonsFromStatuses(languageStatuses = {}) {
  const { statuses } = summarizeLanguageStatuses(languageStatuses);
  const reasons = new Set();
  Object.values(statuses).forEach((entry) => {
    if (UNAVAILABLE_REASONS.includes(entry.status)) reasons.add(entry.status);
  });
  return [...reasons];
}

export function calculateFinalAssociation({ languages = [], languageResults = [], languageStatuses = {} } = {}) {
  const languageScores = (languages || []).map((lang, index) => ({ lang, ...(languageResults[index] || {}) }));
  const represented = languageScores.filter((score) => isFiniteScore(score.normalized) && Number(score.count) > 0);
  const hasCalculatedData = represented.length > 0;
  const totalAssociation = hasCalculatedData ? represented.reduce((acc, score) => acc + Number(score.normalized), 0) : null;
  const finalAssociation = hasCalculatedData ? totalAssociation / represented.length : null;
  const representedLangs = represented.length;
  const groups = new Set(represented.map((score) => score.lang?.group).filter(Boolean));
  const semanticConfirmed = represented.length > 0 && represented.every((score) => score.semanticConfirmed === true);
  const statusSummary = summarizeLanguageStatuses(languageStatuses);
  const unavailableReasons = unavailableReasonsFromStatuses(languageStatuses);
  if (!hasCalculatedData && !unavailableReasons.includes('no_calculated_data')) unavailableReasons.push('no_calculated_data');
  const accepted = hasCalculatedData
    && finalAssociationPassesThreshold(finalAssociation)
    && representedLangs >= 3
    && groups.size >= 2;
  return { languageScores, totalAssociation, finalAssociation, representedLangs, groups: groups.size, semanticConfirmed, accepted, hasCalculatedData, unavailableReasons, languageStatusSummary: statusSummary };
}

export function buildDecisionReasons(result = {}) {
  const critical = [];
  const warnings = [];
  const add = (target, reason) => { if (!target.includes(reason)) target.push(reason); };
  const summary = result.languageStatusSummary || summarizeLanguageStatuses(result.languageStatuses || {});
  if (summary.hasIntermediate) add(warnings, 'calculation_incomplete');
  if (!result.hasCalculatedData || !isFiniteScore(result.finalAssociation)) {
    add(critical, 'no_calculated_data');
  } else {
    if (Number(result.finalAssociation) < THRESHOLDS.main) add(critical, 'final_association_below_35');
    if (Number(result.representedLangs) < 3) add(critical, 'fewer_than_3_languages');
    if (Number(result.groups) < 2) add(critical, 'fewer_than_2_groups');
    if (!result.semanticConfirmed) add(warnings, 'semantic_not_confirmed');
  }
  for (const warning of summary.warnings || []) {
    if (WARNING_DECISION_REASONS.includes(warning)) add(warnings, warning);
  }
  return { critical, warnings };
}

export function finalAssociationRejectionReasons(result = {}) {
  const { critical } = buildDecisionReasons(result);
  const legacy = {
    no_calculated_data: 'no_calculated_languages',
    fewer_than_3_languages: 'fewer_languages',
    fewer_than_2_groups: 'fewer_groups',
    final_association_below_35: 'below_threshold',
    semantic_not_confirmed: 'semantic_unconfirmed'
  };
  return critical.map(reason => legacy[reason] || reason);
}

export function decisionStatusForResult(result = {}) {
  const reasons = buildDecisionReasons(result);
  if (!result.hasCalculatedData || !isFiniteScore(result.finalAssociation)) return 'insufficient_data';
  return reasons.critical.length ? 'reject' : 'accept';
}

export function canCreateAssociativeJsonCard(result = {}) {
  return Boolean(result.hasCalculatedData
    && finalAssociationPassesThreshold(result.finalAssociation)
    && Number(result.representedLangs) >= 3
    && Number(result.groups) >= 2
    && result.accepted);
}

export function classifyScore(final_score) {
  return isFiniteScore(final_score) ? 'evaluated' : 'unavailable';
}

export function finalAssociationPassesThreshold(finalAssociation) {
  return isFiniteScore(finalAssociation) && Number(finalAssociation) >= THRESHOLDS.main;
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

export async function analyzeAssociativeWord({ language, targetMeaning, localizedTargetMeaning, word, frequencyProfile, onProgress, onReviewRequest, signal } = {}) {
  const warnings = [];
  const hasFrequencyProfile = frequencyProfile && typeof frequencyProfile === 'object' && Number.isFinite(Number(frequencyProfile.frequency_score));
  if (!hasFrequencyProfile) onProgress?.('Загрузка частотных списков...');
  const frequency = hasFrequencyProfile ? { ...frequencyProfile, warnings: Array.isArray(frequencyProfile.warnings) ? frequencyProfile.warnings : [] } : await getFrequencyProfile(language, word).catch(error => {
    warnings.push(`Frequency unavailable: ${error.message}`);
    return { frequency_score: null, category_breakdown: {}, warnings: ['Frequency unavailable'] };
  });
  warnings.push(...(frequency.warnings || []));

  let swowTargetMeaning = typeof localizedTargetMeaning === 'string' ? localizedTargetMeaning.trim() : '';
  if (!swowTargetMeaning && arguments[0] && !Object.prototype.hasOwnProperty.call(arguments[0], 'localizedTargetMeaning')) {
    swowTargetMeaning = await translateTargetMeaningForLanguage(targetMeaning, language).catch(() => '');
  }
  let bidirectionalSwow = { target_to_word: null, word_to_target: null };
  if (!swowTargetMeaning) {
    warnings.push('target_translation_unavailable');
  } else {
    onProgress?.(`SWOW: ${language} — ${word}`);
    bidirectionalSwow = await getBidirectionalSwow(language, swowTargetMeaning, word).catch(error => {
      warnings.push(`SWOW unavailable: ${error.message}`);
      return { target_to_word: null, word_to_target: null };
    });
  }
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

  onProgress?.(`Qwen3.6: ${language} — ${word}`);
  const primaryQwen = await getQwenAssociationScores({ language, targetMeaning, word, swow, review: false, signal });

  const primary = buildEvaluation(primaryQwen, frequency.frequency_score, swow_bonus);
  if (primary.association_score == null) warnings.push('Association score unavailable');
  if (frequency.frequency_score == null) warnings.push('Frequency score unavailable');

  let review = null;
  let finalEvaluation = { ...primary, combination_method: 'primary_only' };
  if (shouldReviewPrimaryScore(primary.final_score)) {
    try {
      onReviewRequest?.();
      onProgress?.(`Qwen3-235B: ${language} — ${word}`);
      const reviewQwen = await getQwenAssociationScores({ language, targetMeaning, word, swow, review: true, primary, signal });
      review = buildEvaluation(reviewQwen, frequency.frequency_score, swow_bonus);
      finalEvaluation = { ...review, combination_method: 'review_override' };
    } catch (error) {
      warnings.push('review_failed');
      warnings.push(`review_failed: ${error.message || error}`);
      finalEvaluation = { ...primary, combination_method: 'primary_fallback_after_review_error' };
    }
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
      model: finalEvaluation.model,
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
