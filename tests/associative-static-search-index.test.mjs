import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildStaticSearchIndex } from '../scripts/build-associative-static-search-index.mjs';
import { validateStaticSearchIndex } from '../scripts/validate-associative-static-search-index.mjs';
import { createCandidateIndexLoader, fuzzySeedGrams } from '../associativvordes/js/candidate-index-loader.js';
import { fuzzyRootMatch, specialRootMatch, specialRootVariants } from '../associativvordes/js/root-matcher.js';

const sourceRoot = '.tmp/static-search-source';
const outputRoot = '.tmp/static-search-output';
await rm(sourceRoot, { recursive: true, force: true });
await rm(outputRoot, { recursive: true, force: true });
await mkdir(join(sourceRoot, 'en'), { recursive: true });

const source = { id: 'normative/test.json', file: 'test.json', category: 'normative', ipm: 10 };
const entry = (word, rank, score = 50) => ({ word, normalized: word.toLowerCase(), search_form: word.toLowerCase(), rank, frequency_score: score, category_breakdown: {}, sources: [{ ...source }] });
const shards = {
  'en/a.json': [entry('alternative', 2, 70), entry('alteration', 3, 60)],
  'en/i.json': [entry('irregular', 4, 55)],
  'en/r.json': [entry('regular', 1, 90), entry('regulation', 5, 80)],
  'en/o.json': [entry('ocular', 6, 50)],
  'en/x.json': [entry('xregulation', 7, 45)]
};
for (const [file, entries] of Object.entries(shards)) await writeFile(join(sourceRoot, file), `${JSON.stringify(entries, null, 2)}\n`);
await writeFile(join(sourceRoot, 'manifest.json'), `${JSON.stringify({
  version: '1', normalizer_version: '2', global_config_hash: 'fixture-global',
  languages: { en: { language_config_hash: 'fixture-en', entries: Object.values(shards).reduce((sum, entries) => sum + entries.length, 0), source_files: [source.id], shards: Object.entries(shards).map(([file, entries]) => ({ file, entries: entries.length })) } }
}, null, 2)}\n`);

const { manifest, report } = await buildStaticSearchIndex({ language: 'en', inputRoot: sourceRoot, outputRoot, blockSize: 128, bucketCount: 16 });
assert.equal(manifest.version, '2');
assert.equal(manifest.index_format, 'static-inverted-ngram-v1');
assert.equal(report.entries, 7);
assert.ok(report.posting_grams > 0);
assert.ok(report.total_bytes > 0);

const validation = await validateStaticSearchIndex({ indexRoot: outputRoot, languages: ['en'], strict: true });
assert.equal(validation.valid, true, validation.errors.join('\n'));

const fetch = async url => {
  const relative = String(url).replace(/^\.\/search-index\//, '');
  try {
    const text = await readFile(join(outputRoot, relative), 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(text) };
  } catch {
    return { ok: false, status: 404, json: async () => { throw new Error('not found'); } };
  }
};
const loader = createCandidateIndexLoader({ searchBaseUrl: './search-index/', legacyBaseUrl: './missing-index/', fetch });
const regul = await loader.loadCandidateEntries('en', 'regul');
assert.deepEqual(regul.map(item => item.word), ['irregular', 'regular', 'regulation', 'xregulation'], 'static inverted index finds the root in every word position and shard');
const alter = await loader.loadCandidateEntries('en', 'alter');
assert.deepEqual(alter.map(item => item.word), ['alternative', 'alteration']);
assert.deepEqual((await loader.loadCandidateEntries('en', 'oc')).map(item => item.word), ['ocular'], 'bigram postings support short roots');
assert.deepEqual((await loader.loadCandidateEntries('en', 'x')).map(item => item.word), ['xregulation'], 'single-character postings are complete');
assert.ok((await loader.loadCandidateEntries('en', 'regl')).some(item => item.word === 'regular'), 'fuzzy candidate retrieval uses safe partition seeds');
assert.ok(fuzzySeedGrams('regul').length >= 2);
assert.equal(fuzzyRootMatch('prefixregulation', 'regul')?.index, 6, 'fuzzy matcher checks positions beyond the first four characters');
assert.equal(specialRootMatch('ru', 'регуляция', 'regul'), true);
assert.ok(specialRootVariants('any', 'regul').includes('регул'));
assert.equal(specialRootMatch('any', 'alternative', 'inter'), false, 'alter is not confused with inter');
assert.equal(loader.getCandidateIndexDiagnostics().indexFormat, 'static-inverted-ngram-v1');

const legacyEntry = entry('regulation', 1, 90);
const legacyPayloads = new Map([
  ['./candidate-index/manifest.json', { version: '1', normalizer_version: '2', global_config_hash: 'legacy', languages: { en: { entries: 1, shards: [{ file: 'en/r.json', entries: 1 }] } } }],
  ['./candidate-index/en/r.json', [legacyEntry]]
]);
const legacyLoader = createCandidateIndexLoader({ baseUrl: './candidate-index/', fetch: async url => legacyPayloads.has(url) ? { ok: true, status: 200, json: async () => legacyPayloads.get(url) } : { ok: false, status: 404, json: async () => null } });
assert.deepEqual((await legacyLoader.loadCandidateEntries('en', 'regul')).map(item => item.word), ['regulation'], 'legacy candidate index remains a transition fallback');

console.log('Static associative search index tests passed.');
