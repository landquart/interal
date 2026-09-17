import { buildSearchForm } from './search-normalizer.js';

export const FAMILY_INDEX_VERSION = '3';
export function familyBucket(value) {
  let hash = 0x811c9dc5;
  for (const char of String(value)) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 0x01000193); }
  return ((hash >>> 0) % 256).toString(16).padStart(2, '0');
}
const normalizeAlias = value => buildSearchForm(value).replace(/[^a-z0-9]/g, '');

export class FamilyIndexLoader {
  constructor({ baseUrl = './family-index', fetchJson = async url => { const response = await fetch(url); if (!response.ok) throw new Error(`Family index request failed: ${response.status}`); return response.json(); } } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); this.fetchJson = fetchJson; this.cache = new Map();
  }
  load(path) { if (!this.cache.has(path)) this.cache.set(path, Promise.resolve(this.fetchJson(`${this.baseUrl}/${path}`))); return this.cache.get(path); }
  async manifest() { const value = await this.load('manifest.json'); if (value.version !== FAMILY_INDEX_VERSION) throw new Error(`Unsupported family index version: ${value.version}`); return value; }
  async resolveAlias(query) { const manifest = await this.manifest(); const alias = normalizeAlias(query); if (!alias) return []; const path = manifest.sharding.alias_template.replace('{bucket}', familyBucket(alias)); return (await this.load(path))[alias] || []; }
  async family(id) { const manifest = await this.manifest(); const path = manifest.sharding.family_template.replace('{bucket}', familyBucket(id)); return (await this.load(path))[id] || null; }
  async members(id, language) { const manifest = await this.manifest(); if (!manifest.languages.includes(language)) throw new Error(`Unsupported family language: ${language}`); const path = manifest.sharding.member_template.replace('{language}', language).replace('{bucket}', familyBucket(id)); return (await this.load(path))[id] || []; }
}
