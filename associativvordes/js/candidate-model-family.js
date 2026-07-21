import { buildSearchForm } from './search-normalizer.js';
import { parseMorphemeModel } from './morpheme-model-parser.js';

export function canonicalLexicalStem(value, language = 'en') {
  const parsed = parseMorphemeModel({ language, elementType: 'root', candidateWord: value, search_form: value, matchedRootVariant: value, rootIndex: 0 });
  return parsed.matched_root_variant || buildSearchForm(value);
}

function writingSystem(value) {
  const text = String(value || '');
  const latin = /[A-Za-zÀ-ÖØ-öø-ÿ]/u.test(text);
  const cyrillic = /[\u0400-\u04ff]/u.test(text);
  const greek = /[\u0370-\u03ff]/u.test(text);
  const count = Number(latin) + Number(cyrillic) + Number(greek);
  if (count > 1) return 'mixed';
  if (cyrillic) return 'cyrillic';
  if (greek) return 'greek';
  if (latin) return 'latin';
  return 'other';
}

function latinDiacriticSignature(value, system) {
  if (system !== 'latin') return 'plain';
  const decomposed = String(value || '').normalize('NFD');
  const marks = [];
  let baseIndex = -1;
  for (const char of decomposed) {
    if (/\p{M}/u.test(char)) marks.push(`${baseIndex}:${char.codePointAt(0).toString(16)}`);
    else baseIndex += 1;
  }
  return marks.length ? marks.join(',') : 'plain';
}

export function lexicalModelDescriptor(candidate, root, language = 'en', elementType = 'root') {
  const word = String(candidate?.word || candidate?.normalized || '');
  const wordForm = buildSearchForm(candidate?.search_form || word);
  if (!wordForm) return { key: '', label: '', stem: '', prefix: '', fragment: '', analysis: null };
  const rootForm = buildSearchForm(root);
  const fragment = buildSearchForm(candidate?.match?.type === 'special' ? candidate.match.fragment : (candidate?.match?.fragment || rootForm));
  const explicitIndex = Number(candidate?.match?.index);
  const inferredIndex = fragment ? wordForm.indexOf(fragment) : (rootForm ? wordForm.indexOf(rootForm) : -1);
  const index = Number.isInteger(explicitIndex) && explicitIndex >= 0 ? explicitIndex : Math.max(0, inferredIndex);
  const analysis = parseMorphemeModel({
    language,
    elementType,
    candidateWord: word,
    search_form: wordForm,
    matchedRootVariant: fragment || rootForm,
    rootIndex: index,
    match: candidate?.match
  });
  const system = writingSystem(word);
  const diacritics = latinDiacriticSignature(word, system);
  let modelKey = analysis.model_key;
  if (String(language).toLowerCase() === 'ru' && analysis.matched_root_variant === 'alter' && wordForm.startsWith('alternativ')) modelKey = `${String(language).toLowerCase()}|root|${analysis.prefix_chain.join('+')}|alter|alternativ`;
  if (analysis.prefix_chain.length && elementType === 'root') modelKey = `${String(language).toLowerCase()}|root|${analysis.prefix_chain.join('+')}|${analysis.matched_root_variant}|${wordForm}`;
  const key = `${language}|${system}|${diacritics}|${modelKey}`;
  let stem = analysis.analysis_confidence === 'low' ? analysis.matched_root_variant : `${analysis.matched_root_variant}${analysis.first_meaningful_derivational_element && analysis.first_meaningful_derivational_element !== 'base' ? analysis.first_meaningful_derivational_element : ''}`;
  if (String(language).toLowerCase() === 'ru' && analysis.matched_root_variant === 'alter' && wordForm.startsWith('alternativ')) stem = 'alternativ';
  return { key, label: analysis.model_label, stem, prefix: analysis.prefix_chain.join('+'), fragment: analysis.matched_root_variant, analysis };
}

export function lexicalModelFamilyKey(candidate, root, language = 'en') {
  return lexicalModelDescriptor(candidate, root, language).key;
}

export function candidateFrequencyScore(candidate) {
  const values = [
    candidate?.frequency_score,
    candidate?.analysis?.frequency?.frequency_score,
    candidate?.frequencyProfile?.frequency_score
  ];
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
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
      morpheme_analysis: descriptor.analysis || source?.morpheme_analysis || null
    };
    const key = candidate.model_key || `manual:${language}:${index}:${buildSearchForm(candidate.word)}`;
    const group = groups.get(key) || { key, members: [], representative: null };
    group.members.push(candidate);
    if (!group.representative || compareFrequencyRepresentatives(candidate, group.representative) < 0) group.representative = candidate;
    groups.set(key, group);
  }
  const groupList = [...groups.values()];
  const selected = groupList.map(group => group.representative);
  const dropped = groupList.flatMap(group => group.members.filter(candidate => candidate !== group.representative));
  return { candidates: selected, dropped, groups: groupList };
}
