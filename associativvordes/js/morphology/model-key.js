export const MORPHEME_PARSER_VERSION = '2.1.0';

export function buildModelKey(analysis) {
  const language = String(analysis.language || 'en').toLowerCase();
  const elementType = analysis.element_type || analysis.elementType || 'root';
  if (analysis.analysis_confidence === 'low' || analysis.fallback) {
    if (elementType === 'preposition') return `${language}|preposition-fallback|${analysis.canonical_root || ''}|${analysis.normalized_word || ''}`;
    return `${language}|fallback|${analysis.canonical_root || ''}|${analysis.normalized_word || ''}`;
  }
  if (elementType === 'preposition') return `${language}|preposition|${analysis.canonical_root || ''}|${analysis.first_lexical_root_after_preposition || ''}`;
  return `${language}|root|${(analysis.prefix_chain || []).join('+')}|${analysis.canonical_root || ''}|${analysis.first_meaningful_derivational_element || 'base'}`;
}

export function buildModelLabel(analysis) {
  if ((analysis.element_type || analysis.elementType) === 'preposition') return `${analysis.canonical_root || ''}+${analysis.first_lexical_root_after_preposition || analysis.normalized_word || ''}`;
  return `${(analysis.prefix_chain || []).length ? `${analysis.prefix_chain.join('+')}-` : ''}${analysis.canonical_root || ''}${analysis.first_meaningful_derivational_element && analysis.first_meaningful_derivational_element !== 'base' ? `-${analysis.first_meaningful_derivational_element}` : ''}`;
}
