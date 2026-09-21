import { buildSearchForm } from './search-normalizer.js';

export const FAMILY_INDEX_VERSION = '5';
const SUPPORTED_FAMILY_INDEX_VERSIONS = new Set(['4', FAMILY_INDEX_VERSION]);
export function familyBucket(value) {
  let hash = 0x811c9dc5;
  for (const char of String(value)) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 0x01000193); }
  return ((hash >>> 0) % 256).toString(16).padStart(2, '0');
}
const normalizeAlias = value => buildSearchForm(value).replace(/[^a-z0-9]/g, '');
export const MAX_FAMILY_ALIAS_FANOUT = 25;
const BLOCKED_RUNTIME_STATUSES = new Set(['blocked_from_runtime', 'rejected', 'split_required']);
const hasManualEvidence = member => member?.components?.some(component => component.evidence?.some(evidence => evidence.type === 'manual_override'));
const isRuntimeCorpusMember = member => member?.corpus_quality?.status !== 'rejected';

export class FamilyIndexLoader {
  constructor({ baseUrl = '/associativvordes/family-index-v5', fetchJson = async (url, options) => { const response = await fetch(url, options); if (!response.ok) throw new Error(`Family index request failed: ${response.status}`); if (!url.endsWith('.gz')) return response.json(); if (typeof DecompressionStream !== 'function') throw new Error('Gzip decompression is unavailable'); const stream = response.body.pipeThrough(new DecompressionStream('gzip')); return JSON.parse(await new Response(stream).text()); } } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); this.fetchJson = fetchJson; this.cache = new Map();
  }
  load(path, { signal } = {}) {
    if (signal?.aborted) return Promise.reject(signal.reason || new DOMException('Aborted', 'AbortError'));
    if (!this.cache.has(path)) {
      const separator = this.baseUrl.includes('?') ? '' : '/';
      const request = Promise.resolve(this.fetchJson(`${this.baseUrl}${separator}${path}`, signal ? { signal } : {}));
      this.cache.set(path, request);
      request.catch(() => { if (this.cache.get(path) === request) this.cache.delete(path); });
    }
    return this.cache.get(path);
  }
  async manifest(options) { const value = await this.load('manifest.json', options); if (!SUPPORTED_FAMILY_INDEX_VERSIONS.has(value.version)) throw new Error(`Unsupported family index version: ${value.version}`); return value; }
  async resolveAlias(query, options) { const manifest = await this.manifest(options); const alias = normalizeAlias(query); if (!alias) return []; const path = manifest.sharding.alias_template.replace('{bucket}', familyBucket(alias)); return (await this.load(path, options))[alias] || []; }
  async family(id, options) { const manifest = await this.manifest(options); const path = manifest.sharding.family_template.replace('{bucket}', familyBucket(id)); return (await this.load(path, options))[id] || null; }
  async members(id, language, options) { const manifest = await this.manifest(options); if (!manifest.languages.includes(language)) throw new Error(`Unsupported family language: ${language}`); const path = manifest.sharding.member_template.replace('{language}', language).replace('{bucket}', familyBucket(id)); return (await this.load(path, options))[id] || []; }

  async candidateEntries(query, language, options) {
    const ids = await this.resolveAlias(query, options);
    if (ids.length > MAX_FAMILY_ALIAS_FANOUT) throw new Error(`Family alias fan-out ${ids.length} exceeds runtime limit ${MAX_FAMILY_ALIAS_FANOUT}`);
    const families = await Promise.all(ids.map(id => this.family(id, options)));
    const eligibleFamilies = families.filter(family => family && !BLOCKED_RUNTIME_STATUSES.has(family.review_status));
    const groups = await Promise.all(eligibleFamilies.map(async family => ({ family, members: await this.members(family.id, language, options) })));
    const manualGroups = groups
      .filter(({ family }) => String(family.source || '').includes('manual_override'))
      .map(({ family, members }) => ({ family, members: members.filter(hasManualEvidence) }));
    const eligibleGroups = manualGroups.length ? manualGroups : groups;
    const byLemma = new Map();
    for (const { family, members } of eligibleGroups) {
      if (!family) continue;
      const eligibleMembers = (String(family.source || '').includes('manual_override') ? members.filter(hasManualEvidence) : members).filter(isRuntimeCorpusMember);
      for (const member of eligibleMembers) {
        if (!member || typeof member.lemma_id !== 'string' || typeof member.word !== 'string' || !member.word) continue;
        const candidate = { ...member, family_id: family.id, family_canonical: family.canonical, family_aliases: Array.isArray(family.aliases) ? [...family.aliases] : [], family_verified: family.verified === true, family_indexed: true };
        const previous = byLemma.get(member.lemma_id);
        if (!previous || (candidate.family_verified && !previous.family_verified)) byLemma.set(member.lemma_id, candidate);
      }
    }
    return [...byLemma.values()];
  }
}
