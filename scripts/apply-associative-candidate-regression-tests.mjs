import { readFile, writeFile, rm } from 'node:fs/promises';

async function replaceOne(path, before, after) {
  const source = await readFile(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one replacement, found ${count}`);
  await writeFile(path, source.replace(before, after));
}

await replaceOne(
  'tests/associative-candidate-finder.test.mjs',
  `], root: 'alter' })), ['alter-fuzzy-high', 'alter-exact-ipm-high', 'alter-exact-ipm-low', 'alter-exact-low'], 'initial model ordering is frequency-first; rank and IPM break frequency ties before match quality');`,
  `], root: 'alter' })), ['alter-exact-ipm-high', 'alter-exact-ipm-low', 'alter-exact-low', 'alter-fuzzy-high'], 'exact and configured allomorph matches are ranked by F before fuzzy lookalikes are considered');`
);

await replaceOne(
  'tests/associative-candidate-finder.test.mjs',
  `assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('xregulation', 'xregulation')], root: 'regul', language: 'en' })), [], 'an arbitrary initial letter is not treated as a prefix');\n\nconsole.log('associative candidate finder tests passed');`,
  `assert.deepEqual(words(findCandidatesForRoot({ entries: [entry('xregulation', 'xregulation')], root: 'regul', language: 'en' })), [], 'an arbitrary initial letter is not treated as a prefix');\n\nconst alterRegression = findCandidatesForRoot({\n  entries: [\n    entry('after', 'after', { frequency_score: 100 }),\n    entry('afternoon', 'afternoon', { frequency_score: 77 }),\n    entry('afterwards', 'afterwards', { frequency_score: 60 }),\n    entry('disaster', 'disaster', { frequency_score: 59 }),\n    entry('alternative', 'alternative', { frequency_score: 70 }),\n    entry('alter', 'alter', { frequency_score: 58 }),\n    entry('alteration', 'alteration', { frequency_score: 50 })\n  ],\n  root: 'alter',\n  language: 'en'\n});\nassert.deepEqual(words(alterRegression).slice(0, 3), ['alternative', 'alter', 'alteration'], 'valid alter models must precede more frequent fuzzy lookalikes such as after and disaster');\nassert.ok(alterRegression.candidates.slice(0, 3).every(candidate => candidate.match.type !== 'fuzzy'));\n\nconsole.log('associative candidate finder tests passed');`
);

await replaceOne(
  'tests/associative-qwen-candidate-generation.test.mjs',
  `assert.match(clientSource, /rebalanceSelectedModels/, 'supplements can replace weaker members of the original five');`,
  `assert.match(clientSource, /rebalanceSelectedModels/, 'supplements can replace weaker members of the original five');\nassert.match(clientSource, /existingCandidates = Object\.fromEntries[\s\S]*currentModels\[language\]/, 'the audit excludes only the current five, not every lower-ranked local candidate');\nassert.match(clientSource, /findIndexByWord/, 'a Qwen suggestion already present lower in the full result is located instead of discarded');\nassert.match(clientSource, /findIndexByModel/, 'an existing representative of the suggested model is reused');\nassert.match(clientSource, /allCandidates/, 'final rebalancing uses the full runtime candidate list rather than the truncated saved-state snapshot');\nassert.doesNotMatch(clientSource, /existingKeys\[language\]\.has\(suggestionKey\)/, 'an already-found but unselected word is not silently skipped');`
);

await rm('scripts/apply-associative-candidate-regression-tests.mjs', { force: true });
await rm('.github/workflows/apply-associative-candidate-regression-tests.yml', { force: true });
console.log('Applied associative candidate regression tests.');
