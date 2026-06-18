import { BASE_CATEGORY_WEIGHTS, CATEGORY_ORDER, FREQUENCY_LIST_BASE_PATH, LANGUAGE_SOURCES } from './config-frequency-sources.js';

const frequencyCache = new Map();
const IPM_REF = 1000;

export function meanNonZero(values) {
  const valid = values.filter(v => typeof v === 'number' && v > 0);
  if (!valid.length) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function ipmToScore(ipm) {
  if (!ipm || ipm <= 0) return 0;
  return Math.min(100, (Math.log10(1 + ipm) / Math.log10(1 + IPM_REF)) * 100);
}

export function normalizeWord(value) {
  return String(value || '').trim().toLowerCase().normalize('NFC');
}

function sourceUrl(language, fileName) {
  return `${FREQUENCY_LIST_BASE_PATH}/${encodeURIComponent(language)}/${encodeURIComponent(fileName)}`;
}

async function loadFrequencyFile(language, fileName) {
  const key = `${language}/${fileName}`;
  if (frequencyCache.has(key)) return frequencyCache.get(key);

  const promise = fetch(sourceUrl(language, fileName), { cache: 'force-cache' })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });
  frequencyCache.set(key, promise);
  return promise;
}

function extractIpm(data, word) {
  if (!data || typeof data !== 'object') return 0;
  const key = normalizeWord(word);
  const record = data[key] ?? data[String(word || '').trim()] ?? data[key.normalize('NFD').replace(/[\u0300-\u036f]/g, '')];
  if (typeof record === 'number') return Number.isFinite(record) ? record : 0;
  if (record && typeof record === 'object') {
    const value = record.ipm ?? record.IPM ?? record.frequency ?? record.freq;
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }
  return 0;
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
    for (const fileName of files) {
      try {
        const data = await loadFrequencyFile(lang, fileName);
        ipm_values.push(extractIpm(data, word));
      } catch (error) {
        warnings.push(`Frequency file unavailable: ${lang}/${fileName} (${error.message})`);
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
