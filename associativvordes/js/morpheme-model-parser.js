import { AFFIX_SEARCH_CONFIG } from './affix-search-config.js';
import { buildSearchForm } from './search-normalizer.js';

const INFLECTIONAL_ENDINGS = Object.freeze({
  en: ['ingly','edly','ally','ly','ies','es','s','ed','ing','er','est','e'],
  de: ['erweise','eren','erer','eres','erem','est','en','er','es','em','e','n','s'],
  fr: ['issements','issement','ements','ement','amment','emment','ment','ées','ée','és','es','s','e'],
  es: ['amientos','amiento','imientos','imiento','mente','ados','adas','idos','idas','ando','iendo','es','os','as','o','a'],
  it: ['amenti','amento','imenti','imento','mente','ando','endo','ati','ate','ito','ita','iti','ite','i','e','o','a'],
  ru: ['ыми','ими','ого','его','ому','ему','ных','них','ная','яя','ое','ее','ые','ие','ый','ий','ой','ую','юю','ым','им','ом','ем','но','ами','ями','ах','ях','ов','ев','ам','ям','у','ю','ы','и','а','я','е'],
});

const EXTRA_DERIVATIONAL_SUFFIXES = Object.freeze({
  en: ['ation','tion','ion','native','nativ','ative','ive','al','ism','ist','ity','ly','ness'],
  ru: ['aция','atsiya','acija','izm','ist','ost','nost','n','nyj','nij','ация','изм','ист','ость','н','ность','ый','ий'],
});

const CONNECTORS = Object.freeze({
  en: ['at','ac','o','i'], de: ['s','es','n','en','e','er'], fr: ['at','ac'], es: ['at','ac','o','i'], it: ['at','ac','o','i'], ru: ['ац','ат','ac','at','o','e','i','о','е','и']
});

const SERVICE_MORPHS = Object.freeze({
  en: ['e'], de: [], fr: ['e'], es: [], it: [], ru: []
});

const CANONICAL_FIRST_SUFFIX = Object.freeze({
  ru: { nost: 'n', nyj: 'n', nij: 'n', 'ность': 'н', 'ный': 'н', 'ний': 'н' }
});

const FIRST_LEXICAL_ROOTS_AFTER_PREFIX = Object.freeze({
  en: ['nation','nat','act','net','val','rupt','sect','view','vene','fer','form','pose','cede','ject','mit'],
  de: ['aktion','nation','netz','vall'],
  fr: ['nation','act','net','val'],
  es: ['nacion','accion','act','net','val'],
  it: ['nazion','azion','att','net','vall'],
  ru: ['наци','акт','нет','вал']
});

function sortedUnique(values) { return [...new Set((values || []).filter(Boolean).map(String))].sort((a, b) => b.length - a.length || a.localeCompare(b)); }
function configFor(language) { return AFFIX_SEARCH_CONFIG[String(language || 'en').toLowerCase()] || AFFIX_SEARCH_CONFIG.en; }
function hasCyrillic(value) { return /[\u0400-\u04ff]/u.test(String(value || '')); }
function normalize(value, language) { return hasCyrillic(value) ? String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}'-]+/gu, '') : buildSearchForm(value).replace(/[^a-z0-9'-]+/g, ''); }
function longestAtStart(value, list) { return sortedUnique(list).find(item => value.startsWith(item)) || ''; }
function longestAtEnd(value, list, minLeft = 1) { return sortedUnique(list).find(item => value.endsWith(item) && value.length - item.length >= minLeft) || ''; }
function stripInflections(tail, language) { const endings = INFLECTIONAL_ENDINGS[language] || INFLECTIONAL_ENDINGS.en; const ending = longestAtEnd(tail, endings, 0); return ending ? { stem: tail.slice(0, -ending.length), ending } : { stem: tail, ending: '' }; }
function suffixesFor(language) { const cfg = configFor(language); return sortedUnique([...(cfg.suffixes || []), ...(EXTRA_DERIVATIONAL_SUFFIXES[language] || [])]); }
function prefixesFor(language) { const cfg = configFor(language); return sortedUnique([...(cfg.safePrefixes || []), ...(cfg.restrictedPrefixes || []), ...(cfg.combiningForms || [])]); }
function connectorsFor(language) { const cfg = configFor(language); return sortedUnique([...(cfg.compoundLinkers || []), ...(CONNECTORS[language] || [])]); }

