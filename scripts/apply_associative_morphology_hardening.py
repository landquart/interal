from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, content):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


NORMALIZER = r'''const COMBINING_MARK = /\p{M}/u;
const LATIN_ALLOWED = /[a-z0-9'-]/;
const RUSSIAN_ALLOWED = /[\p{L}\p{N}'-]/u;

function normalizeChar(char, language) {
  const lower = char.toLocaleLowerCase(language === 'ru' ? 'ru' : undefined);
  if (language === 'ru') return lower.replace(/ё/g, 'е').normalize('NFC');
  return lower.normalize('NFD').replace(/\p{M}+/gu, '').normalize('NFC');
}

export function normalizeForMorphology(value, language = 'en') {
  const original = String(value || '').normalize('NFC');
  const code = String(language || 'en').toLowerCase();
  let normalized = '';
  const normalizedToOriginalMap = [];
  let originalOffset = 0;
  for (const sourceChar of original) {
    const transformed = normalizeChar(sourceChar, code);
    for (const outputChar of transformed) {
      if (COMBINING_MARK.test(outputChar)) continue;
      const allowed = code === 'ru' ? RUSSIAN_ALLOWED.test(outputChar) : LATIN_ALLOWED.test(outputChar);
      if (!allowed) continue;
      normalized += outputChar;
      normalizedToOriginalMap.push(originalOffset);
    }
    originalOffset += sourceChar.length;
  }
  return { original, normalized, normalizedToOriginalMap };
}

export function mapNormalizedRangeToOriginal(normalizedResult, start, end) {
  const map = normalizedResult?.normalizedToOriginalMap || [];
  const original = normalizedResult?.original || '';
  const safeStart = Math.max(0, Math.min(Number(start) || 0, map.length));
  const safeEnd = Math.max(safeStart, Math.min(Number(end) || safeStart, map.length));
  if (!map.length || safeStart === safeEnd) {
    const offset = safeStart < map.length ? map[safeStart] : original.length;
    return { start: offset, end: offset };
  }
  const originalStart = map[safeStart];
  const lastMapped = map[safeEnd - 1];
  const sourceChar = [...original.slice(lastMapped)][0] || '';
  return { start: originalStart, end: Math.min(original.length, lastMapped + sourceChar.length) };
}
'''
write('associativvordes/js/morphology/normalizer.js', NORMALIZER)


MORPHOTACTICS = r'''function asArray(value) {
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
'''
write('associativvordes/js/morphology/morphotactics.js', MORPHOTACTICS)


