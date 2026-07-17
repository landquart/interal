import assert from 'node:assert/strict';
import {
  buildDecisionReasons,
  calculateFinalAssociation,
  decisionStatusForResult,
  isLanguageTerminal,
  normalizeLanguageStatus,
  summarizeLanguageStatuses
} from '../associativvordes/js/association-analyzer.js';
import { languageStatusLabel } from '../associativvordes/js/render-results.js';

const languages = [
  { code: 'en', group: 'Germanic' },
  { code: 'de', group: 'Germanic' },
  { code: 'fr', group: 'Romance' },
  { code: 'es', group: 'Romance' },
  { code: 'it', group: 'Romance' },
  { code: 'ru', group: 'Slavic' }
];
const success = (normalized = 50, semanticConfirmed = true) => ({ sum: normalized, normalized, count: 1, semanticConfirmed });
const empty = { sum: null, normalized: null, count: 0, semanticConfirmed: false };

assert.equal(normalizeLanguageStatus({ status: 'no_candidates', candidateCount: 10 }).status, 'no_candidates', 'no_candidates remains distinct');
assert.equal(summarizeLanguageStatuses({ en: { status: 'no_candidates' } }).warnings.includes('some_languages_index_error'), false, 'no_candidates is not index_error');
assert.equal(summarizeLanguageStatuses({ en: { status: 'index_error' } }).warnings.includes('some_languages_no_candidates'), false, 'index_error is not no_candidates');

const partial = summarizeLanguageStatuses({ en: { status: 'completed', candidateCount: 3, analyzedCount: 3, successfulCount: 2, failedCount: 1 } });
assert.equal(partial.statuses.en.status, 'completed', 'partial Qwen failure keeps completed');
assert.equal(partial.warnings.includes('partial_qwen_failure'), true, 'partial Qwen failure adds warning');

const fullQwen = normalizeLanguageStatus({ status: 'qwen_error', candidateCount: 2, analyzedCount: 2, successfulCount: 0, failedCount: 2 });
assert.equal(fullQwen.status, 'qwen_error', 'full Qwen failure is qwen_error');

const oneError = calculateFinalAssociation({ languages: languages.slice(0, 3), languageResults: [success(45), success(50), empty], languageStatuses: { fr: { status: 'index_error' } } });
assert.equal(oneError.representedLangs, 2, 'one language error preserves other represented languages');
assert.equal(oneError.finalAssociation, 47.5, 'one language error does not clear FA from other languages');

const threeOfSix = calculateFinalAssociation({ languages, languageResults: [success(40), empty, success(50), empty, empty, success(60)], languageStatuses: {} });
assert.equal(threeOfSix.finalAssociation, 50, 'three successful languages from six form FA');
assert.equal(threeOfSix.accepted, true, 'three languages in two groups can be accepted');

const oneGroup = calculateFinalAssociation({ languages: languages.slice(0, 2), languageResults: [success(80), success(70)], languageStatuses: {} });
assert.equal(buildDecisionReasons(oneGroup).critical.includes('fewer_than_2_groups'), true, 'minimum two groups remains required');

const faNull = calculateFinalAssociation({ languages: languages.slice(0, 3), languageResults: [empty, empty, empty], languageStatuses: {} });
assert.deepEqual(buildDecisionReasons(faNull).critical, ['no_calculated_data'], 'FA null gives no_calculated_data');
assert.equal(buildDecisionReasons(faNull).critical.includes('final_association_below_35'), false, 'FA null does not give below-threshold');

const faZero = calculateFinalAssociation({ languages: languages.slice(0, 3), languageResults: [success(0), success(0), success(0)], languageStatuses: {} });
assert.equal(buildDecisionReasons(faZero).critical.includes('final_association_below_35'), true, 'FA 0 gives below-threshold');

const analyzing = calculateFinalAssociation({ languages: languages.slice(0, 3), languageResults: [success(40), empty, empty], languageStatuses: { de: { status: 'analyzing' } } });
assert.equal(buildDecisionReasons(analyzing).warnings.includes('calculation_incomplete'), true, 'analyzing is intermediate warning');
assert.equal(buildDecisionReasons(analyzing).critical.includes('fewer_than_3_languages'), true, 'partial numeric data still reports current critical result only with data');

for (const status of ['completed', 'no_candidates', 'index_error', 'qwen_error', 'incomplete', 'aborted']) assert.equal(isLanguageTerminal(status), true, `${status} is terminal`);
assert.equal(summarizeLanguageStatuses({ en: { status: 'completed' }, de: { status: 'no_candidates' }, fr: { status: 'index_error' } }).allTerminal, true, 'all terminal statuses finish global run');

const withIncomplete = calculateFinalAssociation({ languages: languages.slice(0, 3), languageResults: [success(40), empty, success(50)], languageStatuses: { de: { status: 'incomplete' } } });
assert.equal(withIncomplete.representedLangs, 2, 'incomplete does not participate in FA');
const withAborted = calculateFinalAssociation({ languages: languages.slice(0, 3), languageResults: [success(40), empty, success(50)], languageStatuses: { de: { status: 'aborted' } } });
assert.equal(withAborted.representedLangs, 2, 'aborted does not participate in FA');

const acceptedWithIndexWarning = calculateFinalAssociation({ languages, languageResults: [success(40), success(41), success(42), empty, empty, empty], languageStatuses: { it: { status: 'index_error' } } });
assert.equal(acceptedWithIndexWarning.accepted, true, 'index_error warning need not cancel acceptance');
assert.equal(decisionStatusForResult(acceptedWithIndexWarning), 'accept', 'accepted decision survives warning');

const semanticBad = calculateFinalAssociation({ languages: languages.slice(0, 3), languageResults: [success(50), success(50), success(50, false)], languageStatuses: {} });
assert.equal(buildDecisionReasons(semanticBad).critical.includes('semantic_not_confirmed'), true, 'semantic_not_confirmed cancels acceptance');
assert.equal(decisionStatusForResult(semanticBad), 'reject', 'semantic critical reason rejects');

const duplicateOrder = buildDecisionReasons({ ...faZero, languageStatusSummary: summarizeLanguageStatuses({ en: { status: 'index_error' }, de: { status: 'index_error' } }) });
assert.equal(new Set(duplicateOrder.critical).size, duplicateOrder.critical.length, 'critical reasons are unique');
assert.deepEqual(duplicateOrder.critical, ['final_association_below_35'], 'critical reasons have deterministic order');

for (const status of ['idle', 'loading_index', 'no_candidates', 'analyzing', 'completed', 'index_error', 'qwen_error', 'incomplete', 'aborted']) {
  assert.ok(languageStatusLabel({ status }, 'ru'), `RU label exists for ${status}`);
  assert.ok(languageStatusLabel({ status }, 'en'), `EN label exists for ${status}`);
}
assert.equal(languageStatusLabel({ status: 'no_candidates' }, 'en', { short: true }).includes('0'), false, 'no_candidates tab label does not show 0%');

console.log('associativvordes language-status tests passed');
