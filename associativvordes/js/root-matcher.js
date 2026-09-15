import { buildSearchForm, normalizeText, stripDiacritics } from './search-normalizer.js';
import { AFFIX_SEARCH_CONFIG_VERSION, getAffixSearchConfig } from './affix-search-config.js';
import { resolveAssociativeFamily } from './associative-family-registry.js';

export { AFFIX_SEARCH_CONFIG_VERSION, buildSearchForm, normalizeText, stripDiacritics };

const TOKEN_SEPARATOR_RE = /[\s'\-]/;
const affixCache = new Map();

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
  return Boolean(r) && w.includes(r);
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
      type: 'exact', distance: 0, similarity: 1, fragment: canonicalRoot, index: boundary.start, boundary,
      ...suffixMetadata(text, boundary.start + canonicalRoot.length, boundary.end, language)
    };
    if (!best || boundaryPriority(boundary) < boundaryPriority(best.boundary) || (boundaryPriority(boundary) === boundaryPriority(best.boundary) && boundary.start < best.index)) best = candidate;
  }
  return best;
}

export function specialRootVariants(_lang, root) {
  const family = resolveAssociativeFamily(root);
  if (!family?.verified) return [];
  const canonical = buildSearchForm(root);
  return family.aliases.filter(alias => alias !== canonical);
}

export function specialRootMatch(lang, word, root) {
  const language = lang === 'any' ? 'en' : lang;
  return specialRootVariants(lang, root).some(variant => Boolean(exactRootMatchAtBoundary(word, variant, language)));
}

export function specialRootMatchAtBoundary(lang, word, root) {
  const language = lang === 'any' ? 'en' : lang;
  return specialRootVariants(lang, root).some(variant => Boolean(exactRootMatchAtBoundary(word, variant, language)));
}

export function findRootMatch(word, root, language = 'en') {
  const exact = exactRootMatchAtBoundary(word, root, language);
  if (exact) return exact;
  const family = resolveAssociativeFamily(root);
  if (!family) return null;
  for (const variant of family.aliases) {
    if (variant === buildSearchForm(root)) continue;
    const special = exactRootMatchAtBoundary(word, variant, language);
    if (special) return { ...special, type: 'special', canonicalRoot: family.canonical, variant, family_id: family.id };
  }
  return null;
}

export function sortRootCandidateMatches(candidates, getRank = () => 50001) {
  const typePriority = { exact: 0, special: 1 };
  return candidates.slice().sort((a, b) =>
    (typePriority[a.match?.type] ?? 99) - (typePriority[b.match?.type] ?? 99) ||
    getRank(a.word) - getRank(b.word) ||
    String(a.word).localeCompare(String(b.word))
  );
}
