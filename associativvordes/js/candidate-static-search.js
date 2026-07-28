import { CATEGORY_ORDER } from './config-frequency-sources.js';
import { ipmToScore, meanNonZero } from './frequency-loader.js';
import {
  AFFIX_SEARCH_CONFIG_VERSION,
  buildSearchForm,
  findRootMatch,
  specialRootVariants
} from './root-matcher.js';
import { SEARCH_NORMALIZER_VERSION } from './search-normalizer.js';
import {
  STATIC_INDEX_FORMAT,
  STATIC_MANIFEST_VERSION,
  acceptAffixBoundaryMatch,
  exactAnchoredLookups,
  fuzzyAnchoredLookupGroups,
  fuzzySeedGrams
} from './affix-boundary-index.js';

export { STATIC_INDEX_FORMAT, STATIC_MANIFEST_VERSION, fuzzySeedGrams };

export const STATIC_ENTRY_BLOCK_CONCURRENCY = 6;
export const STATIC_RESOURCE_RETRY_ATTEMPTS = 3;
export const STATIC_MAX_CANDIDATE_IDS = 8192;
export const STATIC_MAX_ENTRY_BLOCKS = 24;

export async function mapWithConcurrency(items, limit, mapper) {
  const values = Array.from(items || []);
  const workerLimit = Number(limit);
  if (!Number.isInteger(workerLimit) || workerLimit < 1) throw new TypeError('concurrency limit must be a positive integer');
  if (typeof mapper !== 'function') throw new TypeError('mapper must be a function');
  const output = new Array(values.length);
  let cursor = 0;

  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await mapper(values[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(workerLimit, values.length) }, () => worker()));
  return output;
}

async function retryStaticResource(operation, { signal, shouldRetry, attempts = STATIC_RESOURCE_RETRY_ATTEMPTS } = {}) {
  let lastError;
  const totalAttempts = Math.max(1, Number(attempts) || 1);
  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    if (signal?.aborted) throw lastError || signal.reason || new Error('Static index request aborted.');
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= totalAttempts || !shouldRetry?.(error)) throw error;
      await new Promise(resolve => setTimeout(resolve, 120 * attempt));
    }
  }
  throw lastError;
}

export function validateStaticManifest(manifest, context) {
  const { isPlainObject, isSafeRelativePath, manifestConfigHash, makeError, codes } = context;
  if (manifest.normalizer_version !== SEARCH_NORMALIZER_VERSION) throw makeError(codes.INDEX_CONFIG_INCOMPATIBLE, 'Static search index normalizer version is incompatible.');
  if (manifest.affix_config_version !== AFFIX_SEARCH_CONFIG_VERSION) throw makeError(codes.INDEX_CONFIG_INCOMPATIBLE, 'Static search affix configuration is incompatible.');
  if (manifest.index_format !== STATIC_INDEX_FORMAT) throw makeError(codes.INDEX_CONFIG_INCOMPATIBLE, 'Static search index format is unsupported.');
  if (typeof manifestConfigHash(manifest) !== 'string' || !manifestConfigHash(manifest)) throw makeError(codes.INDEX_CONFIG_INCOMPATIBLE, 'Static search index global config hash is required.');
  if (!isPlainObject(manifest.languages)) throw makeError(codes.MANIFEST_INVALID, 'Static search index manifest languages must be an object.');
  for (const [language, info] of Object.entries(manifest.languages)) {
    if (!isPlainObject(info) || !Number.isInteger(info.entries) || info.entries < 0) throw makeError(codes.MANIFEST_INVALID, 'Static search language metadata is invalid.', { language });
    if (!Array.isArray(info.sources) || !Array.isArray(info.entry_blocks) || !isPlainObject(info.postings)) throw makeError(codes.MANIFEST_INVALID, 'Static search language resources are missing.', { language });
    let expectedFirstId = 0;
    for (const block of info.entry_blocks) {
      if (!isPlainObject(block) || !isSafeRelativePath(block.file) || block.first_id !== expectedFirstId || !Number.isInteger(block.entries) || block.entries <= 0) throw makeError(codes.MANIFEST_INVALID, 'Static search entry block metadata is invalid.', { language, shard: block?.file });
      expectedFirstId += block.entries;
    }
    if (expectedFirstId !== info.entries) throw makeError(codes.MANIFEST_INVALID, 'Static search entry block count does not match language entries.', { language });
    for (const length of ['1', '2', '3']) {
      const posting = info.postings[length];
      if (!isPlainObject(posting) || !Number.isInteger(posting.bucket_count) || posting.bucket_count <= 0 || typeof posting.template !== 'string' || !posting.template.includes('{bucket}') || !Array.isArray(posting.buckets)) throw makeError(codes.MANIFEST_INVALID, `Static search postings metadata is invalid for gram length ${length}.`, { language });
      if (!isSafeRelativePath(posting.template.replace('{bucket}', '00'))) throw makeError(codes.MANIFEST_INVALID, 'Static search postings template is unsafe.', { language });
    }
  }
  return manifest;
}

