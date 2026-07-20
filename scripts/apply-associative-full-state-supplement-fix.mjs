import { readFile, writeFile, rm } from 'node:fs/promises';

async function replaceOne(path, before, after) {
  const source = await readFile(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one replacement, found ${count}`);
  await writeFile(path, source.replace(before, after));
}

await replaceOne(
  'associativvordes/script.js',
  `      candidateAt: (language, index) => (state.languages[language] || [])[index] || null\n    };`,
  `      candidateAt: (language, index) => (state.languages[language] || [])[index] || null,\n      allCandidates: (language) => state.languages[language] || []\n    };`
);

await replaceOne(
  'associativvordes/js/qwen-client.js',
  `async function waitForCandidateAnalysis(language, word, tokenIsCurrent) {\n  const key = buildSearchForm(word);\n  const deadline = Date.now() + QWEN_RUNTIME_CONFIG.supplementalAnalysisTimeoutMs;\n  while (Date.now() < deadline && tokenIsCurrent()) {\n    await delay(250);\n    const snapshot = window.InteralPageStateExport?.();\n    const candidate = (snapshot?.state?.languages?.[language] || []).find(item => buildSearchForm(item.word) === key);\n    if (!candidate) continue;\n    if (hasFiniteScore(candidateFinalScore(candidate))) return candidate;\n    if (candidate.analysisStatus === 'error' || candidate.analysis?.status === 'error') return null;\n  }\n  return null;\n}`,
  `async function waitForCandidateAnalysis(language, word, tokenIsCurrent) {\n  const deadline = Date.now() + QWEN_RUNTIME_CONFIG.supplementalAnalysisTimeoutMs;\n  while (Date.now() < deadline && tokenIsCurrent()) {\n    await delay(250);\n    const index = window.InteralAssociativeModels?.findIndexByWord?.(language, word) ?? -1;\n    const candidate = index >= 0 ? window.InteralAssociativeModels?.candidateAt?.(language, index) : null;\n    if (!candidate) continue;\n    if (hasFiniteScore(candidateFinalScore(candidate))) return candidate;\n    if (candidate.analysisStatus === 'error' || candidate.analysis?.status === 'error') return null;\n  }\n  return null;\n}`
);

await replaceOne(
  'associativvordes/js/qwen-client.js',
  `function rebalanceSelectedModels(originalUpdateItem) {\n  const snapshot = window.InteralPageStateExport?.();\n  for (const language of CONTROL_LANGUAGE_CODES) {\n    const candidates = snapshot?.state?.languages?.[language] || [];\n    const best = selectBestFinalModels(candidates, MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE);\n    const selected = new Set(best.map(candidateIdentity));\n    candidates.forEach((candidate, index) => {\n      const shouldSelect = selected.has(candidateIdentity(candidate));\n      if (Boolean(candidate.selected) !== shouldSelect) originalUpdateItem(language, index, 'selected', shouldSelect);\n    });\n  }\n}`,
  `function rebalanceSelectedModels(originalUpdateItem) {\n  for (const language of CONTROL_LANGUAGE_CODES) {\n    const candidates = window.InteralAssociativeModels?.allCandidates?.(language) || [];\n    const best = selectBestFinalModels(candidates, MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE);\n    const selected = new Set(best.map(candidateIdentity));\n    candidates.forEach((candidate, index) => {\n      const shouldSelect = selected.has(candidateIdentity(candidate));\n      if (Boolean(candidate.selected) !== shouldSelect) originalUpdateItem(language, index, 'selected', shouldSelect);\n    });\n  }\n}`
);

await rm('scripts/apply-associative-full-state-supplement-fix.mjs', { force: true });
await rm('.github/workflows/apply-associative-full-state-supplement-fix.yml', { force: true });
console.log('Applied full-state supplemental model fix.');
