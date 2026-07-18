import { buildSearchForm, normalizeText, stripDiacritics } from './search-normalizer.js';

export { buildSearchForm, normalizeText, stripDiacritics };

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

export function fuzzyRootMatch(word, root) {
  const w = buildSearchForm(word);
  const r = buildSearchForm(root);
  if (!w || !r || r.length < 4) return null;
  const exactIndex = w.indexOf(r);
  if (exactIndex !== -1) return { type: 'exact', distance: 0, similarity: 1, fragment: r, index: exactIndex };
  const maxDistance = allowedRootDistance(r);
  if (maxDistance <= 0) return null;
  const minLen = Math.max(1, r.length - maxDistance);
  const maxLen = r.length + maxDistance;
  let best = null;
  for (let index = 0; index < w.length; index += 1) {
    for (let length = minLen; length <= maxLen; length += 1) {
      const fragment = w.slice(index, index + length);
      if (fragment.length < minLen) continue;
      const distance = levenshtein(fragment, r);
      if (distance > maxDistance) continue;
      const similarity = 1 - distance / Math.max(r.length, fragment.length);
      if (!best
        || distance < best.distance
        || (distance === best.distance && similarity > best.similarity)
        || (distance === best.distance && similarity === best.similarity && index < best.index)) {
        best = { type: 'fuzzy', distance, similarity, fragment, index };
      }
    }
  }
  return best;
}

export function fuzzyIncludesRoot(word, root) {
  return Boolean(fuzzyRootMatch(word, root));
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

export function sortRootCandidateMatches(candidates, getRank = () => 50001) {
  const typePriority = { exact: 0, special: 1, fuzzy: 2 };
  return candidates.slice().sort((a, b) =>
    (typePriority[a.match.type] ?? 99) - (typePriority[b.match.type] ?? 99) ||
    (a.match.distance ?? 0) - (b.match.distance ?? 0) ||
    (b.match.similarity ?? 0) - (a.match.similarity ?? 0) ||
    getRank(a.word) - getRank(b.word) ||
    a.word.localeCompare(b.word)
  );
}
