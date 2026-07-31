#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LANGUAGE_SOURCES, CATEGORY_ORDER, BASE_CATEGORY_WEIGHTS } from '../associativvordes/js/config-frequency-sources.js';

const LANGUAGES = ['en', 'de', 'es', 'fr', 'it', 'ru'];
const BASE = join('associativvordes', 'frequency lists');

const ITEMS = [
  {
    id: 'station',
    logical: 'Station — стояние',
    international: 'Stationu — станция',
    forms: {
      en: ['station'], de: ['station'], es: ['estación', 'estacion'],
      fr: ['station'], it: ['stazione'], ru: ['станция']
    }
  },
  {
    id: 'conductor',
    logical: 'Conductor — совместно ведущий',
    international: 'Conductoru — дирижёр',
    forms: {
      en: ['conductor'], de: null, es: null, fr: null, it: null, ru: null
    }
  },
  {
    id: 'circumspection',
    logical: 'Circumspection — взгляд вокруг',
    international: 'Circumspectionu — осмотрительность, осторожность',
    forms: {
      en: ['circumspection'], de: ['zirkumspektion'],
      es: ['circunspección', 'circunspeccion'], fr: ['circonspection'],
      it: ['circospezione'], ru: ['циркумспекция']
    }
  },
  {
    id: 'transaction',
    logical: 'Transaction — действие, переходящее от одной стороны к другой',
    international: 'Transactionu — транзакция',
    forms: {
      en: ['transaction'], de: ['transaktion'], es: ['transacción', 'transaccion'],
      fr: ['transaction'], it: ['transazione'], ru: ['транзакция']
    }
  },
  {
    id: 'creature',
    logical: 'Creatura — созданное',
    international: 'Creaturu — живое существо',
    forms: {
      en: ['creature'], de: ['kreatur'], es: ['criatura'],
      fr: ['créature', 'creature'], it: ['creatura'], ru: null
    }
  },
  {
    id: 'trajectory',
    logical: 'Trajectoria — место, где бросают через',
    international: 'Trajectoriu — траектория',
    forms: {
      en: ['trajectory'], de: ['trajektorie'], es: ['trayectoria'],
      fr: ['trajectoire'], it: ['traiettoria'], ru: ['траектория']
    }
  },
  {
    id: 'parliament',
    logical: 'Parlament — говорение',
    international: 'Parlamentu — парламент',
    forms: {
      en: ['parliament'], de: ['parlament'], es: ['parlamento'],
      fr: ['parlement'], it: ['parlamento'], ru: ['парламент']
    }
  },
  {
    id: 'pact',
    logical: 'Pact — скреплённое, закреплённое',
    international: 'Pactu — пакт, соглашение',
    forms: {
      en: ['pact'], de: ['pakt'], es: ['pacto'],
      fr: ['pacte'], it: ['patto'], ru: ['пакт']
    }
  },
  {
    id: 'circumvention',
    logical: 'Circumvention — приход вокруг',
    international: 'Circumventionu — уклонение, обход запрета',
    forms: {
      en: ['circumvention'], de: null, es: null, fr: null, it: null, ru: null
    }
  },
  {
    id: 'information',
    logical: 'Information — формирование в',
    international: 'Informationu — информация',
    forms: {
      en: ['information'], de: ['information'], es: ['información', 'informacion'],
      fr: ['information'], it: ['informazione'], ru: ['информация']
    }
  },
  {
    id: 'recreation',
    logical: 'Recreation — повторное создание',
    international: 'Recreationu — отдых, развлечение',
    forms: {
      en: ['recreation'], de: ['rekreation'], es: ['recreación', 'recreacion'],
      fr: ['récréation', 'recreation'], it: ['ricreazione'], ru: ['рекреация']
    }
  },
  {
    id: 'preposition',
    logical: 'Preposition — предварительное ложение',
    international: 'Prepositionu — предлог',
    forms: {
      en: ['preposition'], de: ['präposition', 'praeposition'],
      es: ['preposición', 'preposicion'], fr: ['préposition', 'preposition'],
      it: ['preposizione'], ru: null
    }
  },
  {
    id: 'doctor',
    logical: 'Doctor — обучающий, учитель',
    international: 'Doctoru — врач',
    forms: {
      en: ['doctor'], de: ['doktor'], es: ['doctor'],
      fr: ['docteur'], it: ['dottore'], ru: ['доктор']
    }
  },
  {
    id: 'temperament',
    logical: 'Temperament — результат уравновешивания',
    international: 'Temperamentu — темперамент',
    forms: {
      en: ['temperament'], de: ['temperament'], es: ['temperamento'],
      fr: ['tempérament', 'temperament'], it: ['temperamento'], ru: ['темперамент']
    }
  },
  {
    id: 'emulsion',
    logical: 'Emulsion — дойка',
    international: 'Emulsionu — эмульсия',
    forms: {
      en: ['emulsion'], de: ['emulsion'], es: ['emulsión', 'emulsion'],
      fr: ['émulsion', 'emulsion'], it: ['emulsione'], ru: ['эмульсия']
    }
  }
];

function addIpm(map, word, value) {
  const key = String(word || '').trim().toLowerCase().normalize('NFC');
  const number = Number(value);
  if (key && Number.isFinite(number) && number > 0) map.set(key, number);
}

