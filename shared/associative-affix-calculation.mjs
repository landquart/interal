import {
  CONTROL_LANGUAGE_CODES,
  CONTROL_LANGUAGE_DEMOGRAPHICS,
  calculateDirectDemographicAverage,
  requireSpeakerCount
} from './control-language-demographics.mjs';

export const ASSOCIATIVE_AFFIX_THRESHOLD = 15;
export const ASSOCIATIVE_AFFIX_MIN_IPM = 3;
export const ASSOCIATIVE_AFFIX_MAX_WORDS = 5;

export function normalizeIpmScore(ipm) {
  const value = Number(ipm);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(100, (Math.log10(1 + value) / Math.log10(301)) * 100);
}

function normalizeFrequencyWord(item) {
  const source = typeof item === 'string' ? { word: item } : (item && typeof item === 'object' ? item : {});
  const word = String(source.word || source.lemma || source.form || '').trim();
  const ipm = Number(source.ipm ?? source.IPM ?? source.combined_ipm);
  if (!word || !Number.isFinite(ipm) || ipm < 0) return null;
  return { ...source, word, ipm, F: normalizeIpmScore(ipm) };
}

export function calculateAssociativeAffix(frequencyWords = {}) {
  const languageDetails = [];
  const normalizedFrequencyWords = {};

  for (const code of CONTROL_LANGUAGE_CODES) {
    const selectedWords = (Array.isArray(frequencyWords?.[code]) ? frequencyWords[code] : [])
      .map(normalizeFrequencyWord)
      .filter(Boolean)
      .sort((a, b) => b.ipm - a.ipm || a.word.localeCompare(b.word))
      .slice(0, ASSOCIATIVE_AFFIX_MAX_WORDS);
    normalizedFrequencyWords[code] = selectedWords;
    if (!selectedWords.length) continue;

    const speakers = requireSpeakerCount(code);
    const totalIpm = selectedWords.reduce((sum, item) => sum + item.ipm, 0);
    const averageF = selectedWords.reduce((sum, item) => sum + item.F, 0) / selectedWords.length;
    languageDetails.push({
      language: code,
      group: CONTROL_LANGUAGE_DEMOGRAPHICS[code].group,
      speakers,
      selectedCount: selectedWords.length,
      totalIpm,
      averageF,
      weightedScore: speakers * averageF,
      words: selectedWords
    });
  }

  const representedLanguages = languageDetails.length;
  const representedLanguageGroups = new Set(languageDetails.map((item) => item.group)).size;
  const weighted = calculateDirectDemographicAverage(languageDetails, 'averageF');
  const { speakersTotal, weightedScoreTotal } = weighted;
  const FAa = weighted.score;
  const languageAverageF = Object.fromEntries(languageDetails.map((item) => [item.language, item.averageF]));
  const languageTotalIpm = Object.fromEntries(languageDetails.map((item) => [item.language, item.totalIpm]));
  const criteria = {
    minimum_languages: representedLanguages >= 3,
    minimum_language_groups: representedLanguageGroups >= 2,
    minimum_ipm_each_language: representedLanguages > 0 && languageDetails.every((item) => item.totalIpm >= ASSOCIATIVE_AFFIX_MIN_IPM),
    one_to_five_words_each_language: representedLanguages > 0 && languageDetails.every((item) => item.selectedCount >= 1 && item.selectedCount <= ASSOCIATIVE_AFFIX_MAX_WORDS),
    FAa_threshold: Number.isFinite(FAa) && FAa >= ASSOCIATIVE_AFFIX_THRESHOLD
  };
  const accepted = criteria.minimum_languages
    && criteria.minimum_language_groups
    && criteria.minimum_ipm_each_language
    && criteria.one_to_five_words_each_language
    && criteria.FAa_threshold;

  return {
    representedLanguages,
    representedLanguageGroups,
    speakersTotal,
    weightedScoreTotal,
    languageAverageF,
    languageTotalIpm,
    languageDetails,
    normalizedFrequencyWords,
    FAa,
    threshold: ASSOCIATIVE_AFFIX_THRESHOLD,
    criteria,
    accepted
  };
}
