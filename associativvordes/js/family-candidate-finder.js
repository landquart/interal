import { normalizeText } from './root-matcher.js';
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

function sourceIpm(source) {
  return typeof source?.ipm === 'number' && Number.isFinite(source.ipm) ? source.ipm : 0;
}

function totalIpm(entry) {
  return Array.isArray(entry.sources) ? entry.sources.reduce((sum, source) => sum + sourceIpm(source), 0) : 0;
}

function validEntry(entry, language, diagnostics) {
  diagnostics.inspected += 1;
  if (!isPlainObject(entry)) return reject(diagnostics, 'not_object'), false;
  if (typeof entry.word !== 'string' || !entry.word.trim()) return reject(diagnostics, 'word_empty'), false;
  if (typeof entry.search_form !== 'string' || !entry.search_form.trim()) return reject(diagnostics, 'search_form_empty'), false;
  if (!Array.isArray(entry.sources) || !entry.sources.length) return reject(diagnostics, 'sources_missing'), false;
  if (!Number.isFinite(Number(entry.frequency_score))) return reject(diagnostics, 'frequency_score_not_finite'), false;
  if (!entry.match || entry.match.type !== 'family' || !entry.match.family_id) return reject(diagnostics, 'family_match_missing'), false;
  if (entry.language && language && entry.language !== language) return reject(diagnostics, 'language_mismatch'), false;
  return Boolean(normalizedLemma(entry)) || (reject(diagnostics, 'normalized_empty'), false);
}

function runtimeWarnings(entry) {
  const warnings = new Set(Array.isArray(entry.warnings) ? entry.warnings : []);
  if (Number(entry.frequency_score) === 0) warnings.add('candidate_found_but_frequency_zero');
  if (!entry.family_confidence || entry.family_confidence === 'C') warnings.add('family_requires_review');
  return [...warnings];
}

export function findCandidatesForFamily({ entries, root, language = 'en', elementType = 'root', maxCandidates = Infinity, groupModels = true } = {}) {
  if (!Array.isArray(entries)) throw new TypeError('findCandidatesForFamily requires entries to be an array.');
  if (typeof root !== 'string' || !root.trim()) throw new TypeError('findCandidatesForFamily requires a non-empty root.');
  if (maxCandidates !== Infinity && (!Number.isInteger(maxCandidates) || maxCandidates < 0)) throw new TypeError('maxCandidates must be a non-negative integer.');

  const diagnostics = createDiagnostics();
  const byLemma = new Map();
  for (const entry of entries) {
    if (!validEntry(entry, language, diagnostics)) continue;
    const key = `${language}:${normalizedLemma(entry)}`;
    const existing = byLemma.get(key);
    if (!existing || Number(entry.frequency_score) > Number(existing.frequency_score)) byLemma.set(key, entry);
    else diagnostics.duplicates += 1;
  }

  const matched = [];
  for (const entry of byLemma.values()) {
    const candidate = {
      word: entry.word,
      normalized: entry.normalized,
      search_form: entry.search_form,
      rank: entry.rank,
      frequency_score: Number(entry.frequency_score),
      category_breakdown: isPlainObject(entry.category_breakdown) ? entry.category_breakdown : {},
      sources: entry.sources,
      warnings: runtimeWarnings(entry),
      total_ipm: totalIpm(entry),
      family_id: entry.family_id,
      family_ids: entry.family_ids || [entry.family_id],
      family_label: entry.family_label,
      family_confidence: entry.family_confidence,
      family_aliases: entry.family_aliases || [],
      match: entry.match
    };
    const model = lexicalModelDescriptor(candidate, root, language, elementType);
    candidate.model_family_key = model.key;
    candidate.model_key = model.key;
    candidate.model_label = model.label;
    candidate.morpheme_analysis = model.analysis;
    candidate.parser_version = model.analysis?.parser_version || candidate.parser_version;
    if (model.analysis?.diagnostic_reason?.startsWith('morpheme_parse_fallback')) {
      candidate.warnings = [...new Set([...(candidate.warnings || []), 'morpheme_parse_fallback'])];
    }
    matched.push(candidate);
  }

  const grouped = groupModels ? selectHighestFrequencyPerModel(matched, root, language, elementType) : { candidates: matched, dropped: [] };
  if (grouped.dropped.length) diagnostics.modelDuplicates = grouped.dropped.length;
  for (const item of grouped.dropped) diagnostics.warnings.push({ reason: 'lower_priority_model_variant', word: item.word, model: item.model_family_key });
  grouped.candidates.sort(compareRootMatchThenFrequency);
  diagnostics.matched = grouped.candidates.length;
  return { candidates: grouped.candidates.slice(0, maxCandidates), diagnostics };
}
