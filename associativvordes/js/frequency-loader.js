import { BASE_CATEGORY_WEIGHTS, CATEGORY_ORDER, FREQUENCY_LIST_BASE_PATH, LANGUAGE_SOURCES } from './config-frequency-sources.js';
import { normalizeLanguageSource } from './language-source-descriptor.js';

const frequencyCache = new Map();
export const SCORE_CONFIG = {
  ipmRef: 300
};

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

function sourceUrl(language, fileName) {
  return `${FREQUENCY_LIST_BASE_PATH}/${encodeURIComponent(language)}/${encodeURIComponent(fileName)}`;
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
    if (typeof record === 'number') {
      addIpm(map, key, record);
      continue;
    }
    if (!record || typeof record !== 'object') continue;

    const explicitWord = record.word ?? record.lemma ?? record.form;
    const explicitValue = record.ipm ?? record.IPM ?? record.frequency ?? record.freq;
    if (explicitValue != null) {
      addIpm(map, explicitWord || key, explicitValue);
      continue;
    }

    for (const [nestedWord, nestedValue] of Object.entries(record)) {
      if (typeof nestedValue === 'number') addIpm(map, nestedWord, nestedValue);
      else if (nestedValue && typeof nestedValue === 'object') {
        addIpm(map, nestedWord, nestedValue.ipm ?? nestedValue.IPM ?? nestedValue.frequency ?? nestedValue.freq);
      }
    }
  }

  return map;
}

async function loadFrequencyFile(language, fileName) {
  const key = `${language}/${fileName}`;
  if (frequencyCache.has(key)) return frequencyCache.get(key);

  const promise = fetch(sourceUrl(language, fileName), { cache: 'force-cache' })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(normalizeFrequencyData);
  frequencyCache.set(key, promise);
  return promise;
}

function extractIpm(data, word) {
  if (!data) return 0;
  const key = normalizeWord(word);
  if (data instanceof Map) {
    return data.get(key) ?? data.get(key.normalize('NFD').replace(/[\u0300-\u036f]/g, '')) ?? 0;
  }
  return normalizeFrequencyData(data).get(key) || 0;
}

export function getLanguageCategoryWeights(language) {
  const sources = LANGUAGE_SOURCES[normalizeWord(language)] || {};
  const available = CATEGORY_ORDER.filter(category => Array.isArray(sources[category]) && sources[category].length > 0);
  const totalBase = available.reduce((sum, category) => sum + (BASE_CATEGORY_WEIGHTS[category] || 0), 0);
  if (!totalBase) return {};
  return Object.fromEntries(available.map(category => [category, (BASE_CATEGORY_WEIGHTS[category] || 0) / totalBase]));
}

export async function getFrequencyProfile(language, word) {
  const lang = normalizeWord(language);
  const sources = LANGUAGE_SOURCES[lang] || {};
  const categoryWeights = getLanguageCategoryWeights(lang);
  const category_breakdown = {};
  const warnings = [];
  let frequency_score = 0;

  for (const category of CATEGORY_ORDER) {
    const files = Array.isArray(sources[category]) ? sources[category] : [];
    if (!files.length) {
      warnings.push(`No ${category} source for ${lang}`);
      continue;
    }

    const ipm_values = [];
    for (const source of files) {
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
        const data = await loadFrequencyFile(lang, fileName);
        ipm_values.push(extractIpm(data, word));
      } catch (error) {
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
    category_breakdown[category] = {
      available: true,
      files_count: files.length,
      ipm_values,
      category_ipm,
      category_score,
      category_weight
    };
  }

  return { frequency_score, category_breakdown, warnings };
}
