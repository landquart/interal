import { normalizeForMorphology, mapNormalizedRangeToOriginal } from './normalizer.js';
import { getLanguageConfig } from './languages/index.js';
import { ROOT_ALLOMORPHS } from './data/root-allomorphs.js';
import { MANUALLY_VERIFIED_ROOTS } from './data/manually-verified-roots.js';
import { segmentTail, parsePrefixChain } from './segmentation-engine.js';
import { validateMorphemeSequence } from './morphotactics.js';
import { getLexicalRootCandidates, registerVerifiedLexicalRoots } from './lexical-root-index.js';
import { rankAnalysis, confidenceFor } from './analysis-ranker.js';
import { MORPHEME_PARSER_VERSION, buildModelKey, buildModelLabel } from './model-key.js';

const cache = new Map();
const langCode = language => String(language || 'en').toLowerCase();
const norm = (value, language) => normalizeForMorphology(value, language).normalized;

function allomorphVariants(language, canonicalRoot, matchedRootVariant) {
  const code = langCode(language);
  const canonical = norm(canonicalRoot, code);
  const matched = norm(matchedRootVariant, code);
  const variants = [{ form: canonical, canonicalRoot: canonical, type: 'direct', confidence: 1 }];
  if (matched && matched !== canonical) variants.push({ form: matched, canonicalRoot: canonical, type: 'match_variant', confidence: 0.85 });
  for (const row of ROOT_ALLOMORPHS) {
    if (row.language !== code || norm(row.canonicalRoot, code) !== canonical) continue;
    for (const variant of row.variants) {
      variants.push({ ...variant, form: norm(variant.transliteration || variant.form, code), canonicalRoot: canonical });
      if (variant.transliteration && variant.form) variants.push({ ...variant, form: norm(variant.form, code), canonicalRoot: canonical });
    }
  }
  return [...new Map(variants.filter(item => item.form).map(item => [item.form, item])).values()]
    .sort((a, b) => b.form.length - a.form.length || b.confidence - a.confidence || a.form.localeCompare(b.form));
}

function fallback(base, reason) {
  const output = {
    ...base,
    prefix_chain: [], ignored_connectors: [], first_meaningful_derivational_element: '', following_derivational_elements: [], inflectional_ending: '', first_lexical_root_after_preposition: '', analysis_confidence: 'low', confidence_score: 0.35, confidence_margin: 0,
    diagnostic_reason: reason === 'lexical_root_not_found' ? 'lexical_root_not_found' : 'morpheme_parse_fallback', warnings: ['morpheme_parse_fallback'], best_analysis: null, alternative_analyses: [], fallback: true
  };
  output.model_key = buildModelKey(output);
  output.model_label = buildModelLabel(output);
  return output;
}

function assemble(base, candidate, alternatives) {
  const second = alternatives.find(item => item !== candidate) || null;
  const confidence = confidenceFor(candidate, second);
  const low = confidence.confidence === 'low';
  const diagnostic = low
    ? 'morpheme_parse_fallback'
    : (confidence.margin < 0.15 ? 'ambiguous_morpheme_parse' : (candidate.rootMatchType === 'direct' ? 'exact_morpheme_parse' : 'allomorph_morpheme_parse'));
  const output = {
    ...base,
    prefix_chain: candidate.prefix_chain || [],
    ignored_connectors: candidate.ignored_connectors || [],
    first_meaningful_derivational_element: base.element_type === 'preposition'
      ? (candidate.first_lexical_root_after_preposition || '')
      : (candidate.derivational?.[0]?.canonical || candidate.defaultFirstDerivationalElement || 'base'),
    following_derivational_elements: (candidate.derivational || []).slice(1).map(item => item.canonical),
    inflectional_ending: candidate.inflectional_ending || '',
    first_lexical_root_after_preposition: candidate.first_lexical_root_after_preposition || '',
    analysis_confidence: low ? 'low' : confidence.confidence,
    confidence_score: candidate.confidence_score,
    confidence_margin: confidence.margin,
    diagnostic_reason: diagnostic,
    warnings: low ? ['morpheme_parse_fallback'] : (diagnostic === 'ambiguous_morpheme_parse' ? ['ambiguous_morpheme_parse'] : []),
    best_analysis: candidate,
    alternative_analyses: alternatives.filter(item => item !== candidate).slice(0, 4),
    fallback: low
  };
  output.model_key = buildModelKey(output);
  output.model_label = buildModelLabel(output);
  return output;
}

function enrichAnalysis(analysis, config, stemLength) {
  const validation = validateMorphemeSequence({
    stemLength,
    derivational: analysis.derivational,
    connectors: analysis.ignored_connectors,
    inflection: analysis.inflectional_ending,
    config,
    fullCoverage: analysis.fullCoverage
  });
  analysis.morphotacticsValid = validation.valid;
  analysis.morphotacticsScore = validation.score;
  analysis.morphotacticViolations = validation.violations;
  analysis.resultingPartOfSpeech = validation.resultingPartOfSpeech;
  analysis.confidence_score = rankAnalysis(analysis);
  return analysis;
}

