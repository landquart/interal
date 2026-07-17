import assert from 'node:assert/strict';
import { createCandidateIndexLoader, CANDIDATE_INDEX_ERROR_CODES } from '../associativvordes/js/candidate-index-loader.js';

const validEntry = (word, search_form = word.toLowerCase()) => ({
  word,
  normalized: word.toLowerCase(),
  search_form,
  rank: null,
  frequency_score: 50,
  sources: [{ id: 'fixture', file: 'fixture.tsv', category: 'mixed', ipm: 1 }]
});

const manifest = (overrides = {}) => ({
  version: '1',
  normalizer_version: '2',
  global_config_hash: 'fixture-hash',
  languages: {
    en: { entries: 2, shards: [{ file: 'en/a.json', entries: 1 }, { file: 'en/r.json', entries: 1 }, { file: 'en/i.json', entries: 1 }, { file: 'en/o.json', entries: 1 }] },
    de: { entries: 1, shards: [{ file: 'de/a.json', entries: 1 }] },
    ...overrides.languages
  },
  ...overrides
});

function response(body, ok = true) {
  return { ok, status: ok ? 200 : 500, async json() { return body; } };
}

function mockFetch(routes, { delay = false } = {}) {
  const calls = [];
  const fetch = async (url) => {
    calls.push(String(url));
    if (delay) await new Promise(resolve => setTimeout(resolve, 5));
    const route = routes[String(url)];
    if (route instanceof Error) throw route;
    if (!route) return response({ error: 'missing' }, false);
    return typeof route === 'function' ? route() : route;
  };
  fetch.calls = calls;
  return fetch;
}

async function rejectsCode(fn, code) {
  await assert.rejects(fn, error => {
    assert.equal(error.code, code);
    return true;
  });
}

const baseRoutes = () => ({
  './candidate-index/manifest.json': response(manifest()),
  './candidate-index/en/a.json': response([validEntry('alter')]),
  './candidate-index/en/r.json': response([validEntry('regular', 'regular')]),
  './candidate-index/en/i.json': response([validEntry('interact', 'interact')]),
  './candidate-index/en/o.json': response([validEntry('ocular', 'ocular')]),
  './candidate-index/de/a.json': response([validEntry('alter')])
});

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

test('manifest loads once and repeated calls share cache', async () => {
  const fetch = mockFetch(baseRoutes());
  const loader = createCandidateIndexLoader({ fetch });
  await loader.loadManifest();
  await loader.loadManifest();
  assert.equal(fetch.calls.filter(url => url.endsWith('manifest.json')).length, 1);
});

test('concurrent manifest calls use one promise', async () => {
  const fetch = mockFetch(baseRoutes(), { delay: true });
  const loader = createCandidateIndexLoader({ fetch });
  await Promise.all([loader.loadManifest(), loader.loadManifest(), loader.loadManifest()]);
  assert.equal(fetch.calls.filter(url => url.endsWith('manifest.json')).length, 1);
});

test('loads only needed shard for root and not the whole language', async () => {
  const fetch = mockFetch(baseRoutes());
  const loader = createCandidateIndexLoader({ fetch });
  const entries = await loader.loadCandidateEntries('en', 'alter');
  assert.deepEqual(entries.map(entry => entry.word), ['alter']);
  assert(fetch.calls.includes('./candidate-index/en/a.json'));
  assert(!fetch.calls.includes('./candidate-index/en/r.json'));
  assert(!fetch.calls.includes('./candidate-index/en/i.json'));
  assert(!fetch.calls.includes('./candidate-index/en/o.json'));
});

test('repeat shard request uses cache', async () => {
  const fetch = mockFetch(baseRoutes());
  const loader = createCandidateIndexLoader({ fetch });
  await loader.loadShard('en', 'a');
  await loader.loadShard('en', 'a');
  assert.equal(fetch.calls.filter(url => url.endsWith('/en/a.json')).length, 1);
});

test('different languages have different shard cache keys', async () => {
  const fetch = mockFetch(baseRoutes());
  const loader = createCandidateIndexLoader({ fetch });
  await loader.loadShard('en', 'a');
  await loader.loadShard('de', 'a');
  assert(fetch.calls.includes('./candidate-index/en/a.json'));
  assert(fetch.calls.includes('./candidate-index/de/a.json'));
});

test('missing language returns LANGUAGE_NOT_INDEXED', async () => {
  const loader = createCandidateIndexLoader({ fetch: mockFetch(baseRoutes()) });
  await rejectsCode(() => loader.loadCandidateEntries('fr', 'alter'), CANDIDATE_INDEX_ERROR_CODES.LANGUAGE_NOT_INDEXED);
});

test('missing shard returns SHARD_NOT_LISTED', async () => {
  const loader = createCandidateIndexLoader({ fetch: mockFetch(baseRoutes()) });
  await rejectsCode(() => loader.loadShard('en', 'z'), CANDIDATE_INDEX_ERROR_CODES.SHARD_NOT_LISTED);
});

test('manifest HTTP error returns MANIFEST_FETCH_FAILED', async () => {
  const loader = createCandidateIndexLoader({ fetch: mockFetch({ './candidate-index/manifest.json': response({}, false) }) });
  await rejectsCode(() => loader.loadManifest(), CANDIDATE_INDEX_ERROR_CODES.MANIFEST_FETCH_FAILED);
});

test('damaged manifest is rejected', async () => {
  const loader = createCandidateIndexLoader({ fetch: mockFetch({ './candidate-index/manifest.json': response({ version: '1' }) }) });
  await rejectsCode(() => loader.loadManifest(), CANDIDATE_INDEX_ERROR_CODES.INDEX_CONFIG_INCOMPATIBLE);
});