export function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function bucketName(key, count) {
  const width = Math.max(2, Math.ceil(Math.log(count) / Math.log(16)));
  return (fnv1a(key) % count).toString(16).padStart(width, '0');
}

function decodeDeltas(values) {
  if (!Array.isArray(values)) return null;
  const output = [];
  let current = 0;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!Number.isInteger(value) || value < 0) return null;
    current = index === 0 ? value : current + value;
    if (output.length && current <= output[output.length - 1]) return null;
    output.push(current);
  }
  return output;
}

function intersectSorted(left, right) {
  const output = [];
  let a = 0;
  let b = 0;
  while (a < left.length && b < right.length) {
    if (left[a] === right[b]) { output.push(left[a]); a += 1; b += 1; }
    else if (left[a] < right[b]) a += 1;
    else b += 1;
  }
  return output;
}

function addAll(target, values) {
  for (const value of values) target.add(value);
}

function sourceDictionaryEntry(source, index, language, context) {
  if (!context.isPlainObject(source) || typeof source.id !== 'string' || typeof source.file !== 'string' || typeof source.category !== 'string') throw context.makeError(context.codes.MANIFEST_INVALID, `Static search source ${index} is invalid.`, { language });
  return source;
}

function categoryBreakdownFromSources(sources) {
  const output = {};
  for (const category of CATEGORY_ORDER) {
    const ipmValues = sources.filter(source => source.category === category).map(source => source.ipm);
    if (!ipmValues.length) continue;
    const categoryIpm = meanNonZero(ipmValues);
    output[category] = { ipm_values: ipmValues, category_ipm: categoryIpm, category_score: ipmToScore(categoryIpm) };
  }
  return output;
}

function decodeCompactEntry(record, sourceDictionary, language, index, context) {
  if (!Array.isArray(record) || record.length !== 6) throw context.makeError(context.codes.SHARD_INVALID, `Compact entry ${index} has an invalid shape.`, { language });
  const [word, normalizedValue, searchFormValue, rank, frequencyScore, sourcePairs] = record;
  const normalized = normalizedValue == null ? String(word || '').trim().toLowerCase().normalize('NFC') : normalizedValue;
  const searchForm = searchFormValue == null ? buildSearchForm(normalized) : searchFormValue;
  if (typeof word !== 'string' || !word || typeof normalized !== 'string' || !normalized || typeof searchForm !== 'string' || !searchForm || !(rank === null || (Number.isInteger(rank) && rank > 0)) || typeof frequencyScore !== 'number' || !Number.isFinite(frequencyScore) || frequencyScore < 0 || frequencyScore > 100 || !Array.isArray(sourcePairs) || !sourcePairs.length) throw context.makeError(context.codes.SHARD_INVALID, `Compact entry ${index} is invalid.`, { language });
  const sources = sourcePairs.map(pair => {
    if (!Array.isArray(pair) || pair.length !== 2 || !Number.isInteger(pair[0]) || pair[0] < 0 || pair[0] >= sourceDictionary.length || typeof pair[1] !== 'number' || !Number.isFinite(pair[1]) || pair[1] < 0) throw context.makeError(context.codes.SHARD_INVALID, `Compact entry ${index} source is invalid.`, { language });
    return { ...sourceDictionary[pair[0]], ipm: pair[1] };
  });
  return { word, normalized, search_form: searchForm, rank, frequency_score: frequencyScore, category_breakdown: categoryBreakdownFromSources(sources), sources };
}

function blockForId(info, id) {
  let low = 0;
  let high = info.entry_blocks.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const block = info.entry_blocks[mid];
    if (id < block.first_id) high = mid - 1;
    else if (id >= block.first_id + block.entries) low = mid + 1;
    else return block;
  }
  return null;
}

