export const RANKING_WEIGHTS = Object.freeze({ fullCoverage: 0.32, exactRoot: 0.18, allomorphRoot: 0.15, knownPrefix: 0.08, knownSuffix: 0.18, morphotactics: 0.14, knownLexicalRoot: 0.2, ambiguityPenalty: 0.08, fallbackCeiling: 0.49 });
export function rankAnalysis(a) {
  let score = 0.25;
  if (a.fullCoverage) score += RANKING_WEIGHTS.fullCoverage;
  if (a.rootMatchType === 'direct') score += RANKING_WEIGHTS.exactRoot;
  else if (a.rootMatchType && a.rootMatchType !== 'unknown') score += RANKING_WEIGHTS.allomorphRoot;
  if ((a.prefix_chain || []).length) score += RANKING_WEIGHTS.knownPrefix;
  if ((a.derivational || []).length) score += RANKING_WEIGHTS.knownSuffix;
  if (a.morphotacticsValid) score += RANKING_WEIGHTS.morphotactics;
  if (a.first_lexical_root_after_preposition) score += RANKING_WEIGHTS.knownLexicalRoot;
  score -= Math.max(0, (a.shortMorphCount || 0) - 1) * 0.03;
  return Math.max(0, Math.min(1, Number(score.toFixed(3))));
}
export function confidenceFor(best, second) {
  const margin = Number(((best?.confidence_score || 0) - (second?.confidence_score || 0)).toFixed(3));
  const score = best?.confidence_score || 0;
  const confidence = score >= 0.85 && margin >= 0.15 ? 'high' : (score >= 0.65 ? 'medium' : 'low');
  return { confidence, margin };
}
