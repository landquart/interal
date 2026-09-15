import assert from 'node:assert/strict';
import { findCandidatesForRoot } from '../associativvordes/js/candidate-finder.js';

const entry = (word, search_form, extra = {}) => ({
  word,
  normalized: extra.normalized ?? word.toLowerCase(),
  search_form,
  rank: extra.rank ?? null,
  frequency_score: extra.frequency_score ?? 50,
  sources: extra.sources ?? [{ id: 'fixture:test', file: 'fixture.txt', category: 'mixed', ipm: extra.ipm ?? 1 }],
  ...extra
});
const words = result => result.candidates.map(candidate => candidate.word);

assert.equal(findCandidatesForRoot({ entries: [entry('alternative', 'alternative')], root: 'alter' }).candidates[0].match.type, 'exact');
assert.equal(findCandidatesForRoot({ entries: [entry('altruism', 'altruism')], root: 'alter' }).candidates[0].match.type, 'special');
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('altesation', 'altesation'), entry('altxsation', 'altxsation'), entry('xlteration', 'xlteration')], root: 'alter' })), [], 'lookalikes are not accepted without exact family membership');
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('inter', 'inter'), entry('international', 'international')], root: 'alter' })), []);
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('Walter', 'walter'), entry('alteration', 'alteration')], root: 'alter', language: 'en' })), ['alteration'], 'internal substrings are not treated as roots');
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('realteration', 'realteration')], root: 'alter', language: 'en' })), ['realteration'], 'known prefix boundary is accepted');
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('irregular', 'irregular')], root: 'regul', language: 'en' })), ['irregular'], 'recognized prefix boundary is accepted');
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('xregulation', 'xregulation')], root: 'regul', language: 'en' })), [], 'arbitrary leading material is rejected');

assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('альтернатива', 'alternativa', { language: 'ru', normalized: 'альтернатива' })], root: 'alter', language: 'ru' })), ['альтернатива']);
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('интернациональный', 'internacionalnyj', { language: 'ru', normalized: 'интернациональный' })], root: 'alter', language: 'ru' })), []);
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('окуляр', 'okuljar', { normalized: 'окуляр', language: 'ru' })], root: 'ocul', language: 'ru' })), ['окуляр']);
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('regolare', 'regolare')], root: 'regul', language: 'it' })), ['regolare']);
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('pedicure', 'pedicure'), entry('pedal', 'pedal')], root: 'pede', language: 'en' })).sort(), ['pedal', 'pedicure'].sort());

const validationMissingSources = findCandidatesForRoot({ entries: [{ ...entry('bad', 'bad'), sources: undefined }], root: 'bad' });
assert.equal(validationMissingSources.diagnostics.rejectedByReason.sources_missing, 1);
const validationBadFrequency = findCandidatesForRoot({ entries: [entry('bad', 'bad', { frequency_score: Infinity })], root: 'bad' });
assert.equal(validationBadFrequency.diagnostics.rejectedByReason.frequency_score_not_finite, 1);

assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('alter-low', 'alter-low', { frequency_score: 10 }), entry('alter-high', 'alter-high', { frequency_score: 90 })], root: 'alter' })), ['alter-high', 'alter-low']);
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('alter-rank2', 'alter-rank2', { rank: 2 }), entry('alter-rank1', 'alter-rank1', { rank: 1 })], root: 'alter' })), ['alter-rank1', 'alter-rank2']);
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('alter-low', 'alter-low', { frequency_score: 1 }), entry('alter-high', 'alter-high', { frequency_score: 99 })], root: 'alter', maxCandidates: 1 })), ['alter-high']);

const canonicalSources = [
  { id: 'en:web:alter', file: 'web/en-alter.tsv', category: 'web', ipm: 2.5 },
  { id: 'en:subtitles:alter', file: 'subtitles/en-alter.tsv', category: 'subtitles', ipm: 1.25 }
];
const canonicalEntry = entry('alteration', 'alteration', { sources: canonicalSources, frequency_score: 75 });
const canonicalResult = findCandidatesForRoot({ entries: [canonicalEntry], root: 'alter', language: 'en' });
assert.equal(canonicalResult.candidates[0].total_ipm, 3.75);
assert.deepEqual(canonicalResult.candidates[0].sources, canonicalSources);
assert(!canonicalResult.candidates[0].warnings.includes('missing_category'));
assert(!canonicalResult.candidates[0].warnings.includes('partial_source_data'));

const duplicateA = entry('côté', 'cote', { normalized: 'côté', warnings: [] });
const duplicateB = entry('côté', 'cote', { normalized: 'côté', warnings: [], sources: [...canonicalSources] });
const duplicateInput = [duplicateA, duplicateB];
const beforeDuplicateInput = structuredClone(duplicateInput);
const duplicateRun = findCandidatesForRoot({ entries: duplicateInput, root: 'cote', language: 'fr' });
assert.equal(duplicateRun.candidates.length, 1);
assert.equal(duplicateRun.diagnostics.duplicates, 1);
assert(duplicateRun.candidates[0].warnings.includes('duplicate_runtime_entry'));
assert.deepEqual(duplicateInput, beforeDuplicateInput, 'candidate finder does not mutate source entries');

const familyAnnotated = entry('altruism', 'altruism', {
  family_id: 'family:alter', family_canonical: 'alter', family_aliases: ['alter', 'altern', 'altru'], family_verified: true
});
const familyResult = findCandidatesForRoot({ entries: [familyAnnotated], root: 'alter', language: 'en' }).candidates[0];
assert.equal(familyResult.family_id, 'family:alter');
assert.equal(familyResult.family_canonical, 'alter');
assert.deepEqual(familyResult.family_aliases, ['alter', 'altern', 'altru']);
assert.equal(familyResult.family_verified, true);

const prepositionModels = findCandidatesForRoot({
  entries: [
    entry('interaction', 'interaction', { frequency_score: 90 }),
    entry('interactive', 'interactive', { frequency_score: 80 }),
    entry('international', 'international', { frequency_score: 70 }),
    entry('internationalism', 'internationalism', { frequency_score: 60 }),
    entry('internet', 'internet', { frequency_score: 50 }),
    entry('interval', 'interval', { frequency_score: 40 })
  ],
  root: 'inter', language: 'en', elementType: 'preposition'
});
assert.deepEqual(words(prepositionModels), ['interaction', 'international', 'internet', 'interval']);
assert.ok(prepositionModels.candidates.every(candidate => candidate.model_key.startsWith('en|preposition|inter|')));

const unrelated = findCandidatesForRoot({
  entries: [entry('after', 'after'), entry('afternoon', 'afternoon'), entry('afterwards', 'afterwards'), entry('disaster', 'disaster'), entry('alternative', 'alternative'), entry('alter', 'alter'), entry('alteration', 'alteration')],
  root: 'alter', language: 'en'
});
assert.deepEqual(words(unrelated), ['alter', 'alternative', 'alteration'].sort((a, b) => {
  const fa = unrelated.candidates.find(x => x.word === a)?.frequency_score ?? 0;
  const fb = unrelated.candidates.find(x => x.word === b)?.frequency_score ?? 0;
  return fb - fa || a.localeCompare(b);
}).filter(Boolean), 'unrelated lookalikes never enter the family candidate pool');
assert.equal(Object.hasOwn(unrelated.diagnostics.rejectedByReason, 'fuzzy_morphology_unverified'), false, 'obsolete fuzzy rejection path is gone');

console.log('associative candidate finder family tests passed');
