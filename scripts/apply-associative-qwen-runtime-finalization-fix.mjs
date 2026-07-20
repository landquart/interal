import { readFile, writeFile, rm } from 'node:fs/promises';

async function replaceOne(path, before, after) {
  const source = await readFile(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one replacement, found ${count}`);
  await writeFile(path, source.replace(before, after));
}

async function replaceSection(path, startMarker, endMarker, replacement) {
  const source = await readFile(path, 'utf8');
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`${path}: start marker not found: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`${path}: end marker not found: ${endMarker}`);
  if (source.indexOf(startMarker, start + startMarker.length) >= 0) throw new Error(`${path}: start marker is not unique: ${startMarker}`);
  await writeFile(path, `${source.slice(0, start)}${replacement}${source.slice(end)}`);
}

const qwenPath = 'associativvordes/js/qwen-client.js';

await replaceOne(
  qwenPath,
  `export function selectBestFinalModels(candidates, limit = MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE) {\n  const representatives = new Map();\n  for (const candidate of Array.isArray(candidates) ? candidates : []) {\n    if (!hasFiniteScore(candidateFinalScore(candidate))) continue;\n    const key = String(candidate?.model_key || candidate?.model_family_key || candidate?.model || buildSearchForm(candidate?.word));\n    if (!key) continue;\n    const current = representatives.get(key);\n    if (!current || compareFrequencyRepresentatives(candidate, current) < 0) representatives.set(key, candidate);\n  }\n  return [...representatives.values()]\n    .sort(compareFinalModelCandidates)\n    .slice(0, Math.max(0, Number(limit) || 0));\n}\n\nfunction stateCandidateHasQwen(candidate) {`,
  `export function selectBestFinalModels(candidates, limit = MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE) {\n  const representatives = new Map();\n  for (const candidate of Array.isArray(candidates) ? candidates : []) {\n    if (!hasFiniteScore(candidateFinalScore(candidate))) continue;\n    const key = String(candidate?.model_key || candidate?.model_family_key || candidate?.model || buildSearchForm(candidate?.word));\n    if (!key) continue;\n    const current = representatives.get(key);\n    if (!current || compareFrequencyRepresentatives(candidate, current) < 0) representatives.set(key, candidate);\n  }\n  return [...representatives.values()]\n    .sort(compareFinalModelCandidates)\n    .slice(0, Math.max(0, Number(limit) || 0));\n}\n\nexport function finalizeCandidateOrdering(candidates, limit = MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE) {\n  const source = Array.isArray(candidates) ? candidates : [];\n  const best = selectBestFinalModels(source, limit);\n  const selected = new Set(best.map(candidateIdentity));\n  const remaining = source.filter(candidate => !selected.has(candidateIdentity(candidate)));\n  return [...best, ...remaining].map(candidate => ({\n    ...candidate,\n    selected: selected.has(candidateIdentity(candidate))\n  }));\n}\n\nfunction stateCandidateHasQwen(candidate) {`
);

await replaceSection(qwenPath, 'function candidateCountFromPanel() {', 'function modelForGeneratedCandidate', '');