function deriveFirstSuffix(tail, language) {
  let rest = tail;
  const ignored = [];
  let inflectional = '';
  for (let guard = 0; guard < 4; guard += 1) {
    const stripped = stripInflections(rest, language);
    if (stripped.ending) { inflectional = stripped.ending + inflectional; rest = stripped.stem; continue; }
    break;
  }
  for (const connector of connectorsFor(language)) {
    if (rest.startsWith(connector)) { ignored.push(connector); rest = rest.slice(connector.length); break; }
  }
  const suffix = longestAtStart(rest, suffixesFor(language));
  if (suffix) return { suffix: CANONICAL_FIRST_SUFFIX[language]?.[suffix] || suffix, ignored, inflectional };
  const service = longestAtStart(rest, SERVICE_MORPHS[language] || []);
  if (service) ignored.push(service);
  return { suffix: '', ignored, inflectional };
}

function parsePrefixChain(beforeRoot, language) {
  const prefixes = prefixesFor(language); const chain = []; let rest = beforeRoot;
  while (rest) { const p = longestAtStart(rest, prefixes); if (!p) break; chain.push(p); rest = rest.slice(p.length); }
  return { chain, unparsed: rest };
}

function conservativeFallback({ language, elementType, wordForm, rootVariant, rootIndex, reason }) {
  return { model_key: `${language}|${elementType}|fallback|${rootIndex}|${rootVariant}|${wordForm}`, model_label: wordForm, prefix_chain: [], matched_root_variant: rootVariant, first_meaningful_derivational_element: '', ignored_connectors: [], inflectional_ending: '', analysis_confidence: 'low', diagnostic_reason: `morpheme_parse_fallback:${reason}` };
}

export function parseMorphemeModel({ language = 'en', elementType = 'root', candidateWord = '', word, search_form = '', matchedRootVariant = '', rootVariant = '', rootIndex, match = {} } = {}) {
  const lang = String(language || 'en').toLowerCase();
  const wordForm = normalize(search_form || candidateWord || word, lang);
  const root = normalize(matchedRootVariant || rootVariant || match.fragment || '', lang);
  if (!wordForm) return conservativeFallback({ language: lang, elementType, wordForm, rootVariant: root, rootIndex: 0, reason: 'empty_word' });
  const index = Number.isInteger(rootIndex) ? rootIndex : (Number.isInteger(match.index) ? match.index : (root ? wordForm.indexOf(root) : -1));
  if (!root || index < 0 || !wordForm.includes(root)) return conservativeFallback({ language: lang, elementType, wordForm, rootVariant: root, rootIndex: Math.max(0, index), reason: 'root_not_found' });

  if (elementType === 'preposition') {
    const after = wordForm.slice(index + root.length);
    const roots = FIRST_LEXICAL_ROOTS_AFTER_PREFIX[lang] || FIRST_LEXICAL_ROOTS_AFTER_PREFIX.en;
    const lexical = longestAtStart(after, roots);
    if (!lexical || lexical.length < 3) return conservativeFallback({ language: lang, elementType, wordForm, rootVariant: root, rootIndex: index, reason: 'lexical_root_after_prefix_unknown' });
    return { model_key: `${lang}|preposition|${root}|${lexical}`, model_label: `${root}+${lexical}`, prefix_chain: [root], matched_root_variant: root, first_meaningful_derivational_element: lexical, ignored_connectors: [], inflectional_ending: '', analysis_confidence: 'high', diagnostic_reason: 'preposition_first_lexical_root' };
  }

  const before = wordForm.slice(0, index);
  const prefix = parsePrefixChain(before, lang);
  if (prefix.unparsed) return conservativeFallback({ language: lang, elementType, wordForm, rootVariant: root, rootIndex: index, reason: 'unparsed_prefix_chain' });
  const tail = wordForm.slice(index + root.length);
  const derived = deriveFirstSuffix(tail, lang);
  if (!derived.suffix && tail && !derived.inflectional) return conservativeFallback({ language: lang, elementType, wordForm, rootVariant: root, rootIndex: index, reason: 'derivational_suffix_unknown' });
  const element = derived.suffix || 'base';
  return { model_key: `${lang}|root|${prefix.chain.join('+')}|${root}|${element}`, model_label: `${prefix.chain.length ? `${prefix.chain.join('+')}-` : ''}${root}${element === 'base' ? '' : `-${element}`}`, prefix_chain: prefix.chain, matched_root_variant: root, first_meaningful_derivational_element: derived.suffix, ignored_connectors: derived.ignored, inflectional_ending: derived.inflectional, analysis_confidence: 'high', diagnostic_reason: derived.suffix ? 'first_derivational_suffix' : 'root_or_inflection_only' };
}
