export const CONTROL_LANGUAGE_DEMOGRAPHICS = Object.freeze({
  en: Object.freeze({ code: 'en', name: 'English', group: 'Germanic', speakers: 1_493_000_000 }),
  de: Object.freeze({ code: 'de', name: 'German', group: 'Germanic', speakers: 133_000_000 }),
  fr: Object.freeze({ code: 'fr', name: 'French', group: 'Romance', speakers: 334_000_000 }),
  es: Object.freeze({ code: 'es', name: 'Spanish', group: 'Romance', speakers: 561_000_000 }),
  it: Object.freeze({ code: 'it', name: 'Italian', group: 'Romance', speakers: 66_000_000 }),
  ru: Object.freeze({ code: 'ru', name: 'Russian', group: 'Slavic', speakers: 210_000_000 })
});

export const CONTROL_LANGUAGE_CODES = Object.freeze(Object.keys(CONTROL_LANGUAGE_DEMOGRAPHICS));
export const CONTROL_LANGUAGES = Object.freeze(CONTROL_LANGUAGE_CODES.map((code) => CONTROL_LANGUAGE_DEMOGRAPHICS[code]));

export class MissingSpeakerCountError extends Error {
  constructor(language) {
    super(`Missing speaker count N for represented control language: ${language || 'unknown'}`);
    this.name = 'MissingSpeakerCountError';
    this.code = 'MISSING_LANGUAGE_SPEAKERS';
    this.language = language || null;
  }
}

export function requireSpeakerCount(language) {
  const speakers = CONTROL_LANGUAGE_DEMOGRAPHICS[language]?.speakers;
  if (!Number.isFinite(speakers) || speakers <= 0) throw new MissingSpeakerCountError(language);
  return speakers;
}

export function calculateDirectDemographicAverage(rows = [], averageField = 'average') {
  let speakersTotal = 0;
  let weightedScoreTotal = 0;
  for (const row of rows) {
    const speakers = Number(row?.speakers);
    const average = Number(row?.[averageField]);
    if (!Number.isFinite(speakers) || speakers <= 0) throw new MissingSpeakerCountError(row?.language);
    if (!Number.isFinite(average)) continue;
    speakersTotal += speakers;
    weightedScoreTotal += speakers * average;
  }
  return {
    speakersTotal,
    weightedScoreTotal,
    score: speakersTotal > 0 ? weightedScoreTotal / speakersTotal : null
  };
}
