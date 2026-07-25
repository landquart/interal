import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildAltervordesSystemPrompt,
  buildAltervordesUserPrompt
} from '../api/lib/altervordes-prompts.js';
import {
  findUnsupportedSimpleNounClaims,
  getUnsupportedSimpleNounForms,
  sanitizeUnsupportedSimpleNounClaims
} from '../api/lib/altervordes-noun-guard.js';

const context = {
  version: 'test-version',
  modifiedDeWahlRule: {
    marker: 'binding-context-marker'
  }
};

const baseInput = {
  translation: 'проверять',
  partOfSpeech: 'verb',
  candidate: 'testar',
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
assert.match(ruSystem, /ОБЩАЯ ПРОДУКТИВНАЯ МОДЕЛЬ ПРОСТОГО СУЩЕСТВИТЕЛЬНОГО/);
assert.match(ruSystem, /Эти две схемы являются общей продуктивной моделью/);
assert.match(ruSystem, /Запрещено считать, что к любой теме на `-t` можно добавить `-e`/);
assert.match(ruSystem, /не создают продуктивной модели/);
assert.match(ruSystem, /Примеры специальной формы являются закрытыми свидетельствами/);
assert.match(ruSystem, /Суффиксальное существительное не является вариантом простого существительного без суффикса/);
assert.match(ruSystem, /Пустой массив предпочтительнее выдуманных или сомнительных форм/);
assert.doesNotMatch(ruSystem, /Не выводи существительное `pesat`/);

assert.match(enSystem, /pesar → pesat-/);
assert.match(enSystem, /-mitter → -miss-/);
assert.match(enSystem, /consonant \+ `g`/);
assert.match(enSystem, /binding-context-marker/);
assert.match(enSystem, /GENERAL PRODUCTIVE PATTERN FOR A SIMPLE NOUN/);
assert.match(enSystem, /These two patterns are the general productive model/);
assert.match(enSystem, /Do not assume that adding `-e` to any `-t` stem/);
assert.match(enSystem, /do not establish a productive pattern/);
assert.match(enSystem, /closed evidence for the named families/);
assert.match(enSystem, /A suffixed noun is not another variant of the simple noun without a suffix/);
assert.match(enSystem, /An empty array is preferable to invented or doubtful forms/);
assert.doesNotMatch(enSystem, /Do not generate the noun `pesat`/);

assert.match(ruUser, /"candidate": "testar"/);
assert.match(ruUser, /"interfaceLanguage": "ru"/);
assert.match(enUser, /"candidate": "testar"/);
assert.match(enUser, /"interfaceLanguage": "en"/);

assert.deepEqual(getUnsupportedSimpleNounForms(baseInput), ['testat', 'testate']);
assert.deepEqual(getUnsupportedSimpleNounForms({ ...baseInput, candidate: 'dictar' }), ['dictat']);

const unsafeResult = {
  decision: 'accepted',
  eligible: true,
  analysis: {
    derivationalPotential: "Существительные: 'testa', 'testat', 'testate'; также возможны 'testator' и 'testation'."
  },
  derivation: {
    possibleDerivations: ['testa', 'testat', 'testate', 'testator', 'testation']
  },
  shortConclusion: {
    en: 'The noun testat is possible.', de: 'Testat ist möglich.', fr: 'Testat est possible.',
    es: 'Testat es posible.', it: 'Testat è possibile.', ru: 'Существительное testat возможно.'
  }
};

assert.deepEqual(findUnsupportedSimpleNounClaims(unsafeResult, baseInput), ['testat', 'testate']);
const sanitized = sanitizeUnsupportedSimpleNounClaims(unsafeResult, baseInput);
assert.deepEqual(sanitized.derivation.possibleDerivations, ['testa', 'testator', 'testation']);
assert.doesNotMatch(sanitized.analysis.derivationalPotential, /testat|testate/i);
assert.doesNotMatch(sanitized.shortConclusion.ru, /testat|testate/i);

const apiSource = await readFile(new URL('../api/qwen-analyze.js', import.meta.url), 'utf8');
assert.match(apiSource, /buildAltervordesSystemPromptV2\(input\.interfaceLanguage, DERIVATION_CONTEXT\)/);
assert.match(apiSource, /buildAltervordesUserPromptV2\(input\)/);

const publicEndpoint = await readFile(new URL('../api/altervordes-analyze.js', import.meta.url), 'utf8');
assert.match(publicEndpoint, /altervordes-analyze-guarded\.js/);

const guardedEndpoint = await readFile(new URL('../api/altervordes-analyze-guarded.js', import.meta.url), 'utf8');
assert.match(guardedEndpoint, /altervordes-analyze-core\.js/);
assert.match(guardedEndpoint, /sanitizeUnsupportedSimpleNounClaims/);

const coreEndpoint = await readFile(new URL('../api/altervordes-analyze-core.js', import.meta.url), 'utf8');
assert.match(coreEndpoint, /multilingualShortConclusion: true/);
assert.match(coreEndpoint, /buildAltervordesSystemPrompt/);

console.log('Alter vordes localized prompt and noun guard tests passed.');
