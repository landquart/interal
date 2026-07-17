import { fuzzyRootMatch, normalizeText, specialRootMatch, stripDiacritics } from './root-matcher.js';

export const CANDIDATE_INDEX_ERROR_CODES = Object.freeze({
  MANIFEST_FETCH_FAILED: 'MANIFEST_FETCH_FAILED',
  MANIFEST_INVALID: 'MANIFEST_INVALID',
  MANIFEST_VERSION_UNSUPPORTED: 'MANIFEST_VERSION_UNSUPPORTED',
  LANGUAGE_NOT_INDEXED: 'LANGUAGE_NOT_INDEXED',
  SHARD_NOT_LISTED: 'SHARD_NOT_LISTED',
  SHARD_FETCH_FAILED: 'SHARD_FETCH_FAILED',
  SHARD_INVALID: 'SHARD_INVALID',
  INDEX_CONFIG_INCOMPATIBLE: 'INDEX_CONFIG_INCOMPATIBLE',
  ABORTED: 'ABORTED'
});

const SUPPORTED_MANIFEST_VERSION = '1';
const SUPPORTED_NORMALIZER_VERSION = '2';
const DEFAULT_BASE_URL = './candidate-index/';

export class CandidateIndexError extends Error {
  constructor(code, message, { language, shard, cause } = {}) {
    super(message);
    this.name = 'CandidateIndexError';
    this.code = code;
    if (language != null) this.language = language;
    if (shard != null) this.shard = shard;
    if (cause != null) this.cause = cause;
  }
}

function isAbortError(error) {
  return error?.name === 'AbortError' || error?.code === CANDIDATE_INDEX_ERROR_CODES.ABORTED;
}

function abortError(cause) {
  return new CandidateIndexError(CANDIDATE_INDEX_ERROR_CODES.ABORTED, 'Candidate index request was aborted.', { cause });
}

async function withAbort(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) throw abortError(signal.reason);
  let cleanup;
  const abortPromise = new Promise((_, reject) => {
    const onAbort = () => reject(abortError(signal.reason));
    signal.addEventListener('abort', onAbort, { once: true });
    cleanup = () => signal.removeEventListener('abort', onAbort);
  });
  try {
    return await Promise.race([promise, abortPromise]);
  } finally {
    cleanup?.();
  }
}

function createDiagnostics() {
  return { manifestLoaded: false, manifestVersion: null, normalizerVersion: null, loadedShards: [], cacheHits: 0, cacheMisses: 0, fetchCount: 0, rejectedEntries: 0, validationErrors: [] };
}

function normalizeBaseUrl(baseUrl = DEFAULT_BASE_URL) {
  const value = String(baseUrl || DEFAULT_BASE_URL);
  return value.endsWith('/') ? value : `${value}/`;
}

function joinUrl(baseUrl, path) {
  return `${normalizeBaseUrl(baseUrl)}${path}`;
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError(signal.reason);
}

function fetchOptionsWithSignal(signal) {
  return signal ? { signal } : {};
}