LEXICAL_INDEX = r'''import { normalizeForMorphology } from './normalizer.js';

const ROOTS = new Map();

function bucket(language) {
  const code = String(language || 'en').toLowerCase();
  if (!ROOTS.has(code)) ROOTS.set(code, new Map());
  return ROOTS.get(code);
}

function addRoot(language, form, metadata = {}) {
  const normalized = normalizeForMorphology(form, language).normalized;
  if (!normalized) return;
  const map = bucket(language);
  const current = map.get(normalized);
  const candidate = {
    form: normalized,
    canonical: normalizeForMorphology(metadata.canonical || normalized, language).normalized,
    source: metadata.source || 'candidate_index',
    frequency: Number(metadata.frequency) || 0,
    confidence: Number.isFinite(Number(metadata.confidence)) ? Number(metadata.confidence) : 0.75,
    partOfSpeech: metadata.partOfSpeech || null
  };
  if (!current || candidate.confidence > current.confidence || candidate.frequency > current.frequency) map.set(normalized, candidate);
}

function stripKnownTail(value, config, language) {
  const results = new Set([value]);
  const tokens = [...(config.derivationalSuffixes || []), ...(config.inflectionalEndings || [])]
    .map(item => item.form)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const queue = [value];
  while (queue.length) {
    const current = queue.shift();
    for (const token of tokens) {
      if (!current.endsWith(token) || current.length - token.length < Number(config.lexicalRootRules?.minimumLength || 2)) continue;
      const next = current.slice(0, -token.length);
      if (!results.has(next)) { results.add(next); queue.push(next); }
    }
  }
  return [...results].map(item => normalizeForMorphology(item, language).normalized).filter(Boolean);
}

export function registerLexicalRootsFromEntries(language, entries = [], { prefix = '', config = {} } = {}) {
  const normalizedPrefix = normalizeForMorphology(prefix, language).normalized;
  for (const entry of Array.isArray(entries) ? entries : []) {
    const word = normalizeForMorphology(entry?.search_form || entry?.normalized || entry?.word, language).normalized;
    if (!word) continue;
    const base = normalizedPrefix && word.startsWith(normalizedPrefix) ? word.slice(normalizedPrefix.length) : word;
    for (const root of stripKnownTail(base, config, language)) {
      addRoot(language, root, { canonical: root, source: 'candidate_index', frequency: entry?.frequency_score, confidence: root === base ? 0.72 : 0.84 });
    }
  }
}

export function registerVerifiedLexicalRoots(language, roots = []) {
  for (const root of roots) addRoot(language, root, { source: 'manually_verified', confidence: 1 });
}

export function getRegisteredLexicalRoots(language) {
  return [...bucket(language).values()];
}

export function getLexicalRootCandidates(language, remainder, { config = {}, manuallyVerified = [] } = {}) {
  registerVerifiedLexicalRoots(language, manuallyVerified);
  const normalized = normalizeForMorphology(remainder, language).normalized;
  const minimum = Number(config.lexicalRootRules?.minimumLength || 3);
  const output = [];
  const seen = new Set();
  const add = candidate => {
    if (!candidate?.form || candidate.form.length < minimum || !normalized.startsWith(candidate.form) || seen.has(candidate.form)) return;
    seen.add(candidate.form);
    output.push(candidate);
  };
  for (const candidate of getRegisteredLexicalRoots(language)) add(candidate);
  for (let split = minimum; split <= normalized.length; split += 1) {
    add({ form: normalized.slice(0, split), canonical: normalized.slice(0, split), source: 'inferred_segmentation', frequency: 0, confidence: 0.55 });
  }
  return output.sort((a, b) => b.confidence - a.confidence || b.frequency - a.frequency || b.form.length - a.form.length || a.form.localeCompare(b.form));
}

export function clearLexicalRootIndexForTests() {
  ROOTS.clear();
}
'''
write('associativvordes/js/morphology/lexical-root-index.js', LEXICAL_INDEX)


