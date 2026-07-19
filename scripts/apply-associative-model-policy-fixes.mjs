import { readFile, writeFile, rm } from 'node:fs/promises';

async function replaceOnce(path, search, replacement, label) {
  const source = await readFile(path, 'utf8');
  const count = typeof search === 'string' ? source.split(search).length - 1 : (source.match(search) ? 1 : 0);
  if (count !== 1) throw new Error(`${label}: expected one match in ${path}, found ${count}`);
  await writeFile(path, source.replace(search, replacement));
}

await replaceOnce(
  'associativvordes/js/candidate-model-family.js',
  "  const fragment = buildSearchForm(candidate?.match?.fragment || rootForm);",
  "  const fragment = buildSearchForm(candidate?.match?.type === 'special' ? candidate.match.fragment : rootForm);",
  'canonicalize non-special match fragments'
);

await replaceOnce(
  'associativvordes/js/qwen-client.js',
  "import { API_CONFIG } from './swow-client.js';\nimport { lexicalModelDescriptor, compareFrequencyRepresentatives } from './candidate-model-family.js';",
  "import { API_CONFIG } from './swow-client.js';\nimport { buildSearchForm } from './search-normalizer.js';\nimport { lexicalModelDescriptor, compareFrequencyRepresentatives } from './candidate-model-family.js';",
  'import search normalizer'
);
await replaceOnce(
  'associativvordes/js/qwen-client.js',
  "  enableReviewModel: true,",
  "  enableReviewModel: false,",
  'disable threshold-triggered review model'
);
await replaceOnce(
  'associativvordes/js/qwen-client.js',
  "  autoAnalyzeCandidatesPerLanguage: 5,",
  "  autoAnalyzeCandidatesPerLanguage: Infinity,",
  'analyze every model representative'
);
await replaceOnce(
  'associativvordes/js/qwen-client.js',
  "  maxReviewRequestsPerSearch: 5,",
  "  maxReviewRequestsPerSearch: 0,",
  'remove review request budget'
);
await replaceOnce(
  'associativvordes/js/qwen-client.js',
  "  window.updateItem(language, index, 'model', descriptor.label);\n  window.InteralAssociativeModels?.reconcile?.(language);\n  return true;",
  "  window.updateItem(language, index, 'model', descriptor.label);\n  return true;",
  'avoid detaching an in-flight analysis candidate'
);

await replaceOnce(
  'associativvordes/script.js',
  `    function scoringCandidates(langCode) {\n      const reconciled = reconcileModelRepresentatives(state.languages[langCode], state.root, langCode);\n      state.languages[langCode] = reconciled;\n      return reconciled\n        .filter(item => item.selected && Number.isFinite(wordWeight(item)))\n        .sort((a, b) => compareFrequencyRepresentatives(a, b));\n    }`,
  `    function scoringCandidates(langCode) {\n      return (state.languages[langCode] || [])\n        .filter(item => item.selected && Number.isFinite(wordWeight(item)))\n        .sort((a, b) => compareFrequencyRepresentatives(a, b));\n    }`,
  'keep rendering pure during asynchronous analysis'
);
await replaceOnce(
  'associativvordes/script.js',
  `    function groupByBestModel(items, maxModels = Infinity, langCode = 'en') {\n      return reconcileModelRepresentatives(items, state.root, langCode)\n        .filter(item => Number.isFinite(wordWeight(item)))\n        .slice(0, maxModels)\n        .map(item => ({ ...item, selected: true }));\n    }`,
  `    function groupByBestModel(items, _maxModels = Infinity, langCode = 'en') {\n      return reconcileModelRepresentatives(items, state.root, langCode)\n        .filter(item => Number.isFinite(wordWeight(item)))\n        .map(item => ({ ...item, selected: true }));\n    }`,
  'remove residual model cap'
);

const policyPath = 'tests/associative-model-selection-policy.test.mjs';
let policy = await readFile(policyPath, 'utf8');
policy = policy.replace(
  "assert.match(qwen, /InteralAssociativeModels\\?\\.reconcile/);",
  "assert.doesNotMatch(qwen, /InteralAssociativeModels\\?\\.reconcile/, 'Qwen insertion waits for analyzeItem to reconcile after scoring');\nassert.match(qwen, /autoAnalyzeCandidatesPerLanguage: Infinity/);"
);
await writeFile(policyPath, policy);

await rm('scripts/apply-associative-model-policy-fixes.mjs', { force: true });
await rm('.github/workflows/apply-associative-model-policy-fixes.yml', { force: true });
console.log('Applied associative model policy fixes.');
