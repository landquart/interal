import { buildSearchForm } from './search-normalizer.js';

const OUTER_ENDINGS = Object.freeze({
  en: ['ingly', 'edly', 'ly', 'ing', 'ed', 'est', 'er'],
  de: ['erweise', 'eren', 'erer', 'eres', 'erem', 'est', 'en', 'er', 'es', 'em', 'e', 'n', 's'],
  fr: ['issements', 'issement', 'ements', 'ement', 'amment', 'emment', 'ment', 'ées', 'ée', 'és', 'es', 's', 'e'],
  es: ['amientos', 'amiento', 'imientos', 'imiento', 'mente', 'ados', 'adas', 'idos', 'idas', 'ando', 'iendo', 'es', 'os', 'as', 'o', 'a'],
  it: ['amenti', 'amento', 'imenti', 'imento', 'mente', 'ando', 'endo', 'ati', 'ate', 'ito', 'ita', 'iti', 'ite', 'i', 'e', 'o', 'a'],
  ru: [
    'nymi', 'nogo', 'nego', 'nomu', 'nemu', 'nyh', 'nih', 'naja', 'njaja', 'noe', 'nee', 'nye', 'nie',
    'nyj', 'nij', 'noj', 'nuju', 'njuju', 'nym', 'nim', 'nom', 'nem', 'no',
    'jami', 'ami', 'jakh', 'jah', 'ah', 'ogo', 'ego', 'omu', 'emu', 'ymi', 'imi', 'yh', 'ih',
    'aja', 'jaja', 'oe', 'ee', 'ye', 'ie', 'uju', 'juu', 'oj', 'ej', 'yj', 'ij',
    'ov', 'ev', 'om', 'em', 'am', 'jam', 'u', 'ju', 'y', 'i', 'a', 'ja', 'e'
  ]
});

function stripOuterEnding(value, endings, minimumLength = 4) {
  for (const ending of endings) {
    if (!value.endsWith(ending) || value.length - ending.length < minimumLength) continue;
    return value.slice(0, -ending.length);
  }
  return value;
}

function stripEnglishPlural(value, minimumLength = 4) {
  if (value.endsWith('ies') && value.length - 3 >= minimumLength) return `${value.slice(0, -3)}y`;
  if (/(?:ches|shes|xes|zes|sses)$/.test(value) && value.length - 2 >= minimumLength) return value.slice(0, -2);
  if (value.endsWith('s') && !value.endsWith('ss') && value.length - 1 >= minimumLength) return value.slice(0, -1);
  return value;
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

export function canonicalLexicalStem(value, language = 'en') {
  const normalized = buildSearchForm(value).replace(/[^a-z0-9'-]+/g, '');
  if (!normalized) return '';
  const endings = OUTER_ENDINGS[language] || OUTER_ENDINGS.en;
  let stem = language === 'en' ? stripEnglishPlural(normalized) : normalized;
  if (stem === normalized) stem = stripOuterEnding(normalized, endings);
  if ((language === 'es' || language === 'it') && normalized.endsWith('mente')) stem = stripOuterEnding(stem, endings);
  if (language === 'fr' && stem.endsWith('if') && stem.length > 5) stem = `${stem.slice(0, -2)}iv`;
  return stem;
}

export function lexicalModelDescriptor(candidate, root, language = 'en') {
  const word = String(candidate?.word || candidate?.normalized || '');
  const wordForm = buildSearchForm(candidate?.search_form || word);
  if (!wordForm) return { key: '', label: '', stem: '', prefix: '', fragment: '' };
  const rootForm = buildSearchForm(root);
  const fragment = buildSearchForm(candidate?.match?.type === 'special' ? candidate.match.fragment : rootForm);
  const explicitIndex = Number(candidate?.match?.index);
  const inferredIndex = fragment ? wordForm.indexOf(fragment) : (rootForm ? wordForm.indexOf(rootForm) : -1);
  const index = Number.isInteger(explicitIndex) && explicitIndex >= 0 ? explicitIndex : Math.max(0, inferredIndex);
  const prefix = index > 0 ? wordForm.slice(0, index) : '';
  let stem = canonicalLexicalStem(wordForm, language) || wordForm;
  if (rootForm && wordForm.includes(rootForm) && stem.length < rootForm.length) stem = rootForm;
  const system = writingSystem(word);
  const diacritics = latinDiacriticSignature(word, system);
  const key = `${language}|${system}|${diacritics}|${prefix}|${fragment || rootForm}|${stem}`;
  const label = prefix ? `${prefix}-${stem}` : stem;
  return { key, label, stem, prefix, fragment: fragment || rootForm };
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

export function selectHighestFrequencyPerModel(candidates, root, language = 'en') {
  const groups = new Map();
  for (const [index, source] of (Array.isArray(candidates) ? candidates : []).entries()) {
    const descriptor = lexicalModelDescriptor(source, root, language);
    const candidate = {
      ...source,
      model_family_key: descriptor.key || source?.model_family_key || '',
      model_key: descriptor.key || source?.model_key || '',
      model_label: descriptor.label || source?.model_label || source?.model || '',
      model: descriptor.label || source?.model || ''
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