SEGMENTATION = r'''function sorted(morphs) {
  return [...(morphs || [])].filter(item => item?.form).sort((a, b) => b.form.length - a.form.length || (b.priority || 0) - (a.priority || 0) || a.form.localeCompare(b.form));
}

function contextualMorphs(config) {
  return (config.contextualSequences || []).map(sequence => {
    const parts = Array.isArray(sequence.sequence) ? sequence.sequence : [];
    const form = sequence.form || parts.join('');
    return { form, canonical: sequence.canonical || form, type: sequence.role || 'derivational_suffix', priority: sequence.priority || 120, contextual: true };
  }).filter(item => item.form);
}

function preliminaryScore(analysis) {
  let score = analysis.fullCoverage ? 100 : 0;
  score += analysis.derivational.length * 10;
  score += analysis.derivational.reduce((sum, item) => sum + item.form.length, 0);
  score -= analysis.connectors.length * 2;
  score -= analysis.serviceMorphs.length * 2;
  if (analysis.inflectional) score += 1;
  return score;
}

function stableKey(analysis) {
  return `${analysis.derivational.map(item => item.canonical).join('+')}|${analysis.connectors.join('+')}|${analysis.serviceMorphs.join('+')}|${analysis.inflectional}`;
}

function topK(values, limit) {
  const seen = new Set();
  return values
    .sort((a, b) => preliminaryScore(b) - preliminaryScore(a) || stableKey(a).localeCompare(stableKey(b)))
    .filter(item => { const key = stableKey(item); if (seen.has(key)) return false; seen.add(key); return true; })
    .slice(0, limit);
}

export function segmentTail(tail, config, { maxAnalyses = 8 } = {}) {
  const suffixes = sorted([...(config.derivationalSuffixes || []), ...contextualMorphs(config)]);
  const endings = sorted(config.inflectionalEndings);
  const connectors = sorted(config.connectors);
  const serviceMorphs = sorted(config.serviceMorphs);
  const memo = new Map();

  function rec(pos) {
    if (memo.has(pos)) return memo.get(pos);
    if (pos === tail.length) return [{ derivational: [], connectors: [], serviceMorphs: [], inflectional: '', fullCoverage: true }];
    const out = [];
    for (const morph of suffixes) {
      if (!tail.startsWith(morph.form, pos)) continue;
      for (const rest of rec(pos + morph.form.length)) out.push({ ...rest, derivational: [morph, ...rest.derivational] });
    }
    for (const ending of endings) {
      if (tail.startsWith(ending.form, pos) && pos + ending.form.length === tail.length) out.push({ derivational: [], connectors: [], serviceMorphs: [], inflectional: ending.form, fullCoverage: true });
    }
    for (const connector of connectors) {
      if (!tail.startsWith(connector.form, pos)) continue;
      for (const morph of suffixes) {
        const next = pos + connector.form.length;
        if (!tail.startsWith(morph.form, next)) continue;
        for (const rest of rec(next + morph.form.length)) out.push({ ...rest, connectors: [connector.form, ...rest.connectors], derivational: [morph, ...rest.derivational] });
      }
    }
    for (const service of serviceMorphs) {
      if (!tail.startsWith(service.form, pos)) continue;
      for (const rest of rec(pos + service.form.length)) out.push({ ...rest, serviceMorphs: [service.form, ...rest.serviceMorphs] });
    }
    const ranked = topK(out, maxAnalyses);
    memo.set(pos, ranked);
    return ranked;
  }
  return topK(rec(0), maxAnalyses);
}

export function parsePrefixChain(beforeRoot, config) {
  const prefixes = sorted(config.prefixes);
  const memo = new Map();
  function rec(pos) {
    if (pos === beforeRoot.length) return [[]];
    if (memo.has(pos)) return memo.get(pos);
    const candidates = [];
    for (const prefix of prefixes) {
      if (!beforeRoot.startsWith(prefix.form, pos)) continue;
      for (const rest of rec(pos + prefix.form.length)) candidates.push([prefix.canonical, ...rest]);
    }
    const ranked = candidates.sort((a, b) => a.length - b.length || b.join('').length - a.join('').length || a.join('+').localeCompare(b.join('+'))).slice(0, 8);
    memo.set(pos, ranked);
    return ranked;
  }
  const candidates = rec(0);
  return candidates.length ? { chain: candidates[0], alternatives: candidates.slice(1), unparsed: '' } : { chain: [], alternatives: [], unparsed: beforeRoot };
}
'''
write('associativvordes/js/morphology/segmentation-engine.js', SEGMENTATION)


RANKER = r'''export const RANKING_WEIGHTS = Object.freeze({
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
'''
write('associativvordes/js/morphology/analysis-ranker.js', RANKER)


ANALYZER = r'''import { normalizeForMorphology, mapNormalizedRangeToOriginal } from './normalizer.js';
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
        ignored_connectors: segment.connectors,
        service_morphs: segment.serviceMorphs,
        derivational: segment.derivational,
        inflectional_ending: segment.inflectional,
        fullCoverage: segment.fullCoverage,
        shortMorphCount: segment.derivational.filter(item => item.form.length <= 2).length
      }, config, root.form.length));
    }
  }
  return output.sort((a, b) => b.confidence_score - a.confidence_score || b.first_lexical_root_after_preposition.length - a.first_lexical_root_after_preposition.length || a.first_lexical_root_after_preposition.localeCompare(b.first_lexical_root_after_preposition)).slice(0, 12);
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
'''
write('associativvordes/js/morphology/analyzer.js', ANALYZER)


