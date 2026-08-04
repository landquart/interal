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
  translationLanguage: 'ru',
  translationWord: 'альтернативный',
  targetMeaning: 'другой',
  transcriber(word) {
    transcriberCall = { word };
    return 'ˈalter';
  }
});

assert.deepEqual(transcriberCall, { word: 'alter' });
assert.deepEqual(metadata, {
  interal: {
    word: 'alter',
    ipa: 'ˈalter',
    type: 'root'
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
  translationLanguage: 'ru',
  translationWord: 'между',
  targetMeaning: 'между',
  transcriber: () => 'ˈinter'
});
assert.deepEqual(preposition.interal, { word: 'inter', ipa: 'ˈinter', type: 'preposition' });

assert.throws(
  () => makeAssociativeLemmaMetadata({
    word: 'alter',
    elementType: 'root',
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
assert.doesNotMatch(source, /partOfSpeech\s*[,):=]|part_of_speech/);

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
