import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildAltervordesSystemPrompt,
  buildAltervordesUserPrompt
} from '../api/lib/altervordes-prompts.js';

const context = {
  version: 'test-version',
  marker: 'multilingual-context-marker'
};

const input = {
  translation: 'проверять',
  interfaceLanguage: 'ru',
  partOfSpeech: 'verb',
  candidate: 'testar',
  comment: ''
};

const multilingualOptions = { multilingualShortConclusion: true };
const ruSystem = buildAltervordesSystemPrompt('ru', context, multilingualOptions);
const enSystem = buildAltervordesSystemPrompt('en', context, multilingualOptions);
const ruUser = buildAltervordesUserPrompt(input, multilingualOptions);
const legacySystem = buildAltervordesSystemPrompt('ru', context);

for (const code of ['en', 'de', 'fr', 'es', 'it', 'ru']) {
  assert.match(ruSystem, new RegExp(`"${code}": ""`));
  assert.match(enSystem, new RegExp(`"${code}": ""`));
}

assert.match(ruSystem, /шесть кратких, естественных и семантически эквивалентных версий/);
assert.match(enSystem, /six concise, natural, and semantically equivalent versions/);
assert.match(ruUser, /shortConclusion обязательно заполни на всех шести контрольных языках/);
assert.match(ruSystem, /multilingual-context-marker/);
assert.match(legacySystem, /"shortConclusion": ""/);
assert.doesNotMatch(legacySystem, /шесть кратких, естественных и семантически эквивалентных версий/);

const endpointModule = await import('../api/altervordes-analyze.js');
assert.equal(typeof endpointModule.default, 'function');

const endpointSource = await readFile(new URL('../server/altervordes-analyze-handler.js', import.meta.url), 'utf8');
assert.match(endpointSource, /const CONCLUSION_CODES = \['en', 'de', 'fr', 'es', 'it', 'ru'\]/);
assert.match(endpointSource, /multilingualShortConclusion: true/);
assert.match(endpointSource, /AI returned missing shortConclusion translation/);

const pageSource = await readFile(new URL('../altervordes/script.js', import.meta.url), 'utf8');
assert.doesNotThrow(() => new Function(pageSource));
assert.match(pageSource, /\/api\/altervordes-analyze/);
assert.match(pageSource, /function localizedShortConclusion/);
assert.match(pageSource, /base\.short_conclusion=lastAnalysis\.shortConclusion/);

console.log('Alter vordes multilingual conclusion tests passed.');