await replaceSection(
  qwenPath,
  'function applyVerifiedCandidateData',
  'function installAssociativeBrowserEnhancements',
  `function runtimeCandidates(language) {\n  const candidates = window.InteralAssociativeModels?.allCandidates?.(language);\n  return Array.isArray(candidates) ? candidates : null;\n}\n\nfunction verifiedCandidatePatch(suggestion, entry, root, descriptor, { resetAnalysis = false } = {}) {\n  const searchForm = entry.search_form || buildSearchForm(entry.word);\n  const variant = buildSearchForm(suggestion.root_variant || root);\n  const variantIndex = variant ? searchForm.indexOf(variant) : -1;\n  const fragment = variantIndex >= 0 ? variant : buildSearchForm(suggestion.word);\n  const match = { type: 'special', distance: 0, similarity: 1, fragment, index: Math.max(0, variantIndex) };\n  const frequencyProfile = {\n    frequency_score: entry.frequency_score,\n    category_breakdown: entry.category_breakdown || {},\n    rank: entry.rank ?? null,\n    sources: Array.isArray(entry.sources) ? entry.sources : [],\n    warnings: []\n  };\n  const patch = {\n    ...entry,\n    word: entry.word,\n    normalized: entry.normalized || entry.word,\n    search_form: searchForm,\n    match,\n    rank: entry.rank ?? null,\n    category_breakdown: entry.category_breakdown || {},\n    sources: Array.isArray(entry.sources) ? entry.sources : [],\n    frequencyProfile,\n    warnings: [...new Set([...(Array.isArray(entry.warnings) ? entry.warnings : []), 'qwen_suggestion_verified_in_local_index'])],\n    model_key: descriptor.key,\n    model_family_key: descriptor.key,\n    model: descriptor.label\n  };\n  if (resetAnalysis) {\n    Object.assign(patch, {\n      analysis: null,\n      analysisStatus: 'pending',\n      association_score: null,\n      final_score: null,\n      selected: false\n    });\n  }\n  return patch;\n}\n\nfunction applyVerifiedCandidateData(language, index, suggestion, entry, root, descriptor, options) {\n  const candidates = runtimeCandidates(language);\n  const current = candidates?.[index];\n  if (!current) return null;\n  Object.assign(current, verifiedCandidatePatch(suggestion, entry, root, descriptor, options));\n  return current;\n}\n\nasync function analyzeRuntimeCandidate(language, index, word, tokenIsCurrent) {\n  if (!Number.isInteger(index) || index < 0 || !tokenIsCurrent()) return null;\n  const current = runtimeCandidates(language)?.[index];\n  if (!current) return null;\n  if (!hasFiniteScore(candidateFinalScore(current))) await window.analyzeItem(language, index);\n  return await waitForCandidateAnalysis(language, word || current.word, tokenIsCurrent);\n}\n\nasync function addVerifiedCandidateToRuntime(language, suggestion, entry, root, tokenIsCurrent) {\n  const descriptor = modelForGeneratedCandidate(entry, suggestion, root, language);\n  const proposed = {\n    ...entry,\n    model_key: descriptor.key,\n    model_family_key: descriptor.key,\n    model: descriptor.label,\n    frequencyProfile: { frequency_score: entry.frequency_score }\n  };\n  const exactIndex = window.InteralAssociativeModels?.findIndexByWord?.(language, entry.word) ?? -1;\n  if (exactIndex >= 0) {\n    applyVerifiedCandidateData(language, exactIndex, suggestion, entry, root, descriptor, { resetAnalysis: false });\n    return await analyzeRuntimeCandidate(language, exactIndex, entry.word, tokenIsCurrent);\n  }\n\n  const modelIndex = window.InteralAssociativeModels?.findIndexByModel?.(language, descriptor.key) ?? -1;\n  if (modelIndex >= 0) {\n    const existing = runtimeCandidates(language)?.[modelIndex];\n    if (existing && compareFrequencyRepresentatives(proposed, existing) < 0) {\n      applyVerifiedCandidateData(language, modelIndex, suggestion, entry, root, descriptor, { resetAnalysis: true });\n      return await analyzeRuntimeCandidate(language, modelIndex, entry.word, tokenIsCurrent);\n    }\n    return await analyzeRuntimeCandidate(language, modelIndex, existing?.word, tokenIsCurrent);\n  }\n\n  if (!tokenIsCurrent()) return null;\n  const candidates = runtimeCandidates(language);\n  if (!candidates) return null;\n  candidates.push(verifiedCandidatePatch(suggestion, entry, root, descriptor, { resetAnalysis: true }));\n  const index = candidates.length - 1;\n  return await analyzeRuntimeCandidate(language, index, entry.word, tokenIsCurrent);\n}\n\nfunction rebalanceSelectedModels(originalUpdateItem) {\n  let renderTarget = null;\n  for (const language of CONTROL_LANGUAGE_CODES) {\n    const candidates = runtimeCandidates(language);\n    if (!candidates?.length) continue;\n    const finalized = finalizeCandidateOrdering(candidates, MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE);\n    candidates.splice(0, candidates.length, ...finalized);\n    renderTarget ||= [language, 0];\n  }\n  if (!renderTarget) return;\n  const [language, index] = renderTarget;\n  const candidate = runtimeCandidates(language)?.[index];\n  if (candidate) originalUpdateItem(language, index, 'selected', Boolean(candidate.selected));\n}\n\n`
);

