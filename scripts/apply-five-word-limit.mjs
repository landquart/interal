import { readFile, writeFile, rm } from 'node:fs/promises';

async function replaceOne(path, before, after) {
  const source = await readFile(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one match, found ${count}`);
  await writeFile(path, source.replace(before, after));
}

await replaceOne(
  'associativvordes/js/qwen-client.js',
  "import { lexicalModelDescriptor, compareFrequencyRepresentatives } from './candidate-model-family.js';",
  "import { lexicalModelDescriptor, compareFrequencyRepresentatives } from './candidate-model-family.js';\nimport { MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE } from './associative-state.js';"
);
await replaceOne(
  'associativvordes/js/qwen-client.js',
  '  autoAnalyzeCandidatesPerLanguage: Infinity,',
  '  autoAnalyzeCandidatesPerLanguage: MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE,'
);

await replaceOne(
  'associativvordes/script.js',
  "import { createEmptyAssociativeState, invalidateSearchResult as invalidateAssociativeSearchResult, invalidateFinalCalculation as invalidateAssociativeFinalCalculation, addManualCandidate, updateCandidate, deleteCandidate, compactAssociativeState, restoreAssociativeState } from './js/associative-state.js';",
  "import { MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE, createEmptyAssociativeState, invalidateSearchResult as invalidateAssociativeSearchResult, invalidateFinalCalculation as invalidateAssociativeFinalCalculation, addManualCandidate, updateCandidate, deleteCandidate, compactAssociativeState, restoreAssociativeState } from './js/associative-state.js';"
);
await replaceOne(
  'associativvordes/script.js',
  `    function groupByBestModel(items, _maxModels = Infinity, langCode = 'en') {\n      return reconcileModelRepresentatives(items, state.root, langCode)\n        .filter(item => Number.isFinite(wordWeight(item)))\n        .map(item => ({ ...item, selected: true }));\n    }`,
  `    function groupByBestModel(items, maxModels = MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE, langCode = 'en') {\n      return reconcileModelRepresentatives(items, state.root, langCode)\n        .filter(item => Number.isFinite(wordWeight(item)))\n        .slice(0, maxModels)\n        .map(item => ({ ...item, selected: true }));\n    }`
);
await replaceOne(
  'associativvordes/script.js',
  '      state.maxModels = Number.MAX_SAFE_INTEGER;',
  '      state.maxModels = MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE;'
);
await replaceOne(
  'associativvordes/script.js',
  `    function scoringCandidates(langCode) {\n      return (state.languages[langCode] || [])\n        .filter(item => item.selected && Number.isFinite(wordWeight(item)))\n        .sort((a, b) => compareFrequencyRepresentatives(a, b));\n    }`,
  `    function scoringCandidates(langCode) {\n      return (state.languages[langCode] || [])\n        .filter(item => item.selected && Number.isFinite(wordWeight(item)))\n        .sort((a, b) => compareFrequencyRepresentatives(a, b))\n        .slice(0, state.maxModels || MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE);\n    }`
);
await replaceOne(
  'associativvordes/script.js',
  '      return calculateLanguageScore(scoringCandidates(langCode), { maxModels: Infinity, scoreGetter: wordWeight });',
  '      return calculateLanguageScore(scoringCandidates(langCode), { maxModels: state.maxModels, scoreGetter: wordWeight });'
);

await replaceOne(
  'tests/associative-model-selection-policy.test.mjs',
  `const language = calculateLanguageScore([\n  { selected: true, final_score: 80 },\n  { selected: true, final_score: 50 },\n  { selected: true, final_score: 20 }\n]);\nassert.equal(language.normalized, 50, 'low-scoring models remain in the language mean');`,
  `const language = calculateLanguageScore([\n  { selected: true, final_score: 80 },\n  { selected: true, final_score: 50 },\n  { selected: true, final_score: 20 }\n]);\nassert.equal(language.normalized, 50, 'low-scoring models remain in the language mean');\nconst limitedLanguage = calculateLanguageScore([\n  { selected: true, final_score: 100 },\n  { selected: true, final_score: 90 },\n  { selected: true, final_score: 80 },\n  { selected: true, final_score: 70 },\n  { selected: true, final_score: 60 },\n  { selected: true, final_score: 0 }\n], { maxModels: 5 });\nassert.equal(limitedLanguage.count, 5, 'no more than five words participate in one language result');\nassert.equal(limitedLanguage.normalized, 80, 'the sixth selected word is excluded by the five-word limit');`
);
await replaceOne(
  'tests/associative-model-selection-policy.test.mjs',
  `assert.doesNotMatch(script, /state\\.maxModels = 5/);\nassert.doesNotMatch(script, /slice\\(0, state\\.maxModels\\)/);`,
  `assert.match(script, /state\\.maxModels = MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE/);\nassert.match(script, /slice\\(0, state\\.maxModels \\|\\| MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE\\)/);`
);
await replaceOne(
  'tests/associative-model-selection-policy.test.mjs',
  'assert.match(qwen, /autoAnalyzeCandidatesPerLanguage: Infinity/);',
  'assert.equal((await import(\'../associativvordes/js/qwen-client.js\')).QWEN_RUNTIME_CONFIG.autoAnalyzeCandidatesPerLanguage, 5);'
);

await replaceOne(
  'tests/associativvordes-error-handling.test.mjs',
  "assert.equal(QWEN_RUNTIME_CONFIG.autoAnalyzeCandidatesPerLanguage, Infinity, 'every model representative is analyzed');",
  "assert.equal(QWEN_RUNTIME_CONFIG.autoAnalyzeCandidatesPerLanguage, 5, 'automatic analysis is limited to five model representatives per language');"
);

await replaceOne(
  'tests/associativvordes-persistence.test.mjs',
  "import { compactAssociativeState, restoreAssociativeState } from '../associativvordes/js/associative-state.js';",
  "import { MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE, compactAssociativeState, restoreAssociativeState } from '../associativvordes/js/associative-state.js';"
);
await replaceOne(
  'tests/associativvordes-persistence.test.mjs',
  "  root: 'inter', meaning: 'between', elementType: 'root', maxModels: Number.MAX_SAFE_INTEGER, checked: true, globalStatus: 'completed',",
  "  root: 'inter', meaning: 'between', elementType: 'root', maxModels: MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE, checked: true, globalStatus: 'completed',"
);
await replaceOne(
  'tests/associativvordes-persistence.test.mjs',
  "assert.equal(exported.state.result.accepted, true, 'completed result is exported');",
  "assert.equal(exported.state.result.accepted, true, 'completed result is exported');\nassert.equal(exported.state.maxModels, 5, 'the five-word limit is persisted');"
);
await replaceOne(
  'tests/associativvordes-persistence.test.mjs',
  "assert.equal(restored.model_key, 'en|latin|plain||inter|interact', 'canonical model identity survives restore');",
  "assert.equal(restored.model_key, 'en|latin|plain||inter|interact', 'canonical model identity survives restore');\nassert.equal(imported.state.maxModels, 5, 'the five-word limit survives restore');"
);
await replaceOne(
  'tests/associativvordes-persistence.test.mjs',
  `const completedImport = restoreAssociativeState(exported, { languages, createLanguageStatus });\nassert.equal(completedImport.state.globalStatus, 'completed', 'completed state is not marked for re-analysis');`,
  `const staleUnlimited = structuredClone(exported);\nstaleUnlimited.state.maxModels = Number.MAX_SAFE_INTEGER;\nassert.equal(restoreAssociativeState(staleUnlimited, { languages, createLanguageStatus }).state.maxModels, 5, 'older unlimited drafts are clamped to five words');\n\nconst completedImport = restoreAssociativeState(exported, { languages, createLanguageStatus });\nassert.equal(completedImport.state.globalStatus, 'completed', 'completed state is not marked for re-analysis');`
);

await rm('scripts/apply-five-word-limit.mjs', { force: true });
await rm('.github/workflows/apply-five-word-limit.yml', { force: true });
console.log('Applied five-word limit patch.');
