import { transcribeInteral } from '../../shared/interal-ipa.mjs';

export class AssociativeCardMetadataError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AssociativeCardMetadataError';
    this.code = code;
  }
}

function requiredText(value, code, label) {
  const text = String(value || '').trim();
  if (!text) throw new AssociativeCardMetadataError(code, `${label} is required`);
  return text;
}

export function makeAssociativeLemmaMetadata({
  word,
  elementType = 'root',
  translationLanguage,
  translationWord,
  targetMeaning,
  transcriber = transcribeInteral
} = {}) {
  const normalizedWord = requiredText(word, 'ROOT_REQUIRED', 'interal.word');
  const type = elementType === 'preposition' ? 'preposition' : 'root';
  const language = requiredText(translationLanguage, 'TRANSLATION_REQUIRED', 'translation.language');
  const dictionaryTranslation = requiredText(translationWord, 'TRANSLATION_REQUIRED', 'translation.word');
  const analysisMeaning = requiredText(targetMeaning, 'TARGET_MEANING_REQUIRED', 'analysis_input.target_meaning');

  let ipa = '';
  try {
    ipa = String(transcriber(normalizedWord) || '').trim();
  } catch (error) {
    throw new AssociativeCardMetadataError('IPA_UNAVAILABLE', error?.message || 'IPA transcription failed');
  }
  if (!ipa) throw new AssociativeCardMetadataError('IPA_UNAVAILABLE', 'interal.ipa is required');

  return {
    interal: {
      word: normalizedWord,
      ipa,
      type
    },
    translation: {
      language,
      word: dictionaryTranslation
    },
    analysis_input: {
      language,
      target_meaning: analysisMeaning
    }
  };
}
