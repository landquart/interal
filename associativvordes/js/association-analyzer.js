import { getFrequencyProfile } from './frequency-loader.js';
import { getBidirectionalSwow } from './swow-client.js';
import { getTargetMeaningForLanguage as translateTargetMeaningForLanguage } from './target-meaning-translator.js';
import { ASSOCIATION_SCORE_WEIGHTS, FINAL_SCORE_WEIGHTS, getQwenAssociationScores, QWEN_ERROR_CODES, QWEN_RUNTIME_CONFIG, createReviewBudget, isAbortError, normalizeAbortError } from './qwen-client.js';
import { calculateDirectDemographicAverage, requireSpeakerCount } from '../../shared/control-language-demographics.mjs';

export const THRESHOLDS = { main: 35, association: 35 };
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

// Legacy-compatible API: SWOW evidence is diagnostic only and must not change A or P.
export function calculateSwowBonus() {
  return 0;
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

export const INTERMEDIATE_LANGUAGE_STATUSES = ['idle', 'loading_index', 'grouping_candidates', 'candidate_audit', 'analyzing', 'reviewing'];
export const SUCCESS_TERMINAL_LANGUAGE_STATUSES = ['completed', 'completed_with_warnings'];
export const FAILURE_TERMINAL_LANGUAGE_STATUSES = ['no_candidates', 'index_error', 'qwen_error', 'incomplete', 'aborted'];
export const TERMINAL_LANGUAGE_STATUSES = [...SUCCESS_TERMINAL_LANGUAGE_STATUSES, ...FAILURE_TERMINAL_LANGUAGE_STATUSES];
export const LANGUAGE_STATUSES = [...INTERMEDIATE_LANGUAGE_STATUSES, ...TERMINAL_LANGUAGE_STATUSES];
export const CRITICAL_DECISION_REASONS = ['no_calculated_data', 'final_association_below_35', 'average_association_below_35', 'fewer_than_3_languages', 'fewer_than_2_groups'];
export const WARNING_DECISION_REASONS = ['semantic_not_confirmed', 'some_languages_no_candidates', 'some_languages_index_error', 'some_languages_qwen_error', 'calculation_incomplete'];
export const UNAVAILABLE_REASONS = ['no_candidates', 'index_error', 'qwen_error', 'incomplete', 'aborted', 'no_calculated_data'];

export function isFiniteScore(value) {
  if (value == null || value === '') return false;
  return Number.isFinite(Number(value));
}

export function normalizeLanguageStatus(entry = {}) {
  const hasStatus = entry && Object.prototype.hasOwnProperty.call(entry, 'status') && entry.status != null && entry.status !== '';
  const status = LANGUAGE_STATUSES.includes(entry?.status) ? entry.status : (hasStatus ? 'incomplete' : 'idle');
  const diagnostics = Array.isArray(entry?.diagnostics) ? [...entry.diagnostics] : [];
  if (hasStatus && !LANGUAGE_STATUSES.includes(entry?.status) && !diagnostics.includes('unknown_language_status')) diagnostics.push('unknown_language_status');
  return {
    status,
    errorCode: entry?.errorCode || null,
    diagnostics,
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
  const intermediate = values.filter(entry => INTERMEDIATE_LANGUAGE_STATUSES.includes(entry.status)).map(entry => entry.status);
  const failed = values.filter(entry => FAILURE_TERMINAL_LANGUAGE_STATUSES.includes(entry.status)).map(entry => entry.status);
  const successful = values.filter(entry => entry.status === 'completed').length;
  const completedWithWarnings = values.filter(entry => entry.status === 'completed_with_warnings').length;
  const hasIntermediate = intermediate.length > 0;
  const warnings = [];
  if (values.some(entry => entry.status === 'no_candidates')) warnings.push('some_languages_no_candidates');
  if (values.some(entry => entry.status === 'index_error')) warnings.push('some_languages_index_error');
  if (values.some(entry => entry.status === 'qwen_error')) warnings.push('some_languages_qwen_error');
  if (values.some(entry => ['completed', 'completed_with_warnings'].includes(entry.status) && entry.failedCount > 0)) warnings.push('partial_qwen_failure');
  if (values.some(entry => entry.status === 'completed_with_warnings')) warnings.push('completed_with_warnings');
  if (values.some(entry => entry.diagnostics?.includes('unknown_language_status'))) warnings.push('unknown_language_status');
  if (values.some(entry => ['incomplete', 'aborted'].includes(entry.status)) || hasIntermediate) warnings.push('calculation_incomplete');
  const unavailableReasons = [...new Set(values.map(entry => entry.status).filter(status => UNAVAILABLE_REASONS.includes(status)))];
  return { statuses, allTerminal, hasIntermediate, successful, completedWithWarnings, failed, intermediate, warnings: [...new Set(warnings)], unavailableReasons };
}

export function deriveGlobalStatusFromLanguageStatuses(languageStatuses = {}) {
  const summary = summarizeLanguageStatuses(languageStatuses);
  const statuses = Object.values(summary.statuses || {});
  if (!statuses.length) return 'idle';
  if (summary.hasIntermediate) return 'loading';
  if (!summary.allTerminal) return 'incomplete';
  if (statuses.some(entry => entry.status === 'aborted')) return 'aborted';
  if (statuses.some(entry => entry.status === 'incomplete')) return 'incomplete';
  return summary.warnings?.length ? 'completed_with_warnings' : 'completed';
}

export function calculateLanguageScore(items = [], {
  maxModels = Infinity,
  scoreGetter = (item) => item?.final_score,
  associationScoreGetter = (item) => item?.association_score ?? item?.analysis?.association_score ?? item?.analysis?.association?.association_score ?? item?.A_final ?? item?.analysis?.A_final
} = {}) {
  const selected = (Array.isArray(items) ? items : [])
    .filter((item) => item?.selected)
    .slice(0, maxModels);
  const scores = selected
    .map(scoreGetter)
    .map(Number)
    .filter(Number.isFinite);
  const sum = scores.reduce((acc, score) => acc + score, 0);
  const associationScores = selected
    .map(associationScoreGetter)
    .map(Number)
    .filter(Number.isFinite);
  const associationSum = associationScores.reduce((acc, score) => acc + score, 0);
  const hasCompleteAssociationData = selected.length > 0 && associationScores.length === selected.length;
  return {
    sum: scores.length ? sum : null,
    normalized: scores.length ? sum / scores.length : null,
    count: scores.length,
    associationSum: associationScores.length ? associationSum : null,
    associationNormalized: hasCompleteAssociationData ? associationSum / associationScores.length : null,
    associationCount: associationScores.length
  };
}

export function unavailableReasonsFromStatuses(languageStatuses = {}) {
  return summarizeLanguageStatuses(languageStatuses).unavailableReasons;
}

export function calculateFinalAssociation({ languages = [], languageResults = [], languageStatuses = {} } = {}) {
  const languageScores = (languages || []).map((lang, index) => ({ lang, ...(languageResults[index] || {}) }));
  const represented = languageScores.filter((score) => isFiniteScore(score.normalized) && Number(score.count) > 0);
  const hasCalculatedData = represented.length > 0;
  const totalAssociation = hasCalculatedData ? represented.reduce((acc, score) => acc + Number(score.normalized), 0) : null;
  for (const score of represented) {
    score.speakers = requireSpeakerCount(score.lang?.code);
    score.weightedScore = score.speakers * Number(score.normalized);
  }
  const weighted = hasCalculatedData
    ? calculateDirectDemographicAverage(represented.map(score => ({ language: score.lang.code, speakers: score.speakers, averageP: score.normalized })), 'averageP')
    : { speakersTotal: 0, weightedScoreTotal: 0, score: null };
  const { speakersTotal, weightedScoreTotal } = weighted;
  const finalAssociation = weighted.score;
  const representedLangs = represented.length;
  const groups = new Set(represented.map((score) => score.lang?.group).filter(Boolean));
  const languageAverageP = Object.fromEntries(represented.map((score) => [score.lang.code, Number(score.normalized)]));
  const associationRepresented = represented.filter((score) => isFiniteScore(score.associationNormalized));
  const hasCompleteAssociationData = represented.length > 0 && associationRepresented.length === represented.length;
  const weightedAssociation = hasCompleteAssociationData
    ? calculateDirectDemographicAverage(associationRepresented.map((score) => ({ language: score.lang.code, speakers: score.speakers, averageA: score.associationNormalized })), 'averageA')
    : { score: null };
  const averageAssociation = weightedAssociation.score;
  const languageAverageA = Object.fromEntries(associationRepresented.map((score) => [score.lang.code, Number(score.associationNormalized)]));
  const semanticConfirmed = represented.length > 0 && represented.every((score) => score.semanticConfirmed === true);
  const statusSummary = summarizeLanguageStatuses(languageStatuses);
  const unavailableReasons = unavailableReasonsFromStatuses(languageStatuses);
  if (!hasCalculatedData && !unavailableReasons.includes('no_calculated_data')) unavailableReasons.push('no_calculated_data');
  const accepted = hasCalculatedData
    && finalAssociationPassesThreshold(finalAssociation)
    && averageAssociationPassesThreshold(averageAssociation)
    && representedLangs >= 3
    && groups.size >= 2;
  return { languageScores, totalAssociation, speakersTotal, weightedScoreTotal, languageAverageP, languageAverageA, averageAssociation, AAverage: averageAssociation, finalAssociation, FAv: finalAssociation, representedLangs, groups: groups.size, semanticConfirmed, accepted, threshold: THRESHOLDS.main, associationThreshold: THRESHOLDS.association, hasCalculatedData, unavailableReasons, languageStatusSummary: statusSummary };
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
    if (!averageAssociationPassesThreshold(result.averageAssociation)) add(critical, 'average_association_below_35');
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
    average_association_below_35: 'association_below_threshold',
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
    && averageAssociationPassesThreshold(result.averageAssociation)
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

export function averageAssociationPassesThreshold(averageAssociation) {
  return isFiniteScore(averageAssociation) && Number(averageAssociation) >= THRESHOLDS.association;
}

function semanticConfirmedFromQwen(qwen) {
  return Number.isFinite(Number(qwen?.directness)) && Number.isFinite(Number(qwen?.field_relatedness)) && Number.isFinite(Number(qwen?.domain_shift));
}

function buildEvaluation(qwen, frequencyScore) {
  const semantic_confirmed = semanticConfirmedFromQwen(qwen);
  const association_score_base = semantic_confirmed ? calculateAssociationScore(qwen) : null;
  const association_score = association_score_base;
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

function throwIfAborted(signal, stage) {
  if (signal?.aborted) throw normalizeAbortError(signal.reason, { stage });
}

export async function analyzeAssociativeWord({ language, targetMeaning, localizedTargetMeaning, word, frequencyProfile, onProgress, onReviewRequest, onReviewEvent, reviewBudget, signal, runId } = {}) {
  throwIfAborted(signal, 'analysis_start');
  const warnings = [];
  const budget = reviewBudget || createReviewBudget({ enabled: QWEN_RUNTIME_CONFIG.enableReviewModel === true, maxRequests: QWEN_RUNTIME_CONFIG.maxReviewRequestsPerSearch });
  const reviewDiagnostics = {
    reviewEligibleCount: 0,
    reviewStartedCount: 0,
    reviewCompletedCount: 0,
    reviewFailedCount: 0,
    reviewAbortedCount: 0,
    reviewSkippedDisabledCount: 0,
    reviewSkippedBudgetCount: 0,
    reviewBudgetLimit: budget.limit
  };
  const noteReview = (key) => { reviewDiagnostics[key] += 1; onReviewEvent?.(key, { diagnostics: reviewDiagnostics, budget }); };
  const hasFrequencyProfile = frequencyProfile && typeof frequencyProfile === 'object' && Number.isFinite(Number(frequencyProfile.frequency_score));
  if (!hasFrequencyProfile) onProgress?.('Загрузка частотных списков...');
  let frequency;
  if (hasFrequencyProfile) {
    frequency = { ...frequencyProfile, warnings: Array.isArray(frequencyProfile.warnings) ? frequencyProfile.warnings : [] };
  } else {
    try {
      frequency = await getFrequencyProfile(language, word, { signal });
      throwIfAborted(signal, 'frequency_profile');
    } catch (error) {
      if (isAbortError(error, signal)) throw normalizeAbortError(error, { stage: 'frequency_profile', runId });
      warnings.push(`Frequency unavailable: ${error.message}`);
      frequency = { frequency_score: null, category_breakdown: {}, warnings: ['Frequency unavailable'] };
    }
  }
  warnings.push(...(frequency.warnings || []));

  let swowTargetMeaning = typeof localizedTargetMeaning === 'string' ? localizedTargetMeaning.trim() : '';
  if (!swowTargetMeaning && arguments[0] && !Object.prototype.hasOwnProperty.call(arguments[0], 'localizedTargetMeaning')) {
    try {
      swowTargetMeaning = await translateTargetMeaningForLanguage(targetMeaning, language, { signal });
      throwIfAborted(signal, 'target_translation');
    } catch (error) {
      if (isAbortError(error, signal)) throw normalizeAbortError(error, { stage: 'target_translation', runId });
      swowTargetMeaning = '';
    }
  }
  let bidirectionalSwow = { target_to_word: null, word_to_target: null };
  if (!swowTargetMeaning) {
    warnings.push('target_translation_unavailable');
  } else {
    onProgress?.(`SWOW: ${language} — ${word}`);
    try {
      bidirectionalSwow = await getBidirectionalSwow(language, swowTargetMeaning, word, { signal });
      throwIfAborted(signal, 'swow');
    } catch (error) {
      if (isAbortError(error, signal)) throw normalizeAbortError(error, { stage: 'swow', runId });
      warnings.push(`SWOW unavailable: ${error.message}`);
      bidirectionalSwow = { target_to_word: null, word_to_target: null };
    }
  }
  const swowPairFound = Boolean(bidirectionalSwow.target_to_word?.found || bidirectionalSwow.word_to_target?.found);
  if (!swowPairFound) warnings.push('No SWOW pair found, association not penalized');
  for (const side of [bidirectionalSwow.target_to_word, bidirectionalSwow.word_to_target]) {
    if (side?.warning && !warnings.includes(side.warning)) warnings.push(side.warning);
  }

  const swow_bonus = 0;
  const swow = {
    ...bidirectionalSwow,
    bonus: swow_bonus,
    source: 'local_swow'
  };

  onProgress?.(`Qwen3.6: ${language} — ${word}`);
  let primaryQwen;
  try {
    primaryQwen = await getQwenAssociationScores({ language, targetMeaning, word, swow, review: false, signal });
    throwIfAborted(signal, 'primary_qwen');
  } catch (error) {
    if (isAbortError(error, signal)) throw normalizeAbortError(error, { stage: 'primary_qwen', runId });
    throw error;
  }

  const primary = buildEvaluation(primaryQwen, frequency.frequency_score);
  if (primary.association_score == null) warnings.push('Association score unavailable');
  if (frequency.frequency_score == null) warnings.push('Frequency score unavailable');

  let review = null;
  let finalEvaluation = { ...primary, combination_method: 'primary_only' };
  if (shouldReviewPrimaryScore(primary.final_score)) {
    noteReview('reviewEligibleCount');
    throwIfAborted(signal, 'before_review_qwen');
    if (QWEN_RUNTIME_CONFIG.enableReviewModel !== true || budget.enabled !== true) {
      noteReview('reviewSkippedDisabledCount');
    } else if (!budget.canRequest()) {
      noteReview('reviewSkippedBudgetCount');
      warnings.push('review_budget_exhausted');
      finalEvaluation = { ...primary, combination_method: 'primary_only_review_budget_exhausted' };
    } else {
      try {
        if (!budget.reserve()) {
          noteReview('reviewSkippedBudgetCount');
          warnings.push('review_budget_exhausted');
          finalEvaluation = { ...primary, combination_method: 'primary_only_review_budget_exhausted' };
        } else {
          noteReview('reviewStartedCount');
          onReviewRequest?.();
          onProgress?.(`Qwen3-235B: ${language} — ${word}`);
          const reviewQwen = await getQwenAssociationScores({ language, targetMeaning, word, swow, review: true, primary, signal });
          throwIfAborted(signal, 'review_qwen');
          review = buildEvaluation(reviewQwen, frequency.frequency_score);
          noteReview('reviewCompletedCount');
          finalEvaluation = { ...review, combination_method: 'review_override' };
        }
      } catch (error) {
        if (isAbortError(error, signal)) { noteReview('reviewAbortedCount'); budget.releaseOnAbort?.(); throw normalizeAbortError(error, { stage: 'review_qwen', runId }); }
        noteReview('reviewFailedCount');
        warnings.push('review_failed');
        warnings.push(`review_failed: ${error.message || error}`);
        finalEvaluation = { ...primary, combination_method: 'primary_fallback_after_review_error' };
      }
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
    wordToTarget: swow.word_to_target,
    review: reviewDiagnostics
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
