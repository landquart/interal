import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  AssociativeCardMetadataError,
  makeAssociativeLemmaMetadata
} from '../associativvordes/js/card-metadata.js';
import { languageTranslations } from '../scripts/lib/registry-translations.mjs';

let transcriberCall = null;
const metadata = makeAssociativeLemmaMetadata({
  word: 'alter',
  elementType: 'root',
  partOfSpeech: 'adjective',
  translationLanguage: 'ru',
  translationWord: 'альтернативный',
  targetMeaning: 'другой',
  transcriber(word, options) {
    transcriberCall = { word, options };
    return 'ˈalter';
  }
});

assert.deepEqual(transcriberCall, {
  word: 'alter',
  options: { partOfSpeech: 'adjective' }
});
assert.deepEqual(metadata, {
  interal: {
    word: 'alter',
    ipa: 'ˈalter',
    type: 'root',
    part_of_speech: 'adjective'
  },
  translation: {
    language: 'ru',
    word: 'альтернативный'
  },
  analysis_input: {
    language: 'ru',
    target_meaning: 'другой'
  }
});
assert.notEqual(metadata.translation.word, metadata.analysis_input.target_meaning);

const preposition = makeAssociativeLemmaMetadata({
  word: 'inter',
  elementType: 'preposition',
  partOfSpeech: '',
  translationLanguage: 'ru',
  translationWord: 'между',
  targetMeaning: 'между',
  transcriber: (_word, options) => options.partOfSpeech === 'preposition' ? 'ˈinter' : ''
});
assert.equal(preposition.interal.part_of_speech, 'preposition');

assert.throws(
  () => makeAssociativeLemmaMetadata({
    word: 'alter',
    elementType: 'root',
    translationLanguage: 'ru',
    translationWord: 'альтернативный',
    targetMeaning: 'другой'
  }),
  (error) => error instanceof AssociativeCardMetadataError && error.code === 'PART_OF_SPEECH_REQUIRED'
);
assert.throws(
  () => makeAssociativeLemmaMetadata({
    word: 'alter',
    elementType: 'root',
    partOfSpeech: 'adjective',
    translationLanguage: 'ru',
    translationWord: '',
    targetMeaning: 'другой'
  }),
  (error) => error instanceof AssociativeCardMetadataError && error.code === 'TRANSLATION_REQUIRED'
);
assert.throws(
  () => makeAssociativeLemmaMetadata({
    word: 'alter',
    elementType: 'root',
    partOfSpeech: 'adjective',
    translationLanguage: 'ru',
    translationWord: 'альтернативный',
    targetMeaning: 'другой',
    transcriber: () => ''
  }),
  (error) => error instanceof AssociativeCardMetadataError && error.code === 'IPA_UNAVAILABLE'
);

const source = await readFile('associativvordes/script.js', 'utf8');
assert.doesNotMatch(source, /translationWord\s*\|\|\s*state\.targetMeaning/);
assert.doesNotMatch(source, /targetMeaning\s*\|\|\s*state\.root/);
assert.doesNotMatch(source, /part_of_speech:[^\n]*'other'/);

assert.deepEqual(
  languageTranslations({
    vord_type: 'av',
    translation: { language: 'ru', word: 'альтернативный' },
    language_evidence: [
      { language: 'en', word: 'alternative' },
      { language: 'de', word: 'alter' }
    ]
  }),
  { ru: 'альтернативный' },
  'associative evidence never becomes a dictionary translation'
);

console.log('associativvordes card metadata tests passed');
