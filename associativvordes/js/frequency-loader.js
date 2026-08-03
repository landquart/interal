import { BASE_CATEGORY_WEIGHTS, CATEGORY_ORDER, FREQUENCY_LIST_BASE_PATH, LANGUAGE_SOURCES } from './config-frequency-sources.js';
import { normalizeLanguageSource } from './language-source-descriptor.js';
import { isAbortError, normalizeAbortError } from './qwen-client.js';

// Cache only fully loaded maps so cancellation of one run cannot poison another run.
const frequencyCache = new Map();
export const SCORE_CONFIG = { ipmRef: 300 };

export function meanNonZero(values) {
  const valid = values.filter(v => typeof v === 'number' && v > 0);
  if (!valid.length) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function ipmToScore(ipm) {
  if (!ipm || ipm <= 0) return 0;
  return Math.min(100, (Math.log10(1 + ipm) / Math.log10(1 + SCORE_CONFIG.ipmRef)) * 100);
}

export function normalizeWord(value) {
  return String(value || '').trim().toLowerCase().normalize('NFC');
}

function sourceUrl(language, fileName, basePath = FREQUENCY_LIST_BASE_PATH) {
  return `${basePath}/${encodeURIComponent(language)}/${encodeURIComponent(fileName)}`;
}

function throwIfAborted(signal, stage) {
  if (signal?.aborted) throw normalizeAbortError(signal.reason, { stage });
}

function addIpm(map, word, value) {
  const key = normalizeWord(word);
  const number = Number(value);
  if (key && Number.isFinite(number) && number > 0) map.set(key, number);
}

export function normalizeFrequencyData(data) {
  const map = new Map();
  if (!data || typeof data !== 'object') return map;
  if (Array.isArray(data)) {
    for (const record of data) {
      if (!record || typeof record !== 'object') continue;
      addIpm(map, record.word ?? record.lemma ?? record.form, record.ipm ?? record.IPM ?? record.frequency ?? record.freq);
    }
    return map;
  }
  for (const [key, record] of Object.entries(data)) {
    if (typeof record === 'number') { addIpm(map, key, record); continue; }
    if (!record || typeof record !== 'object') continue;
    const explicitWord = record.word ?? record.lemma ?? record.form;
    const explicitValue = record.ipm ?? record.IPM ?? record.frequency ?? record.freq;
    if (explicitValue != null) { addIpm(map, explicitWord || key, explicitValue); continue; }
    for (const [nestedWord, nestedValue] of Object.entries(record)) {
      if (typeof nestedValue === 'number') addIpm(map, nestedWord, nestedValue);
      else if (nestedValue && typeof nestedValue === 'object') addIpm(map, nestedWord, nestedValue.ipm ?? nestedValue.IPM ?? nestedValue.frequency ?? nestedValue.freq);
    }
  }
  return map;
}

async function loadFrequencyFile(language, fileName, { signal, basePath = FREQUENCY_LIST_BASE_PATH } = {}) {
  const key = `${basePath}/${language}/${fileName}`;
  throwIfAborted(signal, 'frequency_fetch');
  if (frequencyCache.has(key)) return frequencyCache.get(key);
  let response;
  try {
    response = await fetch(sourceUrl(language, fileName, basePath), { cache: 'force-cache', signal });
  } catch (error) {
    if (isAbortError(error, signal)) throw normalizeAbortError(error, { stage: 'frequency_fetch' });
    throw error;
  }
  throwIfAborted(signal, 'frequency_fetch');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  throwIfAborted(signal, 'frequency_parse');
  const normalized = normalizeFrequencyData(payload);
  frequencyCache.set(key, normalized);
  return normalized;
}

function extractIpm(data, word) {
  if (!data) return 0;
  const key = normalizeWord(word);
  if (data instanceof Map) return data.get(key) ?? data.get(key.normalize('NFD').replace(/[\u0300-\u036f]/g, '')) ?? 0;
  return normalizeFrequencyData(data).get(key) || 0;
}

export function getLanguageCategoryWeights(language) {
  const sources = LANGUAGE_SOURCES[normalizeWord(language)] || {};
  const available = CATEGORY_ORDER.filter(category => Array.isArray(sources[category]) && sources[category].length > 0);
  const totalBase = available.reduce((sum, category) => sum + (BASE_CATEGORY_WEIGHTS[category] || 0), 0);
  if (!totalBase) return {};
  return Object.fromEntries(available.map(category => [category, (BASE_CATEGORY_WEIGHTS[category] || 0) / totalBase]));
}

export async function getFrequencyProfile(language, word, { signal, basePath = FREQUENCY_LIST_BASE_PATH } = {}) {
  const lang = normalizeWord(language);
  const sources = LANGUAGE_SOURCES[lang] || {};
  const categoryWeights = getLanguageCategoryWeights(lang);
  const category_breakdown = {};
  const warnings = [];
  let frequency_score = 0;
  for (const category of CATEGORY_ORDER) {
    throwIfAborted(signal, `frequency:${category}`);
    const files = Array.isArray(sources[category]) ? sources[category] : [];
    if (!files.length) { warnings.push(`No ${category} source for ${lang}`); continue; }
    const ipm_values = [];
    for (const source of files) {
      throwIfAborted(signal, `frequency:${category}`);
      let descriptor;
      try {
        descriptor = normalizeLanguageSource(category, source);
      } catch (error) {
        warnings.push(`Invalid frequency source descriptor for ${lang}/${category}: ${error.message}`);
        ipm_values.push(0);
        continue;
      }
      const { fileName, sourceId, optional } = descriptor;
      try {
        const data = await loadFrequencyFile(lang, fileName, { signal, basePath });
        throwIfAborted(signal, `frequency:${category}`);
        ipm_values.push(extractIpm(data, word));
      } catch (error) {
        if (isAbortError(error, signal)) throw normalizeAbortError(error, { stage: `frequency:${category}` });
        const requiredness = optional ? 'Optional' : 'Required';
        warnings.push(`${requiredness} frequency file unavailable: ${lang}/${sourceId} (${error.message})`);
        ipm_values.push(0);
      }
    }
    const category_ipm = meanNonZero(ipm_values);
    if (category_ipm === 0) warnings.push(`Word not found in ${category} corpus for ${lang}`);
    const category_score = ipmToScore(category_ipm);
    const category_weight = categoryWeights[category] || 0;
    frequency_score += category_weight * category_score;
    category_breakdown[category] = { available: true, files_count: files.length, ipm_values, category_ipm, category_score, category_weight };
  }
  const combined_ipm = CATEGORY_ORDER.reduce((sum, category) => {
    const details = category_breakdown[category];
    return sum + (Number(details?.category_ipm) || 0) * (Number(details?.category_weight) || 0);
  }, 0);
  return { frequency_score, combined_ipm, category_breakdown, warnings };
}

export function clearFrequencyCacheForTests() {
  frequencyCache.clear();
}
