import { normalizeForMorphology } from './normalizer.js';
import { getLanguageConfig } from './languages/index.js';
import { ROOT_ALLOMORPHS } from './data/root-allomorphs.js';
import { MANUALLY_VERIFIED_ROOTS } from './data/manually-verified-roots.js';
import { segmentTail, parsePrefixChain } from './segmentation-engine.js';
import { rankAnalysis, confidenceFor } from './analysis-ranker.js';
import { MORPHEME_PARSER_VERSION, buildModelKey, buildModelLabel } from './model-key.js';

const cache = new Map();
function langCode(language) { return String(language || 'en').toLowerCase(); }
function norm(value, language) { return normalizeForMorphology(value, language).normalized; }
function allomorphVariants(language, canonicalRoot, matchedRootVariant) {
  const code = langCode(language); const canonical = norm(canonicalRoot, code); const matched = norm(matchedRootVariant, code);
  const variants = [{ form: canonical, canonicalRoot: canonical, type: 'direct', confidence: 1 }];
  if (matched && matched !== canonical) variants.push({ form: matched, canonicalRoot: canonical, type: 'match_variant', confidence: 0.85 });
  for (const row of ROOT_ALLOMORPHS) if (row.language === code && norm(row.canonicalRoot, code) === canonical) for (const v of row.variants) { variants.push({ ...v, form: norm(v.transliteration || v.form, code), canonicalRoot: canonical }); if (v.transliteration && v.form) variants.push({ ...v, form: norm(v.form, code), canonicalRoot: canonical }); }
  return [...new Map(variants.filter(v=>v.form).map(v=>[v.form, v])).values()].sort((a,b)=>b.form.length-a.form.length || b.confidence-a.confidence);
}
function fallback(base, reason) {
  const out = { ...base, prefix_chain: [], ignored_connectors: [], first_meaningful_derivational_element: '', following_derivational_elements: [], inflectional_ending: '', first_lexical_root_after_preposition: '', analysis_confidence: 'low', confidence_score: 0.35, confidence_margin: 0, diagnostic_reason: reason === 'lexical_root_not_found' ? 'lexical_root_not_found' : 'morpheme_parse_fallback', warnings: ['morpheme_parse_fallback'], best_analysis: null, alternative_analyses: [], fallback: true };
  out.model_key = buildModelKey(out); out.model_label = buildModelLabel(out); return out;
}
function assemble(base, candidate, alternatives) {
  const second = alternatives.find(a => a !== candidate) || null;
  const cm = confidenceFor(candidate, second);
  const low = cm.confidence === 'low';
  const diagnostic = low ? 'morpheme_parse_fallback' : (cm.margin < 0.15 ? 'ambiguous_morpheme_parse' : (candidate.rootMatchType === 'direct' ? 'exact_morpheme_parse' : 'allomorph_morpheme_parse'));
  const out = { ...base, prefix_chain: candidate.prefix_chain || [], ignored_connectors: candidate.ignored_connectors || [], first_meaningful_derivational_element: base.element_type === 'preposition' ? (candidate.first_lexical_root_after_preposition || '') : (candidate.derivational?.[0]?.canonical || candidate.defaultFirstDerivationalElement || 'base'), following_derivational_elements: (candidate.derivational || []).slice(1).map(m=>m.canonical), inflectional_ending: candidate.inflectional_ending || '', first_lexical_root_after_preposition: candidate.first_lexical_root_after_preposition || '', analysis_confidence: low ? 'low' : cm.confidence, confidence_score: candidate.confidence_score, confidence_margin: cm.margin, diagnostic_reason: diagnostic, warnings: low ? ['morpheme_parse_fallback'] : (diagnostic === 'ambiguous_morpheme_parse' ? ['ambiguous_morpheme_parse'] : []), best_analysis: candidate, alternative_analyses: alternatives.filter(a=>a!==candidate).slice(0,2), fallback: low };
  out.model_key = buildModelKey(out); out.model_label = buildModelLabel(out); return out;
}
function rootAnalyses(base, config, word, variants, explicitIndex) {
  const out = [];
  for (const variant of variants) {
    const starts = [];
    if (Number.isInteger(explicitIndex) && explicitIndex >= 0 && word.slice(explicitIndex, explicitIndex + variant.form.length) === variant.form) starts.push(explicitIndex);
    let i = word.indexOf(variant.form); while (i >= 0) { if (!starts.includes(i)) starts.push(i); i = word.indexOf(variant.form, i + 1); }
    for (const start of starts) {
      const prefix = parsePrefixChain(word.slice(0, start), config); if (prefix.unparsed) continue;
      const tail = word.slice(start + variant.form.length);
      for (const seg of segmentTail(tail, config)) {
        const a = { root_start: start, root_end: start + variant.form.length, matched_root_variant: variant.form, rootMatchType: variant.type, defaultFirstDerivationalElement: variant.defaultFirstDerivationalElement || '', prefix_chain: prefix.chain, ignored_connectors: seg.connectors, derivational: seg.derivational, inflectional_ending: seg.inflectional, fullCoverage: seg.fullCoverage, morphotacticsValid: true, shortMorphCount: seg.derivational.filter(m=>m.form.length <= 2).length };
        a.confidence_score = rankAnalysis(a); out.push(a);
      }
    }
  }
  return out.sort((a,b)=>b.confidence_score-a.confidence_score || a.root_start-b.root_start).slice(0,8);
}
function prepositionAnalyses(base, config, word, prefix) {
  if (!word.startsWith(prefix)) return [];
  const after = word.slice(prefix.length); const roots = [...new Set([...(MANUALLY_VERIFIED_ROOTS[base.language] || []), ...ROOT_ALLOMORPHS.filter(r=>r.language===base.language).flatMap(r=>r.variants.map(v=>norm(v.transliteration||v.form, base.language)))])].sort((a,b)=>b.length-a.length);
  const out = [];
  for (const root of roots) if (root.length >= (config.lexicalRootRules?.minimumLength || 3) && after.startsWith(root)) {
    const tail = after.slice(root.length);
    for (const seg of segmentTail(tail, config)) {
      const a = { root_start: 0, root_end: prefix.length, matched_root_variant: prefix, rootMatchType: 'direct', prefix_chain: [prefix], first_lexical_root_after_preposition: root, ignored_connectors: seg.connectors, derivational: seg.derivational, inflectional_ending: seg.inflectional, fullCoverage: seg.fullCoverage, morphotacticsValid: true, shortMorphCount: seg.derivational.filter(m=>m.form.length<=2).length };
      a.confidence_score = rankAnalysis(a); out.push(a);
    }
  }
  return out.sort((a,b)=>b.confidence_score-a.confidence_score || b.first_lexical_root_after_preposition.length-a.first_lexical_root_after_preposition.length).slice(0,8);
}
export function parseDerivationalModel({ language = 'en', elementType = 'root', word = '', candidateWord = '', lemma = '', canonicalRoot = '', matchedRootVariant = '', rootVariant = '', matchIndex, rootIndex, match = {}, search_form = '' } = {}) {
  const code = langCode(language); const element = elementType === 'preposition' ? 'preposition' : 'root';
  const normalized = normalizeForMorphology(search_form || candidateWord || word || lemma, code); const normalizedWord = normalized.normalized;
  const canonical = norm(canonicalRoot || matchedRootVariant || rootVariant || match.fragment, code); const matched = norm(matchedRootVariant || rootVariant || match.fragment || canonical, code);
  const key = `${MORPHEME_PARSER_VERSION}|${code}|${element}|${canonical}|${matched}|${normalizedWord}`; if (cache.has(key)) return cache.get(key);
  const base = { parser_version: MORPHEME_PARSER_VERSION, language: code, element_type: element, original_word: normalized.original, normalized_word: normalizedWord, lemma: lemma || '', canonical_root: canonical, matched_root_variant: matched, root_start: 0, root_end: 0 };
  if (!normalizedWord || !canonical) return fallback(base, 'morpheme_parse_fallback');
  const config = getLanguageConfig(code); const explicitIndex = Number.isInteger(matchIndex) ? matchIndex : (Number.isInteger(rootIndex) ? rootIndex : (Number.isInteger(match.index) ? match.index : undefined));
  const analyses = element === 'preposition' ? prepositionAnalyses(base, config, normalizedWord, canonical) : rootAnalyses(base, config, normalizedWord, allomorphVariants(code, canonical, matched), explicitIndex);
  if (!analyses.length) { const fb = fallback(base, element === 'preposition' ? 'lexical_root_not_found' : 'morpheme_parse_fallback'); cache.set(key, fb); return fb; }
  const result = assemble(base, analyses[0], analyses); result.root_start = analyses[0].root_start; result.root_end = analyses[0].root_end; result.matched_root_variant = analyses[0].matched_root_variant; cache.set(key, result); return result;
}
export { MORPHEME_PARSER_VERSION };
export function morphemeParserCacheSize() { return cache.size; }