await replaceOne(
  qwenPath,
  `          await addVerifiedCandidateToRuntime(language, suggestion, entry, rootAtClick, originalUpdateItem, tokenIsCurrent);`,
  `          await addVerifiedCandidateToRuntime(language, suggestion, entry, rootAtClick, tokenIsCurrent);`
);

const testSource = String.raw`import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { finalizeCandidateOrdering } from '../associativvordes/js/qwen-client.js';

const initial = [
  { word: 'alternative', model_key: 'm1', frequency_score: 95, final_score: 35, selected: true },
  { word: 'alteration', model_key: 'm2', frequency_score: 90, final_score: 50, selected: true },
  { word: 'alterity', model_key: 'm3', frequency_score: 85, final_score: 45, selected: true },
  { word: 'alternate', model_key: 'm4', frequency_score: 80, final_score: 40, selected: true },
  { word: 'alterable', model_key: 'm5', frequency_score: 75, final_score: 30, selected: true },
  ...Array.from({ length: 100 }, (_, index) => ({ word: 'unscored-' + index, model_key: 'unscored-' + index, frequency_score: 10, final_score: null, selected: false })),
  { word: 'altruism', model_key: 'm6', frequency_score: 60, final_score: 82, selected: false },
  { word: 'altruist', model_key: 'm7', frequency_score: 55, final_score: 78, selected: false }
];

const finalized = finalizeCandidateOrdering(initial, 5);
assert.deepEqual(finalized.slice(0, 5).map(candidate => candidate.word), ['altruism', 'altruist', 'alteration', 'alterity', 'alternate'], 'supplemental winners are moved into the visible top five in final-P order');
assert.equal(finalized.filter(candidate => candidate.selected).length, 5, 'exactly five scored models remain selected');
assert.ok(finalized.findIndex(candidate => candidate.word === 'altruism') < 5, 'a supplement originally below the first 100 rows is promoted into view');
assert.equal(initial[0].selected, true, 'finalization does not mutate the caller array');
assert.notStrictEqual(finalized[0], initial.at(-2), 'finalization returns safe candidate copies');

const source = await readFile('associativvordes/js/qwen-client.js', 'utf8');
assert.doesNotMatch(source, /function candidateCountFromPanel/, 'runtime insertion no longer derives a state index from localized UI text');
assert.doesNotMatch(source, /function activateLanguageTab/, 'runtime insertion no longer changes the active language tab');
assert.doesNotMatch(source, /originalUpdateItem\(language, index, 'word'/, 'supplement insertion cannot trigger the normal word-change analysis hook');
assert.match(source, /candidates\.push\(verifiedCandidatePatch/, 'new supplements are appended directly to the runtime state');
assert.match(source, /candidates\.splice\(0, candidates\.length, \.\.\.finalized\)/, 'the final top five are physically reordered before rendering');

const analyzeStart = source.indexOf('async function analyzeRuntimeCandidate');
const analyzeEnd = source.indexOf('async function addVerifiedCandidateToRuntime', analyzeStart);
assert.ok(analyzeStart >= 0 && analyzeEnd > analyzeStart, 'runtime analysis function is present');
const analyzeBlock = source.slice(analyzeStart, analyzeEnd);
assert.equal((analyzeBlock.match(/window\.analyzeItem/g) || []).length, 1, 'each supplemental candidate has one explicit analysis entry point');

console.log('Associative Qwen runtime finalization tests passed.');
`;

await writeFile('tests/associative-qwen-runtime-finalization.test.mjs', testSource);
await rm('scripts/apply-associative-qwen-runtime-finalization-fix.mjs', { force: true });
await rm('.github/workflows/apply-associative-qwen-runtime-finalization-fix.yml', { force: true });
console.log('Applied associative Qwen runtime finalization fix.');
