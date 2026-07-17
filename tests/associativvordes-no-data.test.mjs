import assert from 'node:assert/strict';
import {
  calculateFinalAssociation,
  calculateLanguageScore,
  canCreateAssociativeJsonCard,
  finalAssociationPassesThreshold,
  finalAssociationRejectionReasons
} from '../associativvordes/js/association-analyzer.js';
import { formatMetric } from '../associativvordes/js/render-results.js';

const languages = [
  { code: 'en', group: 'germanic' },
  { code: 'de', group: 'germanic' },
  { code: 'fr', group: 'romance' }
];

const empty = calculateFinalAssociation({ languages, languageResults: languages.map(() => ({ sum: null, normalized: null, count: 0 })) });
assert.equal(empty.finalAssociation, null, 'empty languages produce no FA');
assert.equal(empty.totalAssociation, null, 'empty language sum is not a completed TA');
assert.equal(empty.hasCalculatedData, false, 'empty languages have no calculated data');
assert.equal(empty.semanticConfirmed, false, 'empty languages do not confirm semantics');
assert.equal(empty.accepted, false, 'empty languages are rejected without numeric FA');

const zeroLanguage = calculateLanguageScore([{ selected: true, final_score: 0 }], { scoreGetter: item => item.final_score });
assert.deepEqual(zeroLanguage, { sum: 0, normalized: 0, count: 1 }, 'calculated zero word stays a real zero');
const realZeroFinal = calculateFinalAssociation({ languages: [languages[0]], languageResults: [{ sum: 0, normalized: 0, count: 1, semanticConfirmed: true }] });
assert.equal(realZeroFinal.finalAssociation, 0, 'one calculated language with score 0 gives FA 0');
assert.equal(realZeroFinal.totalAssociation, 0, 'real zero stays TA 0');
assert.equal(realZeroFinal.hasCalculatedData, true, 'real zero counts as calculated data');
assert.notEqual(realZeroFinal.finalAssociation, null, 'real zero is not null');

assert.equal(formatMetric(null, 1), '—', 'null displays as no data');
assert.equal(formatMetric(undefined, 1), '—', 'undefined displays as no data');
assert.equal(formatMetric(0, 1), '0.0', 'zero formats as zero');
assert.equal(formatMetric(NaN, 1), '—', 'NaN is not displayed as percent-like number');
assert.equal(formatMetric(Infinity, 1), '—', 'Infinity is not displayed as percent-like number');

assert.equal(finalAssociationPassesThreshold(null), false, 'null does not pass threshold');
assert.equal(finalAssociationPassesThreshold(undefined), false, 'undefined does not pass threshold');
assert.equal(finalAssociationPassesThreshold(NaN), false, 'NaN does not pass threshold');
assert.equal(finalAssociationPassesThreshold(Infinity), false, 'Infinity does not pass threshold');
assert.equal(finalAssociationPassesThreshold(0), false, 'zero does not pass threshold');
assert.equal(finalAssociationPassesThreshold(34.999), false, '34.999 does not pass threshold');
assert.equal(finalAssociationPassesThreshold(35), true, '35 passes threshold');
assert.equal(finalAssociationPassesThreshold(35.0), true, '35.0 passes threshold');
assert.equal(finalAssociationPassesThreshold(40.6), true, '40.6 passes threshold');

assert.equal(finalAssociationRejectionReasons({ representedLangs: 3, groups: 2, finalAssociation: null, semanticConfirmed: true, hasCalculatedData: false }).includes('below_threshold'), false, 'null does not add below-threshold reason');
assert.equal(finalAssociationRejectionReasons({ representedLangs: 3, groups: 2, finalAssociation: 20, semanticConfirmed: true, hasCalculatedData: true }).includes('below_threshold'), true, 'numeric 20 adds below-threshold reason');

assert.equal(canCreateAssociativeJsonCard(empty), false, 'JSON card is unavailable without FA');
assert.equal(canCreateAssociativeJsonCard(realZeroFinal), false, 'JSON card is not blocked merely by zero; methodology acceptance blocks this case');
assert.equal(realZeroFinal.hasCalculatedData, true, 'zero is treated as a completed calculation');

const noWords = calculateLanguageScore([], { scoreGetter: item => item.final_score });
assert.deepEqual(noWords, { sum: null, normalized: null, count: 0 }, 'no selected calculated words returns nulls');
const calculatedZeroWord = calculateLanguageScore([{ selected: true, final_score: 0 }], { scoreGetter: item => item.final_score, maxModels: 1 });
assert.deepEqual(calculatedZeroWord, { sum: 0, normalized: 0, count: 1 }, 'calculated zero word returns zero, not null');

console.log('associativvordes no-data tests passed');