function normalizeFrequencyData(data) {
  const map = new Map();
  if (!data || typeof data !== 'object') return map;
  if (Array.isArray(data)) {
    for (const record of data) {
      if (!record || typeof record !== 'object') continue;
      addIpm(map, record.word ?? record.lemma ?? record.form,
        record.ipm ?? record.IPM ?? record.frequency ?? record.freq);
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
      if (typeof nestedValue === 'number') {
        addIpm(map, nestedWord, nestedValue);
      } else if (nestedValue && typeof nestedValue === 'object') {
        addIpm(map, nestedWord,
          nestedValue.ipm ?? nestedValue.IPM ?? nestedValue.frequency ?? nestedValue.freq);
      }
    }
  }
  return map;
}

function sourceDescriptors(language) {
  const descriptors = [];
  for (const category of CATEGORY_ORDER) {
    for (const source of LANGUAGE_SOURCES[language]?.[category] || []) {
      descriptors.push({
        category,
        file: typeof source === 'string' ? source : source.file
      });
    }
  }
  return descriptors;
}

function languageCategoryWeights(language) {
  const available = CATEGORY_ORDER.filter(
    category => Array.isArray(LANGUAGE_SOURCES[language]?.[category]) &&
      LANGUAGE_SOURCES[language][category].length > 0
  );
  const total = available.reduce(
    (sum, category) => sum + (BASE_CATEGORY_WEIGHTS[category] || 0), 0
  );
  return Object.fromEntries(
    available.map(category => [category, (BASE_CATEGORY_WEIGHTS[category] || 0) / total])
  );
}

function lookup(map, candidates) {
  if (!candidates) return { value: 0, matched: null };
  for (const candidate of candidates) {
    const nfc = candidate.normalize('NFC').toLowerCase();
    const stripped = nfc.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const variant of [...new Set([nfc, stripped])]) {
      const value = map.get(variant);
      if (typeof value === 'number' && value > 0) {
        return { value, matched: variant };
      }
    }
  }
  return { value: 0, matched: null };
}

function meanNonZero(values) {
  const valid = values.filter(value => typeof value === 'number' && value > 0);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
}

const results = ITEMS.map(item => ({
  ...item,
  languages: Object.fromEntries(LANGUAGES.map(lang => [lang, {
    forms: item.forms[lang],
    source_values: [],
    source_mean_ipm: 0,
    found_in_sources: 0
  }]))
}));

for (const language of LANGUAGES) {
  const descriptors = sourceDescriptors(language);
  for (const descriptor of descriptors) {
    const path = join(BASE, language, descriptor.file);
    let data;
    try {
      data = normalizeFrequencyData(JSON.parse(await readFile(path, 'utf8')));
    } catch (error) {
      console.error(`Cannot read ${path}: ${error.message}`);
      continue;
    }
    for (const result of results) {
      const forms = result.forms[language];
      if (!forms) {
        result.languages[language].source_values.push({
          category: descriptor.category,
          source: descriptor.file,
          ipm: 0,
          matched: null,
          reason: 'no_target_cognate'
        });
        continue;
      }
      const hit = lookup(data, forms);
      result.languages[language].source_values.push({
        category: descriptor.category,
        source: descriptor.file,
        ipm: hit.value,
        matched: hit.matched,
        reason: hit.matched ? 'found' : 'not_in_source'
      });
    }
  }
}

for (const result of results) {
  const languageValues = [];
  for (const language of LANGUAGES) {
    const info = result.languages[language];
    const weights = languageCategoryWeights(language);
    info.category_ipm = {};
    info.source_mean_ipm = 0;
    for (const category of CATEGORY_ORDER) {
      const values = info.source_values
        .filter(entry => entry.category === category)
        .map(entry => entry.ipm);
      if (!values.length) continue;
      const categoryIpm = meanNonZero(values);
      info.category_ipm[category] = categoryIpm;
      info.source_mean_ipm += (weights[category] || 0) * categoryIpm;
    }
    info.found_in_sources = info.source_values.filter(entry => entry.matched).length;
    languageValues.push(info.source_mean_ipm);
  }
  result.arithmetic_mean_ipm =
    languageValues.reduce((a, b) => a + b, 0) / LANGUAGES.length;
  result.geometric_mean_ipm =
    Math.exp(languageValues.reduce((sum, value) => sum + Math.log1p(value), 0)
      / LANGUAGES.length) - 1;
  result.language_values_ipm = Object.fromEntries(
    LANGUAGES.map((lang, i) => [lang, languageValues[i]])
  );
  result.cognate_languages =
    LANGUAGES.filter(lang => result.forms[lang] != null).length;
  result.positive_languages =
    LANGUAGES.filter(lang => result.languages[lang].source_mean_ipm > 0).length;
}

const sorted = [...results].sort((a, b) => a.geometric_mean_ipm - b.geometric_mean_ipm);
for (let i = 0; i < sorted.length; i += 1) {
  sorted[i].tertile = i < 5 ? 'низкая' : i < 10 ? 'средняя' : 'высокая';
}

const output = {
  generated_at: new Date().toISOString(),
  method: {
    control_languages: LANGUAGES,
    within_language: 'Внутри категории используется среднее ненулевых IPM, затем категории объединяются с весами конфигурации репозитория; отсутствие леммы во всех источниках категории = 0.',
    across_languages: 'Геометрическое среднее с единицей: exp(mean(ln(1 + IPM_lang))) - 1; отсутствие целевого когната в языке = 0.',
    caveat: 'Частотность относится к лемме целиком и не разделяет значения полисемичного слова.'
  },
  results
};

await writeFile('chatgpt-frequency-results.json', `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(results.map(r => ({
  id: r.id,
  international: r.international,
  geometric_mean_ipm: r.geometric_mean_ipm,
  arithmetic_mean_ipm: r.arithmetic_mean_ipm,
  tertile: r.tertile,
  language_values_ipm: r.language_values_ipm
})), null, 2));
