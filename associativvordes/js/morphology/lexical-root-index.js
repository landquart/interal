import { normalizeForMorphology } from './normalizer.js';

const ROOTS = new Map();

function bucket(language) {
  const code = String(language || 'en').toLowerCase();
  if (!ROOTS.has(code)) ROOTS.set(code, new Map());
  return ROOTS.get(code);
}

function addRoot(language, form, metadata = {}) {
  const normalized = normalizeForMorphology(form, language).normalized;
  if (!normalized) return;
  const map = bucket(language);
  const current = map.get(normalized);
  const candidate = {
    form: normalized,
    canonical: normalizeForMorphology(metadata.canonical || normalized, language).normalized,
    source: metadata.source || 'candidate_index',
    frequency: Number(metadata.frequency) || 0,
    confidence: Number.isFinite(Number(metadata.confidence)) ? Number(metadata.confidence) : 0.75,
    partOfSpeech: metadata.partOfSpeech || null
  };
  if (!current || candidate.confidence > current.confidence || candidate.frequency > current.frequency) map.set(normalized, candidate);
}

function stripKnownTail(value, config, language) {
  const results = new Set([value]);
  const tokens = [...(config.derivationalSuffixes || []), ...(config.inflectionalEndings || [])]
    .map(item => item.form)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const queue = [value];
  while (queue.length) {
    const current = queue.shift();
    for (const token of tokens) {
      if (!current.endsWith(token) || current.length - token.length < Number(config.lexicalRootRules?.minimumLength || 2)) continue;
      const next = current.slice(0, -token.length);
      if (!results.has(next)) { results.add(next); queue.push(next); }
    }
  }
  return [...results].map(item => normalizeForMorphology(item, language).normalized).filter(Boolean);
}

export function registerLexicalRootsFromEntries(language, entries = [], { prefix = '', config = {} } = {}) {
  const normalizedPrefix = normalizeForMorphology(prefix, language).normalized;
  for (const entry of Array.isArray(entries) ? entries : []) {
    const word = normalizeForMorphology(entry?.search_form || entry?.normalized || entry?.word, language).normalized;
    if (!word) continue;
    const base = normalizedPrefix && word.startsWith(normalizedPrefix) ? word.slice(normalizedPrefix.length) : word;
    for (const root of stripKnownTail(base, config, language)) {
      addRoot(language, root, { canonical: root, source: 'candidate_index', frequency: entry?.frequency_score, confidence: root === base ? 0.72 : 0.84 });
    }
  }
}

export function registerVerifiedLexicalRoots(language, roots = []) {
  for (const root of roots) addRoot(language, root, { source: 'manually_verified', confidence: 1 });
}

export function getRegisteredLexicalRoots(language) {
  return [...bucket(language).values()];
}

export function getLexicalRootCandidates(language, remainder, { config = {}, manuallyVerified = [] } = {}) {
  registerVerifiedLexicalRoots(language, manuallyVerified);
  const normalized = normalizeForMorphology(remainder, language).normalized;
  const minimum = Number(config.lexicalRootRules?.minimumLength || 3);
  const output = [];
  const seen = new Set();
  const add = candidate => {
    if (!candidate?.form || candidate.form.length < minimum || !normalized.startsWith(candidate.form) || seen.has(candidate.form)) return;
    seen.add(candidate.form);
    output.push(candidate);
  };
  for (const candidate of getRegisteredLexicalRoots(language)) add(candidate);
  for (let split = minimum; split <= normalized.length; split += 1) {
    add({ form: normalized.slice(0, split), canonical: normalized.slice(0, split), source: 'inferred_segmentation', frequency: 0, confidence: 0.55 });
  }
  return output.sort((a, b) => b.confidence - a.confidence || b.frequency - a.frequency || b.form.length - a.form.length || a.form.localeCompare(b.form));
}

export function clearLexicalRootIndexForTests() {
  ROOTS.clear();
}
