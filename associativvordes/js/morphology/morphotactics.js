function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function canonical(morph) {
  return morph?.canonical || morph?.form || '';
}

export function validateMorphemeSequence({ stemLength = 0, derivational = [], connectors = [], inflection = '', config = {}, fullCoverage = true } = {}) {
  const violations = [];
  let score = 1;
  if (!fullCoverage) violations.push('incomplete_word_coverage');
  if (stemLength < Number(config.lexicalRootRules?.minimumLength || 1)) violations.push('stem_too_short');
  if (derivational.length > 1 && config.morphotacticRules?.allowMultipleDerivationalSuffixes === false) violations.push('multiple_suffixes_forbidden');
  if (connectors.length > derivational.length) violations.push('orphan_connector');

  let currentPos = 'root';
  for (let index = 0; index < derivational.length; index += 1) {
    const morph = derivational[index];
    const previous = derivational[index - 1];
    const next = derivational[index + 1];
    const allowedInput = asArray(morph.inputPos);
    if (allowedInput.length && !allowedInput.includes(currentPos) && !allowedInput.includes('root') && !allowedInput.includes('any')) violations.push(`invalid_input_pos:${canonical(morph)}`);
    const mayFollow = asArray(morph.mayFollow);
    if (mayFollow.length && previous && !mayFollow.includes(canonical(previous))) violations.push(`invalid_predecessor:${canonical(morph)}`);
    const mayPrecede = asArray(morph.mayPrecede);
    if (mayPrecede.length && next && !mayPrecede.includes(canonical(next))) violations.push(`invalid_successor:${canonical(morph)}`);
    if (Number(morph.minimumStemLength || 0) > stemLength) violations.push(`minimum_stem_length:${canonical(morph)}`);
    currentPos = Array.isArray(morph.outputPos) ? (morph.outputPos[0] || currentPos) : (morph.outputPos || currentPos);
  }

  if (inflection) {
    const ending = (config.inflectionalEndings || []).find(item => item.form === inflection);
    const applicable = asArray(ending?.applicableTo);
    if (applicable.length && !applicable.includes(currentPos) && !applicable.includes('any')) violations.push(`invalid_inflection:${inflection}`);
  }

  score -= violations.length * 0.18;
  if (derivational.length) score += 0.05;
  if (connectors.length && derivational.length) score += 0.02;
  return {
    valid: violations.length === 0,
    score: Math.max(0, Math.min(1, Number(score.toFixed(3)))),
    violations,
    resultingPartOfSpeech: currentPos
  };
}
