import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  calculateFinalAssociation,
  calculateLanguageScore
} from '../associativvordes/js/association-analyzer.js';
import {
  calculateAssociativeAffix,
  normalizeIpmScore
} from '../shared/associative-affix-calculation.mjs';
import {
  CONTROL_LANGUAGE_DEMOGRAPHICS,
  calculateDirectDemographicAverage
} from '../shared/control-language-demographics.mjs';

const example = calculateDirectDemographicAverage([
  { language: 'one', speakers: 100, average: 40 },
  { language: 'two', speakers: 200, average: 50 },
  { language: 'three', speakers: 700, average: 60 }
]);
assert.equal(example.score, 56, 'the methodology example is weighted directly by N');
assert.equal(example.speakersTotal, 1000);
assert.equal(example.weightedScoreTotal, 56_000);
const affixFormulaExample = calculateDirectDemographicAverage([
  { language: 'one', speakers: 100, averageF: 40 },
  { language: 'two', speakers: 200, averageF: 50 },
  { language: 'three', speakers: 700, averageF: 60 }
], 'averageF');
assert.equal(affixFormulaExample.score, 56, 'the same direct-N formula applies to FAa with F-bar');

const languages = [
  { code: 'en', group: 'Germanic' },
  { code: 'de', group: 'Germanic' },
  { code: 'fr', group: 'Romance' }
];
const result = calculateFinalAssociation({
  languages,
  languageResults: [
    { normalized: 40, sum: 80, count: 2, semanticConfirmed: true },
    { normalized: 80, sum: 80, count: 1, semanticConfirmed: true },
    { normalized: null, sum: null, count: 0, semanticConfirmed: false }
  ]
});
const enN = CONTROL_LANGUAGE_DEMOGRAPHICS.en.speakers;
const deN = CONTROL_LANGUAGE_DEMOGRAPHICS.de.speakers;
assert.equal(result.speakersTotal, enN + deN, 'denominator contains only represented languages');
assert.equal(result.weightedScoreTotal, enN * 40 + deN * 80);
assert.equal(result.finalAssociation, (enN * 40 + deN * 80) / (enN + deN));
assert.ok(result.finalAssociation < 60, 'the language with the larger N has the stronger influence');
assert.equal(result.languageScores[2].speakers, undefined, 'a language without selected derivatives is not represented');
assert.deepEqual(result.languageAverageP, { en: 40, de: 80 });

const withAssociationThreshold = calculateFinalAssociation({
  languages,
  languageResults: [
    { normalized: 50, count: 1, associationNormalized: 34, semanticConfirmed: true },
    { normalized: 50, count: 1, associationNormalized: 34, semanticConfirmed: true },
    { normalized: 50, count: 1, associationNormalized: 34, semanticConfirmed: true }
  ]
});
assert.equal(withAssociationThreshold.finalAssociation, 50);
assert.equal(withAssociationThreshold.averageAssociation, 34);
assert.equal(withAssociationThreshold.accepted, false, 'weighted mean A below 35 rejects even when FAv passes');

const allThresholdsPass = calculateFinalAssociation({
  languages,
  languageResults: [
    { normalized: 50, count: 1, associationNormalized: 35, semanticConfirmed: true },
    { normalized: 50, count: 1, associationNormalized: 35, semanticConfirmed: true },
    { normalized: 50, count: 1, associationNormalized: 35, semanticConfirmed: true }
  ]
});
assert.equal(allThresholdsPass.averageAssociation, 35);
assert.equal(allThresholdsPass.accepted, true);

const derivativeAverage = calculateLanguageScore([
  { selected: true, final_score: 20, association_score: 40 },
  { selected: true, final_score: 50, association_score: 50 },
  { selected: false, final_score: 100 }
]);
assert.equal(derivativeAverage.normalized, 35, 'P-bar uses the number of actually selected derivatives');
assert.equal(derivativeAverage.count, 2);
assert.equal(derivativeAverage.associationNormalized, 45, 'A-bar uses the same selected derivatives as P-bar');

