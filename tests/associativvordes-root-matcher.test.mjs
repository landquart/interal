import assert from 'node:assert/strict';
import { exactRootMatchAtBoundary, findRootMatch, specialRootMatch, specialRootVariants, sortRootCandidateMatches } from '../associativvordes/js/root-matcher.js';
import { resolveAssociativeFamily } from '../associativvordes/js/associative-family-registry.js';

assert.equal(exactRootMatchAtBoundary('alteration', 'alter', 'en').type, 'exact');
assert.equal(exactRootMatchAtBoundary('alternative', 'alter', 'en').type, 'exact');
assert.equal(exactRootMatchAtBoundary('xlteration', 'alter', 'en'), null, 'one-letter substitutions are not accepted');
assert.equal(exactRootMatchAtBoundary('inter', 'alter', 'en'), null, 'unrelated exact strings do not match');

const alterFamily = resolveAssociativeFamily('alter');
assert.equal(alterFamily.id, 'family:alter');
assert.deepEqual(alterFamily.aliases, ['alter', 'altern', 'altru']);
assert.equal(resolveAssociativeFamily('altru').id, 'family:alter');
assert.equal(findRootMatch('altruism', 'alter', 'en').type, 'special');
assert.equal(findRootMatch('alternative', 'alter', 'en').type, 'exact');
assert.equal(findRootMatch('walter', 'alter', 'en'), null, 'family matching still requires a valid root boundary');

assert.deepEqual(resolveAssociativeFamily('pede').aliases, ['pede', 'ped', 'pedi']);
assert.equal(findRootMatch('pedicure', 'pede', 'en').type, 'special');
assert.equal(findRootMatch('pedal', 'pede', 'en').type, 'special');
assert.equal(findRootMatch('ocular', 'ocul', 'en').type, 'exact');
assert.equal(specialRootMatch('de', 'okular', 'ocul'), true);
assert.equal(findRootMatch('regolare', 'regul', 'it').type, 'special');
assert.ok(specialRootVariants('any', 'regul').includes('regol'));

const surface = resolveAssociativeFamily('xeno');
assert.equal(surface.id, 'surface-family:xeno');
assert.deepEqual(surface.aliases, ['xeno']);
assert.equal(surface.verified, false);

const ordered = sortRootCandidateMatches([
  { word: 'okular', match: { type: 'special', distance: 0, similarity: 1 } },
  { word: 'alteration', match: { type: 'exact', distance: 0, similarity: 1 } },
  { word: 'altruism', match: { type: 'special', distance: 0, similarity: 1 } }
], word => ({ altruism: 1, okular: 50, alteration: 50 }[word] ?? 50));
assert.deepEqual(ordered.map(x => x.match.type), ['exact', 'special', 'special']);
assert.equal(ordered[1].word, 'altruism');
