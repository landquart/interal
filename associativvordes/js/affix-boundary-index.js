import { buildSearchForm, rootBoundarySegments } from './root-matcher.js';

export const STATIC_MANIFEST_VERSION = '4';
export const STATIC_INDEX_FORMAT = 'static-affix-anchored-ngram-v1';

export function postingKey(offset, gram) {
  if (!Number.isInteger(offset) || offset < 0) throw new TypeError('posting offset must be a non-negative integer');
  const normalizedGram = buildSearchForm(gram);
  if (!normalizedGram || normalizedGram.length > 3) throw new TypeError('posting gram must contain one to three normalized characters');
  return `${offset}:${normalizedGram}`;
}

export function parsePostingKey(key) {
  const match = String(key || '').match(/^(0|[1-9]\d*):(.{1,3})$/u);
  if (!match) return null;
  return { offset: Number(match[1]), gram: match[2], length: Array.from(match[2]).length };
}

export function anchoredPostingKeys(value, language, length) {
  const text = buildSearchForm(value);
  const size = Number(length);
  const keys = new Set();
  if (!text || !Number.isInteger(size) || size < 1 || size > 3) return keys;
  for (const boundary of rootBoundarySegments(text, language)) {
    for (let index = boundary.start; index + size <= boundary.end; index += 1) {
      keys.add(postingKey(index - boundary.start, text.slice(index, index + size)));
    }
  }
  return keys;
}

export function exactAnchoredLookups(value) {
  const text = buildSearchForm(value);
  if (!text) return [];
  if (text.length <= 2) return [{ key: postingKey(0, text), gram: text, length: text.length, offset: 0 }];
  const lookups = [];
  for (let offset = 0; offset <= text.length - 3; offset += 1) {
    const gram = text.slice(offset, offset + 3);
    lookups.push({ key: postingKey(offset, gram), gram, length: 3, offset });
  }
  return lookups;
}

export function acceptAffixBoundaryMatch(match) {
  return Boolean(match && (!Number.isFinite(match.distance) || match.distance === 0));
}