export async function loadStaticCandidateEntries({ manifest, language, root, signal, loadResource, context, diagnostics }) {
  const info = manifest.languages[language];
  if (!info) throw context.makeError(context.codes.LANGUAGE_NOT_INDEXED, 'Language is not indexed.', { language });
  const shouldRetryFetch = error => error?.code === context.codes.SHARD_FETCH_FAILED;

  async function loadPosting(lookup) {
    const meta = info.postings[String(lookup.length)];
    const bucket = bucketName(lookup.key, meta.bucket_count);
    if (!meta.buckets.includes(bucket)) return [];
    const path = meta.template.replace('{bucket}', bucket);
    const payload = await retryStaticResource(() => loadResource(path, { signal, code: context.codes.SHARD_FETCH_FAILED, language, shard: bucket, validator: value => {
      if (!context.isPlainObject(value)) throw context.makeError(context.codes.SHARD_INVALID, 'Static postings bucket must be an object.', { language, shard: bucket });
      return value;
    } }), { signal, shouldRetry: shouldRetryFetch });
    if (!Object.hasOwn(payload, lookup.key)) return [];
    const decoded = decodeDeltas(payload[lookup.key]);
    if (decoded == null) throw context.makeError(context.codes.SHARD_INVALID, `Static postings list is invalid for ${lookup.key}.`, { language, shard: bucket });
    return decoded;
  }

  async function exactIds(value) {
    const lookups = exactAnchoredLookups(value);
    if (!lookups.length) return [];
    const lists = [];
    for (const lookup of lookups) lists.push(await loadPosting(lookup));
    lists.sort((a, b) => a.length - b.length);
    let result = lists[0] || [];
    for (let index = 1; index < lists.length && result.length; index += 1) result = intersectSorted(result, lists[index]);
    return result;
  }

  async function loadEntriesByIds(ids) {
    const sourceDictionary = info.sources.map((source, index) => sourceDictionaryEntry(source, index, language, context));
    const grouped = new Map();
    for (const id of ids) {
      if (!Number.isInteger(id) || id < 0 || id >= info.entries) throw context.makeError(context.codes.SHARD_INVALID, `Static postings entry id is out of range: ${id}.`, { language });
      const block = blockForId(info, id);
      if (!block) throw context.makeError(context.codes.MANIFEST_INVALID, `No entry block contains id ${id}.`, { language });
      if (!grouped.has(block.file)) grouped.set(block.file, { block, ids: [] });
      grouped.get(block.file).ids.push(id);
    }
    const output = [];
    await mapWithConcurrency(grouped.values(), STATIC_ENTRY_BLOCK_CONCURRENCY, async ({ block, ids: blockIds }) => {
      const payload = await retryStaticResource(() => loadResource(block.file, { signal, code: context.codes.SHARD_FETCH_FAILED, language, shard: block.file, validator: value => {
        if (!context.isPlainObject(value) || value.first_id !== block.first_id || !Array.isArray(value.entries) || value.entries.length !== block.entries) throw context.makeError(context.codes.SHARD_INVALID, 'Static entry block is invalid.', { language, shard: block.file });
        return value;
      } }), { signal, shouldRetry: shouldRetryFetch });
      for (const id of blockIds) output.push({ id, entry: decodeCompactEntry(payload.entries[id - block.first_id], sourceDictionary, language, id, context) });
    });
    output.sort((a, b) => a.id - b.id);
    return output.map(item => item.entry);
  }

  const normalizedRoot = buildSearchForm(root);
  const candidateIds = new Set(await exactIds(normalizedRoot));
  for (const variant of specialRootVariants(language, normalizedRoot)) {
    addAll(candidateIds, await exactIds(variant));
  }
  diagnostics.exactCandidateIds = candidateIds.size;

  // Fuzzy retrieval is a fallback, not a quota filler. Combining every fuzzy
  // posting for a root such as "alter" can cover almost the entire dictionary
  // (tens of thousands of ids and hundreds of entry blocks), even when exact
  // derivatives already exist. Besides admitting weaker candidates, that made
  // an ordinary calculation download the full per-language index.
  if (candidateIds.size === 0) {
    const fuzzyIds = new Set();
    for (const group of fuzzyAnchoredLookupGroups(normalizedRoot)) {
      for (const lookup of group.lookups) addAll(fuzzyIds, await loadPosting(lookup));
    }
    diagnostics.fuzzyCandidateIds = fuzzyIds.size;
    addAll(candidateIds, fuzzyIds);
  } else {
    diagnostics.fuzzyCandidateIds = 0;
  }

  const candidateBlocks = new Set();
  for (const id of candidateIds) {
    const block = blockForId(info, id);
    if (block) candidateBlocks.add(block.file);
  }
  diagnostics.candidateEntryBlocks = candidateBlocks.size;

  // Keep every browser query bounded. If a fallback typo or an extremely short
  // root is too broad, return no local candidates and let the Qwen audit propose
  // specific words that are verified by exact word lookup. Never download an
  // effectively complete million-entry index for a single button click.
  if (candidateIds.size > STATIC_MAX_CANDIDATE_IDS || candidateBlocks.size > STATIC_MAX_ENTRY_BLOCKS) {
    diagnostics.querySuppressed = true;
    diagnostics.querySuppressedReason = candidateIds.size > STATIC_MAX_CANDIDATE_IDS
      ? 'candidate_id_limit'
      : 'entry_block_limit';
    diagnostics.candidateIds = candidateIds.size;
    return [];
  }

  diagnostics.querySuppressed = false;
  diagnostics.querySuppressedReason = null;
  diagnostics.candidateIds = candidateIds.size;
  const entries = await loadEntriesByIds([...candidateIds].sort((a, b) => a - b));
  return entries.filter(entry => {
    const match = findRootMatch(entry.search_form, normalizedRoot, language);
    return acceptAffixBoundaryMatch(match, normalizedRoot);
  });
}