async function fetchJson(fetchImpl, url, fetchOptions, code, language, shard) {
  let response;
  try {
    response = await fetchImpl(url, fetchOptions);
  } catch (error) {
    if (isAbortError(error)) throw abortError(error);
    throw new CandidateIndexError(code, 'Candidate index fetch failed.', { language, shard, cause: error });
  }
  if (!response?.ok) throw new CandidateIndexError(code, 'Candidate index fetch failed.', { language, shard, cause: response });
  try {
    return await response.json();
  } catch (error) {
    throw new CandidateIndexError(code, 'Candidate index JSON parse failed.', { language, shard, cause: error });
  }
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function assertRelativeShardPath(file) {
  return typeof file === 'string' && file && !file.startsWith('/') && !file.includes('://') && !file.includes('\\') && !file.split('/').includes('..');
}

function manifestConfigHash(manifest) {
  return manifest.global_config_hash ?? manifest.config_hash;
}

function validateManifest(manifest) {
  if (!isPlainObject(manifest)) throw new CandidateIndexError(CANDIDATE_INDEX_ERROR_CODES.MANIFEST_INVALID, 'Candidate index manifest must be an object.');
  if (manifest.version !== SUPPORTED_MANIFEST_VERSION) throw new CandidateIndexError(CANDIDATE_INDEX_ERROR_CODES.MANIFEST_VERSION_UNSUPPORTED, 'Candidate index manifest version is unsupported.');
  if (manifest.normalizer_version !== SUPPORTED_NORMALIZER_VERSION) throw new CandidateIndexError(CANDIDATE_INDEX_ERROR_CODES.INDEX_CONFIG_INCOMPATIBLE, 'Candidate index normalizer version is incompatible.');
  if (typeof manifestConfigHash(manifest) !== 'string' || !manifestConfigHash(manifest)) throw new CandidateIndexError(CANDIDATE_INDEX_ERROR_CODES.INDEX_CONFIG_INCOMPATIBLE, 'Candidate index global config hash is required.');
  if (!isPlainObject(manifest.languages)) throw new CandidateIndexError(CANDIDATE_INDEX_ERROR_CODES.MANIFEST_INVALID, 'Candidate index manifest languages must be an object.');
  for (const [language, info] of Object.entries(manifest.languages)) {
    if (!isPlainObject(info)) throw new CandidateIndexError(CANDIDATE_INDEX_ERROR_CODES.MANIFEST_INVALID, 'Candidate index language metadata must be an object.', { language });
    if (info.language_config_hash != null && (typeof info.language_config_hash !== 'string' || !info.language_config_hash)) throw new CandidateIndexError(CANDIDATE_INDEX_ERROR_CODES.INDEX_CONFIG_INCOMPATIBLE, 'Candidate index language config hash is invalid.', { language });
    if (!Number.isInteger(info.entries) || info.entries < 0) throw new CandidateIndexError(CANDIDATE_INDEX_ERROR_CODES.MANIFEST_INVALID, 'Candidate index language entries must be a non-negative integer.', { language });
    if (!Array.isArray(info.shards)) throw new CandidateIndexError(CANDIDATE_INDEX_ERROR_CODES.MANIFEST_INVALID, 'Candidate index shards must be listed.', { language });
    for (const shard of info.shards) {
      if (!isPlainObject(shard) || !assertRelativeShardPath(shard.file) || !Number.isInteger(shard.entries) || shard.entries < 0) {
        throw new CandidateIndexError(CANDIDATE_INDEX_ERROR_CODES.MANIFEST_INVALID, 'Candidate index shard metadata is invalid.', { language, shard: shard?.file });
      }
    }
  }
  return manifest;
}

function shardIdFromFile(file) {
  return file.split('/').pop().replace(/\.json$/i, '');
}

function getLanguageInfo(manifest, language) {
  const info = manifest.languages?.[language];
  if (!info) throw new CandidateIndexError(CANDIDATE_INDEX_ERROR_CODES.LANGUAGE_NOT_INDEXED, 'Language is not indexed.', { language });
  return info;
}

function getShardMeta(manifest, language, shardId) {
  const info = getLanguageInfo(manifest, language);
  const found = info.shards.find(shard => shardIdFromFile(shard.file) === shardId || shard.file === shardId);
  if (!found) throw new CandidateIndexError(CANDIDATE_INDEX_ERROR_CODES.SHARD_NOT_LISTED, 'Shard is not listed in manifest.', { language, shard: shardId });
  return { ...found, id: shardIdFromFile(found.file) };
}


function normalizeSourceForRuntime(source) {
  if (!isPlainObject(source)) return null;
  const id = typeof source.id === 'string' && source.id.trim() ? source.id : null;
  const file = typeof source.file === 'string' && source.file.trim()
    ? source.file
    : (typeof source.filename === 'string' && source.filename.trim() ? source.filename : null);
  const category = typeof source.category === 'string' && source.category.trim()
    ? source.category
    : (typeof source.corpus_category === 'string' && source.corpus_category.trim()
      ? source.corpus_category
      : (typeof source.type === 'string' && source.type.trim() ? source.type : null));
  const ipm = typeof source.ipm === 'number' && Number.isFinite(source.ipm)
    ? source.ipm
    : (Number.isFinite(Number(source.IPM ?? source.frequency_ipm)) ? Number(source.IPM ?? source.frequency_ipm) : null);
  if (!id || !file || !category || ipm == null) return null;
  return { id, file, category, ipm };
}

function normalizeEntrySourcesForRuntime(entry) {
  const sources = entry.sources.map(normalizeSourceForRuntime);
  if (sources.some(source => !source)) return null;
  return { ...entry, sources };
}

function validateEntry(entry, index, diagnostics) {
  const invalid = reason => {
    diagnostics.rejectedEntries += 1;
    diagnostics.validationErrors.push(reason);
    throw new Error(reason);
  };
  if (!isPlainObject(entry)) invalid(`entry ${index} is not an object`);
  if (typeof entry.word !== 'string' || !entry.word) invalid(`entry ${index} word is required`);
  if (typeof entry.normalized !== 'string' || !entry.normalized) invalid(`entry ${index} normalized is required`);
  if (typeof entry.search_form !== 'string' || !entry.search_form) invalid(`entry ${index} search_form is required`);
  if (!Array.isArray(entry.sources) || entry.sources.length === 0) invalid(`entry ${index} sources are required`);
  if (!normalizeEntrySourcesForRuntime(entry)) invalid(`entry ${index} sources must use canonical runtime shape`);
  if (typeof entry.frequency_score !== 'number' || !Number.isFinite(entry.frequency_score) || entry.frequency_score < 0 || entry.frequency_score > 100) invalid(`entry ${index} frequency_score is invalid`);
  if (!(typeof entry.rank === 'number' || entry.rank === null)) invalid(`entry ${index} rank is invalid`);
  if (typeof entry.rank === 'number' && !Number.isFinite(entry.rank)) invalid(`entry ${index} rank is not finite`);
}

function validateShardPayload(payload, language, shardMeta, diagnostics) {
  const entries = Array.isArray(payload) ? payload : payload?.entries;
  if (!Array.isArray(entries)) throw new CandidateIndexError(CANDIDATE_INDEX_ERROR_CODES.SHARD_INVALID, 'Candidate index shard must be an array or object with entries.', { language, shard: shardMeta.id });
  const normalizedEntries = [];
  for (const [index, entry] of entries.entries()) {
    try {
      validateEntry(entry, index, diagnostics);
      normalizedEntries.push(normalizeEntrySourcesForRuntime(entry));
    } catch (cause) { throw new CandidateIndexError(CANDIDATE_INDEX_ERROR_CODES.SHARD_INVALID, 'Candidate index shard contains invalid entries.', { language, shard: shardMeta.id, cause }); }
  }
  return normalizedEntries;
}

function candidateShardIdsForRoot(language, root) {
  const normalized = stripDiacritics(normalizeText(root));
  const ids = new Set();
  const first = normalized[0];
  if (first && first >= 'a' && first <= 'z') ids.add(first); else ids.add('_other');
  if (['inter', 'ocul', 'regul'].includes(normalized)) ids.add('_other');
  return [...ids];
}

export function createCandidateIndexLoader(options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);
  const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis);
  if (typeof fetchImpl !== 'function') throw new TypeError('createCandidateIndexLoader requires fetch support.');
  const diagnostics = createDiagnostics();
  let manifestPromise;
  const shardPromises = new Map();
  const shardCache = new Map();
  let manifestCache;

  function getReusablePromise(record, signal) {
    if (!record || record.signal !== signal) return null;
    return record.promise;
  }

  async function loadManifest({ signal } = {}) {
    if (manifestCache) {
      diagnostics.cacheHits += 1;
      throwIfAborted(signal);
      return manifestCache;
    }
    const reusableManifestPromise = getReusablePromise(manifestPromise, signal);
    if (reusableManifestPromise) {
      diagnostics.cacheHits += 1;
      return withAbort(reusableManifestPromise, signal);
    }
    diagnostics.cacheMisses += 1;
    diagnostics.fetchCount += 1;
    const record = { signal, promise: null };
    record.promise = fetchJson(fetchImpl, joinUrl(baseUrl, 'manifest.json'), fetchOptionsWithSignal(signal), CANDIDATE_INDEX_ERROR_CODES.MANIFEST_FETCH_FAILED)
      .then(payload => { throwIfAborted(signal); return validateManifest(payload); })
      .then(manifest => { throwIfAborted(signal); manifestCache = manifest; diagnostics.manifestLoaded = true; diagnostics.manifestVersion = manifest.version || null; diagnostics.normalizerVersion = manifest.normalizer_version || null; return manifest; })
      .catch(error => { if (manifestPromise === record) manifestPromise = undefined; throw error; });
    manifestPromise = record;
    return withAbort(record.promise, signal);
  }

  async function loadShard(language, shardId, { signal } = {}) {
    const manifest = await loadManifest({ signal });
    const shardMeta = getShardMeta(manifest, language, shardId);
    const key = `${language}/${shardMeta.id}`;
    if (shardCache.has(key)) { diagnostics.cacheHits += 1; throwIfAborted(signal); return shardCache.get(key); }
    const reusableShardPromise = getReusablePromise(shardPromises.get(key), signal);
    if (reusableShardPromise) { diagnostics.cacheHits += 1; return withAbort(reusableShardPromise, signal); }
    diagnostics.cacheMisses += 1;
    diagnostics.fetchCount += 1;
    const record = { signal, promise: null };
    record.promise = fetchJson(fetchImpl, joinUrl(baseUrl, shardMeta.file), fetchOptionsWithSignal(signal), CANDIDATE_INDEX_ERROR_CODES.SHARD_FETCH_FAILED, language, shardMeta.id)
      .then(payload => { throwIfAborted(signal); return validateShardPayload(payload, language, shardMeta, diagnostics); })
      .then(entries => { throwIfAborted(signal); shardCache.set(key, entries); diagnostics.loadedShards.push(key); return entries; })
      .catch(error => { if (shardPromises.get(key) === record) shardPromises.delete(key); throw error; });
    shardPromises.set(key, record);
    return withAbort(record.promise, signal);
  }

  async function loadCandidateEntries(language, root, { signal } = {}) {
    const manifest = await loadManifest({ signal });
    getLanguageInfo(manifest, language);
    const entries = [];
    const ids = candidateShardIdsForRoot(language, root);
    for (const shardId of ids) {
      try { entries.push(...await loadShard(language, shardId, { signal })); }
      catch (error) { if (error.code === CANDIDATE_INDEX_ERROR_CODES.SHARD_NOT_LISTED && shardId === '_other') continue; throw error; }
    }
    const normalizedRoot = normalizeText(root);
    return entries.filter(entry => fuzzyRootMatch(entry.search_form, normalizedRoot) || specialRootMatch(language, entry.search_form, normalizedRoot));
  }

  function clearCandidateIndexCache() {
    manifestPromise = undefined;
    manifestCache = undefined;
    shardPromises.clear();
    shardCache.clear();
    Object.assign(diagnostics, createDiagnostics());
  }

  function getCandidateIndexDiagnostics() {
    return { ...diagnostics, loadedShards: [...diagnostics.loadedShards], validationErrors: [...diagnostics.validationErrors] };
  }

  return { loadManifest, loadShard, loadCandidateEntries, clearCandidateIndexCache, getCandidateIndexDiagnostics };
}
