export function optionalFiniteNumber(value) {
  if (value == null || typeof value === 'boolean') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function associativeWordWeight(item) {
  const final = optionalFiniteNumber(item?.final_score);
  if (final != null) return final;

  const analysisFinal = optionalFiniteNumber(item?.analysis?.final_score);
  if (analysisFinal != null) return analysisFinal;

  return null;
}

export function rankSortValue(value) {
  const rank = optionalFiniteNumber(value);
  return Number.isInteger(rank) && rank > 0 ? rank : Number.POSITIVE_INFINITY;
}
