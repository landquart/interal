import assert from 'node:assert/strict';
import { findCandidatesForRoot } from '../associativvordes/js/candidate-finder.js';

const entry = (word, search_form, extra = {}) => ({
  word,
  normalized: extra.normalized ?? word.toLowerCase(),
  search_form,
  rank: extra.rank ?? null,
  frequency_score: extra.frequency_score ?? 50,
  sources: extra.sources ?? [{ name: 'test', ipm: extra.ipm ?? 1 }],
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
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('xlteration', 'xlteration')], root: 'alter' })), []);
assert.equal(findCandidatesForRoot({ entries: [entry('altesation', 'altesation')], root: 'alter' }).candidates[0].match.similarity, 0.8);
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('ixxxxx', 'ixxxxx')], root: 'intern' })), []);
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('альтернатива', 'alternativa', { language: 'ru', normalized: 'альтернатива' })], root: 'alter', language: 'ru' })), ['альтернатива']);
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('интернациональный', 'internacionalnyj', { language: 'ru', normalized: 'интернациональный' })], root: 'alter', language: 'ru' })), []);
assert.equal(findCandidatesForRoot({ entries: [entry('альтернативный', 'alternativnyj', { language: 'ru', normalized: 'альтернативный' })], root: 'alter', language: 'ru' }).candidates[0].word, 'альтернативный');
assert.equal(findCandidatesForRoot({ entries: [{ ...entry('bad', 'bad'), sources: undefined }], root: 'bad' }).diagnostics.rejectedByReason.sources_missing, 1);
assert.equal(findCandidatesForRoot({ entries: [entry('bad', 'bad', { frequency_score: Infinity })], root: 'bad' }).diagnostics.rejectedByReason.frequency_score_not_finite, 1);
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('alter-low', 'alterlow', { frequency_score: 10 }), entry('alter-high', 'alterhigh', { frequency_score: 90 })], root: 'alter' })), ['alter-high', 'alter-low']);
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('alter-rank2', 'alterrank2', { rank: 2 }), entry('alter-rank1', 'alterrank1', { rank: 1 })], root: 'alter' })), ['alter-rank1', 'alter-rank2']);
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('alter-null', 'alternull', { rank: null }), entry('alter-ranked', 'alterranked', { rank: 3 })], root: 'alter' })), ['alter-ranked', 'alter-null']);
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('база', 'baza', { normalized: 'база' }), entry('base', 'baza', { normalized: 'base' })], root: 'baza' })).sort(), ['base', 'база'].sort());
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('alter-low', 'alterlow', { frequency_score: 1 }), entry('alter-high', 'alterhigh', { frequency_score: 99 })], root: 'alter', maxCandidates: 1 })), ['alter-high']);
const orderEntries = [entry('alter-b', 'alterb', { frequency_score: 20 }), entry('alter-a', 'altera', { frequency_score: 20 })];
assert.deepEqual(words(findCandidatesForRoot({ entries: orderEntries, root: 'alter' })), words(findCandidatesForRoot({ entries: orderEntries.toReversed(), root: 'alter' })));
assert.deepEqual(findCandidatesForRoot({ entries: [], root: 'alter' }), { candidates: [], diagnostics: { inspected: 0, matched: 0, rejected: 0, rejectedByReason: {}, duplicates: 0, warnings: [] } });
const diagnostic = findCandidatesForRoot({ entries: [null, entry('', 'x'), entry('x', '')], root: 'x' }).diagnostics;
assert.equal(diagnostic.rejected, 3);
assert.equal(diagnostic.rejectedByReason.not_object, 1);
assert.equal(diagnostic.rejectedByReason.word_empty, 1);
assert.equal(diagnostic.rejectedByReason.search_form_empty, 1);

assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('регулировать', 'regulirovat', { language: 'ru', normalized: 'регулировать' })], root: 'regul', language: 'ru' })), ['регулировать']);
assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('интернациональный', 'internacionalnyj', { language: 'ru', normalized: 'интернациональный' })], root: 'inter', language: 'ru' })), ['интернациональный']);
