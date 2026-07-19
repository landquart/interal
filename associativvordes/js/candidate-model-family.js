import { buildSearchForm } from './search-normalizer.js';

const SIMPLE_ENDINGS = Object.freeze({
  en: ['ingly', 'edly', 'ly', 'ing', 'ed', 'est', 'er', 'es', 's'],
  de: ['erweise', 'eren', 'erer', 'eres', 'erem', 'en', 'er', 'es', 'em', 'e', 'n', 's'],
  fr: ['issements', 'issement', 'ements', 'ement', 'amment', 'emment', 'ment', 'ées', 'ée', 'és', 'es', 's', 'e'],
  es: ['amientos', 'amiento', 'imientos', 'imiento', 'mente', 'ados', 'adas', 'idos', 'idas', 'ando', 'iendo', 'os', 'as', 'o', 'a'],
  it: ['amenti', 'amento', 'imenti', 'imento', 'mente', 'ando', 'endo', 'ati', 'ate', 'ito', 'ita', 'iti', 'ite', 'i', 'e', 'o', 'a'],
  ru: [
    'nymi', 'nymi', 'nogo', 'nego', 'nomu', 'nemu', 'nyh', 'nih', 'naja', 'njaja', 'noe', 'nee', 'nye', 'nie',
    'nyj', 'nij', 'noj', 'nuju', 'njuju', 'nym', 'nim', 'nom', 'nem', 'no',
    'jami', 'ami', 'jakh', 'ah', 'jah', 'ogo', 'ego', 'omu', 'emu', 'ymi', 'imi', 'yh', 'ih',
    'aja', 'jaja', 'oe', 'ee', 'ye', 'ie', 'uju', 'juu', 'oj', 'ej', 'yj', 'ij',
    'ami', 'jami', 'ov', 'ev', 'om', 'em', 'am', 'jam', 'ah', 'jah', 'u', 'ju', 'y', 'i', 'a', 'ja', 'e'
  ]
});

function stripOneEnding(value, endings, minimumLength = 4) {
  for (const ending of endings) {
    if (value.length - ending.length < minimumLength) continue;
    if (value.endsWith(ending)) return value.slice(0, -ending.length);
  }
  return value;
}

function normalizeFrenchAlternation(value) {
  if (value.endsWith('ive') && value.length > 6) return `${value.slice(0, -3)}iv`;
  if (value.endsWith('if') && value.length > 5) return `${value.slice(0, -2)}iv`;
  return value;
}

export function canonicalLexicalStem(value, language = 'en') {
  let stem = buildSearchForm(value).replace(/[^a-z0-9'-]+/g, '');
  if (!stem) return '';

  const endings = SIMPLE_ENDINGS[language] || SIMPLE_ENDINGS.en;
  for (let pass = 0; pass < 2; pass += 1) {
    const next = stripOneEnding(stem, endings);
    if (next === stem) break;
    stem = next;
  }
  if (language === 'fr') stem = normalizeFrenchAlternation(stem);
  return stem;
}

export function lexicalModelFamilyKey(candidate, root, language = 'en') {
  const wordForm = buildSearchForm(candidate?.search_form || candidate?.word);
  if (!wordForm) return '';
  const stem = canonicalLexicalStem(wordForm, language) || wordForm;
  const matchIndex = Number.isInteger(candidate?.match?.index) ? candidate.match.index : Math.max(0, wordForm.indexOf(buildSearchForm(root)));
  const prefix = matchIndex > 0 ? canonicalLexicalStem(wordForm.slice(0, matchIndex), language) : '';
  return `${prefix}|${stem}`;
}

function totalIpm(candidate) {
  if (Number.isFinite(Number(candidate?.total_ipm))) return Number(candidate.total_ipm);
  return Array.isArray(candidate?.sources)
    ? candidate.sources.reduce((sum, source) => sum + (Number.isFinite(Number(source?.ipm)) ? Number(source.ipm) : 0), 0)
    : 0;
}

export function compareFrequencyRepresentatives(left, right) {
  return totalIpm(right) - totalIpm(left)
    || (Number(right?.frequency_score) || 0) - (Number(left?.frequency_score) || 0)
    || (Number.isInteger(left?.rank) ? left.rank : Number.POSITIVE_INFINITY) - (Number.isInteger(right?.rank) ? right.rank : Number.POSITIVE_INFINITY)
    || String(left?.word || '').localeCompare(String(right?.word || ''));
}

export function selectHighestFrequencyPerModel(candidates, root, language = 'en') {
  const selected = new Map();
  const dropped = [];
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    const key = lexicalModelFamilyKey(candidate, root, language) || buildSearchForm(candidate?.word);
    const current = selected.get(key);
    if (!current) {
      selected.set(key, candidate);
      continue;
    }
    if (compareFrequencyRepresentatives(candidate, current) < 0) {
      dropped.push(current);
      selected.set(key, candidate);
    } else {
      dropped.push(candidate);
    }
  }
  return { candidates: [...selected.values()], dropped };
}
