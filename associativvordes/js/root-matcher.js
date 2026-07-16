export function normalizeText(s) {
  return String(s || '').trim().toLowerCase().normalize('NFC');
}

export function stripDiacritics(s) {
  return normalizeText(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function includesRoot(word, root) {
  const w = stripDiacritics(word);
  const r = stripDiacritics(root);
  return r.length > 0 && w.includes(r);
}

export function levenshtein(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  const dp = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
  for (let i = 0; i <= left.length; i++) dp[i][0] = i;
  for (let j = 0; j <= right.length; j++) dp[0][j] = j;
  for (let i = 1; i <= left.length; i++) {
    for (let j = 1; j <= right.length; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[left.length][right.length];
}

export function allowedRootDistance(root) {
  const length = stripDiacritics(root).length;
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  if (length <= 8) return 2;
  return Math.max(2, Math.floor(length * 0.25));
}

export function fuzzyRootMatch(word, root) {
  const w = stripDiacritics(word);
  const r = stripDiacritics(root);
  if (!w || !r || r.length < 4) return null;
  const exactIndex = w.indexOf(r);
  if (exactIndex !== -1) return { type: 'exact', distance: 0, similarity: 1, fragment: r, index: exactIndex };
  const maxDistance = allowedRootDistance(r);
  if (maxDistance <= 0) return null;
  const minLen = Math.max(3, r.length - maxDistance);
  const maxLen = r.length + maxDistance;
  const maxStart = Math.min(w.length - 1, 3);
  let best = null;
  for (let i = 0; i <= maxStart; i++) {
    for (let len = minLen; len <= maxLen; len++) {
      const part = w.slice(i, i + len);
      if (part.length < minLen) continue;
      if (part[0] !== r[0]) continue;
      const distance = levenshtein(part, r);
      const similarity = 1 - distance / Math.max(r.length, part.length);
      if (distance <= maxDistance && similarity >= 0.8 && (!best || distance < best.distance || (distance === best.distance && similarity > best.similarity))) {
        best = { type: 'fuzzy', distance, similarity, fragment: part, index: i };
      }
    }
  }
  return best;
}

export function fuzzyIncludesRoot(word, root) {
  return Boolean(fuzzyRootMatch(word, root));
}

export function specialRootMatch(lang, word, root) {
  const w = normalizeText(word);
  if (root === 'inter') return w.includes('интер') || w.includes('ίντερ') || w.includes('inter');
  if (root === 'ocul') return w.includes('окул') || w.includes('ocul') || w.includes('okul');
  if (root === 'regul') return w.includes('регул') || w.includes('regul') || w.includes('régul') || w.includes('regol');
  return false;
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
