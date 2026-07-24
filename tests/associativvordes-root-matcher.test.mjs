import assert from 'node:assert/strict';
import { MIN_FUZZY_ROOT_SIMILARITY, allowedRootDistance, fuzzyRootMatch, specialRootMatch, sortRootCandidateMatches } from '../associativvordes/js/root-matcher.js';

assert.equal(MIN_FUZZY_ROOT_SIMILARITY, 0.8);
assert.equal(allowedRootDistance('alter'), 1);
assert.equal(fuzzyRootMatch('inter', 'alter'), null);
assert.equal(fuzzyRootMatch('international', 'alter'), null);
assert.equal(fuzzyRootMatch('alteration', 'alter').type, 'exact');
assert.equal(fuzzyRootMatch('alternative', 'alter').type, 'exact');
assert.equal(fuzzyRootMatch('altruism', 'alter').type, 'fuzzy');
assert.equal(fuzzyRootMatch('altruism', 'alter').similarity, 0.8);
assert.equal(fuzzyRootMatch('xlteration', 'alter'), null, 'fuzzy fragments must begin with the same letter as the root');
assert.equal(fuzzyRootMatch('abxxefghi', 'abcdefghi'), null, 'distance within the raw allowance is rejected below 80% similarity');
assert.equal(fuzzyRootMatch('abxxefghij', 'abcdefghij').similarity, 0.8, 'the 80% boundary remains inclusive');
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
