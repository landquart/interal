import { buildSearchForm, findRootMatch } from './root-matcher.js';
import { acceptAffixBoundaryMatch, STATIC_MANIFEST_VERSION } from './affix-boundary-index.js';
import { loadStaticCandidateEntries, validateStaticManifest } from './candidate-static-search.js';
import { SEARCH_NORMALIZER_VERSION } from './search-normalizer.js';
import { resolveAssociativeFamily } from './associative-family-registry.js';
import { FamilyIndexLoader } from './family-index-loader.js';
import { QWEN_RUNTIME_CONFIG } from './qwen-client.js';

// Candidate generation must not create words outside the selected exact family.
// Qwen remains enabled for semantic scoring/review of candidates already found locally.
QWEN_RUNTIME_CONFIG.enableCandidateGeneration = false;

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

const LEGACY_MANIFEST_VERSION = '1';
const LEGACY_NORMALIZER_VERSIONS = new Set(['2', SEARCH_NORMALIZER_VERSION]);
const DEFAULT_STATIC_BASE_URL = './search-index/';
const DEFAULT_LEGACY_BASE_URL = './candidate-index/';
const DEFAULT_MAX_CACHED_RESOURCES = 128;

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

function makeError(code, message, details) { return new CandidateIndexError(code, message, details); }
function isAbortError(error) { return error?.name === 'AbortError' || error?.code === CANDIDATE_INDEX_ERROR_CODES.ABORTED; }
function abortError(cause) { return makeError(CANDIDATE_INDEX_ERROR_CODES.ABORTED, 'Candidate index request was aborted.', { cause }); }
function throwIfAborted(signal) { if (signal?.aborted) throw abortError(signal.reason); }

async function withAbort(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) throw abortError(signal.reason);
  let cleanup;
  const aborted = new Promise((_, reject) => {
    const onAbort = () => reject(abortError(signal.reason));
    signal.addEventListener('abort', onAbort, { once: true });
    cleanup = () => signal.removeEventListener('abort', onAbort);
  });
  try { return await Promise.race([promise, aborted]); }
  finally { cleanup?.(); }
}

function createDiagnostics() {
  return {
    manifestLoaded: false,
    manifestVersion: null,
    normalizerVersion: null,
    indexFormat: null,
    loadedShards: [],
    unlistedShards: [],
    cacheHits: 0,
    cacheMisses: 0,
    cacheEvictions: 0,
    fetchCount: 0,
    rejectedEntries: 0,
    candidateIds: 0,
    exactCandidateIds: 0,
    fuzzyCandidateIds: 0,
    approximateCandidateIds: 0,
    candidateEntryBlocks: 0,
    querySuppressed: false,
    querySuppressedReason: null,
    familyId: null,
    familyCanonical: null,
    familyAliases: [],
    familyIndexStatus: 'not_tried',
    familyIndexFamilies: 0,
    validationErrors: []
  };
}

function normalizeBaseUrl(baseUrl) { const value = String(baseUrl || ''); return value.endsWith('/') ? value : `${value}/`; }
function joinUrl(baseUrl, path) { return `${normalizeBaseUrl(baseUrl)}${path}`; }

async function fetchJson(fetchImpl, url, signal, code, language, shard) {
  let response;
  try { response = await fetchImpl(url, signal ? { signal } : {}); }
  catch (error) { if (isAbortError(error)) throw abortError(error); throw makeError(code, `Candidate index fetch failed: ${url}`, { language, shard, cause: error }); }
  if (!response?.ok) throw makeError(code, `Candidate index fetch failed: ${url}`, { language, shard, cause: response });
  try { return await response.json(); }
  catch (error) { throw makeError(code, `Candidate index JSON parse failed: ${url}`, { language, shard, cause: error }); }
}

