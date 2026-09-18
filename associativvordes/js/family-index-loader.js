import { buildSearchForm } from './search-normalizer.js';

export const FAMILY_INDEX_VERSION = '4';
export function familyBucket(value) {
  let hash = 0x811c9dc5;
  for (const char of String(value)) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 0x01000193); }
  return ((hash >>> 0) % 256).toString(16).padStart(2, '0');
}
const normalizeAlias = value => buildSearchForm(value).replace(/[^a-z0-9]/g, '');

export class FamilyIndexLoader {
  constructor({ baseUrl = './family-index', fetchJson = async (url, options) => { const response = await fetch(url, options); if (!response.ok) throw new Error(`Family index request failed: ${response.status}`); return response.json(); } } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); this.fetchJson = fetchJson; this.cache = new Map();
  }
  load(path, { signal } = {}) {
    if (signal?.aborted) return Promise.reject(signal.reason || new DOMException('Aborted', 'AbortError'));
    if (!this.cache.has(path)) {
      const request = Promise.resolve(this.fetchJson(`${this.baseUrl}/${path}`, signal ? { signal } : {}));
      this.cache.set(path, request);
      request.catch(() => { if (this.cache.get(path) === request) this.cache.delete(path); });
    }
    return this.cache.get(path);
  }
  async manifest(options) { const value = await this.load('manifest.json', options); if (value.version !== FAMILY_INDEX_VERSION) throw new Error(`Unsupported family index version: ${value.version}`); return value; }
  async resolveAlias(query, options) { const manifest = await this.manifest(options); const alias = normalizeAlias(query); if (!alias) return []; const path = manifest.sharding.alias_template.replace('{bucket}', familyBucket(alias)); return (await this.load(path, options))[alias] || []; }
  async family(id, options) { const manifest = await this.manifest(options); const path = manifest.sharding.family_template.replace('{bucket}', familyBucket(id)); return (await this.load(path, options))[id] || null; }
  async members(id, language, options) { const manifest = await this.manifest(options); if (!manifest.languages.includes(language)) throw new Error(`Unsupported family language: ${language}`); const path = manifest.sharding.member_template.replace('{language}', language).replace('{bucket}', familyBucket(id)); return (await this.load(path, options))[id] || []; }

  async candidateEntries(query, language, options) {
    const ids = await this.resolveAlias(query, options);
    const groups = await Promise.all(ids.map(async id => ({ family: await this.family(id, options), members: await this.members(id, language, options) })));
    const byLemma = new Map();
    for (const { family, members } of groups) {
      if (!family) continue;
      for (const member of members) {
        if (!member || typeof member.lemma_id !== 'string' || typeof member.word !== 'string' || !member.word) continue;
        const candidate = { ...member, family_id: family.id, family_canonical: family.canonical, family_aliases: Array.isArray(family.aliases) ? [...family.aliases] : [], family_verified: family.verified === true, family_indexed: true };
        const previous = byLemma.get(member.lemma_id);
        if (!previous || (candidate.family_verified && !previous.family_verified)) byLemma.set(member.lemma_id, candidate);
      }
    }
    return [...byLemma.values()];
  }
}
