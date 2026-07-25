import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildAltervordesSystemPrompt,
  buildAltervordesUserPrompt
} from '../api/lib/altervordes-prompts.js';
import { sanitizeGeneratedDerivativeClaims } from '../api/lib/altervordes-noun-guard.js';

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
assert.match(ruSystem, /binding-context-marker/);
assert.match(ruSystem, /ПРОВЕРКА ДЕРИВАЦИОННОГО ПОТЕНЦИАЛА БЕЗ ГЕНЕРАЦИИ СЛОВ/);
assert.match(ruSystem, /В `derivation\.possibleDerivations` всегда возвращай пустой массив/);
assert.match(ruSystem, /не пиши ни одного нового слова/);
assert.match(ruSystem, /`-ment` отбрасывается только конечная `r` или `n`/);
assert.match(ruSystem, /`-ori\/a` является специальным вариантом, а не универсальным суффиксом со значением места/);
assert.match(ruSystem, /не создавай её/);

assert.match(enSystem, /EVALUATING DERIVATIONAL POTENTIAL WITHOUT GENERATING WORDS/);
assert.match(enSystem, /Always return an empty array `\[\]` in `derivation\.possibleDerivations`/);
assert.match(enSystem, /do not write any new word/);
assert.match(enSystem, /with `-ment`, only final `r` or `n` is removed/);
assert.match(enSystem, /`-ori\/a` is a special variant, not a universal place-forming suffix/);
assert.match(enSystem, /do not create it/);

assert.match(ruUser, /Не создавай и не перечисляй конкретные производные/);
assert.match(ruUser, /всегда верни пустой массив `\[\]`/);
assert.match(enUser, /Do not construct or list concrete derivatives/);
assert.match(enUser, /Always return an empty array `\[\]`/);

const unsafeResult = {
  decision: 'accepted',
  eligible: true,
  analysis: {
    derivationalPotential: "Существительные: 'testa', 'testat', 'testate', 'testator'; прилагательные: 'testal', 'testiv'."
  },
  derivation: {
    possibleDerivations: ['testa', 'testat', 'testate', 'testator', 'testation', 'testment']
  },
  shortConclusion: {
    en: 'The candidate can form testat and testator.',
    de: 'Die Formen testat und testator sind möglich.',
    fr: 'Les formes testat et testator sont possibles.',
    es: 'Las formas testat y testator son posibles.',
    it: 'Le forme testat e testator sono possibili.',
    ru: 'Возможны формы testat и testator.'
  }
};

const sanitized = sanitizeGeneratedDerivativeClaims(unsafeResult, baseInput);
assert.deepEqual(sanitized.derivation.possibleDerivations, []);
assert.doesNotMatch(sanitized.analysis.derivationalPotential, /testa|testat|testator|testment/i);
assert.match(sanitized.analysis.derivationalPotential, /Конкретные производные не перечисляются/);
assert.doesNotMatch(sanitized.shortConclusion.ru, /testat|testator/i);
assert.equal(Object.keys(sanitized.shortConclusion).sort().join(','), 'de,en,es,fr,it,ru');

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

console.log('Alter vordes prompt and derivative suppression tests passed.');