function rootAnalyses(base, config, word, variants, explicitIndex) {
  const output = [];
  for (const variant of variants) {
    const starts = [];
    if (Number.isInteger(explicitIndex) && explicitIndex >= 0 && word.slice(explicitIndex, explicitIndex + variant.form.length) === variant.form) starts.push(explicitIndex);
    let index = word.indexOf(variant.form);
    while (index >= 0) { if (!starts.includes(index)) starts.push(index); index = word.indexOf(variant.form, index + 1); }
    for (const start of starts) {
      const prefix = parsePrefixChain(word.slice(0, start), config);
      if (prefix.unparsed) continue;
      const tail = word.slice(start + variant.form.length);
      for (const segment of segmentTail(tail, config, { maxAnalyses: 16 })) {
        output.push(enrichAnalysis({
          root_start: start,
          root_end: start + variant.form.length,
          matched_root_variant: variant.form,
          rootMatchType: variant.type,
          defaultFirstDerivationalElement: variant.defaultFirstDerivationalElement || '',
          prefix_chain: prefix.chain,
          ignored_connectors: segment.connectors,
          service_morphs: segment.serviceMorphs,
          derivational: segment.derivational,
          inflectional_ending: segment.inflectional,
          fullCoverage: segment.fullCoverage,
          shortMorphCount: segment.derivational.filter(item => item.form.length <= 2).length
        }, config, variant.form.length));
      }
    }
  }
  return output.sort((a, b) => b.confidence_score - a.confidence_score || a.root_start - b.root_start || a.matched_root_variant.localeCompare(b.matched_root_variant)).slice(0, 12);
}

function prepositionAnalyses(base, config, word, prefix) {
  if (!word.startsWith(prefix)) return [];
  const remainder = word.slice(prefix.length);
  registerVerifiedLexicalRoots(base.language, MANUALLY_VERIFIED_ROOTS[base.language] || []);
  const roots = getLexicalRootCandidates(base.language, remainder, { config, manuallyVerified: MANUALLY_VERIFIED_ROOTS[base.language] || [] });
  const output = [];
  for (const root of roots) {
    if (!remainder.startsWith(root.form)) continue;
    const tail = remainder.slice(root.form.length);
    for (const segment of segmentTail(tail, config, { maxAnalyses: 16 })) {
      output.push(enrichAnalysis({
        root_start: 0,
        root_end: prefix.length,
        matched_root_variant: prefix,
        rootMatchType: 'direct',
        prefix_chain: [prefix],
        first_lexical_root_after_preposition: root.canonical || root.form,
        lexicalRootSource: root.source,
        lexicalRootFrequency: root.frequency,
        lexicalRootConfidence: root.confidence,
        ignored_connectors: segment.connectors,
        service_morphs: segment.serviceMorphs,
        derivational: segment.derivational,
        inflectional_ending: segment.inflectional,
        fullCoverage: segment.fullCoverage,
        shortMorphCount: segment.derivational.filter(item => item.form.length <= 2).length
      }, config, root.form.length));
    }
  }
  return output.sort((a, b) => b.confidence_score - a.confidence_score
    || (b.derivational?.length || 0) - (a.derivational?.length || 0)
    || Number(b.lexicalRootConfidence || 0) - Number(a.lexicalRootConfidence || 0)
    || b.first_lexical_root_after_preposition.length - a.first_lexical_root_after_preposition.length
    || a.first_lexical_root_after_preposition.localeCompare(b.first_lexical_root_after_preposition)).slice(0, 12);
}

export function parseDerivationalModel({ language = 'en', elementType = 'root', word = '', candidateWord = '', lemma = '', canonicalRoot = '', matchedRootVariant = '', rootVariant = '', matchIndex, rootIndex, match = {}, search_form = '' } = {}) {
  const code = langCode(language);
  const element = elementType === 'preposition' ? 'preposition' : 'root';
  const normalized = normalizeForMorphology(search_form || candidateWord || word || lemma, code);
  const normalizedWord = normalized.normalized;
  const canonical = norm(canonicalRoot || matchedRootVariant || rootVariant || match.fragment, code);
  const matched = norm(matchedRootVariant || rootVariant || match.fragment || canonical, code);
  const key = `${MORPHEME_PARSER_VERSION}|${code}|${element}|${canonical}|${matched}|${normalizedWord}`;
  if (cache.has(key)) return cache.get(key);
  const base = {
    parser_version: MORPHEME_PARSER_VERSION,
    language: code,
    element_type: element,
    original_word: normalized.original,
    normalized_word: normalizedWord,
    normalized_to_original_map: normalized.normalizedToOriginalMap,
    lemma: lemma || '',
    canonical_root: canonical,
    matched_root_variant: matched,
    root_start: 0,
    root_end: 0
  };
  if (!normalizedWord || !canonical) return fallback(base, 'morpheme_parse_fallback');
  const config = getLanguageConfig(code);
  const explicitIndex = Number.isInteger(matchIndex) ? matchIndex : (Number.isInteger(rootIndex) ? rootIndex : (Number.isInteger(match.index) ? match.index : undefined));
  const analyses = element === 'preposition'
    ? prepositionAnalyses(base, config, normalizedWord, canonical)
    : rootAnalyses(base, config, normalizedWord, allomorphVariants(code, canonical, matched), explicitIndex);
  if (!analyses.length) {
    const result = fallback(base, element === 'preposition' ? 'lexical_root_not_found' : 'morpheme_parse_fallback');
    cache.set(key, result);
    return result;
  }
  const result = assemble(base, analyses[0], analyses);
  result.root_start = analyses[0].root_start;
  result.root_end = analyses[0].root_end;
  result.original_root_range = mapNormalizedRangeToOriginal(normalized, result.root_start, result.root_end);
  result.matched_root_variant = analyses[0].matched_root_variant;
  cache.set(key, result);
  return result;
}

export { MORPHEME_PARSER_VERSION };
export function morphemeParserCacheSize() { return cache.size; }
export function clearMorphemeParserCacheForTests() { cache.clear(); }
