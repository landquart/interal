import assert from 'node:assert/strict';
import {
  STATIC_ENTRY_BLOCK_CONCURRENCY,
  STATIC_MAX_CANDIDATE_IDS,
  STATIC_MAX_ENTRY_BLOCKS,
  STATIC_RESOURCE_RETRY_ATTEMPTS,
  bucketName,
  loadStaticCandidateEntries,
  mapWithConcurrency
} from '../associativvordes/js/candidate-static-search.js';

assert.equal(STATIC_ENTRY_BLOCK_CONCURRENCY, 6, 'entry-block requests use a conservative browser-safe concurrency limit');
assert.equal(STATIC_RESOURCE_RETRY_ATTEMPTS, 3, 'transient static-resource failures receive bounded retries');
assert.ok(STATIC_MAX_CANDIDATE_IDS > 0);
assert.ok(STATIC_MAX_ENTRY_BLOCKS > 0);

let activeWorkers = 0;
let maxActiveWorkers = 0;
const ordered = await mapWithConcurrency(Array.from({ length: 20 }, (_, index) => index), STATIC_ENTRY_BLOCK_CONCURRENCY, async (value) => {
  activeWorkers += 1;
  maxActiveWorkers = Math.max(maxActiveWorkers, activeWorkers);
  await new Promise(resolve => setTimeout(resolve, 2));
  activeWorkers -= 1;
  return value * 2;
});
assert.deepEqual(ordered, Array.from({ length: 20 }, (_, index) => index * 2), 'bounded mapping preserves input order');
assert.ok(maxActiveWorkers <= STATIC_ENTRY_BLOCK_CONCURRENCY, 'bounded mapping never exceeds the configured concurrency');
assert.ok(maxActiveWorkers > 1, 'bounded mapping still loads independent blocks concurrently');

const language = 'en';
const entryCount = 12;
const postingKey = '0:a';
const postingBucket = bucketName(postingKey, 128);
const entryBlocks = Array.from({ length: entryCount }, (_, index) => ({
  file: `${language}/entries/${String(index).padStart(6, '0')}.json`,
  first_id: index,
  entries: 1
}));
const manifest = {
  languages: {
    [language]: {
      entries: entryCount,
      sources: [{ id: 'normative/test.json', file: 'test.json', category: 'normative' }],
      entry_blocks: entryBlocks,
      postings: {
        1: { bucket_count: 128, template: `${language}/postings/1/{bucket}.json`, buckets: [postingBucket] },
        2: { bucket_count: 128, template: `${language}/postings/2/{bucket}.json`, buckets: [] },
        3: { bucket_count: 128, template: `${language}/postings/3/{bucket}.json`, buckets: [] }
      }
    }
  }
};
const codes = {
  LANGUAGE_NOT_INDEXED: 'LANGUAGE_NOT_INDEXED',
  SHARD_FETCH_FAILED: 'SHARD_FETCH_FAILED',
  SHARD_INVALID: 'SHARD_INVALID',
  MANIFEST_INVALID: 'MANIFEST_INVALID'
};
const context = {
  codes,
  isPlainObject: value => value && typeof value === 'object' && !Array.isArray(value),
  makeError: (code, message, details = {}) => Object.assign(new Error(message), { code, ...details })
};
const diagnostics = {};
const attempts = new Map();
let activeLoads = 0;
let maxActiveLoads = 0;

async function loadResource(path, options = {}) {
  if (path.includes('/postings/')) {
    return options.validator({ [postingKey]: [0, ...Array.from({ length: entryCount - 1 }, () => 1)] });
  }

  const blockIndex = Number(path.match(/(\d+)\.json$/)?.[1]);
  attempts.set(path, (attempts.get(path) || 0) + 1);
  activeLoads += 1;
  maxActiveLoads = Math.max(maxActiveLoads, activeLoads);
  try {
    await new Promise(resolve => setTimeout(resolve, 2));
    if (blockIndex === 4 && attempts.get(path) === 1) {
      throw Object.assign(new Error('temporary CDN failure'), { code: codes.SHARD_FETCH_FAILED });
    }
    const letter = String.fromCharCode(97 + blockIndex);
    return options.validator({
      first_id: blockIndex,
      entries: [[`a${letter}`, null, null, blockIndex + 1, 50, [[0, 1]]]]
    });
  } finally {
    activeLoads -= 1;
  }
}

const entries = await loadStaticCandidateEntries({
  manifest,
  language,
  root: 'a',
  loadResource,
  context,
  diagnostics
});

assert.equal(entries.length, entryCount, 'all matching entries survive a transient block failure');
assert.equal(attempts.get(entryBlocks[4].file), 2, 'a transient entry-block failure is retried');
assert.ok(maxActiveLoads <= STATIC_ENTRY_BLOCK_CONCURRENCY, 'entry-block requests are bounded in the real static loader');
assert.equal(diagnostics.candidateIds, entryCount, 'candidate diagnostics remain accurate');
assert.equal(diagnostics.querySuppressed, false);

{
  const broadEntryCount = STATIC_MAX_ENTRY_BLOCKS + 1;
  const broadBlocks = Array.from({ length: broadEntryCount }, (_, index) => ({
    file: `${language}/entries/broad-${String(index).padStart(6, '0')}.json`,
    first_id: index,
    entries: 1
  }));
  const broadManifest = {
    languages: {
      [language]: {
        entries: broadEntryCount,
        sources: manifest.languages[language].sources,
        entry_blocks: broadBlocks,
        postings: manifest.languages[language].postings
      }
    }
  };
  let broadEntryLoads = 0;
  const broadDiagnostics = {};
  const broadEntries = await loadStaticCandidateEntries({
    manifest: broadManifest,
    language,
    root: 'a',
    context,
    diagnostics: broadDiagnostics,
    loadResource: async (path, options = {}) => {
      if (path.includes('/postings/')) {
        return options.validator({
          [postingKey]: [0, ...Array.from({ length: broadEntryCount - 1 }, () => 1)]
        });
      }
      broadEntryLoads += 1;
      throw new Error(`broad query unexpectedly loaded ${path}`);
    }
  });

  assert.deepEqual(broadEntries, [], 'an over-broad local query returns promptly instead of downloading the full index');
  assert.equal(broadEntryLoads, 0, 'entry-block downloads are skipped after the deterministic request-budget check');
  assert.equal(broadDiagnostics.querySuppressed, true);
  assert.equal(broadDiagnostics.querySuppressedReason, 'entry_block_limit');
}

console.log('Associative static index load-control tests passed.');
