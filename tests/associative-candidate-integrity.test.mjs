import assert from 'node:assert/strict';
import {
  applyDeterministicCandidateIntegrity,
  buildCrossLanguageCandidateEvidence,
  deterministicCandidateRejection
} from '../associativvordes/js/candidate-integrity.js';

const pools = {
  en: [
    { word: 'alternative', frequency_score: 70 },
    { word: 'alternate', frequency_score: 40 },
    { word: 'alter', frequency_score: 60 }
  ],
  fr: [
    { word: 'alternative', frequency_score: 50 },
    { word: 'alternate', frequency_score: 1.4 },
    { word: 'alter', frequency_score: 19 }
  ],
  ru: [
    { word: 'альтер', search_form: 'alter', frequency_score: 10 },
    { word: 'alternate', frequency_score: 2 }
  ]
};

const evidence = buildCrossLanguageCandidateEvidence(pools, ['en', 'fr', 'ru']);
assert.equal(deterministicCandidateRejection(pools.fr[0], 'fr', 'alter', evidence), null, 'a genuinely shared French lemma is not rejected merely because English also has it');
assert.equal(deterministicCandidateRejection(pools.fr[1], 'fr', 'alter', evidence).reason, 'cross_language_frequency_dominance', 'an English-dominated spelling in the French corpus is rejected');
assert.equal(deterministicCandidateRejection(pools.fr[2], 'fr', 'alter', evidence).reason, 'foreign_bare_root_dominance', 'a bare English root does not become a French model through corpus noise');
assert.equal(deterministicCandidateRejection(pools.ru[0], 'ru', 'alter', evidence).reason, 'foreign_bare_root_dominance', 'the separated Russian token from альтер эго is conservatively rejected');
assert.equal(deterministicCandidateRejection(pools.ru[1], 'ru', 'alter', evidence).reason, 'unexpected_language_script', 'a Latin-script English token cannot enter Russian results');

const applied = applyDeterministicCandidateIntegrity(pools, { root: 'alter', languages: ['en', 'fr', 'ru'] });
assert.equal(applied.candidatesByLanguage.fr.find(item => item.word === 'alternative').automatic_selection_eligible, undefined);
assert.equal(applied.candidatesByLanguage.fr.find(item => item.word === 'alternate').automatic_selection_eligible, false);
assert.equal(applied.candidatesByLanguage.ru.find(item => item.word === 'альтер').automatic_selection_eligible, false);
assert.deepEqual(applied.diagnostics, {
  deterministicRejectedCount: 4,
  unexpectedLanguageScriptCount: 1,
  crossLanguageDominanceCount: 1,
  foreignBareRootCount: 2
});

console.log('Associative deterministic candidate-integrity tests passed.');
