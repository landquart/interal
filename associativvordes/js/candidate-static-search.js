import { CATEGORY_ORDER } from './config-frequency-sources.js';
import { ipmToScore, meanNonZero } from './frequency-loader.js';
import {
  allowedRootDistance,
  buildSearchForm,
  fuzzyRootMatch,
  includesRoot,
  specialRootMatch,
  specialRootVariants
} from './root-matcher.js';
import { SEARCH_NORMALIZER_VERSION } from './search-normalizer.js';

export const STATIC_MANIFEST_VERSION = '3';
export const STATIC_INDEX_FORMAT = 'static-inverted-ngram-v2';

export function validateStaticManifest(manifest, context) {
  const { isPlainObject, isSafeRelativePath, manifestConfigHash, makeError, codes } = context;
  if (manifest.normalizer_version !== SEARCH_NORMALIZER_VERSION) throw makeError(codes.INDEX_CONFIG_INCOMPATIBLE, 'Static search index normalizer version is incompatible.');
  if (manifest.index_format !== STATIC_INDEX_FORMAT) throw makeError(codes.INDEX_CONFIG_INCOMPATIBLE, 'Static search index format is unsupported.');
  if (typeof manifestConfigHash(manifest) !== 'string' || !manifestConfigHash(manifest)) throw makeError(codes.INDEX_CONFIG_INCOMPATIBLE, 'Static search index global config hash is required.');
  if (!isPlainObject(manifest.languages)) throw makeError(codes.MANIFEST_INVALID, 'Static search index languages must be an object.');
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

export function bucketName(gram, count) {
  const width = Math.max(2, Math.ceil(Math.log(count) / Math.log(16)));
  return (fnv1a(gram) % count).toString(16).padStart(width, '0');
}

function uniqueGrams(value, length) {
  const text = buildSearchForm(value);
  const grams = new Set();
  if (!text || text.length < length) return [];
  for (let index = 0; index <= text.length - length; index += 1) grams.add(text.slice(index, index + length));
  return [...grams];
}

function exactLookupGrams(value) {
  const text = buildSearchForm(value);
  if (!text) return [];
  if (text.length <= 2) return [{ gram: text, length: text.length }];
  return uniqueGrams(text, 3).map(gram => ({ gram, length: 3 }));
}

export function fuzzySeedGrams(root) {
  const text = buildSearchForm(root);
  const distance = allowedRootDistance(text);
  if (!text || distance <= 0) return [];
  const partCount = Math.min(text.length, distance + 1);
  const baseLength = Math.floor(text.length / partCount);
  const remainder = text.length % partCount;
  const seeds = [];
  let offset = 0;
  for (let index = 0; index < partCount; index += 1) {
    const partLength = baseLength + (index < remainder ? 1 : 0);
    const part = text.slice(offset, offset + partLength);
    offset += partLength;
    if (part) seeds.push({ gram: part, length: part.length });
  }
  return [...new Map(seeds.map(seed => [`${seed.length}:${seed.gram}`, seed])).values()];
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

  async function loadPosting(gram, length) {
    const meta = info.postings[String(length)];
    const bucket = bucketName(gram, meta.bucket_count);
    if (!meta.buckets.includes(bucket)) return [];
    const path = meta.template.replace('{bucket}', bucket);
    const payload = await loadResource(path, { signal, code: context.codes.SHARD_FETCH_FAILED, language, shard: bucket, validator: value => {
      if (!context.isPlainObject(value)) throw context.makeError(context.codes.SHARD_INVALID, 'Static postings bucket must be an object.', { language, shard: bucket });
      return value;
    } });
    if (!Object.hasOwn(payload, gram)) return [];
    const decoded = decodeDeltas(payload[gram]);
    if (decoded == null) throw context.makeError(context.codes.SHARD_INVALID, `Static postings list is invalid for ${gram}.`, { language, shard: bucket });
    return decoded;
  }

  async function exactIds(value) {
    const lookups = exactLookupGrams(value);
    if (!lookups.length) return [];
    const lists = [];
    for (const lookup of lookups) lists.push(await loadPosting(lookup.gram, lookup.length));
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
    for (const { block, ids: blockIds } of grouped.values()) {
      const payload = await loadResource(block.file, { signal, code: context.codes.SHARD_FETCH_FAILED, language, shard: block.file, validator: value => {
        if (!context.isPlainObject(value) || value.first_id !== block.first_id || !Array.isArray(value.entries) || value.entries.length !== block.entries) throw context.makeError(context.codes.SHARD_INVALID, 'Static entry block is invalid.', { language, shard: block.file });
        return value;
      } });
      for (const id of blockIds) output.push({ id, entry: decodeCompactEntry(payload.entries[id - block.first_id], sourceDictionary, language, id, context) });
    }
    output.sort((a, b) => a.id - b.id);
    return output.map(item => item.entry);
  }

  const normalizedRoot = buildSearchForm(root);
  const candidateIds = new Set(await exactIds(normalizedRoot));
  for (const variant of specialRootVariants(language, normalizedRoot)) addAll(candidateIds, await exactIds(variant));
  for (const seed of fuzzySeedGrams(normalizedRoot)) {
    const ids = seed.length <= 3 ? await loadPosting(seed.gram, seed.length) : await exactIds(seed.gram);
    addAll(candidateIds, ids);
  }
  diagnostics.candidateIds = candidateIds.size;
  const entries = await loadEntriesByIds([...candidateIds].sort((a, b) => a - b));
  return entries.filter(entry => includesRoot(entry.search_form, normalizedRoot) || fuzzyRootMatch(entry.search_form, normalizedRoot) || specialRootMatch(language, entry.search_form, normalizedRoot));
}
