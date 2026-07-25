import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildAltervordesSystemPrompt,
  buildAltervordesUserPrompt
} from '../api/lib/altervordes-prompts.js';
import {
  hasDerivationalPotential,
  sanitizeGeneratedDerivativeClaims
} from '../server/altervordes-noun-guard.js';

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

assert.match(ruSystem, /ОЦЕНКА ДЕРИВАЦИОННОГО ПОТЕНЦИАЛА/);
assert.match(ruSystem, /возвращай ровно одно из двух значений/);
assert.match(ruSystem, /`Есть\.`/);
assert.match(ruSystem, /`Нет\.`/);
assert.match(ruSystem, /запрещены любые объяснения, ссылки, номера параграфов/);
assert.match(ruSystem, /пустой массив `\[\]`/);

assert.match(enSystem, /EVALUATING DERIVATIONAL POTENTIAL/);
assert.match(enSystem, /return exactly one of these two values/);
assert.match(enSystem, /`Yes\.`/);
assert.match(enSystem, /`No\.`/);
assert.match(enSystem, /No explanations, references, paragraph numbers/);
assert.match(enSystem, /empty array `\[\]`/);

assert.match(ruUser, /верни только `Есть\.` или `Нет\.`/);
assert.match(ruUser, /без объяснений, ссылок, примеров и уточнений/);
assert.match(enUser, /return only `Yes\.` or `No\.`/);
assert.match(enUser, /without explanations, references, examples, or qualifications/);

const resultWithPotential = {
  decision: 'accepted',
  eligible: true,
  analysis: {
    derivationalPotential: "Существительные: 'testa', 'testator'; прилагательное: 'testal'."
  },
  derivation: {
    canFormVerb: true,
    canFormNoun: true,
    canFormAdjective: false,
    possibleDerivations: ['testa', 'testator', 'testal']
  },
  shortConclusion: {
    en: 'The candidate can form testator.',
    de: 'Testator ist möglich.',
    fr: 'Testator est possible.',
    es: 'Testator es posible.',
    it: 'Testator è possibile.',
    ru: 'Возможна форма testator.'
  }
};

assert.equal(hasDerivationalPotential(resultWithPotential, baseInput), true);
const sanitizedWithPotential = sanitizeGeneratedDerivativeClaims(resultWithPotential, baseInput);
assert.equal(sanitizedWithPotential.analysis.derivationalPotential, 'Есть.');
assert.deepEqual(sanitizedWithPotential.derivation.possibleDerivations, []);
assert.doesNotMatch(sanitizedWithPotential.shortConclusion.ru, /testator/i);

const resultWithoutPotential = {
  decision: 'accepted',
  eligible: true,
  analysis: { derivationalPotential: 'Подробное объяснение.' },
  derivation: {
    canFormVerb: true,
    canFormNoun: false,
    canFormAdjective: false,
    possibleDerivations: ['invented']
  },
  shortConclusion: {}
};

assert.equal(hasDerivationalPotential(resultWithoutPotential, baseInput), false);
const sanitizedWithoutPotential = sanitizeGeneratedDerivativeClaims(resultWithoutPotential, baseInput);
assert.equal(sanitizedWithoutPotential.analysis.derivationalPotential, 'Нет.');
assert.deepEqual(sanitizedWithoutPotential.derivation.possibleDerivations, []);

const englishWithoutPotential = sanitizeGeneratedDerivativeClaims(resultWithoutPotential, {
  ...baseInput,
  interfaceLanguage: 'en'
});
assert.equal(englishWithoutPotential.analysis.derivationalPotential, 'No.');
assert.equal(Object.keys(englishWithoutPotential.shortConclusion).sort().join(','), 'de,en,es,fr,it,ru');

const publicEndpoint = await readFile(new URL('../api/altervordes-analyze.js', import.meta.url), 'utf8');
assert.match(publicEndpoint, /\.\.\/server\/altervordes-analyze-handler\.js/);

const serverHandler = await readFile(new URL('../server/altervordes-analyze-handler.js', import.meta.url), 'utf8');
assert.match(serverHandler, /sanitizeGeneratedDerivativeClaims/);
assert.match(serverHandler, /multilingualShortConclusion: true/);
assert.match(serverHandler, /buildAltervordesSystemPrompt/);

console.log('Alter vordes binary derivational potential tests passed.');
