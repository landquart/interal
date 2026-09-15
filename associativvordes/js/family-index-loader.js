import { buildSearchForm, SEARCH_NORMALIZER_VERSION } from './search-normalizer.js';

export const FAMILY_INDEX_ERROR_CODES = Object.freeze({
  MANIFEST_FETCH_FAILED: 'MANIFEST_FETCH_FAILED', MANIFEST_INVALID: 'MANIFEST_INVALID', VERSION_UNSUPPORTED: 'VERSION_UNSUPPORTED', LANGUAGE_NOT_INDEXED: 'LANGUAGE_NOT_INDEXED', LOOKUP_FETCH_FAILED: 'LOOKUP_FETCH_FAILED', MEMBERS_FETCH_FAILED: 'MEMBERS_FETCH_FAILED', ABORTED: 'ABORTED'
});

const FAMILY_INDEX_VERSION = '1';
const DEFAULT_BASE_URL = './family-index/';
const MIN_ALIAS_LENGTH = 2;

export class FamilyIndexError extends Error {
  constructor(code, message, details = {}) { super(message); this.name = 'FamilyIndexError'; this.code = code; Object.assign(this, details); }
}
function normalizeBaseUrl(value) { const base = String(value || DEFAULT_BASE_URL); return base.endsWith('/') ? base : `${base}/`; }
function normalizeAlias(value) { return buildSearchForm(value).replace(/[^a-z0-9]/g, ''); }
function aliasShard(alias) { const first = alias[0]; return first && /[a-z0-9]/.test(first) ? first : '_other'; }
function abortError(cause) { return new FamilyIndexError(FAMILY_INDEX_ERROR_CODES.ABORTED, 'Family index request was aborted.', { cause }); }
function throwIfAborted(signal) { if (signal?.aborted) throw abortError(signal.reason); }
function isAbortError(error) { return error?.name === 'AbortError' || error?.code === FAMILY_INDEX_ERROR_CODES.ABORTED; }

async function fetchJson(fetchImpl, url, { signal, code, language, shard } = {}) {
  throwIfAborted(signal);
  let response;
  try { response = await fetchImpl(url, signal ? { signal } : {}); }
  catch (error) { if (isAbortError(error)) throw abortError(error); throw new FamilyIndexError(code, `Family index fetch failed: ${url}`, { language, shard, cause: error }); }
  if (!response?.ok) throw new FamilyIndexError(code, `Family index fetch failed: ${url}`, { language, shard, cause: response });
  try { return await response.json(); }
  catch (error) { throw new FamilyIndexError(code, `Family index JSON parse failed: ${url}`, { language, shard, cause: error }); }
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new FamilyIndexError(FAMILY_INDEX_ERROR_CODES.MANIFEST_INVALID, 'Family index manifest must be an object.');
  if (manifest.version !== FAMILY_INDEX_VERSION) throw new FamilyIndexError(FAMILY_INDEX_ERROR_CODES.VERSION_UNSUPPORTED, 'Family index version is unsupported.');
  if (manifest.normalizer_version !== SEARCH_NORMALIZER_VERSION) throw new FamilyIndexError(FAMILY_INDEX_ERROR_CODES.MANIFEST_INVALID, 'Family index normalizer version is incompatible.');
  if (!Array.isArray(manifest.languages) || !manifest.languages.length) throw new FamilyIndexError(FAMILY_INDEX_ERROR_CODES.MANIFEST_INVALID, 'Family index languages are missing.');
  if (!Array.isArray(manifest.lookup_shards)) throw new FamilyIndexError(FAMILY_INDEX_ERROR_CODES.MANIFEST_INVALID, 'Family index lookup shards are missing.');
  if (!manifest.member_shards || typeof manifest.member_shards !== 'object') throw new FamilyIndexError(FAMILY_INDEX_ERROR_CODES.MANIFEST_INVALID, 'Family index member shards are missing.');
  return manifest;
}
function memberShardMeta(manifest, language, shard) {
  const list = manifest.member_shards?.[language];
  if (!Array.isArray(list)) throw new FamilyIndexError(FAMILY_INDEX_ERROR_CODES.LANGUAGE_NOT_INDEXED, `Language is not indexed: ${language}`, { language });
  return list.find(item => item?.shard === shard) || null;
}
function lookupShardMeta(manifest, shard) { return manifest.lookup_shards.find(item => item?.shard === shard) || null; }

function familyMatch(entry, familyMeta, familyId, lookupAlias, queryRoot) {
  const searchForm = buildSearchForm(entry.search_form || entry.word || entry.normalized);
  const anchors = [entry.family_surface_anchor, ...(Array.isArray(familyMeta?.aliases) ? familyMeta.aliases : [])]
    .map(normalizeAlias).filter(Boolean).filter(anchor => searchForm.includes(anchor)).sort((a, b) => b.length - a.length || a.localeCompare(b));
  const fragment = anchors[0] || normalizeAlias(queryRoot) || searchForm.slice(0, Math.min(4, searchForm.length));
  const index = Math.max(0, searchForm.indexOf(fragment));
  return { type: 'family', family_id: familyId, family_label: familyMeta?.label || familyId, family_confidence: familyMeta?.confidence || null, lookup_alias: lookupAlias, fragment, index, distance: 0, similarity: 1 };
}

