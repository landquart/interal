import { normalizeWord } from './frequency-loader.js';

export const API_CONFIG = {
  swowBasePath: './swow_association_strength',
  qwenAssociationUrl: '/api/qwen-association',
  qwenPrimaryModel: 'qwen3.6-35b-a3b/latest',
  qwenReviewModel: 'qwen3-235b-a22b-fp8/latest'
};

const SWOW_LANGUAGE_FILES = {
  en: {
    path: 'en',
    r1: 'strength.SWOW-EN.R1.20180827.csv',
    r123: 'strength.SWOW-EN.R123.20180827.csv'
  },
  de: {
    path: 'de',
    r1: 'strength.SWOW-DE.2025.R1.csv',
    r123: 'strength.SWOW-DE.2025.R123.csv'
  },
  es: {
    path: 'es-rp',
    r1: 'strength.SWOWRP.R1.20220426.csv',
    r123: 'strength.SWOWRP.R123.20220426.csv'
  }
};

const swowCache = new Map();

export function normalizeSwowWord(value) {
  return String(value || '').trim().toLowerCase().normalize('NFC');
}

function emptyAssociation(language, cue, response, extra = {}) {
  return {
    found: false,
    language,
    cue: normalizeSwowWord(cue),
    response: normalizeSwowWord(response),
    r1_strength: 0,
    r123_strength: 0,
    source: 'local_swow',
    ...extra
  };
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function swowUrl(langConfig, fileName) {
  return `${API_CONFIG.swowBasePath}/${encodeURIComponent(langConfig.path)}/${encodeURIComponent(fileName)}`;
}

function splitCsvLine(line, delimiter) {
  const result = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      result.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }
  result.push(cell);
  return result;
}

function parseStrengthCsv(text, strengthKey) {
  const lines = String(text || '').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return new Map();
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = splitCsvLine(lines[0], delimiter).map(h => normalizeWord(h));
  const cueIndex = headers.indexOf('cue');
  const responseIndex = headers.indexOf('response');
  let strengthIndex = headers.findIndex(h => h === `${strengthKey}.strength` || h === `${strengthKey}_strength`);
  if (strengthIndex === -1) strengthIndex = headers.findIndex(h => h === strengthKey);
  const map = new Map();

  for (const line of lines.slice(1)) {
    const columns = splitCsvLine(line, delimiter);
    const cue = normalizeSwowWord(columns[cueIndex]);
    const response = normalizeSwowWord(columns[responseIndex]);
    if (!cue || !response) continue;
    map.set(`${cue}\u0000${response}`, numberOrZero(columns[strengthIndex]));
  }

  return map;
}

async function loadStrengthFile(langConfig, fileName, strengthKey) {
  const url = swowUrl(langConfig, fileName);
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { url, data: parseStrengthCsv(await res.text(), strengthKey) };
}

async function loadSwowLanguage(language) {
  const lang = normalizeWord(language);
  if (swowCache.has(lang)) return swowCache.get(lang);

  const promise = (async () => {
    const langConfig = SWOW_LANGUAGE_FILES[lang];
    if (!langConfig) {
      return {
        available: false,
        language: lang,
        swowPath: `${API_CONFIG.swowBasePath}/${lang}`,
        warning: `SWOW local file not found for language: ${lang}`,
        r1: new Map(),
        r123: new Map()
      };
    }

    const swowPath = `${API_CONFIG.swowBasePath}/${langConfig.path}`;
    try {
      const [r1, r123] = await Promise.all([
        loadStrengthFile(langConfig, langConfig.r1, 'r1'),
        loadStrengthFile(langConfig, langConfig.r123, 'r123')
      ]);
      return { available: true, language: lang, swowPath, files: { r1: r1.url, r123: r123.url }, r1: r1.data, r123: r123.data };
    } catch (error) {
      return {
        available: false,
        language: lang,
        swowPath,
        warning: `SWOW local file not found for language: ${lang}`,
        details: error.message,
        r1: new Map(),
        r123: new Map()
      };
    }
  })();

  swowCache.set(lang, promise);
  return promise;
}

export async function getSwowAssociation(language, cue, response) {
  const lang = normalizeWord(language);
  const normalizedCue = normalizeSwowWord(cue);
  const normalizedResponse = normalizeSwowWord(response);
  const loaded = await loadSwowLanguage(lang);

  if (!loaded.available) {
    return emptyAssociation(lang, normalizedCue, normalizedResponse, {
      warning: 'SWOW file unavailable for language',
      diagnostic: {
        swowPath: loaded.swowPath,
        swowFileLoaded: false,
        swowPairFound: false,
        swowTargetMeaning: normalizedCue
      }
    });
  }

  const key = `${normalizedCue}\u0000${normalizedResponse}`;
  const r1Strength = loaded.r1.get(key) || 0;
  const r123Strength = loaded.r123.get(key) || 0;
  const found = r1Strength > 0 || r123Strength > 0;
  return {
    found,
    language: lang,
    cue: normalizedCue,
    response: normalizedResponse,
    r1_strength: r1Strength,
    r123_strength: r123Strength,
    source: 'local_swow',
    warning: found ? undefined : 'No SWOW pair found, association not penalized',
    diagnostic: {
      swowPath: loaded.swowPath,
      swowFileLoaded: true,
      swowPairFound: found,
      swowTargetMeaning: normalizedCue
    }
  };
}

export async function getBidirectionalSwow(language, target, word) {
  const [targetToWord, wordToTarget] = await Promise.all([
    getSwowAssociation(language, target, word),
    getSwowAssociation(language, word, target)
  ]);
  return { target_to_word: targetToWord, word_to_target: wordToTarget };
}
