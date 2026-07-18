import { allowedRootDistance, buildSearchForm, levenshtein, rootBoundarySegments } from './root-matcher.js';

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
    if (part) {
      const gram = part.slice(0, Math.min(3, part.length));
      seeds.push({ gram, length: gram.length, offset, maxOffsetShift: distance });
    }
    offset += partLength;
  }
  return [...new Map(seeds.map(seed => [`${seed.offset}:${seed.length}:${seed.gram}`, seed])).values()];
}

export function fuzzyAnchoredLookupGroups(root) {
  return fuzzySeedGrams(root).map(seed => {
    const keys = [];
    const minimum = Math.max(0, seed.offset - seed.maxOffsetShift);
    const maximum = seed.offset + seed.maxOffsetShift;
    for (let offset = minimum; offset <= maximum; offset += 1) {
      keys.push({ key: postingKey(offset, seed.gram), gram: seed.gram, length: seed.length, offset });
    }
    return { seed, lookups: keys };
  });
}

export function acceptAffixBoundaryMatch(match, root) {
  if (!match) return false;
  if (!Number.isFinite(match.distance) || match.distance <= 0) return true;
  const canonicalRoot = buildSearchForm(root);
  const fragment = buildSearchForm(match.fragment);
  if (!canonicalRoot || !fragment) return false;
  if (fragment.length > canonicalRoot.length && levenshtein(fragment.slice(1), canonicalRoot) < match.distance) return false;
  if (fragment.length < canonicalRoot.length && levenshtein(fragment, canonicalRoot.slice(1)) < match.distance) return false;
  return true;
}
