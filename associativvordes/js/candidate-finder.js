import { fuzzyRootMatch, includesRoot, normalizeText, specialRootMatch, stripDiacritics } from './root-matcher.js';

const MATCH_PRIORITY = Object.freeze({ exact: 0, special: 1, fuzzy: 2 });

function createDiagnostics() {
  return { inspected: 0, matched: 0, rejected: 0, rejectedByReason: {}, duplicates: 0, warnings: [] };
}

function reject(diagnostics, reason) {
  diagnostics.rejected += 1;
  diagnostics.rejectedByReason[reason] = (diagnostics.rejectedByReason[reason] || 0) + 1;
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function normalizedLemma(entry) {
  return normalizeText(entry.normalized || entry.word);
}

function entryLanguage(entry) {
  return entry.language ?? entry.lang ?? entry.locale;
}

function sourceCategory(source) {
  return source?.category ?? null;
}

function sourceIpm(source) {
  return typeof source?.ipm === 'number' && Number.isFinite(source.ipm) ? source.ipm : 0;
}

function sourceFile(source) {
  return typeof source?.file === 'string' && source.file.trim() ? source.file : null;
}

function validRank(value) {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

function totalIpm(entry) {
  return Array.isArray(entry.sources) ? entry.sources.reduce((sum, source) => sum + sourceIpm(source), 0) : 0;
}

function completenessScore(entry) {
  return [entry.word, entry.normalized, entry.search_form].filter(value => typeof value === 'string' && value.trim()).length
    + (Array.isArray(entry.sources) ? Math.min(entry.sources.length, 20) : 0)
    + (isPlainObject(entry.category_breakdown) ? Object.keys(entry.category_breakdown).length : 0)
    + (validRank(entry.rank) ? 1 : 0)
    + (typeof entry.frequency_score === 'number' && Number.isFinite(entry.frequency_score) ? 1 : 0);
}

function validateEntry(entry, language, diagnostics) {
  diagnostics.inspected += 1;
  if (!isPlainObject(entry)) return reject(diagnostics, 'not_object'), false;
  if (typeof entry.word !== 'string' || !entry.word.trim()) return reject(diagnostics, 'word_empty'), false;
  if (typeof entry.search_form !== 'string' || !entry.search_form.trim()) return reject(diagnostics, 'search_form_empty'), false;
  if (!Array.isArray(entry.sources)) return reject(diagnostics, 'sources_missing'), false;
  if (entry.sources.length === 0) return reject(diagnostics, 'sources_empty'), false;
  if (typeof entry.frequency_score !== 'number' || !Number.isFinite(entry.frequency_score)) return reject(diagnostics, 'frequency_score_not_finite'), false;
  if (entry.frequency_score < 0 || entry.frequency_score > 100) return reject(diagnostics, 'frequency_score_out_of_range'), false;
  const storedLanguage = entryLanguage(entry);
  if (storedLanguage != null && language != null && String(storedLanguage) !== String(language)) return reject(diagnostics, 'language_mismatch'), false;
  if (!normalizedLemma(entry)) return reject(diagnostics, 'normalized_empty'), false;
  return true;
}

function runtimeWarningsForEntry(entry) {
  const warnings = new Set(Array.isArray(entry.warnings) ? entry.warnings : []);
  for (const source of entry.sources) {
    if (!sourceCategory(source)) warnings.add('missing_category');
    if (!source || !sourceFile(source) || !sourceCategory(source) || typeof source.ipm !== 'number' || !Number.isFinite(source.ipm)) warnings.add('partial_source_data');
  }
  if (entry.frequency_score === 0) warnings.add('candidate_found_but_frequency_zero');
  return [...warnings];
}

function exactRootMatch(searchForm, root) {
  if (!includesRoot(searchForm, root)) return null;
  const word = stripDiacritics(searchForm);
  const normalizedRoot = stripDiacritics(root);
  return { type: 'exact', distance: 0, similarity: 1, fragment: normalizedRoot, index: word.indexOf(normalizedRoot) };
}

function findMatch({ searchForm, root, language, specialRootMatcher }) {
  const exact = exactRootMatch(searchForm, root);
  if (exact) return exact;
  const specialMatcher = specialRootMatcher || specialRootMatch;
  if (specialMatcher(language, searchForm, stripDiacritics(root))) {
    return { type: 'special', distance: 0, similarity: 1, fragment: stripDiacritics(root), index: 0 };
  }
  const fuzzy = fuzzyRootMatch(searchForm, root);
  return fuzzy && fuzzy.type === 'exact' ? { ...fuzzy, type: 'exact' } : fuzzy;
}

function compareCandidates(a, b) {
  const rankA = validRank(a.rank) ? a.rank : Number.POSITIVE_INFINITY;
  const rankB = validRank(b.rank) ? b.rank : Number.POSITIVE_INFINITY;
  return (MATCH_PRIORITY[a.match.type] ?? 99) - (MATCH_PRIORITY[b.match.type] ?? 99)
    || (a.match.distance ?? 0) - (b.match.distance ?? 0)
    || (b.match.similarity ?? 0) - (a.match.similarity ?? 0)
    || (b.frequency_score ?? 0) - (a.frequency_score ?? 0)
    || (b.total_ipm ?? 0) - (a.total_ipm ?? 0)
    || rankA - rankB
    || a.word.localeCompare(b.word);
}

function withDuplicateWarning(entry) {
  return {
    ...entry,
    warnings: [...new Set([...(Array.isArray(entry.warnings) ? entry.warnings : []), 'duplicate_runtime_entry'])]
  };
}

export function findCandidatesForRoot({ entries, root, language, maxCandidates = Infinity, specialRootMatcher } = {}) {
  if (!Array.isArray(entries)) throw new TypeError('findCandidatesForRoot requires entries to be an array.');
  if (typeof root !== 'string' || !root.trim()) throw new TypeError('findCandidatesForRoot requires a non-empty root.');
  if (maxCandidates !== Infinity && (!Number.isInteger(maxCandidates) || maxCandidates < 0)) throw new TypeError('maxCandidates must be a non-negative integer.');

  const diagnostics = createDiagnostics();
  const byLemma = new Map();
  for (const entry of entries) {
    if (!validateEntry(entry, language, diagnostics)) continue;
    const key = `${language ?? entryLanguage(entry) ?? ''}:${normalizedLemma(entry)}`;
    const existing = byLemma.get(key);
    if (existing) {
      diagnostics.duplicates += 1;
      diagnostics.warnings.push({ reason: 'duplicate_runtime_entry', word: entry.word, normalized: entry.normalized });
      const replacementIsBetter = completenessScore(entry) > completenessScore(existing);
      byLemma.set(key, withDuplicateWarning(replacementIsBetter ? entry : existing));
      continue;
    }
    byLemma.set(key, entry);
  }

  const candidates = [];
  for (const entry of byLemma.values()) {
    const match = findMatch({ searchForm: entry.search_form, root, language, specialRootMatcher });
    if (!match) continue;
    candidates.push({
      word: entry.word,
      normalized: entry.normalized,
      search_form: entry.search_form,
      rank: entry.rank,
      frequency_score: entry.frequency_score,
      category_breakdown: isPlainObject(entry.category_breakdown) ? entry.category_breakdown : {},
      sources: entry.sources,
      warnings: runtimeWarningsForEntry(entry),
      total_ipm: totalIpm(entry),
      match
    });
  }
  candidates.sort(compareCandidates);
  diagnostics.matched = candidates.length;
  return { candidates: candidates.slice(0, maxCandidates), diagnostics };
}
