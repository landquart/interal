export function formatMetric(value, digits = 1) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return Number(value).toFixed(digits);
}

export function swowLabel(swow) {
  if (swow?.target_to_word?.found || swow?.word_to_target?.found) return 'SWOW direct';
  return 'no direct SWOW';
}

export function resultRowClasses(result) {
  return [
    Number(result.final_score) >= 70 ? 'is-high-final' : '',
    Number(result.association?.domain_shift) >= 65 ? 'is-high-domain-shift' : '',
    result.association?.directness == null ? 'is-qwen-missing' : '',
    (!result.swow?.target_to_word?.found && !result.swow?.word_to_target?.found) ? 'is-swow-missing' : ''
  ].filter(Boolean).join(' ');
}
