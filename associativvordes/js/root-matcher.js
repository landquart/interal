import { buildSearchForm, normalizeText, stripDiacritics } from './search-normalizer.js';
import { AFFIX_SEARCH_CONFIG_VERSION, getAffixSearchConfig } from './affix-search-config.js';

export { AFFIX_SEARCH_CONFIG_VERSION, buildSearchForm, normalizeText, stripDiacritics };

const TOKEN_SEPARATOR_RE = /[\s'\-]/;
const affixCache = new Map();
export const MIN_FUZZY_ROOT_SIMILARITY = 0.8;

function uniqueSortedAffixes(values) {
  return [...new Set((values || []).map(buildSearchForm).filter(Boolean))]
    .sort((a, b) => b.length - a.length || a.localeCompare(b));
}

function normalizedAffixConfig(language) {
  const code = String(language || 'en').toLowerCase();
  if (affixCache.has(code)) return affixCache.get(code);
  const raw = getAffixSearchConfig(code);
  const config = Object.freeze({
    safePrefixes: uniqueSortedAffixes(raw.safePrefixes),
    restrictedPrefixes: uniqueSortedAffixes(raw.restrictedPrefixes),
    combiningForms: uniqueSortedAffixes(raw.combiningForms),
    suffixes: uniqueSortedAffixes(raw.suffixes),
    compoundLinkers: uniqueSortedAffixes(raw.compoundLinkers)
  });
  affixCache.set(code, config);
  return config;
}

function tokenRanges(text) {
  const ranges = [];
  let start = 0;
  while (start < text.length) {
    while (start < text.length && TOKEN_SEPARATOR_RE.test(text[start])) start += 1;
    if (start >= text.length) break;
    let end = start + 1;
    while (end < text.length && !TOKEN_SEPARATOR_RE.test(text[end])) end += 1;
    ranges.push({ start, end });
    start = end + 1;
  }
  return ranges;
}

function boundaryPriority(boundary) {
  if (boundary.kind === 'token') return 0;
  if (boundary.kind === 'safe') return 1;
  if (boundary.kind === 'combining') return 2;
  return 3;
}

function addBoundary(target, boundary) {
  const existing = target.get(boundary.start);
  if (!existing || boundaryPriority(boundary) < boundaryPriority(existing)) target.set(boundary.start, boundary);
}

export function rootBoundarySegments(word, language = 'en', { maxAffixes = 2 } = {}) {
  const text = buildSearchForm(word);
  if (!text) return [];
  const config = normalizedAffixConfig(language);
  const boundaries = new Map();

  for (const token of tokenRanges(text)) {
    addBoundary(boundaries, { start: token.start, end: token.end, kind: 'token', prefixes: [] });
    const queue = [{ position: token.start, prefixes: [], restrictedCount: 0, combiningCount: 0 }];
    const visited = new Set();

    while (queue.length) {
      const state = queue.shift();
      if (state.prefixes.length >= maxAffixes) continue;
      const key = `${state.position}:${state.prefixes.length}:${state.restrictedCount}:${state.combiningCount}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const groups = [
        { kind: 'safe', values: config.safePrefixes },
        { kind: 'combining', values: state.combiningCount ? [] : config.combiningForms },
        { kind: 'restricted', values: state.restrictedCount ? [] : config.restrictedPrefixes }
      ];

      for (const group of groups) {
        for (const prefix of group.values) {
          if (!text.startsWith(prefix, state.position)) continue;
          const next = state.position + prefix.length;
          if (next >= token.end) continue;
          const prefixes = [...state.prefixes, { value: prefix, kind: group.kind }];
          const restrictedCount = state.restrictedCount + (group.kind === 'restricted' ? 1 : 0);
          const combiningCount = state.combiningCount + (group.kind === 'combining' ? 1 : 0);
          const kind = restrictedCount ? 'restricted' : combiningCount ? 'combining' : 'safe';
          addBoundary(boundaries, { start: next, end: token.end, kind, prefixes });
          queue.push({ position: next, prefixes, restrictedCount, combiningCount });
        }
      }
    }
  }

  return [...boundaries.values()].sort((a, b) => a.start - b.start || boundaryPriority(a) - boundaryPriority(b));
}

export function includesRoot(word, root) {
  const w = buildSearchForm(word);
  const r = buildSearchForm(root);
  return r.length > 0 && w.includes(r);
}

export function levenshtein(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  let current = new Array(right.length + 1);
  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    [previous, current] = [current, previous];
  }
  return previous[right.length];
}

export function allowedRootDistance(root) {
  const length = buildSearchForm(root).length;
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  if (length <= 8) return 2;
  return Math.max(2, Math.floor(length * 0.25));
}

function suffixMetadata(text, rootEnd, tokenEnd, language) {
  const tail = text.slice(rootEnd, tokenEnd);
  if (!tail) return { suffix: null, tail: '' };
  const suffix = normalizedAffixConfig(language).suffixes.find(value => tail.startsWith(value)) || null;
  return { suffix, tail };
}

export function exactRootMatchAtBoundary(word, root, language = 'en') {
  const text = buildSearchForm(word);
  const canonicalRoot = buildSearchForm(root);
  if (!text || !canonicalRoot) return null;
  let best = null;
  for (const boundary of rootBoundarySegments(text, language)) {
    if (boundary.start + canonicalRoot.length > boundary.end || !text.startsWith(canonicalRoot, boundary.start)) continue;
    const candidate = {
      type: 'exact',
      distance: 0,
      similarity: 1,
      fragment: canonicalRoot,
      index: boundary.start,
      boundary,
      ...suffixMetadata(text, boundary.start + canonicalRoot.length, boundary.end, language)
    };
    if (!best || boundaryPriority(boundary) < boundaryPriority(best.boundary) || (boundaryPriority(boundary) === boundaryPriority(best.boundary) && boundary.start < best.index)) best = candidate;
  }
  return best;
}

export function fuzzyRootMatch(word, root, language = 'en') {
  const text = buildSearchForm(word);
  const canonicalRoot = buildSearchForm(root);
  if (!text || !canonicalRoot || canonicalRoot.length < 4) return null;
  const exact = exactRootMatchAtBoundary(text, canonicalRoot, language);
  if (exact) return exact;
  const maxDistance = allowedRootDistance(canonicalRoot);
  if (maxDistance <= 0) return null;
  const minLen = Math.max(1, canonicalRoot.length - maxDistance);
  const maxLen = canonicalRoot.length + maxDistance;
  let best = null;

  for (const boundary of rootBoundarySegments(text, language)) {
    for (let length = minLen; length <= maxLen; length += 1) {
      if (boundary.start + length > boundary.end) continue;
      const fragment = text.slice(boundary.start, boundary.start + length);
      if (fragment[0] !== canonicalRoot[0]) continue;
      const distance = levenshtein(fragment, canonicalRoot);
      if (distance > maxDistance) continue;
      const similarity = 1 - distance / Math.max(canonicalRoot.length, fragment.length);
      if (similarity < MIN_FUZZY_ROOT_SIMILARITY) continue;
      const candidate = {
        type: 'fuzzy',
        distance,
        similarity,
        fragment,
        index: boundary.start,
        boundary,
        ...suffixMetadata(text, boundary.start + fragment.length, boundary.end, language)
      };
      if (!best
        || distance < best.distance
        || (distance === best.distance && similarity > best.similarity)
        || (distance === best.distance && similarity === best.similarity && boundaryPriority(boundary) < boundaryPriority(best.boundary))
        || (distance === best.distance && similarity === best.similarity && boundaryPriority(boundary) === boundaryPriority(best.boundary) && boundary.start < best.index)) best = candidate;
    }
  }
  return best;
}

export function fuzzyIncludesRoot(word, root, language = 'en') {
  return Boolean(fuzzyRootMatch(word, root, language));
}

const SPECIAL_ROOT_VARIANTS = Object.freeze({
  inter: Object.freeze({ any: ['inter'], ru: ['интер'], el: ['ίντερ'] }),
  ocul: Object.freeze({ any: ['ocul', 'okul'], ru: ['окул'] }),
  regul: Object.freeze({ any: ['regul'], ru: ['регул'], fr: ['régul'], it: ['regol'] })
});

export function specialRootVariants(lang, root) {
  const canonical = buildSearchForm(root);
  const config = SPECIAL_ROOT_VARIANTS[canonical];
  if (!config) return [];
  const language = normalizeText(lang);
  const values = language === 'any'
    ? Object.values(config).flat()
    : [...(config.any || []), ...(config[language] || [])];
  return [...new Set(values.map(buildSearchForm).filter(Boolean))];
}

export function specialRootMatch(lang, word, root) {
  const searchForm = buildSearchForm(word);
  return specialRootVariants(lang, root).some(variant => searchForm.includes(variant));
}

export function specialRootMatchAtBoundary(lang, word, root) {
  return specialRootVariants(lang, root).some(variant => exactRootMatchAtBoundary(word, variant, lang));
}

export function findRootMatch(word, root, language = 'en') {
  const exact = exactRootMatchAtBoundary(word, root, language);
  if (exact) return exact;
  for (const variant of specialRootVariants(language, root)) {
    const special = exactRootMatchAtBoundary(word, variant, language);
    if (special) return { ...special, type: 'special', canonicalRoot: buildSearchForm(root), variant };
  }
  let best = fuzzyRootMatch(word, root, language);
  for (const variant of specialRootVariants(language, root)) {
    const fuzzy = fuzzyRootMatch(word, variant, language);
    if (fuzzy && (!best || fuzzy.distance < best.distance || (fuzzy.distance === best.distance && fuzzy.similarity > best.similarity))) best = { ...fuzzy, type: 'special', canonicalRoot: buildSearchForm(root), variant };
  }
  return best;
}

export function sortRootCandidateMatches(candidates, getRank = () => 50001) {
  const typePriority = { exact: 0, special: 1, fuzzy: 2 };
  return candidates.slice().sort((a, b) =>
    (typePriority[a.match.type] ?? 99) - (typePriority[b.match.type] ?? 99) ||
    (a.match.distance ?? 0) - (b.match.distance ?? 0) ||
    (b.match.similarity ?? 0) - (a.match.similarity ?? 0) ||
    boundaryPriority(a.match.boundary || { kind: 'restricted' }) - boundaryPriority(b.match.boundary || { kind: 'restricted' }) ||
    getRank(a.word) - getRank(b.word) ||
    a.word.localeCompare(b.word)
  );
}
