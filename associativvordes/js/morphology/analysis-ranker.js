export const RANKING_WEIGHTS = Object.freeze({
  fullCoverage: 0.28,
  exactRoot: 0.16,
  allomorphRoot: 0.13,
  knownPrefix: 0.06,
  knownSuffix: 0.15,
  morphotactics: 0.16,
  knownLexicalRoot: 0.18,
  inferredLexicalRoot: 0.08,
  ambiguityPenalty: 0.08,
  fallbackCeiling: 0.49
});

export function rankAnalysis(analysis) {
  let score = 0.18;
  if (analysis.fullCoverage) score += RANKING_WEIGHTS.fullCoverage;
  if (analysis.rootMatchType === 'direct') score += RANKING_WEIGHTS.exactRoot;
  else if (analysis.rootMatchType && analysis.rootMatchType !== 'unknown') score += RANKING_WEIGHTS.allomorphRoot;
  if ((analysis.prefix_chain || []).length) score += RANKING_WEIGHTS.knownPrefix;
  if ((analysis.derivational || []).length) score += RANKING_WEIGHTS.knownSuffix;
  score += RANKING_WEIGHTS.morphotactics * Number(analysis.morphotacticsScore || 0);
  if (analysis.first_lexical_root_after_preposition) score += analysis.lexicalRootSource === 'inferred_segmentation' ? RANKING_WEIGHTS.inferredLexicalRoot : RANKING_WEIGHTS.knownLexicalRoot;
  score += Math.min(0.05, Number(analysis.lexicalRootFrequency || 0) / 2000);
  score -= Math.max(0, (analysis.shortMorphCount || 0) - 1) * 0.03;
  score -= (analysis.morphotacticViolations || []).length * 0.08;
  return Math.max(0, Math.min(1, Number(score.toFixed(3))));
}

export function confidenceFor(best, second) {
  const margin = Number(((best?.confidence_score || 0) - (second?.confidence_score || 0)).toFixed(3));
  const score = best?.confidence_score || 0;
  const confidence = score >= 0.85 && margin >= 0.15 ? 'high' : (score >= 0.65 ? 'medium' : 'low');
  return { confidence, margin };
}
