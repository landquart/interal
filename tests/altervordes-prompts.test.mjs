import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildAltervordesSystemPrompt,
  buildAltervordesUserPrompt
} from '../api/lib/altervordes-prompts.js';

const context = {
  version: 'test-version',
  modifiedDeWahlRule: {
    marker: 'binding-context-marker'
  }
};

const baseInput = {
  translation: 'весить',
  partOfSpeech: 'verb',
  candidate: 'pesar',
  comment: '',
  interfaceLanguage: 'ru'
};

const ruSystem = buildAltervordesSystemPrompt('ru', context);
const enSystem = buildAltervordesSystemPrompt('en', context);
const ruUser = buildAltervordesUserPrompt(baseInput);
const enUser = buildAltervordesUserPrompt({ ...baseInput, interfaceLanguage: 'en' });

for (const prompt of [ruSystem, enSystem, ruUser, enUser]) {
  assert.equal(prompt.includes('{{INTERAL_DERIVATION_CONTEXT}}'), false);
  assert.equal(prompt.includes('{{INPUT_JSON}}'), false);
}

assert.match(ruSystem, /Интераля/);
assert.match(ruSystem, /Никогда не пиши «Интерала»/);
assert.match(ruSystem, /pesar → pesat-/);
assert.match(ruSystem, /-mitter → -miss-/);
assert.match(ruSystem, /согласная \+ g/);
assert.match(ruSystem, /binding-context-marker/);

assert.match(enSystem, /pesar → pesat-/);
assert.match(enSystem, /-mitter → -miss-/);
assert.match(enSystem, /consonant \+ `g`/);
assert.match(enSystem, /binding-context-marker/);

assert.match(ruUser, /"candidate": "pesar"/);
assert.match(ruUser, /"interfaceLanguage": "ru"/);
assert.match(enUser, /"candidate": "pesar"/);
assert.match(enUser, /"interfaceLanguage": "en"/);

const apiSource = await readFile(new URL('../api/qwen-analyze.js', import.meta.url), 'utf8');
assert.match(apiSource, /buildAltervordesSystemPromptV2\(input\.interfaceLanguage, DERIVATION_CONTEXT\)/);
assert.match(apiSource, /buildAltervordesUserPromptV2\(input\)/);

console.log('Alter vordes localized prompt tests passed.');
