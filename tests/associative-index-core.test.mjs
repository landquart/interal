import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ipmToScore } from '../associativvordes/js/frequency-loader.js';
import {
  buildSearchForm,
  calculateCategoryProfile,
  calculateFrequencyScore,
  extractFrequencyRecords,
  mergeFrequencyRecord,
  normalizeLemma,
  stableSortEntries,
  stripDiacritics,
  transliterateRussianForSearch
} from '../scripts/lib/associative-index-core.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
async function fixture(name) {
  return JSON.parse(await readFile(join(__dirname, 'fixtures/associative-index', `${name}.json`), 'utf8'));
}

const en = extractFrequencyRecords(await fixture('en'), 'en');
const de = extractFrequencyRecords(await fixture('de'), 'de');
const fr = extractFrequencyRecords(await fixture('fr'), 'fr');
const es = extractFrequencyRecords(await fixture('es'), 'es');
const it = extractFrequencyRecords(await fixture('it'), 'it');
const ru = extractFrequencyRecords(await fixture('ru'), 'ru');
const all = [...en, ...de, ...fr, ...es, ...it, ...ru];

assert.equal(en.find(r => r.normalized === 'alternative').ipm, 10);
assert.equal(de.find(r => r.normalized === 'alternative').ipm, 17.4);
assert.equal(fr.find(r => r.normalized === 'régulation').ipm, 12.5);
assert.equal(es.find(r => r.normalized === 'interacción').ipm, 8.5);
assert.equal(it.find(r => r.normalized === 'città').ipm, 7.25);
assert.equal(ru.find(r => r.normalized === 'альтернативный').ipm, 9);

const ranked = de.find(r => r.normalized === 'alternative');
assert.equal(ranked.rank, 105);
assert.equal(ranked.ipm, 17.4);
assert.equal(extractFrequencyRecords({ 105: { alternative: { rank: 105 } } }).length, 0);

const index = new Map();
for (const record of all) mergeFrequencyRecord(index, record, record.source);
assert.equal(index.get('duplicate').original, 'duplicate');
assert.deepEqual(index.get('duplicate').sources, { en: 1, de: 3, fr: 5 });
assert.equal(index.get('zero').sources.fr, 0);
assert.equal(index.has('negative'), false);
assert.equal(index.has('minus'), false);
assert.equal(index.has('неверный'), false);
assert.equal(index.has('broken'), false);
assert.equal(index.has('damaged'), false);

const profile = calculateCategoryProfile([0, 10, 20]);
assert.equal(profile.category_ipm, 15);
assert.equal(profile.category_score, ipmToScore(15));
assert.equal(calculateFrequencyScore({ subtitles: { category_score: 25 }, normative: { category_score: 75 } }), 50);

assert.equal(normalizeLemma(' Café '), 'café');
assert.equal(stripDiacritics('régulación'), 'regulacion');
assert.equal(buildSearchForm('régulation'), 'regulation');
assert.equal(transliterateRussianForSearch('альтернативный'), 'alternativnyj');
const russian = index.get('альтернативный');
assert.equal(russian.original, 'альтернативный');
assert.equal(russian.search_form, 'alternativnyj');
assert.notEqual(russian.original, russian.search_form);

const sorted = stableSortEntries([
  { original: 'b', normalized: 'b', frequency_score: 2 },
  { original: 'a', normalized: 'a', frequency_score: 2 },
  { original: 'c', normalized: 'c', frequency_score: 3 }
]);
assert.deepEqual(sorted.map(x => x.normalized), ['c', 'a', 'b']);

const unorderedA = extractFrequencyRecords({ first: 1, second: 2 }).map(r => r.normalized).sort();
const unorderedB = extractFrequencyRecords({ second: 2, first: 1 }).map(r => r.normalized).sort();
assert.deepEqual(unorderedA, unorderedB);