const incompleteAssociation = calculateLanguageScore([
  { selected: true, final_score: 40, association_score: 50 },
  { selected: true, final_score: 40 }
]);
assert.equal(incompleteAssociation.associationNormalized, null, 'A-bar is unavailable if any selected derivative lacks A');

assert.throws(
  () => calculateFinalAssociation({ languages: [{ code: 'el', group: 'Hellenic' }], languageResults: [{ normalized: 50, sum: 50, count: 1 }] }),
  error => error?.code === 'MISSING_LANGUAGE_SPEAKERS',
  'a represented language without N raises a diagnostic error'
);

const affix = calculateAssociativeAffix({
  en: [{ word: 'en-one', ipm: 1 }, { word: 'en-two', ipm: 2 }],
  de: [{ word: 'de-one', ipm: 3 }],
  fr: [{ word: 'fr-one', ipm: 4 }]
});
assert.equal(normalizeIpmScore(3), Math.log10(4) / Math.log10(301) * 100, 'affix F uses the specified logarithmic normalization');
assert.equal(affix.representedLanguages, 3);
assert.equal(affix.representedLanguageGroups, 2);
assert.equal(affix.languageTotalIpm.en, 3, '3 IPM is checked by the per-language sum');
assert.equal(affix.languageAverageF.en, (normalizeIpmScore(1) + normalizeIpmScore(2)) / 2, 'F-bar uses the number of actually selected words');
assert.equal(affix.speakersTotal, enN + deN + CONTROL_LANGUAGE_DEMOGRAPHICS.fr.speakers);
assert.equal(affix.accepted, true);

const oneLanguageBelowIpm = calculateAssociativeAffix({
  en: [{ word: 'en', ipm: 3 }],
  de: [{ word: 'de', ipm: 2.99 }],
  fr: [{ word: 'fr', ipm: 3 }]
});
assert.equal(oneLanguageBelowIpm.criteria.minimum_ipm_each_language, false, '3 IPM is enforced separately for every represented language');
assert.equal(oneLanguageBelowIpm.accepted, false);

const belowAffixThreshold = calculateAssociativeAffix({
  en: Array.from({ length: 5 }, (_, index) => ({ word: `en-${index}`, ipm: 0.6 })),
  de: Array.from({ length: 5 }, (_, index) => ({ word: `de-${index}`, ipm: 0.6 })),
  fr: Array.from({ length: 5 }, (_, index) => ({ word: `fr-${index}`, ipm: 0.6 }))
});
assert.equal(belowAffixThreshold.criteria.minimum_ipm_each_language, true);
assert.ok(belowAffixThreshold.FAa < 15);
assert.equal(belowAffixThreshold.accepted, false, 'FAa below 15% is rejected independently of IPM totals');

const insufficientBreadth = calculateAssociativeAffix({
  en: [{ word: 'en', ipm: 300 }],
  de: [{ word: 'de', ipm: 300 }]
});
assert.ok(insufficientBreadth.FAa >= 15);
assert.equal(insufficientBreadth.accepted, false, 'a score above threshold does not replace breadth requirements');

const associativeWordUi = await readFile('associativvordes/script.js', 'utf8');
for (const field of ['representedLanguages', 'representedLanguageGroups', 'speakersTotal', 'weightedScoreTotal', 'languageAverageP', 'languageAverageA', 'FAv', 'AAverage', 'threshold', 'associationThreshold', 'accepted']) {
  assert.match(associativeWordUi, new RegExp(`\\b${field}\\b`), `associative word JSON retains ${field}`);
}
const affixUi = await readFile('affixes/script.js', 'utf8');
const affixCalculationSource = await readFile('shared/associative-affix-calculation.mjs', 'utf8');
for (const field of ['representedLanguages', 'representedLanguageGroups', 'speakersTotal', 'weightedScoreTotal', 'languageAverageF', 'languageTotalIpm', 'FAa', 'threshold', 'accepted']) {
  assert.match(affixUi + affixCalculationSource, new RegExp(`\\b${field}\\b`), `associative affix JSON retains ${field}`);
}

console.log('association demographic weighting tests passed');