export function createFamilyIndexLoader(options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl || DEFAULT_BASE_URL);
  const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis);
  if (typeof fetchImpl !== 'function') throw new TypeError('createFamilyIndexLoader requires fetch support.');
  const cache = new Map();
  let manifestCache = null;
  const diagnostics = { manifestLoaded: false, manifestVersion: null, normalizerVersion: null, loadedShards: [], cacheHits: 0, cacheMisses: 0, fetchCount: 0, familyCandidateIds: 0, resolvedFamilyIds: [], resolvedAlias: null, elementType: null };

  async function cachedJson(path, meta = {}) {
    if (cache.has(path)) { diagnostics.cacheHits += 1; throwIfAborted(meta.signal); return cache.get(path); }
    diagnostics.cacheMisses += 1; diagnostics.fetchCount += 1;
    const value = await fetchJson(fetchImpl, `${baseUrl}${path}`, meta);
    cache.set(path, value); diagnostics.loadedShards.push(path); return value;
  }
  async function loadManifest({ signal } = {}) {
    if (manifestCache) { diagnostics.cacheHits += 1; throwIfAborted(signal); return manifestCache; }
    diagnostics.fetchCount += 1;
    const manifest = validateManifest(await fetchJson(fetchImpl, `${baseUrl}manifest.json`, { signal, code: FAMILY_INDEX_ERROR_CODES.MANIFEST_FETCH_FAILED }));
    manifestCache = manifest; diagnostics.manifestLoaded = true; diagnostics.manifestVersion = manifest.version; diagnostics.normalizerVersion = manifest.normalizer_version; return manifest;
  }

  async function resolveFamilies(root, { signal, elementType = 'root' } = {}) {
    const manifest = await loadManifest({ signal });
    const normalized = normalizeAlias(root);
    const requestedType = elementType === 'preposition' ? 'preposition' : 'root';
    diagnostics.elementType = requestedType;
    if (normalized.length < MIN_ALIAS_LENGTH) return { alias: null, families: [] };
    const shard = aliasShard(normalized);
    const meta = lookupShardMeta(manifest, shard);
    if (!meta) return { alias: null, families: [] };
    const lookup = await cachedJson(meta.file, { signal, code: FAMILY_INDEX_ERROR_CODES.LOOKUP_FETCH_FAILED, shard });
    for (let length = normalized.length; length >= MIN_ALIAS_LENGTH; length -= 1) {
      const alias = normalized.slice(0, length);
      const families = (Array.isArray(lookup?.[alias]) ? lookup[alias] : []).filter(item => item?.element_type === requestedType);
      if (families.length) {
        diagnostics.resolvedAlias = alias; diagnostics.resolvedFamilyIds = families.map(item => item.id);
        return { alias, families };
      }
    }
    diagnostics.resolvedAlias = null; diagnostics.resolvedFamilyIds = [];
    return { alias: null, families: [] };
  }

  async function loadCandidateEntries(language, root, { signal, elementType = 'root' } = {}) {
    const manifest = await loadManifest({ signal });
    if (!manifest.languages.includes(language)) throw new FamilyIndexError(FAMILY_INDEX_ERROR_CODES.LANGUAGE_NOT_INDEXED, `Language is not indexed: ${language}`, { language });
    const resolved = await resolveFamilies(root, { signal, elementType });
    if (!resolved.families.length) { diagnostics.familyCandidateIds = 0; return []; }
    const byLemma = new Map();
    for (const familyRef of resolved.families) {
      const shardMeta = memberShardMeta(manifest, language, familyRef.shard);
      if (!shardMeta) continue;
      const payload = await cachedJson(shardMeta.file, { signal, code: FAMILY_INDEX_ERROR_CODES.MEMBERS_FETCH_FAILED, language, shard: familyRef.shard });
      const bucket = payload?.[familyRef.id];
      if (!bucket || !Array.isArray(bucket.members)) continue;
      for (const source of bucket.members) {
        const key = buildSearchForm(source.normalized || source.word);
        if (!key) continue;
        const entry = { ...source, language, family_id: familyRef.id, family_ids: [...new Set([...(Array.isArray(source.family_ids) ? source.family_ids : []), familyRef.id])], family_label: bucket.meta?.label || familyRef.label || familyRef.id, family_confidence: bucket.meta?.confidence || familyRef.confidence || null, family_aliases: Array.isArray(bucket.meta?.aliases) ? bucket.meta.aliases : [], match: familyMatch(source, bucket.meta, familyRef.id, resolved.alias, root) };
        const existing = byLemma.get(key);
        if (!existing || Number(entry.frequency_score) > Number(existing.frequency_score)) byLemma.set(key, entry);
        else if (existing) existing.family_ids = [...new Set([...(existing.family_ids || []), familyRef.id])];
      }
    }
    const entries = [...byLemma.values()]; diagnostics.familyCandidateIds = entries.length; return entries;
  }

  function getFamilyIndexDiagnostics() { return JSON.parse(JSON.stringify(diagnostics)); }
  function clearCache() { cache.clear(); manifestCache = null; diagnostics.manifestLoaded = false; diagnostics.loadedShards = []; diagnostics.resolvedFamilyIds = []; diagnostics.resolvedAlias = null; diagnostics.familyCandidateIds = 0; diagnostics.elementType = null; }
  return { loadManifest, resolveFamilies, loadCandidateEntries, getFamilyIndexDiagnostics, clearCache };
}
