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
assert.match(ruSystem, /ТОЧНЫЙ АЛГОРИТМ ОБРАЗОВАНИЯ СУЩЕСТВИТЕЛЬНЫХ ОТ ГЛАГОЛОВ/);
assert.match(ruSystem, /Отбросить только конечную `r`/);
assert.match(ruSystem, /`nominar → nomin, nomine`/);
assert.match(ruSystem, /Если от такой темы образуется самостоятельное существительное без словообразовательного суффикса, добавляется окончание `-e`/);
assert.match(ruSystem, /Не добавляй к деривационной теме на `-t` окончание `-a`/);
assert.match(ruSystem, /Суффиксальное существительное не является вариантом простого существительного без суффикса/);
assert.match(ruSystem, /Пустой массив предпочтительнее выдуманных или сомнительных форм/);
assert.doesNotMatch(ruSystem, /VII\. СУЩЕСТВИТЕЛЬНЫЕ И ПРИЛАГАТЕЛЬНЫЕ БЕЗ УКАЗАННЫХ СУФФИКСОВ/);
assert.doesNotMatch(ruSystem, /Не выводи существительное `pesat`/);

assert.match(enSystem, /pesar → pesat-/);
assert.match(enSystem, /-mitter → -miss-/);
assert.match(enSystem, /consonant \+ `g`/);
assert.match(enSystem, /binding-context-marker/);
assert.match(enSystem, /EXACT ALGORITHM FOR FORMING NOUNS FROM VERBS/);
assert.match(enSystem, /Remove only final `r`/);
assert.match(enSystem, /`nominar → nomin, nomine`/);
assert.match(enSystem, /ending `-e` is added/);
assert.match(enSystem, /Do not add ending `-a` to a derivational stem ending in `-t`/);
assert.match(enSystem, /A suffixed noun is not another variant of the simple noun without a suffix/);
assert.match(enSystem, /An empty array is preferable to invented or doubtful forms/);
assert.doesNotMatch(enSystem, /VII\. NOUNS AND ADJECTIVES WITHOUT THE LISTED SUFFIXES/);
assert.doesNotMatch(enSystem, /Do not generate the noun `pesat`/);

assert.match(ruUser, /"candidate": "pesar"/);
assert.match(ruUser, /"interfaceLanguage": "ru"/);
assert.match(enUser, /"candidate": "pesar"/);
assert.match(enUser, /"interfaceLanguage": "en"/);

const apiSource = await readFile(new URL('../api/qwen-analyze.js', import.meta.url), 'utf8');
assert.match(apiSource, /buildAltervordesSystemPromptV2\(input\.interfaceLanguage, DERIVATION_CONTEXT\)/);
assert.match(apiSource, /buildAltervordesUserPromptV2\(input\)/);

console.log('Alter vordes localized prompt tests passed.');
