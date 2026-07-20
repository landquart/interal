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
assert.equal(findCandidatesForRoot({ entries: [entry('altesative', 'altesative'), entry('alternative', 'alternative')], root: 'alter' }).candidates[0].word, 'alternative');
assert.equal(findCandidatesForRoot({ entries: [entry('regolare', 'regolare'), entry('rexulare', 'rexulare')], root: 'regul', language: 'it' }).candidates[0].match.type, 'special');
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('inter', 'inter')], root: 'alter' })), []);
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('international', 'international')], root: 'alter' })), []);
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('internet', 'internet')], root: 'alter' })), []);
assert.equal(findCandidatesForRoot({ entries: [entry('altesation', 'altesation')], root: 'alter' }).candidates[0].match.type, 'fuzzy');
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('altxsation', 'altxsation')], root: 'alter' })), []);
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('xlteration', 'xlteration')], root: 'alter' })), ['xlteration'], 'a first-character substitution is accepted at a valid root boundary');
assert.equal(findCandidatesForRoot({ entries: [entry('altesation', 'altesation')], root: 'alter' }).candidates[0].match.similarity, 0.8);
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('ixxxxx', 'ixxxxx')], root: 'intern' })), []);
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('альтернатива', 'alternativa', { language: 'ru', normalized: 'альтернатива' })], root: 'alter', language: 'ru' })), ['альтернатива']);
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('интернациональный', 'internacionalnyj', { language: 'ru', normalized: 'интернациональный' })], root: 'alter', language: 'ru' })), []);
assert.equal(findCandidatesForRoot({ entries: [entry('альтернативный', 'alternativnyj', { language: 'ru', normalized: 'альтернативный' })], root: 'alter', language: 'ru' }).candidates[0].word, 'альтернативный');
assert.equal(findCandidatesForRoot({ entries: [{ ...entry('bad', 'bad'), sources: undefined }], root: 'bad' }).diagnostics.rejectedByReason.sources_missing, 1);
assert.equal(findCandidatesForRoot({ entries: [entry('bad', 'bad', { frequency_score: Infinity })], root: 'bad' }).diagnostics.rejectedByReason.frequency_score_not_finite, 1);
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('alter-low', 'alter-low', { frequency_score: 10 }), entry('alter-high', 'alter-high', { frequency_score: 90 })], root: 'alter' })), ['alter-high', 'alter-low']);
assert.deepEqual(words(findCandidatesForRoot({ entries: [
  entry('alter-fuzzy-high', 'altes-high', { frequency_score: 100, ipm: 100 }),
  entry('alter-exact-low', 'alter-low', { frequency_score: 1, ipm: 1 }),
  entry('alter-exact-ipm-low', 'alter-ipm-low', { frequency_score: 50, ipm: 1 }),
  entry('alter-exact-ipm-high', 'alter-ipm-high', { frequency_score: 50, ipm: 99 })
], root: 'alter' })), ['alter-fuzzy-high', 'alter-exact-ipm-high', 'alter-exact-ipm-low', 'alter-exact-low'], 'initial model ordering is frequency-first; rank and IPM break frequency ties before match quality');
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('alter-rank2', 'alter-rank2', { rank: 2 }), entry('alter-rank1', 'alter-rank1', { rank: 1 })], root: 'alter' })), ['alter-rank1', 'alter-rank2']);
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('alter-null', 'alter-null', { rank: null }), entry('alter-ranked', 'alter-ranked', { rank: 3 })], root: 'alter' })), ['alter-ranked', 'alter-null'], 'rank influences sorting after frequency tie');
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('alter-null-high-frequency', 'alter-null-high-frequency', { rank: null, frequency_score: 90 }), entry('alter-ranked-low-frequency', 'alter-ranked-low-frequency', { rank: 1, frequency_score: 10 })], root: 'alter' })), ['alter-null-high-frequency', 'alter-ranked-low-frequency'], 'frequency_score is compared before real rank vs null');
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('alter-null-high-ipm', 'alter-null-high-ipm', { rank: null, frequency_score: 50, ipm: 90 }), entry('alter-ranked-low-ipm', 'alter-ranked-low-ipm', { rank: 1, frequency_score: 50, ipm: 1 })], root: 'alter' })), ['alter-ranked-low-ipm', 'alter-null-high-ipm'], 'rank breaks an F tie before summed IPM');
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('база', 'baza', { normalized: 'база' }), entry('base', 'baza', { normalized: 'base' })], root: 'baza' })).sort(), ['base', 'база'].sort());
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('alter-low', 'alter-low', { frequency_score: 1 }), entry('alter-high', 'alter-high', { frequency_score: 99 })], root: 'alter', maxCandidates: 1 })), ['alter-high']);
const orderEntries = [entry('alter-b', 'alter-b', { frequency_score: 20 }), entry('alter-a', 'alter-a', { frequency_score: 20 })];
assert.deepEqual(words(findCandidatesForRoot({ entries: orderEntries, root: 'alter' })), words(findCandidatesForRoot({ entries: orderEntries.toReversed(), root: 'alter' })));
assert.deepEqual(findCandidatesForRoot({ entries: [], root: 'alter' }), { candidates: [], diagnostics: { inspected: 0, matched: 0, rejected: 0, rejectedByReason: {}, duplicates: 0, warnings: [] } });
const diagnostic = findCandidatesForRoot({ entries: [null, entry('', 'x'), entry('x', '')], root: 'x' }).diagnostics;
assert.equal(diagnostic.rejected, 3);
assert.equal(diagnostic.rejectedByReason.not_object, 1);
assert.equal(diagnostic.rejectedByReason.word_empty, 1);
assert.equal(diagnostic.rejectedByReason.search_form_empty, 1);

assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('регулировать', 'regulirovat', { language: 'ru', normalized: 'регулировать' })], root: 'regul', language: 'ru' })), ['регулировать']);
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('интернациональный', 'internacionalnyj', { language: 'ru', normalized: 'интернациональный' })], root: 'inter', language: 'ru' })), ['интернациональный']);

const canonicalSources = [
  { id: 'en:web:alter', file: 'web/en-alter.tsv', category: 'web', ipm: 2.5 },
  { id: 'en:subtitles:alter', file: 'subtitles/en-alter.tsv', category: 'subtitles', ipm: 1.25 }
];
const canonicalEntry = entry('alteration', 'alteration', { sources: canonicalSources, frequency_score: 75 });
const canonicalResult = findCandidatesForRoot({ entries: [canonicalEntry], root: 'alter', language: 'en' });
assert.equal(canonicalResult.candidates[0].total_ipm, 3.75);
assert(!canonicalResult.candidates[0].warnings.includes('missing_category'));
assert(!canonicalResult.candidates[0].warnings.includes('partial_source_data'));
assert.deepEqual(canonicalResult.candidates[0].sources, canonicalSources);
assert(!Object.hasOwn(canonicalEntry, '__runtimeWarnings'));
assert.deepEqual(canonicalEntry.sources, canonicalSources);

const legacyCategoryFromIdOnly = entry('alterable', 'alterable', { sources: [{ id: 'web:alterable', file: 'legacy.tsv', ipm: 1 }] });
assert(findCandidatesForRoot({ entries: [legacyCategoryFromIdOnly], root: 'alter' }).candidates[0].warnings.includes('missing_category'));

const diacriticEntries = [
  entry('si', 'si', { normalized: 'si' }),
  entry('sí', 'si', { normalized: 'sí' }),
  entry('ou', 'ou', { normalized: 'ou' }),
  entry('où', 'ou', { normalized: 'où' }),
  entry('cote', 'cote', { normalized: 'cote' }),
  entry('côté', 'cote', { normalized: 'côté' })
];
assert.deepEqual(words(findCandidatesForRoot({ entries: diacriticEntries.slice(0, 2), root: 'si', language: 'fr' })).sort(), ['si', 'sí'].sort(), 'si and sí remain distinct lemmas');
assert.deepEqual(words(findCandidatesForRoot({ entries: diacriticEntries.slice(2, 4), root: 'ou', language: 'fr' })).sort(), ['ou', 'où'].sort(), 'ou and où remain distinct lemmas');
assert.deepEqual(words(findCandidatesForRoot({ entries: diacriticEntries.slice(4), root: 'cote', language: 'fr' })).sort(), ['cote', 'côté'].sort(), 'cote and côté remain distinct lemmas');

const duplicateA = entry('côté', 'cote', { normalized: 'côté', warnings: [] });
const duplicateB = entry('côté', 'cote', { normalized: 'côté', warnings: [], sources: [...canonicalSources] });
const duplicateInput = [duplicateA, duplicateB];
const beforeDuplicateInput = structuredClone(duplicateInput);
const firstDuplicateRun = findCandidatesForRoot({ entries: duplicateInput, root: 'cote', language: 'fr' });
const secondDuplicateRun = findCandidatesForRoot({ entries: duplicateInput, root: 'cote', language: 'fr' });
assert.equal(firstDuplicateRun.candidates.length, 1, 'identical normalized lemmas are deduplicated');
assert.equal(firstDuplicateRun.diagnostics.duplicates, 1, 'duplicate is reported');
assert(firstDuplicateRun.candidates[0].warnings.includes('duplicate_runtime_entry'), 'retained candidate receives duplicate warning');
assert.deepEqual(duplicateInput, beforeDuplicateInput, 'candidate finder does not mutate shard cache entries');
assert.deepEqual(secondDuplicateRun, firstDuplicateRun, 'repeated call on the same cached entries is stable');

assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('ocular', 'ocular')], root: 'ocul', language: 'en' })), ['ocular'], 'ocul exact matching remains available');
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('окуляр', 'okuljar', { normalized: 'окуляр', language: 'ru' })], root: 'ocul', language: 'ru' })), ['окуляр'], 'ocul/okul special matching remains available');
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('regolare', 'regolare')], root: 'regul', language: 'it' })), ['regolare'], 'regul/regol special matching remains available');

assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('Walter', 'walter'), entry('alteration', 'alteration')], root: 'alter', language: 'en' })), ['alteration'], 'alter inside Walter is rejected');
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('бухгалтерия', 'buhgalterija', { normalized: 'бухгалтерия', language: 'ru' }), entry('альтернатива', 'alternativa', { normalized: 'альтернатива', language: 'ru' })], root: 'alter', language: 'ru' })), ['альтернатива'], 'alter inside бухгалтерия is rejected');
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('realteration', 'realteration')], root: 'alter', language: 'en' })), ['realteration'], 'a root after a known safe prefix is accepted');
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('irregular', 'irregular')], root: 'regul', language: 'en' })), ['irregular'], 'a root after a known restricted allomorph is accepted');
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('xregulation', 'xregulation')], root: 'regul', language: 'en' })), [], 'an arbitrary initial letter is not treated as a prefix');

console.log('associative candidate finder tests passed');
