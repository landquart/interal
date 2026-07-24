import { findRootMatch, normalizeText } from './root-matcher.js';
import { acceptAffixBoundaryMatch } from './affix-boundary-index.js';
import { lexicalModelDescriptor, selectHighestFrequencyPerModel, compareRootMatchThenFrequency } from './candidate-model-family.js';

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

function findMatch({ searchForm, root, language, specialRootMatcher }) {
  if (specialRootMatcher) {
    const customSpecial = specialRootMatcher(language, searchForm, root);
    if (customSpecial) return typeof customSpecial === 'object'
      ? { type: 'special', distance: 0, similarity: 1, index: 0, ...customSpecial }
      : { type: 'special', distance: 0, similarity: 1, fragment: root, index: 0 };
  }
  const match = findRootMatch(searchForm, root, language || 'en');
  return acceptAffixBoundaryMatch(match, root) ? match : null;
}

export function isReliableFuzzyMorphemeAnalysis(analysis) {
  return Boolean(analysis
    && analysis.fallback !== true
    && analysis.analysis_confidence !== 'low'
    && analysis.diagnostic_reason !== 'morpheme_parse_fallback'
    && analysis.diagnostic_reason !== 'lexical_root_not_found'
    && analysis.best_analysis
    && analysis.best_analysis.morphotacticsValid !== false);
}

function withDuplicateWarning(entry) {
  return {
    ...entry,
    warnings: [...new Set([...(Array.isArray(entry.warnings) ? entry.warnings : []), 'duplicate_runtime_entry'])]
  };
}

export function findCandidatesForRoot({ entries, root, language = 'en', elementType = 'root', maxCandidates = Infinity, specialRootMatcher } = {}) {
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

  const matched = [];
  for (const entry of byLemma.values()) {
    const match = findMatch({ searchForm: entry.search_form, root, language, specialRootMatcher });
    if (!match) continue;
    const candidate = {
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
    };
    const model = lexicalModelDescriptor(candidate, root, language, elementType);
    candidate.model_family_key = model.key;
    candidate.model_key = model.key;
    candidate.model_label = model.label;
    candidate.morpheme_analysis = model.analysis;
    candidate.parser_version = model.analysis?.parser_version || candidate.parser_version;
    if (model.analysis?.diagnostic_reason?.startsWith('morpheme_parse_fallback')) candidate.warnings = [...new Set([...(candidate.warnings || []), 'morpheme_parse_fallback'])];
    if (match.type === 'fuzzy' && !isReliableFuzzyMorphemeAnalysis(model.analysis)) {
      reject(diagnostics, 'fuzzy_morphology_unverified');
      continue;
    }
    matched.push(candidate);
  }

  const grouped = selectHighestFrequencyPerModel(matched, root, language, elementType);
  if (grouped.dropped.length) diagnostics.modelDuplicates = grouped.dropped.length;
  for (const item of grouped.dropped) diagnostics.warnings.push({ reason: 'lower_priority_model_variant', word: item.word, model: item.model_family_key });

  grouped.candidates.sort(compareRootMatchThenFrequency);
  diagnostics.matched = grouped.candidates.length;
  return { candidates: grouped.candidates.slice(0, maxCandidates), diagnostics };
}
