import assert from 'node:assert/strict';
import { allowedRootDistance, fuzzyRootMatch, specialRootMatch, sortRootCandidateMatches } from '../associativvordes/js/root-matcher.js';

assert.equal(allowedRootDistance('alter'), 1);
assert.equal(fuzzyRootMatch('inter', 'alter'), null);
assert.equal(fuzzyRootMatch('international', 'alter'), null);
assert.equal(fuzzyRootMatch('alteration', 'alter').type, 'exact');
assert.equal(fuzzyRootMatch('alternative', 'alter').type, 'exact');
assert.equal(fuzzyRootMatch('altesation', 'alter').type, 'fuzzy');
assert.equal(fuzzyRootMatch('altesation', 'alter').similarity, 0.8);
assert.equal(fuzzyRootMatch('ocular', 'ocul').type, 'exact');
assert.equal(specialRootMatch('de', 'okular', 'ocul'), true);
assert.equal(fuzzyRootMatch('regulate', 'regul').type, 'exact');
assert.equal(specialRootMatch('it', 'regolare', 'regul'), true);
assert.equal(fuzzyRootMatch('cat', 'bat'), null);
assert.equal(fuzzyRootMatch('inter', 'alter'), null);
assert.equal(fuzzyRootMatch('xxter', 'alter'), null);
assert.equal(fuzzyRootMatch('alter', 'alter').type, 'exact');
assert.equal(fuzzyRootMatch('inter', 'alter'), null);

const ordered = sortRootCandidateMatches([
  { word: 'zzfuzzy', match: { type: 'fuzzy', distance: 1, similarity: 0.8 } },
  { word: 'okular', match: { type: 'special', distance: 0, similarity: 1 } },
  { word: 'alteration', match: { type: 'exact', distance: 0, similarity: 1 } },
  { word: 'aafuzzy', match: { type: 'fuzzy', distance: 1, similarity: 0.9 } }
], word => ({ zzfuzzy: 1, aafuzzy: 99 }[word] ?? 50));
assert.deepEqual(ordered.map(x => x.match.type), ['exact', 'special', 'fuzzy', 'fuzzy']);
assert.equal(ordered[2].word, 'aafuzzy');