function isPlainObject(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function isSafeRelativePath(file) { return typeof file === 'string' && file && !file.startsWith('/') && !file.includes('://') && !file.includes('\\') && !file.split('/').includes('..'); }
function manifestConfigHash(manifest) { return manifest.global_config_hash ?? manifest.config_hash; }
const staticContext = { isPlainObject, isSafeRelativePath, manifestConfigHash, makeError, codes: CANDIDATE_INDEX_ERROR_CODES };

function validateLegacyManifest(manifest) {
  if (!LEGACY_NORMALIZER_VERSIONS.has(manifest.normalizer_version)) throw makeError(CANDIDATE_INDEX_ERROR_CODES.INDEX_CONFIG_INCOMPATIBLE, 'Candidate index normalizer version is incompatible.');
  if (typeof manifestConfigHash(manifest) !== 'string' || !manifestConfigHash(manifest)) throw makeError(CANDIDATE_INDEX_ERROR_CODES.INDEX_CONFIG_INCOMPATIBLE, 'Candidate index global config hash is required.');
  if (!isPlainObject(manifest.languages)) throw makeError(CANDIDATE_INDEX_ERROR_CODES.MANIFEST_INVALID, 'Candidate index manifest languages must be an object.');
  for (const [language, info] of Object.entries(manifest.languages)) {
    if (!isPlainObject(info) || !Number.isInteger(info.entries) || info.entries < 0 || !Array.isArray(info.shards)) throw makeError(CANDIDATE_INDEX_ERROR_CODES.MANIFEST_INVALID, 'Candidate index language metadata is invalid.', { language });
    for (const shard of info.shards) {
      if (!isPlainObject(shard) || !isSafeRelativePath(shard.file) || !Number.isInteger(shard.entries) || shard.entries < 0) throw makeError(CANDIDATE_INDEX_ERROR_CODES.MANIFEST_INVALID, 'Candidate index shard metadata is invalid.', { language, shard: shard?.file });
    }
  }
  return { ...manifest, index_format: 'legacy-letter-shards' };
}

function validateManifest(manifest) {
  if (!isPlainObject(manifest)) throw makeError(CANDIDATE_INDEX_ERROR_CODES.MANIFEST_INVALID, 'Candidate index manifest must be an object.');
  if (manifest.version === LEGACY_MANIFEST_VERSION) return validateLegacyManifest(manifest);
  if (manifest.version === STATIC_MANIFEST_VERSION) return validateStaticManifest(manifest, staticContext);
  throw makeError(CANDIDATE_INDEX_ERROR_CODES.MANIFEST_VERSION_UNSUPPORTED, 'Candidate index manifest version is unsupported.');
}

function getLanguageInfo(manifest, language) {
  const info = manifest.languages?.[language];
  if (!info) throw makeError(CANDIDATE_INDEX_ERROR_CODES.LANGUAGE_NOT_INDEXED, 'Language is not indexed.', { language });
  return info;
}

function shardIdFromFile(file) { return file.split('/').pop().replace(/\.json$/i, ''); }
function getLegacyShardMeta(manifest, language, shardId) {
  const info = getLanguageInfo(manifest, language);
  const found = info.shards.find(shard => shardIdFromFile(shard.file) === shardId || shard.file === shardId);
  if (!found) throw makeError(CANDIDATE_INDEX_ERROR_CODES.SHARD_NOT_LISTED, 'Shard is not listed in manifest.', { language, shard: shardId });
  return { ...found, id: shardIdFromFile(found.file) };
}

function normalizeSource(source) {
  if (!isPlainObject(source)) return null;
  const id = typeof source.id === 'string' && source.id.trim() ? source.id : null;
  const file = typeof source.file === 'string' && source.file.trim() ? source.file : (typeof source.filename === 'string' && source.filename.trim() ? source.filename : null);
  const category = typeof source.category === 'string' && source.category.trim() ? source.category : (typeof source.corpus_category === 'string' && source.corpus_category.trim() ? source.corpus_category : (typeof source.type === 'string' && source.type.trim() ? source.type : null));
  const rawIpm = source.ipm ?? source.IPM ?? source.frequency_ipm;
  const ipm = typeof rawIpm === 'number' && Number.isFinite(rawIpm) ? rawIpm : (Number.isFinite(Number(rawIpm)) ? Number(rawIpm) : null);
  return id && file && category && ipm != null ? { id, file, category, ipm } : null;
}

function validateLegacyShardPayload(payload, language, shardMeta, diagnostics) {
  const entries = Array.isArray(payload) ? payload : payload?.entries;
  if (!Array.isArray(entries)) throw makeError(CANDIDATE_INDEX_ERROR_CODES.SHARD_INVALID, 'Candidate index shard must contain entries.', { language, shard: shardMeta.id });
  return entries.map((entry, index) => {
    const invalid = reason => {
      diagnostics.rejectedEntries += 1;
      diagnostics.validationErrors.push(reason);
      throw makeError(CANDIDATE_INDEX_ERROR_CODES.SHARD_INVALID, 'Candidate index shard contains invalid entries.', { language, shard: shardMeta.id, cause: new Error(reason) });
    };
    if (!isPlainObject(entry)) invalid(`entry ${index} is not an object`);
    if (typeof entry.word !== 'string' || !entry.word) invalid(`entry ${index} word is required`);
    if (typeof entry.normalized !== 'string' || !entry.normalized) invalid(`entry ${index} normalized is required`);
    if (typeof entry.search_form !== 'string' || !entry.search_form) invalid(`entry ${index} search_form is required`);
    if (typeof entry.frequency_score !== 'number' || !Number.isFinite(entry.frequency_score) || entry.frequency_score < 0 || entry.frequency_score > 100) invalid(`entry ${index} frequency_score is invalid`);
    if (!(entry.rank === null || typeof entry.rank === 'number') || (typeof entry.rank === 'number' && !Number.isFinite(entry.rank))) invalid(`entry ${index} rank is invalid`);
    if (!Array.isArray(entry.sources) || !entry.sources.length) invalid(`entry ${index} sources are required`);
    const sources = entry.sources.map(normalizeSource);
    if (sources.some(source => !source)) invalid(`entry ${index} sources are invalid`);
    return { ...entry, sources };
  });
}

function legacyShardIdsForAliases(aliases) {
  const ids = new Set();
  for (const alias of aliases) {
    const first = buildSearchForm(alias)[0];
    ids.add(first && first >= 'a' && first <= 'z' ? first : '_other');
  }
  return [...ids];
}

function annotateFamily(entries, family) {
  return entries.map(entry => ({
    ...entry,
    family_id: family.id,
    family_canonical: family.canonical,
    family_aliases: [...family.aliases],
    family_verified: family.verified
  }));
}

export function createCandidateIndexLoader(options = {}) {
  const explicitBase = options.baseUrl ? normalizeBaseUrl(options.baseUrl) : null;
  const staticBase = normalizeBaseUrl(options.searchBaseUrl ?? DEFAULT_STATIC_BASE_URL);
  const legacyBase = normalizeBaseUrl(options.legacyBaseUrl ?? DEFAULT_LEGACY_BASE_URL);
  const manifestBases = explicitBase ? [explicitBase] : (options.searchBaseUrl != null || options.preferStatic === true || options.fetch == null ? [staticBase, legacyBase] : [legacyBase, staticBase]);
  const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis);
  if (typeof fetchImpl !== 'function') throw new TypeError('createCandidateIndexLoader requires fetch support.');
  const maxCachedResources = Number.isInteger(options.maxCachedResources) && options.maxCachedResources >= 0 ? options.maxCachedResources : DEFAULT_MAX_CACHED_RESOURCES;
  const familyIndexLoader = options.familyIndexLoader || new FamilyIndexLoader({ baseUrl: options.familyBaseUrl || '/api/family-index?path=', fetchJson: async (url, init) => {
    const response = await fetchImpl(url, init);
    if (!response?.ok) throw new Error(`Family index request failed: ${response?.status ?? 'network'}`);
    return response.json();
  } });

  const diagnostics = createDiagnostics();
  let manifestRecord;
  let manifestCache;
  let activeBaseUrl;
  const resourcePromises = new Map();
  const resourceCache = new Map();

  function getCachedResource(path) {
    if (!resourceCache.has(path)) return undefined;
    const value = resourceCache.get(path);
    resourceCache.delete(path);
    resourceCache.set(path, value);
    diagnostics.cacheHits += 1;
    return value;
  }

  function cacheResource(path, value) {
    if (maxCachedResources === 0) return;
    if (resourceCache.has(path)) resourceCache.delete(path);
    resourceCache.set(path, value);
    while (resourceCache.size > maxCachedResources) {
      const oldest = resourceCache.keys().next().value;
      resourceCache.delete(oldest);
      diagnostics.cacheEvictions += 1;
    }
  }

  async function loadManifest({ signal } = {}) {
    if (manifestCache) { diagnostics.cacheHits += 1; throwIfAborted(signal); return manifestCache; }
    if (manifestRecord && manifestRecord.signal === signal) { diagnostics.cacheHits += 1; return withAbort(manifestRecord.promise, signal); }
    diagnostics.cacheMisses += 1;
    const record = { signal, promise: null };
    record.promise = (async () => {
      let lastError;
      for (const baseUrl of manifestBases) {
        diagnostics.fetchCount += 1;
        try {
          const manifest = validateManifest(await fetchJson(fetchImpl, joinUrl(baseUrl, 'manifest.json'), signal, CANDIDATE_INDEX_ERROR_CODES.MANIFEST_FETCH_FAILED));
          activeBaseUrl = baseUrl;
          manifestCache = manifest;
          diagnostics.manifestLoaded = true;
          diagnostics.manifestVersion = manifest.version;
          diagnostics.normalizerVersion = manifest.normalizer_version;
          diagnostics.indexFormat = manifest.index_format || 'legacy-letter-shards';
          return manifest;
        } catch (error) {
          if (isAbortError(error)) throw error;
          if (error?.code !== CANDIDATE_INDEX_ERROR_CODES.MANIFEST_FETCH_FAILED) throw error;
          lastError = error;
        }
      }
      throw lastError || makeError(CANDIDATE_INDEX_ERROR_CODES.MANIFEST_FETCH_FAILED, 'Candidate index manifest could not be loaded.');
    })().finally(() => { if (manifestRecord === record) manifestRecord = undefined; });
    manifestRecord = record;
    return withAbort(record.promise, signal);
  }

  async function loadResource(path, { signal, code, language, shard, validator, diagnosticKey } = {}) {
    const cached = getCachedResource(path);
    if (cached !== undefined) { throwIfAborted(signal); return cached; }
    const existing = resourcePromises.get(path);
    if (existing && existing.signal === signal) { diagnostics.cacheHits += 1; return withAbort(existing.promise, signal); }
    diagnostics.cacheMisses += 1;
    diagnostics.fetchCount += 1;
    const record = { signal, promise: null };
    record.promise = fetchJson(fetchImpl, joinUrl(activeBaseUrl, path), signal, code, language, shard)
      .then(payload => { throwIfAborted(signal); return validator ? validator(payload) : payload; })
      .then(value => { cacheResource(path, value); diagnostics.loadedShards.push(diagnosticKey ?? path); return value; })
      .finally(() => { if (resourcePromises.get(path) === record) resourcePromises.delete(path); });
    resourcePromises.set(path, record);
    return withAbort(record.promise, signal);
  }

  async function loadShard(language, shardId, { signal } = {}) {
    const manifest = await loadManifest({ signal });
    if (manifest.version !== LEGACY_MANIFEST_VERSION) throw makeError(CANDIDATE_INDEX_ERROR_CODES.SHARD_NOT_LISTED, 'Letter shards are unavailable in the static search index.', { language, shard: shardId });
    const meta = getLegacyShardMeta(manifest, language, shardId);
    return loadResource(meta.file, { signal, code: CANDIDATE_INDEX_ERROR_CODES.SHARD_FETCH_FAILED, language, shard: meta.id, diagnosticKey: `${language}/${meta.id}`, validator: payload => validateLegacyShardPayload(payload, language, meta, diagnostics) });
  }

  async function loadLegacyFamilyEntries(language, family, { signal } = {}) {
    const entries = [];
    for (const shardId of legacyShardIdsForAliases(family.aliases)) {
      try {
        const shard = await loadShard(language, shardId, { signal });
        entries.push(...shard);
      } catch (error) {
        if (error.code === CANDIDATE_INDEX_ERROR_CODES.SHARD_NOT_LISTED) { diagnostics.unlistedShards.push(`${language}/${shardId}`); continue; }
        throw error;
      }
    }
    const byLemma = new Map();
    for (const entry of entries) {
      const match = findRootMatch(entry.search_form, family.canonical, language);
      if (!acceptAffixBoundaryMatch(match)) continue;
      const key = buildSearchForm(entry.normalized || entry.word);
      if (!byLemma.has(key)) byLemma.set(key, entry);
    }
    diagnostics.exactCandidateIds = byLemma.size;
    diagnostics.candidateIds = byLemma.size;
    return annotateFamily([...byLemma.values()], family);
  }

  async function loadCandidateEntries(language, root, { signal, elementType = 'root' } = {}) {
    if (elementType === 'root') {
      try {
        const familyEntries = await familyIndexLoader.candidateEntries(root, language, { signal });
        diagnostics.familyIndexStatus = 'loaded';
        diagnostics.familyIndexFamilies = new Set(familyEntries.map(entry => entry.family_id)).size;
        if (familyEntries.length) {
          diagnostics.familyId = diagnostics.familyIndexFamilies === 1 ? familyEntries[0].family_id : null;
          diagnostics.familyCanonical = diagnostics.familyIndexFamilies === 1 ? familyEntries[0].family_canonical : null;
          diagnostics.familyAliases = [...new Set(familyEntries.flatMap(entry => entry.family_aliases || []))];
          diagnostics.candidateIds = familyEntries.length;
          diagnostics.exactCandidateIds = familyEntries.length;
          return familyEntries;
        }
      } catch (error) {
        if (isAbortError(error)) throw error;
        diagnostics.familyIndexStatus = 'unavailable';
        diagnostics.validationErrors.push(`family_index: ${error?.message || error}`);
      }
    }
    const manifest = await loadManifest({ signal });
    getLanguageInfo(manifest, language);
    const family = resolveAssociativeFamily(root, { elementType });
    if (!family) return [];
    diagnostics.familyId = family.id;
    diagnostics.familyCanonical = family.canonical;
    diagnostics.familyAliases = [...family.aliases];
    diagnostics.fuzzyCandidateIds = 0;
    diagnostics.approximateCandidateIds = 0;
    let entries;
    if (manifest.version === STATIC_MANIFEST_VERSION) {
      entries = await loadStaticCandidateEntries({ manifest, language, root: family.canonical, signal, loadResource, context: staticContext, diagnostics });
    } else {
      entries = await loadLegacyFamilyEntries(language, family, { signal });
    }
    return annotateFamily(entries, family);
  }

  function clearCandidateIndexCache() {
    manifestRecord = undefined;
    manifestCache = undefined;
    activeBaseUrl = undefined;
    resourcePromises.clear();
    resourceCache.clear();
    Object.assign(diagnostics, createDiagnostics());
  }

  function getCandidateIndexDiagnostics() {
    return { ...diagnostics, cachedResources: resourceCache.size, pendingResources: resourcePromises.size, maxCachedResources, loadedShards: [...diagnostics.loadedShards], unlistedShards: [...diagnostics.unlistedShards], familyAliases: [...diagnostics.familyAliases], validationErrors: [...diagnostics.validationErrors] };
  }

  return { loadManifest, loadShard, loadCandidateEntries, clearCandidateIndexCache, getCandidateIndexDiagnostics };
}