test('incompatible version is rejected', async () => {
  const loader = createCandidateIndexLoader({ fetch: mockFetch({ './candidate-index/manifest.json': response(manifest({ version: '0' })) }) });
  await rejectsCode(() => loader.loadManifest(), CANDIDATE_INDEX_ERROR_CODES.MANIFEST_VERSION_UNSUPPORTED);
});

test('incompatible normalizer_version is rejected', async () => {
  const loader = createCandidateIndexLoader({ fetch: mockFetch({ './candidate-index/manifest.json': response(manifest({ normalizer_version: 'old' })) }) });
  await rejectsCode(() => loader.loadManifest(), CANDIDATE_INDEX_ERROR_CODES.INDEX_CONFIG_INCOMPATIBLE);
});

test('shard HTTP error returns SHARD_FETCH_FAILED', async () => {
  const routes = baseRoutes();
  routes['./candidate-index/en/a.json'] = response({}, false);
  const loader = createCandidateIndexLoader({ fetch: mockFetch(routes) });
  await rejectsCode(() => loader.loadShard('en', 'a'), CANDIDATE_INDEX_ERROR_CODES.SHARD_FETCH_FAILED);
});

test('damaged shard is rejected and not returned as empty array', async () => {
  const routes = baseRoutes();
  routes['./candidate-index/en/a.json'] = response({ nope: [] });
  const loader = createCandidateIndexLoader({ fetch: mockFetch(routes) });
  await rejectsCode(() => loader.loadShard('en', 'a'), CANDIDATE_INDEX_ERROR_CODES.SHARD_INVALID);
});


test('normalizes legacy fixture source metadata without deriving category from id', async () => {
  const routes = baseRoutes();
  routes['./candidate-index/en/a.json'] = response([{ ...validEntry('alter'), sources: [{ id: 'fixture:web', filename: 'legacy.tsv', corpus_category: 'web', frequency_ipm: '2.5' }] }]);
  const loader = createCandidateIndexLoader({ fetch: mockFetch(routes) });
  const entries = await loader.loadShard('en', 'a');
  assert.deepEqual(entries[0].sources, [{ id: 'fixture:web', file: 'legacy.tsv', category: 'web', ipm: 2.5 }]);
});

test('source category is required even when legacy id contains one', async () => {
  const routes = baseRoutes();
  routes['./candidate-index/en/a.json'] = response([{ ...validEntry('alter'), sources: [{ id: 'fixture:web', file: 'legacy.tsv', ipm: 1 }] }]);
  const loader = createCandidateIndexLoader({ fetch: mockFetch(routes) });
  await rejectsCode(() => loader.loadShard('en', 'a'), CANDIDATE_INDEX_ERROR_CODES.SHARD_INVALID);
});

test('entry without sources is rejected', async () => {
  const routes = baseRoutes();
  routes['./candidate-index/en/a.json'] = response([{ ...validEntry('alter'), sources: [] }]);
  const loader = createCandidateIndexLoader({ fetch: mockFetch(routes) });
  await rejectsCode(() => loader.loadShard('en', 'a'), CANDIDATE_INDEX_ERROR_CODES.SHARD_INVALID);
});

test('non-finite frequency_score is rejected', async () => {
  const routes = baseRoutes();
  routes['./candidate-index/en/a.json'] = response([{ ...validEntry('alter'), frequency_score: Infinity }]);
  const loader = createCandidateIndexLoader({ fetch: mockFetch(routes) });
  await rejectsCode(() => loader.loadShard('en', 'a'), CANDIDATE_INDEX_ERROR_CODES.SHARD_INVALID);
});

test('AbortSignal stops operation without poisoning cache', async () => {
  const fetch = mockFetch(baseRoutes(), { delay: true });
  const loader = createCandidateIndexLoader({ fetch });
  const controller = new AbortController();
  const pending = loader.loadManifest({ signal: controller.signal });
  controller.abort();
  await rejectsCode(() => pending, CANDIDATE_INDEX_ERROR_CODES.ABORTED);
  await loader.loadManifest();
  assert.equal(fetch.calls.filter(url => url.endsWith('manifest.json')).length, 1);
});

test('diagnostics count fetches and cache hits', async () => {
  const loader = createCandidateIndexLoader({ fetch: mockFetch(baseRoutes()) });
  await loader.loadShard('en', 'a');
  await loader.loadShard('en', 'a');
  const diagnostics = loader.getCandidateIndexDiagnostics();
  assert.equal(diagnostics.fetchCount, 2);
  assert(diagnostics.cacheHits >= 1);
  assert.deepEqual(diagnostics.loadedShards, ['en/a']);
});

test('special roots add _other only when needed and skip if not listed', async () => {
  const fetch = mockFetch(baseRoutes());
  const loader = createCandidateIndexLoader({ fetch });
  await loader.loadCandidateEntries('en', 'inter');
  assert(fetch.calls.includes('./candidate-index/en/i.json'));
  assert(!fetch.calls.includes('./candidate-index/en/a.json'));
});

test('production base URL is relative and overridable', async () => {
  const fetch = mockFetch({ '/fixtures/manifest.json': response(manifest()) });
  const loader = createCandidateIndexLoader({ fetch, baseUrl: '/fixtures/' });
  await loader.loadManifest();
  assert.deepEqual(fetch.calls, ['/fixtures/manifest.json']);
  const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('../associativvordes/js/candidate-index-loader.js', import.meta.url), 'utf8'));
  assert(!source.includes('interal.vercel.app'));
  assert(!source.includes('landquart.github.io'));
  assert(!source.includes('localhost'));
});

for (const [name, fn] of tests) {
  await fn();
  console.log(`ok - ${name}`);
}
