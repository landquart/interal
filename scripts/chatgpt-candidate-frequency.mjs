#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LANGUAGE_SOURCES, CATEGORY_ORDER, BASE_CATEGORY_WEIGHTS } from '../associativvordes/js/config-frequency-sources.js';

const LANGUAGES = ['en', 'de', 'es', 'fr', 'it', 'ru'];
const BASE = join('associativvordes', 'frequency lists');

const ITEMS = [
  { id:'repository', forms:{en:['repository'],de:['repository','repositorium'],es:['repositorio'],fr:['repository'],it:['repository','repositorio'],ru:['репозиторий']}},
  { id:'abduction', forms:{en:['abduction'],de:['abduktion'],es:['abducción','abduccion'],fr:['abduction'],it:['abduzione'],ru:null}},
  { id:'attraction', forms:{en:['attraction'],de:['attraktion'],es:['atracción','atraccion'],fr:['attraction'],it:['attrazione'],ru:null}},
  { id:'prescription', forms:{en:['prescription'],de:null,es:['prescripción','prescripcion'],fr:['prescription'],it:['prescrizione'],ru:null}},
  { id:'detention', forms:{en:['detention'],de:['detention'],es:['detención','detencion'],fr:['détention','detention'],it:['detenzione'],ru:['детенция']}},
  { id:'commotion', forms:{en:['commotion'],de:['kommotion'],es:['conmoción','conmocion'],fr:['commotion'],it:['commozione'],ru:['коммоция']}},
  { id:'rotation', forms:{en:['rotation'],de:['rotation'],es:['rotación','rotacion'],fr:['rotation'],it:['rotazione'],ru:['ротация']}},
  { id:'audition', forms:{en:['audition'],de:['audition'],es:['audición','audicion'],fr:['audition'],it:['audizione'],ru:['аудиция']}},
  { id:'prospect', forms:{en:['prospect'],de:null,es:null,fr:null,it:null,ru:null}},
  { id:'action_lawsuit', forms:{en:['action'],de:null,es:['acción','accion'],fr:['action'],it:['azione'],ru:null}}
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
    if (typeof record === 'number') { addIpm(map, key, record); continue; }
    if (!record || typeof record !== 'object') continue;
    const explicitWord = record.word ?? record.lemma ?? record.form;
    const explicitValue = record.ipm ?? record.IPM ?? record.frequency ?? record.freq;
    if (explicitValue != null) { addIpm(map, explicitWord || key, explicitValue); continue; }
    for (const [nestedWord, nestedValue] of Object.entries(record)) {
      if (typeof nestedValue === 'number') addIpm(map, nestedWord, nestedValue);
      else if (nestedValue && typeof nestedValue === 'object') {
        addIpm(map, nestedWord, nestedValue.ipm ?? nestedValue.IPM ?? nestedValue.frequency ?? nestedValue.freq);
      }
    }
  }
  return map;
}

function sourceDescriptors(language) {
  const descriptors = [];
  for (const category of CATEGORY_ORDER) {
    for (const source of LANGUAGE_SOURCES[language]?.[category] || []) {
      descriptors.push({ category, file: typeof source === 'string' ? source : source.file });
    }
  }
  return descriptors;
}

function languageCategoryWeights(language) {
  const available = CATEGORY_ORDER.filter(category => (LANGUAGE_SOURCES[language]?.[category] || []).length > 0);
  const total = available.reduce((sum, category) => sum + (BASE_CATEGORY_WEIGHTS[category] || 0), 0);
  return Object.fromEntries(available.map(category => [category, (BASE_CATEGORY_WEIGHTS[category] || 0) / total]));
}

function lookup(map, candidates) {
  if (!candidates) return 0;
  for (const candidate of candidates) {
    const nfc = candidate.normalize('NFC').toLowerCase();
    const stripped = nfc.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const variant of [...new Set([nfc, stripped])]) {
      const value = map.get(variant);
      if (typeof value === 'number' && value > 0) return value;
    }
  }
  return 0;
}

function meanNonZero(values) {
  const valid = values.filter(v => Number.isFinite(v) && v > 0);
  return valid.length ? valid.reduce((a,b)=>a+b,0)/valid.length : 0;
}

const results = ITEMS.map(item => ({id:item.id, forms:item.forms, languages:Object.fromEntries(LANGUAGES.map(l=>[l,{entries:[]}]))}));

for (const language of LANGUAGES) {
  for (const descriptor of sourceDescriptors(language)) {
    const path = join(BASE, language, descriptor.file);
    let map;
    try { map = normalizeFrequencyData(JSON.parse(await readFile(path,'utf8'))); }
    catch (error) { console.error(`Cannot read ${path}: ${error.message}`); continue; }
    for (const result of results) {
      result.languages[language].entries.push({category:descriptor.category, value:lookup(map,result.forms[language])});
    }
  }
}

for (const result of results) {
  const vals=[];
  for (const language of LANGUAGES) {
    const weights=languageCategoryWeights(language);
    let sum=0;
    for (const category of CATEGORY_ORDER) {
      const catVals=result.languages[language].entries.filter(x=>x.category===category).map(x=>x.value);
      if (!catVals.length) continue;
      sum += (weights[category] || 0) * meanNonZero(catVals);
    }
    result.languages[language]=sum;
    vals.push(sum);
  }
  result.geometric_mean_ipm=Math.exp(vals.reduce((s,v)=>s+Math.log1p(v),0)/LANGUAGES.length)-1;
  result.arithmetic_mean_ipm=vals.reduce((a,b)=>a+b,0)/LANGUAGES.length;
}

await writeFile('chatgpt-candidate-frequency-results.json', JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
