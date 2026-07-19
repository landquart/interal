import { BASE_CATEGORY_WEIGHTS, CATEGORY_ORDER } from '../../associativvordes/js/config-frequency-sources.js';
import { ipmToScore, meanNonZero } from '../../associativvordes/js/frequency-loader.js';
import {
  buildSearchForm,
  isUsableSearchForm,
  normalizeText,
  stripDiacritics,
  transliterateRussianForSearch
} from '../../associativvordes/js/search-normalizer.js';

const IPM_FIELDS = ['ipm', 'IPM', 'frequency', 'freq'];
const WORD_FIELDS = ['word', 'lemma', 'form'];

export const normalizeLemma = normalizeText;
export { buildSearchForm, isUsableSearchForm, stripDiacritics, transliterateRussianForSearch };

function finitePositiveNumber(value) {
  if (value === '' || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function validRank(value) {
  if (value === '' || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) && Number.isInteger(number) && number > 0 ? number : null;
}

function explicitIpm(record) {
  for (const field of IPM_FIELDS) {
    if (Object.hasOwn(record, field)) return finitePositiveNumber(record[field]);
  }
  return null;
}

function explicitLemma(record) {
  for (const field of WORD_FIELDS) {
    if (Object.hasOwn(record, field)) return record[field];
  }
  return undefined;
}

function pushRecord(records, lemmaValue, ipmValue, rankValue, sourceId) {
  const original = String(lemmaValue ?? '').trim();
  const normalized = normalizeLemma(original);
  const searchForm = buildSearchForm(original);
  const ipm = finitePositiveNumber(ipmValue);
  if (!normalized || !isUsableSearchForm(searchForm) || ipm == null) return;
  const rank = validRank(rankValue);
  records.push({
    original,
    normalized,
    search_form: searchForm,
    lemma: normalized,
    frequency_lookup_key: normalized,
    ipm,
    ...(rank != null ? { rank } : {}),
    ...(sourceId ? { source: sourceId } : {})
  });
}

export function extractFrequencyRecords(data, sourceId = '') {
  const records = [];
  if (!data || typeof data !== 'object') return records;

  if (Array.isArray(data)) {
    for (const record of data) {
      if (!record || typeof record !== 'object') continue;
      pushRecord(records, explicitLemma(record), explicitIpm(record), record.rank, sourceId);
    }
    return records;
  }

  for (const [key, record] of Object.entries(data)) {
    if (typeof record === 'number') {
      pushRecord(records, key, record, undefined, sourceId);
      continue;
    }
    if (!record || typeof record !== 'object' || Array.isArray(record)) continue;

    const value = explicitIpm(record);
    if (value != null) {
      pushRecord(records, explicitLemma(record) ?? key, value, record.rank, sourceId);
      continue;
    }

    const keyIsRank = /^\d+$/.test(key);
    for (const [nestedWord, nestedValue] of Object.entries(record)) {
      if (typeof nestedValue === 'number') {
        pushRecord(records, nestedWord, nestedValue, keyIsRank ? key : undefined, sourceId);
      } else if (nestedValue && typeof nestedValue === 'object' && !Array.isArray(nestedValue)) {
        const nestedIpm = explicitIpm(nestedValue);
        if (nestedIpm != null) pushRecord(records, explicitLemma(nestedValue) ?? nestedWord, nestedIpm, nestedValue.rank ?? (keyIsRank ? key : undefined), sourceId);
      }
    }
  }
  return records;
}

export function mergeFrequencyRecord(index, record, sourceId = record?.source || 'default') {
  if (!(index instanceof Map) || !record) return index;
  const normalized = normalizeLemma(record.normalized ?? record.lemma ?? record.original);
  const frequencyLookupKey = normalizeLemma(record.frequency_lookup_key ?? normalized);
  const searchForm = buildSearchForm(record.original || normalized);
  const ipm = finitePositiveNumber(record.ipm);
  if (!normalized || !isUsableSearchForm(searchForm) || ipm == null) return index;
  if (frequencyLookupKey !== normalized) throw new Error(`Frequency lookup key must be normalized original lemma for ${normalized}`);
  const existing = index.get(normalized) ?? {
    original: record.original || normalized,
    normalized,
    search_form: searchForm,
    sources: {},
    ranks: {}
  };
  if (!existing.sources) existing.sources = {};
  if (!existing.ranks) existing.ranks = {};
  existing.sources[sourceId] = ipm;
  const rank = validRank(record.rank);
  if (rank != null) existing.ranks[sourceId] = rank;
  index.set(normalized, existing);
  return index;
}

export function calculateCategoryProfile(sourceValues = []) {
  const ipm_values = sourceValues.map(value => finitePositiveNumber(value) ?? 0);
  const category_ipm = meanNonZero(ipm_values);
  const category_score = ipmToScore(category_ipm);
  return { ipm_values, category_ipm, category_score };
}

export function calculateFrequencyScore(categoryBreakdown = {}, categoryWeights = BASE_CATEGORY_WEIGHTS) {
  const available = CATEGORY_ORDER.filter(category => categoryBreakdown[category]);
  const totalBase = available.reduce((sum, category) => sum + (categoryWeights[category] || 0), 0);
  if (!totalBase) return 0;
  return available.reduce((sum, category) => sum + ((categoryWeights[category] || 0) / totalBase) * (categoryBreakdown[category].category_score || 0), 0);
}

export function candidateIndexEntryComparator(a, b) {
  return String(a?.search_form ?? '').localeCompare(String(b?.search_form ?? ''))
    || String(a?.normalized ?? a?.lemma ?? a?.original ?? '').localeCompare(String(b?.normalized ?? b?.lemma ?? b?.original ?? ''))
    || String(a?.word ?? a?.original ?? '').localeCompare(String(b?.word ?? b?.original ?? ''));
}

export function stableSortEntries(entries) {
  return Array.from(entries).sort(candidateIndexEntryComparator);
}
