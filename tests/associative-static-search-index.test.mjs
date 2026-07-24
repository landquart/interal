import assert from 'node:assert/strict';
import { cp, mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { bucketName as buildBucketName, buildStaticSearchIndex } from '../scripts/build-associative-static-search-index.mjs';
import { validateStaticSearchIndex } from '../scripts/validate-associative-static-search-index.mjs';
import { createCandidateIndexLoader, fuzzySeedGrams } from '../associativvordes/js/candidate-index-loader.js';
import { bucketName as runtimeBucketName } from '../associativvordes/js/candidate-static-search.js';
import { acceptAffixBoundaryMatch, anchoredPostingKeys } from '../associativvordes/js/affix-boundary-index.js';
import { buildSearchForm, findRootMatch, fuzzyRootMatch, includesRoot, rootBoundarySegments, specialRootMatch, specialRootVariants } from '../associativvordes/js/root-matcher.js';
import { SEARCH_NORMALIZER_VERSION } from '../associativvordes/js/search-normalizer.js';

const sourceRoot = '.tmp/static-search-source';
const outputRoot = '.tmp/static-search-output';
const corruptRoot = '.tmp/static-search-corrupt';
await rm(sourceRoot, { recursive: true, force: true });
await rm(outputRoot, { recursive: true, force: true });
await rm(corruptRoot, { recursive: true, force: true });
await mkdir(join(sourceRoot, 'en'), { recursive: true });

const source = { id: 'normative/test.json', file: 'test.json', category: 'normative', ipm: 10 };
const entry = (word, rank, score = 50) => ({ word, normalized: word.toLowerCase(), search_form: buildSearchForm(word), rank, frequency_score: score, category_breakdown: {}, sources: [{ ...source }] });
const shards = {
  'en/a.json': [entry('alternative', 2, 70), entry('alteration', 3, 60)],
  'en/i.json': [entry('irregular', 4, 55)],
  'en/r.json': [entry('regular', 1, 90), entry('regulation', 5, 80), entry('realteration', 6, 65)],
  'en/o.json': [entry('ocular', 7, 50)],
  'en/x.json': [entry('xregulation', 8, 45)],
  'en/q.json': [entry('qegular', 9, 40)],
  'en/w.json': [entry('Walter', 10, 35)],
  'en/p.json': [entry('prefixregulation', 11, 30)],
  'en/s.json': [entry('Straße', 12, 25)]
};
for (const [file, entries] of Object.entries(shards)) await writeFile(join(sourceRoot, file), `${JSON.stringify(entries, null, 2)}\n`);
await writeFile(join(sourceRoot, 'manifest.json'), `${JSON.stringify({
  version: '1', normalizer_version: '2', global_config_hash: 'fixture-global',
  languages: { en: { language_config_hash: 'fixture-en', entries: Object.values(shards).reduce((sum, entries) => sum + entries.length, 0), source_files: [source.id], shards: Object.entries(shards).map(([file, entries]) => ({ file, entries: entries.length })) } }
}, null, 2)}\n`);

assert.equal(buildBucketName('2:ter', 128), '68', 'anchored posting keys use hexadecimal bucket names');
assert.equal(runtimeBucketName('2:ter', 128), buildBucketName('2:ter', 128), 'builder and browser use identical bucket hashing');
assert.ok(anchoredPostingKeys('realteration', 'en', 3).has('0:alt'), 'known re- prefix creates an anchored root position');
assert.ok(!anchoredPostingKeys('walter', 'en', 3).has('0:alt'), 'arbitrary w- does not create an alter boundary');

const { manifest, report } = await buildStaticSearchIndex({ language: 'en', inputRoot: sourceRoot, outputRoot, blockSize: 128, bucketCount: 128 });
assert.equal(manifest.version, '4');
assert.equal(manifest.normalizer_version, SEARCH_NORMALIZER_VERSION);
assert.equal(manifest.affix_config_version, '1');
assert.equal(manifest.index_format, 'static-affix-anchored-ngram-v1');
assert.equal(report.entries, 12);
assert.ok(report.posting_grams > 0);
assert.ok(report.total_bytes > 0);
assert.ok(manifest.languages.en.postings['3'].buckets.includes('68'), 'high decimal bucket 104 is retained as hexadecimal 68');

const validation = await validateStaticSearchIndex({ indexRoot: outputRoot, languages: ['en'], strict: true });
assert.equal(validation.valid, true, validation.errors.join('\n'));
assert.equal(validation.languages.en.posting_ids, validation.languages.en.expected_posting_ids, 'validator proves complete affix-anchored posting coverage');

const fetch = async url => {
  const relative = String(url).replace(/^\.\/search-index\//, '');
  try {
    const text = await readFile(join(outputRoot, relative), 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(text) };
  } catch {
    return { ok: false, status: 404, json: async () => { throw new Error('not found'); } };
  }
};
const loader = createCandidateIndexLoader({ searchBaseUrl: './search-index/', legacyBaseUrl: './missing-index/', fetch, maxCachedResources: 2 });
const regul = await loader.loadCandidateEntries('en', 'regul');
assert.deepEqual(
  regul.map(item => item.word).sort(),
  ['irregular', 'regular', 'regulation'].sort(),
  'static affix index finds roots only at token or recognized prefix boundaries'
);
assert.ok(!regul.some(item => item.word === 'xregulation'));
assert.ok(!regul.some(item => item.word === 'prefixregulation'));
const alter = await loader.loadCandidateEntries('en', 'alter');
assert.deepEqual(alter.map(item => item.word).sort(), ['alternative', 'alteration', 'realteration'].sort());
assert.ok(!alter.some(item => item.word === 'Walter'));
assert.deepEqual((await loader.loadCandidateEntries('en', 'oc')).map(item => item.word), ['ocular'], 'bigram postings support short roots');
assert.deepEqual((await loader.loadCandidateEntries('en', 'x')).map(item => item.word), ['xregulation'], 'single-character roots remain searchable at a real boundary');
assert.ok((await loader.loadCandidateEntries('en', 'regl')).some(item => item.word === 'regular'), 'fuzzy candidate retrieval uses affix-anchored partition seeds');
assert.ok(fuzzySeedGrams('regul').length >= 2);
assert.equal(fuzzyRootMatch('prefixregulation', 'regul', 'en'), null, 'fuzzy matcher does not scan arbitrary internal positions');
assert.equal(fuzzyRootMatch('qegular', 'regular', 'en'), null, 'fuzzy matcher rejects a first-character substitution even at a valid boundary');
const xPrefixMatch = findRootMatch('xregulation', 'regul', 'en');
assert.equal(acceptAffixBoundaryMatch(xPrefixMatch, 'regul'), false, 'leading insertion is not treated as an implicit prefix');
assert.equal(includesRoot('Straße', 'strasse'), true, 'runtime and build normalization both map ß to ss');
assert.equal(specialRootMatch('ru', 'регуляция', 'regul'), true);
assert.ok(specialRootVariants('any', 'regul').includes('regul'));
assert.equal(specialRootMatch('any', 'alternative', 'inter'), false, 'alter is not confused with inter');
assert.ok(rootBoundarySegments('counterrealteration', 'en').some(boundary => boundary.start === 'counterre'.length), 'two-prefix chains create a boundary');
assert.equal(loader.getCandidateIndexDiagnostics().indexFormat, 'static-affix-anchored-ngram-v1');
assert.ok(loader.getCandidateIndexDiagnostics().cachedResources <= 2, 'resource cache obeys its LRU bound');
assert.equal(loader.getCandidateIndexDiagnostics().pendingResources, 0, 'settled resource promises are removed');
assert.ok(loader.getCandidateIndexDiagnostics().cacheEvictions > 0, 'bounded cache evicts old resources');

await cp(outputRoot, corruptRoot, { recursive: true });
await unlink(join(corruptRoot, 'en', 'postings', '3', '68.json'));
const corruptValidation = await validateStaticSearchIndex({ indexRoot: corruptRoot, languages: ['en'], strict: true });
assert.equal(corruptValidation.valid, false, 'strict validation rejects a missing high-numbered postings bucket');
assert.ok(corruptValidation.errors.some(error => error.includes('68.json') || error.includes('coverage mismatch')));

const legacyEntry = entry('regulation', 1, 90);
const legacyPayloads = new Map([
  ['./candidate-index/manifest.json', { version: '1', normalizer_version: '2', global_config_hash: 'legacy', languages: { en: { entries: 1, shards: [{ file: 'en/r.json', entries: 1 }] } } }],
  ['./candidate-index/en/r.json', [legacyEntry]]
]);
const legacyLoader = createCandidateIndexLoader({ baseUrl: './candidate-index/', fetch: async url => legacyPayloads.has(url) ? { ok: true, status: 200, json: async () => legacyPayloads.get(url) } : { ok: false, status: 404, json: async () => null } });
assert.deepEqual((await legacyLoader.loadCandidateEntries('en', 'regul')).map(item => item.word), ['regulation'], 'legacy candidate index remains a transition fallback');

console.log('Static associative search index tests passed.');
