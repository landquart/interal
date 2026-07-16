import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fuzzyRootMatch } from '../associativvordes/js/root-matcher.js';
import {
  buildSearchForm,
  extractFrequencyRecords,
  mergeFrequencyRecord,
  normalizeLemma,
  transliterateRussianForSearch
} from '../scripts/lib/associative-index-core.mjs';

const fixtureRoot = 'tests/fixtures/associative-frequency';
const outputRoot = '.tmp/associative-index-ru-normalization';
const node = process.execPath;

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function readBuiltEntries(out = outputRoot) {
  const manifest = await readJson(join(out, 'manifest.json'));
  const entries = [];
  for (const shard of manifest.languages.ru.shards) entries.push(...await readJson(join(out, shard.file)));
  return entries;
}

function assertRoot(entries, root, expected, rejected = []) {
  const matches = entries.filter(entry => fuzzyRootMatch(entry.search_form, root));
  const words = matches.map(entry => entry.word);
  for (const word of expected) assert.ok(words.includes(word), `${root} finds ${word}`);
  for (const word of rejected) assert.equal(words.includes(word), false, `${root} does not find ${word}`);
}

const requiredTransliterations = new Map([
  ['альтернатива', 'alternativa'],
  ['альтернативный', 'alternativnyj'],
  ['альтернативность', 'alternativnost'],
  ['регулировать', 'regulirovat'],
  ['регуляция', 'reguljacija'],
  ['регулярный', 'reguljarnyj'],
  ['окуляр', 'okuljar'],
  ['окулист', 'okulist'],
  ['интернациональный', 'internacionalnyj'],
  ['интерактивный', 'interaktivnyj'],
  ['ёлка', 'elka'],
  ['объект', 'objekt'],
  ['подъезд', 'podezd']
]);
for (const [input, expected] of requiredTransliterations) {
  assert.equal(transliterateRussianForSearch(input), expected);
  assert.equal(buildSearchForm(input), expected);
}

assert.equal(normalizeLemma('ЁЛКА'), 'ёлка');
assert.equal(buildSearchForm('альтер‑форма'), 'alter-forma', 'hyphen boundary is preserved');
assert.equal(buildSearchForm('альфа2'), 'alfa2', 'digits are preserved');
assert.equal(buildSearchForm('latinКириллица'), 'latinkirillica', 'Latin+Cyrillic mixed input is safe');
assert.equal(buildSearchForm('  пробелы  '), 'probely', 'outer spaces are trimmed');
assert.equal(buildSearchForm('тест’апостроф'), "test'apostrof", 'typographic apostrophe is normalized');
assert.equal(buildSearchForm(''), '', 'empty string is safe');
assert.equal(buildSearchForm(null), '', 'null is safe');
assert.equal(buildSearchForm(undefined), '', 'undefined is safe');
assert.equal(buildSearchForm('юла'), 'jula', 'ю uses the shared table');
assert.equal(buildSearchForm('яблоко'), 'jabloko', 'я uses the shared table');

const sourceA = await readJson(join(fixtureRoot, 'ru', 'hermit_2018_ru_full_lemmatized_pymorphy3_ipm6.json'));
const sourceB = await readJson(join(fixtureRoot, 'ru', 'rnc-orig.out.lpos-clean2-biwt.cleaned_ipm6.json'));
const sourceC = await readJson(join(fixtureRoot, 'ru', 'ruwac.out.gz.lpos-clean2-biwt.cleaned_recommended_min100_ipm6.json'));
const records = [
  ...extractFrequencyRecords(sourceA, 'subtitles/hermit_2018_ru_full_lemmatized_pymorphy3_ipm6.json'),
  ...extractFrequencyRecords(sourceB, 'normative/rnc-orig.out.lpos-clean2-biwt.cleaned_ipm6.json'),
  ...extractFrequencyRecords(sourceC, 'web/ruwac.out.gz.lpos-clean2-biwt.cleaned_recommended_min100_ipm6.json')
];
const index = new Map();
for (const record of records) mergeFrequencyRecord(index, record, record.source);

const alternative = index.get('альтернатива');
assert.equal(alternative.original, 'альтернатива', 'original Cyrillic form is preserved');
assert.equal(alternative.normalized, 'альтернатива', 'normalized remains Cyrillic');
assert.equal(alternative.search_form, 'alternativa', 'search_form is Latin');
assert.equal(index.get('дубль').original, 'дубль', 'UI/Qwen original form remains available');
assert.equal(Object.keys(index.get('дубль').sources).length, 3, 'duplicate original lemmas are merged');
assert.equal(index.get('замок').search_form, index.get('замокъ').search_form, 'fixture has a transliteration collision');
assert.ok(index.has('замок') && index.has('замокъ'), 'different originals are not merged by search_form collision');
assert.equal(index.get('интернет').sources['web/ruwac.out.gz.lpos-clean2-biwt.cleaned_recommended_min100_ipm6.json'], 20, 'frequency lookup uses original normalized key');
assert.equal(index.has('internet'), false, 'frequency lookup does not use search_form as key');
assert.equal(index.has('отрицательный'), false, 'negative IPM fixture row is rejected');
assert.equal(index.has('повреждённый'), false, 'damaged fixture row is rejected');

await rm(outputRoot, { recursive: true, force: true });
const build = spawnSync(node, [
  'scripts/build-associative-candidate-index.mjs',
  '--languages=ru',
  `--input-root=${fixtureRoot}`,
  `--output-root=${outputRoot}`,
  '--max-records=5000',
  `--report=${outputRoot}/build-report.json`
], { encoding: 'utf8' });
assert.equal(build.status, 0, build.stderr || build.stdout);

const entries = await readBuiltEntries();
const builtAlternative = entries.find(entry => entry.normalized === 'альтернатива');
assert.deepEqual(
  { word: builtAlternative.word, normalized: builtAlternative.normalized, search_form: builtAlternative.search_form },
  { word: 'альтернатива', normalized: 'альтернатива', search_form: 'alternativa' },
  'Russian index entry separates UI word, Cyrillic normalized form, and Latin search_form'
);
assertRoot(entries, 'alter', ['альтернатива', 'альтернативный'], ['интернациональный', 'интерактивный']);
assertRoot(entries, 'regul', ['регулировать', 'регулярный']);
assertRoot(entries, 'okul', ['окуляр', 'окулист']);
assertRoot(entries, 'inter', ['интернациональный', 'интерактивный'], ['альтернатива', 'альтернативный']);
assert.equal(fuzzyRootMatch('inter', 'alter'), null, 'alter does not fuzzily match inter');
assert.equal(fuzzyRootMatch('internacionalnyj', 'alter'), null, 'alter does not fuzzily match интернациональный search_form');

const ruReport = await readJson(join(outputRoot, 'build-report.json'));
assert.equal(ruReport.transliteration.version, '1', 'Russian report includes transliteration version');
assert.equal(ruReport.transliteration.entries_with_search_form, entries.length, 'all Russian entries have search_form in report');
assert.equal(ruReport.transliteration.entries_without_search_form, 0, 'Russian report has no missing search_form');
assert.ok(ruReport.transliteration.collisions >= 1, 'Russian report counts search_form collisions without deleting entries');
assert.ok(ruReport.root_samples.alter.includes('альтернатива'), 'Russian root samples use original Cyrillic words');
