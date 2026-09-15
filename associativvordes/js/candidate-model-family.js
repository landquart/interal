import { buildSearchForm } from './search-normalizer.js';
import { parseMorphemeModel } from './morpheme-model-parser.js';

const MATCH_TIER = Object.freeze({ family: 0, exact: 1, special: 1 });
const RUSSIAN_QUALITY_SUFFIXES = Object.freeze(['ность', 'ный', 'ная', 'ное', 'ные']);

function russianAdjectivalQualityFamily(word) {
  const normalized = String(word || '').trim().normalize('NFC').toLocaleLowerCase('ru');
  for (const suffix of RUSSIAN_QUALITY_SUFFIXES) {
    if (normalized.length > suffix.length + 2 && normalized.endsWith(suffix)) return buildSearchForm(normalized.slice(0, -suffix.length));
  }
  return '';
}

export function canonicalLexicalStem(value, language = 'en') {
  const parsed = parseMorphemeModel({ language, elementType: 'root', candidateWord: value, search_form: value, matchedRootVariant: value, rootIndex: 0 });
  return parsed.matched_root_variant || buildSearchForm(value);
}

export function lexicalModelDescriptor(candidate, root, language = 'en', elementType = 'root') {
  const word = String(candidate?.word || candidate?.normalized || '');
  const wordForm = buildSearchForm(candidate?.search_form || word);
  if (!wordForm) return { key: '', label: '', stem: '', prefix: '', fragment: '', analysis: null };
  const rootForm = buildSearchForm(root);
  const familyAnchor = candidate?.match?.type === 'family' ? buildSearchForm(candidate?.match?.fragment || '') : '';
  const fragment = familyAnchor || buildSearchForm(candidate?.match?.fragment || rootForm);
  const explicitIndex = Number(candidate?.match?.index);
  const inferredIndex = fragment ? wordForm.indexOf(fragment) : (rootForm ? wordForm.indexOf(rootForm) : -1);
  const index = Number.isInteger(explicitIndex) && explicitIndex >= 0 ? explicitIndex : Math.max(0, inferredIndex);
  const analysis = parseMorphemeModel({
    language,
    elementType,
    candidateWord: word,
    search_form: wordForm,
    canonicalRoot: rootForm,
    matchedRootVariant: fragment || rootForm,
    rootIndex: index,
    match: candidate?.match
  });
  const languageCode = String(language).toLowerCase();
  const qualityFamily = languageCode === 'ru' && index > 0 ? russianAdjectivalQualityFamily(word) : '';
  if (qualityFamily) analysis.model_key = `ru|adjectival-quality|${qualityFamily}`;
  const stemRoot = languageCode === 'ru' ? buildSearchForm(analysis.matched_root_variant || analysis.canonical_root) : (analysis.matched_root_variant || analysis.canonical_root);
  return { key: analysis.model_key, label: analysis.model_label, stem: stemRoot, prefix: analysis.prefix_chain.join('+'), fragment: analysis.matched_root_variant, analysis };
}

export function lexicalModelFamilyKey(candidate, root, language = 'en') {
  return lexicalModelDescriptor(candidate, root, language).key;
}

export function candidateFrequencyScore(candidate) {
  for (const value of [candidate?.frequency_score, candidate?.analysis?.frequency?.frequency_score, candidate?.frequencyProfile?.frequency_score]) {
    const number = Number(value);
    if (value != null && value !== '' && Number.isFinite(number)) return number;
  }
  return Number.NEGATIVE_INFINITY;
}

function totalIpm(candidate) {
  return Array.isArray(candidate?.sources)
    ? candidate.sources.reduce((sum, source) => sum + (Number.isFinite(Number(source?.ipm)) ? Number(source.ipm) : 0), 0)
    : 0;
}

export function compareFrequencyRepresentatives(left, right) {
  return candidateFrequencyScore(right) - candidateFrequencyScore(left)
    || (Number.isInteger(left?.rank) ? left.rank : Number.POSITIVE_INFINITY) - (Number.isInteger(right?.rank) ? right.rank : Number.POSITIVE_INFINITY)
    || totalIpm(right) - totalIpm(left)
    || String(left?.word || '').localeCompare(String(right?.word || ''));
}

export function compareRootMatchQuality(left, right) {
  const leftTier = MATCH_TIER[left?.match?.type] ?? 99;
  const rightTier = MATCH_TIER[right?.match?.type] ?? 99;
  return leftTier - rightTier;
}

export function compareRootMatchThenFrequency(left, right) {
  return compareRootMatchQuality(left, right) || compareFrequencyRepresentatives(left, right);
}

export function selectHighestFrequencyPerModel(candidates, root, language = 'en', elementType = 'root') {
  const groups = new Map();
  for (const [index, source] of (Array.isArray(candidates) ? candidates : []).entries()) {
    const descriptor = lexicalModelDescriptor(source, root, language, source?.elementType || elementType);
    const candidate = {
      ...source,
      model_family_key: descriptor.key || source?.model_family_key || '',
      model_key: descriptor.key || source?.model_key || '',
      model_label: descriptor.label || source?.model_label || source?.model || '',
      model: descriptor.label || source?.model || '',
      morpheme_analysis: descriptor.analysis || source?.morpheme_analysis || null,
      parser_version: descriptor.analysis?.parser_version || source?.parser_version || source?.morpheme_analysis?.parser_version || null
    };
    const key = candidate.model_key || `manual:${language}:${index}:${buildSearchForm(candidate.word)}`;
    const group = groups.get(key) || { key, members: [], representative: null };
    group.members.push(candidate);
    if (!group.representative || compareFrequencyRepresentatives(candidate, group.representative) < 0) group.representative = candidate;
    groups.set(key, group);
  }
  const groupList = [...groups.values()];
  return {
    candidates: groupList.map(group => group.representative),
    dropped: groupList.flatMap(group => group.members.filter(candidate => candidate !== group.representative)),
    groups: groupList
  };
}
