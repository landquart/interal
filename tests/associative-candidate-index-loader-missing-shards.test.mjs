import assert from 'node:assert/strict';
import {
  CANDIDATE_INDEX_ERROR_CODES,
  createCandidateIndexLoader
} from '../associativvordes/js/candidate-index-loader.js';

const validEntry = (word, searchForm = word.toLowerCase()) => ({
  word,
  normalized: word.toLowerCase(),
  search_form: searchForm,
  rank: null,
  frequency_score: 50,
  sources: [{ id: 'mixed/fixture.tsv', file: 'fixture.tsv', category: 'mixed', ipm: 1 }]
});

function response(body, { ok = true, throws = false } = {}) {
  return {
    ok,
    status: ok ? 200 : 404,
    async json() {
      if (throws) throw new SyntaxError('invalid json');
      return body;
    }
  };
}

const baseManifest = {
  version: '1',
  normalizer_version: '2',
  global_config_hash: 'fixture-hash',
  languages: {
    en: {
      entries: 1,
      shards: [{ file: 'en/a.json', entries: 1 }]
    }
  }
};

function makeFetch(routes) {
  const calls = [];
  const fetch = async url => {
    const key = String(url);
    calls.push(key);
    return routes[key] ?? response({}, { ok: false });
  };
  fetch.calls = calls;
  return fetch;
}

async function rejectsCode(action, expectedCode) {
  await assert.rejects(action, error => {
    assert.equal(error.code, expectedCode);
    return true;
  });
}

{
  const fetch = makeFetch({
    './candidate-index/manifest.json': response(baseManifest),
    './candidate-index/en/a.json': response([validEntry('alter')])
  });
  const loader = createCandidateIndexLoader({ fetch });
  const entries = await loader.loadCandidateEntries('en', 'xeno');
  assert.deepEqual(entries, [], 'an unlisted ordinary letter shard means no candidates');
  assert.equal(fetch.calls.some(url => url.endsWith('/en/x.json')), false, 'an unlisted shard is not fetched');
  assert.deepEqual(loader.getCandidateIndexDiagnostics().unlistedShards, ['en/x']);
}

{
  const fetch = makeFetch({
    './candidate-index/manifest.json': response(baseManifest),
    './candidate-index/en/a.json': response([validEntry('alter')])
  });
  const loader = createCandidateIndexLoader({ fetch });
  const entries = await loader.loadCandidateEntries('en', '1alter');
  assert.deepEqual(entries, [], 'an unlisted _other shard means no candidates');
  assert.deepEqual(loader.getCandidateIndexDiagnostics().unlistedShards, ['en/_other']);
}

{
  const manifestWithX = {
    ...baseManifest,
    languages: {
      en: {
        entries: 2,
        shards: [
          { file: 'en/a.json', entries: 1 },
          { file: 'en/x.json', entries: 1 }
        ]
      }
    }
  };
  const fetch = makeFetch({
    './candidate-index/manifest.json': response(manifestWithX),
    './candidate-index/en/x.json': response({}, { ok: false })
  });
  const loader = createCandidateIndexLoader({ fetch });
  await rejectsCode(
    () => loader.loadCandidateEntries('en', 'xeno'),
    CANDIDATE_INDEX_ERROR_CODES.SHARD_FETCH_FAILED
  );
}

{
  const manifestWithX = {
    ...baseManifest,
    languages: {
      en: {
        entries: 2,
        shards: [
          { file: 'en/a.json', entries: 1 },
          { file: 'en/x.json', entries: 1 }
        ]
      }
    }
  };
  const fetch = makeFetch({
    './candidate-index/manifest.json': response(manifestWithX),
    './candidate-index/en/x.json': response(null, { throws: true })
  });
  const loader = createCandidateIndexLoader({ fetch });
  await rejectsCode(
    () => loader.loadCandidateEntries('en', 'xeno'),
    CANDIDATE_INDEX_ERROR_CODES.SHARD_FETCH_FAILED
  );
}

{
  const fetch = makeFetch({ './candidate-index/manifest.json': response(baseManifest) });
  const loader = createCandidateIndexLoader({ fetch });
  await rejectsCode(
    () => loader.loadCandidateEntries('de', 'alter'),
    CANDIDATE_INDEX_ERROR_CODES.LANGUAGE_NOT_INDEXED
  );
}

console.log('associative candidate-index missing shard tests passed');