# Add real contextual sequences to language configs where the project already models connectors.
config_updates = {
    'associativvordes/js/morphology/languages/en.js': ("contextualSequences: []", "contextualSequences: [{ sequence: ['at','ion'], canonical: 'ation', role: 'derivational_suffix' }, { sequence: ['ac','tion'], canonical: 'ation', role: 'derivational_suffix' }]") ,
    'associativvordes/js/morphology/languages/fr.js': ("contextualSequences: []", "contextualSequences: [{ sequence: ['at','ion'], canonical: 'ation', role: 'derivational_suffix' }]") ,
    'associativvordes/js/morphology/languages/es.js': ("contextualSequences: []", "contextualSequences: [{ sequence: ['ac','ion'], canonical: 'ación', role: 'derivational_suffix' }]") ,
    'associativvordes/js/morphology/languages/it.js': ("contextualSequences: []", "contextualSequences: [{ sequence: ['az','ione'], canonical: 'azione', role: 'derivational_suffix' }]") ,
    'associativvordes/js/morphology/languages/ru.js': ("contextualSequences: []", "contextualSequences: [{ sequence: ['ац','ия'], canonical: 'ация', role: 'derivational_suffix' }, { sequence: ['ac','ija'], canonical: 'acija', role: 'derivational_suffix' }]")
}
for path, (old, new) in config_updates.items():
    text = read(path)
    if old in text:
        text = replace_once(text, old, new, f'contextual sequences {path}')
        write(path, text)


# Remove the remaining word-specific branch from algorithmic model grouping.
path = 'associativvordes/js/candidate-model-family.js'
text = read(path)
old = r'''  const stem = analysis.analysis_confidence === 'low'
    ? stemRoot
    : `${stemRoot}${analysis.first_meaningful_derivational_element && analysis.first_meaningful_derivational_element !== 'base' && !(String(language).toLowerCase() === 'ru' && stemRoot === 'alternativ') ? analysis.first_meaningful_derivational_element : ''}`;
'''
new = r'''  const stem = analysis.analysis_confidence === 'low'
    ? stemRoot
    : `${stemRoot}${analysis.first_meaningful_derivational_element && analysis.first_meaningful_derivational_element !== 'base' ? analysis.first_meaningful_derivational_element : ''}`;
'''
text = replace_once(text, old, new, 'remove alternativ special case')
write(path, text)


# Register lexical roots from the actual loaded candidate-index entries.
path = 'associativvordes/script.js'
text = read(path)
old = "import { lexicalModelDescriptor, selectHighestFrequencyPerModel, compareFrequencyRepresentatives } from './js/candidate-model-family.js';\n"
new = "import { lexicalModelDescriptor, selectHighestFrequencyPerModel, compareFrequencyRepresentatives } from './js/candidate-model-family.js';\nimport { registerLexicalRootsFromEntries } from './js/morphology/lexical-root-index.js';\nimport { getLanguageConfig } from './js/morphology/languages/index.js';\n"
text = replace_once(text, old, new, 'lexical root imports')
old = r'''      const entries = await candidateIndexLoader.loadCandidateEntries(langCode, root, { signal });
      addDuration('candidate_index', indexStartedAt);
'''
new = r'''      const entries = await candidateIndexLoader.loadCandidateEntries(langCode, root, { signal });
      registerLexicalRootsFromEntries(langCode, entries, { prefix: state.elementType === 'preposition' ? root : '', config: getLanguageConfig(langCode) });
      addDuration('candidate_index', indexStartedAt);
'''
text = replace_once(text, old, new, 'register roots from index')
write(path, text)

print('Applied associative morphology hardening.')
