import { buildSearchForm } from './search-normalizer.js';

const CYRILLIC_RE = /\p{Script=Cyrillic}/u;
const LATIN_RE = /\p{Script=Latin}/u;
const CROSS_LANGUAGE_RATIO = 8;
const CROSS_LANGUAGE_MIN_SCORE = 5;
const BARE_ROOT_RATIO = 2.5;
const BARE_ROOT_MIN_SCORE = 20;
const KNOWN_NONWORDS = Object.freeze({
  alter: Object.freeze({
    ru: new Set(['альтеро'])
  })
});

function finiteFrequency(candidate) {
  const values = [
    candidate?.frequency_score,
    candidate?.analysis?.frequency?.frequency_score,
    candidate?.frequencyProfile?.frequency_score
  ];
  for (const value of values) {
    const score = Number(value);
    if (Number.isFinite(score)) return score;
  }
  return null;
}

function spellingKey(value) {
  return String(value || '')
    .trim()
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{M}]+/gu, '');
}

function addEvidence(map, key, language, score) {
  if (!key || !Number.isFinite(score)) return;
  if (!map.has(key)) map.set(key, new Map());
  const byLanguage = map.get(key);
  const current = byLanguage.get(language);
  if (!Number.isFinite(current) || score > current) byLanguage.set(language, score);
}

export function buildCrossLanguageCandidateEvidence(candidatesByLanguage = {}, languages = Object.keys(candidatesByLanguage || {})) {
  const spelling = new Map();
  const search = new Map();
  for (const language of languages) {
    const candidates = Array.isArray(candidatesByLanguage?.[language]) ? candidatesByLanguage[language] : [];
    for (const candidate of candidates) {
      const score = finiteFrequency(candidate);
      if (!Number.isFinite(score)) continue;
      addEvidence(spelling, spellingKey(candidate?.word), language, score);
      addEvidence(search, buildSearchForm(candidate?.word || candidate?.search_form), language, score);
    }
  }
  return { spelling, search };
}

function strongestOtherLanguage(byLanguage, language) {
  let strongest = null;
  for (const [candidateLanguage, score] of byLanguage || []) {
    if (candidateLanguage === language || !Number.isFinite(score)) continue;
    if (!strongest || score > strongest.score) strongest = { language: candidateLanguage, score };
  }
  return strongest;
}

function unexpectedScriptReason(word, language) {
  const value = String(word || '');
  if (language === 'ru') {
    if (!CYRILLIC_RE.test(value) || LATIN_RE.test(value)) return 'unexpected_language_script';
    return null;
  }
  return CYRILLIC_RE.test(value) ? 'unexpected_language_script' : null;
}

export function deterministicCandidateRejection(candidate, language, root, evidence) {
  const scriptReason = unexpectedScriptReason(candidate?.word, language);
  if (scriptReason) return { reason: scriptReason };

  const knownNonwords = KNOWN_NONWORDS[buildSearchForm(root)]?.[language];
  if (knownNonwords?.has(spellingKey(candidate?.word))) return { reason: 'known_nonword' };

  const score = finiteFrequency(candidate);
  if (!Number.isFinite(score)) return { reason: 'frequency_score_missing' };

  const exactSpelling = strongestOtherLanguage(evidence?.spelling?.get(spellingKey(candidate?.word)), language);
  if (
    exactSpelling
    && exactSpelling.score >= CROSS_LANGUAGE_MIN_SCORE
    && exactSpelling.score >= Math.max(score * CROSS_LANGUAGE_RATIO, score + CROSS_LANGUAGE_MIN_SCORE)
  ) {
    return {
      reason: 'cross_language_frequency_dominance',
      dominant_language: exactSpelling.language,
      dominant_frequency_score: exactSpelling.score
    };
  }

  const candidateSearch = buildSearchForm(candidate?.word || candidate?.search_form);
  const normalizedRoot = buildSearchForm(root);
  if (candidateSearch && candidateSearch === normalizedRoot) {
    const sameRootElsewhere = strongestOtherLanguage(evidence?.search?.get(candidateSearch), language);
    if (
      sameRootElsewhere
      && sameRootElsewhere.score >= BARE_ROOT_MIN_SCORE
      && sameRootElsewhere.score >= Math.max(score * BARE_ROOT_RATIO, score + CROSS_LANGUAGE_MIN_SCORE)
    ) {
      return {
        reason: 'foreign_bare_root_dominance',
        dominant_language: sameRootElsewhere.language,
        dominant_frequency_score: sameRootElsewhere.score
      };
    }
  }

  return null;
}

export function applyDeterministicCandidateIntegrity(candidatesByLanguage = {}, {
  root = '',
  languages = Object.keys(candidatesByLanguage || {})
} = {}) {
  const evidence = buildCrossLanguageCandidateEvidence(candidatesByLanguage, languages);
  const diagnostics = {
    deterministicRejectedCount: 0,
    unexpectedLanguageScriptCount: 0,
    crossLanguageDominanceCount: 0,
    foreignBareRootCount: 0,
    knownNonwordCount: 0
  };
  const output = {};

  for (const language of languages) {
    const candidates = Array.isArray(candidatesByLanguage?.[language]) ? candidatesByLanguage[language] : [];
    output[language] = candidates.map(candidate => {
      const rejection = deterministicCandidateRejection(candidate, language, root, evidence);
      if (!rejection) return { ...candidate };
      diagnostics.deterministicRejectedCount += 1;
      if (rejection.reason === 'unexpected_language_script') diagnostics.unexpectedLanguageScriptCount += 1;
      if (rejection.reason === 'cross_language_frequency_dominance') diagnostics.crossLanguageDominanceCount += 1;
      if (rejection.reason === 'foreign_bare_root_dominance') diagnostics.foreignBareRootCount += 1;
      if (rejection.reason === 'known_nonword') diagnostics.knownNonwordCount += 1;
      return {
        ...candidate,
        automatic_selection_eligible: false,
        deterministic_candidate_validation: {
          accepted: false,
          language,
          ...rejection
        }
      };
    });
  }

  return { candidatesByLanguage: output, diagnostics };
}
