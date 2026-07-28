import { transcribeInteral } from '../../shared/interal-ipa.mjs';

export const ASSOCIATIVE_ROOT_PARTS_OF_SPEECH = Object.freeze([
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'conjunction',
  'particle',
  'numeral',
  'other'
]);

const ROOT_POS_SET = new Set(ASSOCIATIVE_ROOT_PARTS_OF_SPEECH);

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
  partOfSpeech,
  translationLanguage,
  translationWord,
  targetMeaning,
  transcriber = transcribeInteral
} = {}) {
  const normalizedWord = requiredText(word, 'ROOT_REQUIRED', 'interal.word');
  const type = elementType === 'preposition' ? 'preposition' : 'root';
  const selectedPartOfSpeech = type === 'preposition'
    ? 'preposition'
    : requiredText(partOfSpeech, 'PART_OF_SPEECH_REQUIRED', 'interal.part_of_speech');
  if (type === 'root' && !ROOT_POS_SET.has(selectedPartOfSpeech)) {
    throw new AssociativeCardMetadataError('PART_OF_SPEECH_REQUIRED', 'interal.part_of_speech has an invalid value');
  }
  const language = requiredText(translationLanguage, 'TRANSLATION_REQUIRED', 'translation.language');
  const dictionaryTranslation = requiredText(translationWord, 'TRANSLATION_REQUIRED', 'translation.word');
  const analysisMeaning = requiredText(targetMeaning, 'TARGET_MEANING_REQUIRED', 'analysis_input.target_meaning');

  let ipa = '';
  try {
    ipa = String(transcriber(normalizedWord, { partOfSpeech: selectedPartOfSpeech }) || '').trim();
  } catch (error) {
    throw new AssociativeCardMetadataError('IPA_UNAVAILABLE', error?.message || 'IPA transcription failed');
  }
  if (!ipa) throw new AssociativeCardMetadataError('IPA_UNAVAILABLE', 'interal.ipa is required');

  return {
    interal: {
      word: normalizedWord,
      ipa,
      type,
      part_of_speech: selectedPartOfSpeech
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
