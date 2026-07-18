import assert from 'node:assert/strict';
import { AFFIX_SEARCH_CONFIG, AFFIX_SEARCH_CONFIG_VERSION } from '../associativvordes/js/affix-search-config.js';
import { acceptAffixBoundaryMatch } from '../associativvordes/js/affix-boundary-index.js';
import { findRootMatch, rootBoundarySegments } from '../associativvordes/js/root-matcher.js';

assert.equal(AFFIX_SEARCH_CONFIG_VERSION, '1');
assert.deepEqual(Object.keys(AFFIX_SEARCH_CONFIG).sort(), ['de', 'en', 'es', 'fr', 'it', 'ru']);
for (const [language, config] of Object.entries(AFFIX_SEARCH_CONFIG)) {
  assert.ok(config.safePrefixes.length >= 25, `${language} has a substantial safe-prefix inventory`);
  assert.ok(config.restrictedPrefixes.length >= 4, `${language} has restricted ambiguous prefixes`);
  assert.ok(config.combiningForms.length >= 20, `${language} has combining forms`);
  assert.ok(config.suffixes.length >= 25, `${language} has derivational suffixes`);
}

const accepted = [
  ['en', 'realteration', 'alter'],
  ['de', 'veralterung', 'alter'],
  ['fr', 'réaltération', 'alter'],
  ['es', 'realteración', 'alter'],
  ['it', 'rialterazione', 'alter'],
  ['ru', 'переальтернатива', 'alter']
];
for (const [language, word, root] of accepted) {
  const match = findRootMatch(word, root, language);
  assert.ok(match, `${language}: ${word} matches ${root} after a listed affix`);
  assert.ok(acceptAffixBoundaryMatch(match, root), `${language}: ${word} passes boundary safety`);
  assert.ok(match.index > 0, `${language}: the accepted match is genuinely prefixed`);
}

const rejected = [
  ['en', 'walter', 'alter'],
  ['de', 'walter', 'alter'],
  ['fr', 'malterie', 'alter'],
  ['es', 'salterio', 'alter'],
  ['it', 'salterio', 'alter'],
  ['ru', 'бухгалтерия', 'alter']
];
for (const [language, word, root] of rejected) {
  const match = findRootMatch(word, root, language);
  assert.equal(acceptAffixBoundaryMatch(match, root), false, `${language}: ${word} does not expose an arbitrary internal ${root}`);
}

assert.ok(rootBoundarySegments('counterrealteration', 'en').some(boundary => boundary.start === 9), 'two listed prefixes can form a chain');
assert.ok(!rootBoundarySegments('precounterrealteration', 'en').some(boundary => boundary.start === 12), 'automatic prefix chains are capped at two');
assert.equal(findRootMatch('alteration', 'alter', 'en')?.suffix, 'ation', 'known suffixes annotate the matched derivational model');
assert.equal(findRootMatch('irregular', 'regul', 'en')?.boundary?.kind, 'restricted', 'restricted allomorphs are marked explicitly');
assert.equal(acceptAffixBoundaryMatch(findRootMatch('xregulation', 'regul', 'en'), 'regul'), false, 'a leading insertion is not promoted to an unknown prefix');
assert.equal(acceptAffixBoundaryMatch(findRootMatch('xlteration', 'alter', 'en'), 'alter'), true, 'a same-length first-character substitution remains a fuzzy candidate');

console.log('Associative affix boundary tests passed.');
