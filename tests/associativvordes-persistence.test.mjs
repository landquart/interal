import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const script = await readFile('associativvordes/script.js', 'utf8');
const formDraft = await readFile('shared/form-draft.js', 'utf8');

assert.match(script, /version: PAGE_STATE_VERSION,[\s\S]*page: PAGE_STATE_NAME,[\s\S]*state: \{/, 'completed state exports through versioned compact page adapter');
assert.match(script, /result: checked \? \{[\s\S]*finalAssociation[\s\S]*accepted[\s\S]*\} : null/, 'completed result is exported');
assert.match(script, /unwrapAssociativePageState[\s\S]*saved\.version === PAGE_STATE_VERSION[\s\S]*saved\.page === PAGE_STATE_NAME/, 'completed state imports from current adapter version');
assert.match(script, /importAssociativePageState[\s\S]*renderAll\(\)[\s\S]*setCalculateButtonStatus\(defaultCalculateButtonText\(\), false/, 'import restores result and leaves calculate button usable');
assert.doesNotMatch(script, /importAssociativePageState[\s\S]*analyzeAssociativeWord\(/, 'import does not call Qwen');
assert.doesNotMatch(script, /importAssociativePageState[\s\S]*candidateIndexLoader\./, 'import does not load shards or index for display');
assert.match(script, /\['loading_index', 'analyzing'\]\.includes\(restored\.status\)[\s\S]*'aborted'/, 'loading_index and analyzing restore as aborted');
assert.match(script, /Предыдущий расчёт был прерван\. Запустите его повторно\./, 'Russian interrupted explanation is localized');
assert.match(script, /The previous calculation was interrupted\. Run it again\./, 'English interrupted explanation is localized');
assert.match(formDraft, /if \(await restoreShortStateFromUrl\(\)\)[\s\S]*return true;[\s\S]*if \(restoreSharedStateFromUrl\(\)\)[\s\S]*return true;[\s\S]*initialRestoreSucceeded = restoreDraft\(\)/, 'URL priority remains ?s=, then ?state=, then local draft');
assert.match(formDraft, /if \(initialRestoreAttempted\) return initialRestoreSucceeded/, 'successful URL import prevents duplicate local restore');
assert.match(script, /window\.InteralFormDraft\?\.isRestoring\?\.\(\) \|\| isImportingAssociativeState/, 'isRestoring blocks invalidation during import');
assert.match(script, /state\.languages = emptyState\(\)\.languages;[\s\S]*state\.languageStatuses = emptyState\(\)\.languageStatuses;[\s\S]*state\.globalStatus = 'idle'/, 'root/meaning/element type changes invalidate previous result');
assert.match(formDraft, /window\.InteralPageReset\?\.\(\)/, 'reset calls page-specific reset hook');
assert.match(script, /function resetAssociativePageState\(\)[\s\S]*invalidateActiveRuns\(\)[\s\S]*state = emptyState\(\)/, 'reset cancels active run and clears only page state');
assert.match(script, /activeLang = LANGUAGES\.some/, 'active language is restored');
assert.match(script, /word: String\(item\.word \|\| ''\)/, 'original words including Russian are preserved');
assert.match(script, /match: compactStateMatch\(item\.match\)/, 'match metadata is preserved compactly');
assert.match(script, /MAX_STATE_SOURCES_PER_CANDIDATE[\s\S]*compactStateSource/, 'sources are compact and bounded');
assert.doesNotMatch(script.match(/function collectAssociativePageState[\s\S]*?function unwrapAssociativePageState/)?.[0] || '', /manifest|shard|loader|cache/i, 'full shard/loader cache is not exported by persistence adapter');
assert.doesNotMatch(script.match(/function collectAssociativePageState[\s\S]*?function unwrapAssociativePageState/)?.[0] || '', /diagnosticsState|diagnostics/i, 'diagnostics are not exported');
assert.match(formDraft, /interal_associative_state/, 'legacy Associativ vordes migration key remains readable');
assert.match(script, /console\.warn\('Associativ vordes state version is incompatible; using defaults\.'\)/, 'incompatible versions are safely rejected');
assert.match(script, /function nextRunId\(\)[\s\S]*activeRunId \+= 1/, 'new calculation after restore gets a new run id');
assert.match(script, /MAX_STATE_CANDIDATES_PER_LANGUAGE = 80[\s\S]*MAX_STATE_WARNING_LENGTH = 240[\s\S]*MAX_STATE_EXPLANATION_LENGTH = 1200/, 'URL share state remains compact');
assert.match(script, /return JSON\.parse\(JSON\.stringify\(payload\)\)/, 'export normalizes JSON and rejects circular values');
assert.doesNotMatch(script.match(/function collectAssociativePageState[\s\S]*?function unwrapAssociativePageState/)?.[0] || '', /new Map|new Set|AbortController|Promise|undefined/, 'export avoids non-JSON runtime objects');
assert.match(script, /function compactStateMatch\(match\)[\s\S]*return \{ type, distance, similarity, fragment, index \}/, 'root match is compacted with canonical real fields only');
assert.doesNotMatch(script.match(/function compactStateMatch[\s\S]*?function normalizeRestoredLanguageStatuses/)?.[0] || '', /\broot\b|\bmatched\b|\bsearch_form\b/, 'compact match does not save legacy/fake root, matched, or search_form fields');
assert.match(script, /const matchIndex = Number\.isInteger\(item\.match\?\.index\) \? item\.match\.index : null/, 'inferModel uses restored match index after reload');

const persistenceHelpers = script.match(/function sourceFileNameForState[\s\S]*?function collectAssociativePageState/)?.[0]?.replace(/\n    function collectAssociativePageState[\s\S]*$/, '');
assert.ok(persistenceHelpers, 'persistence source helpers are present');
const compactAssociativeLanguages = Function(`
  const LANGUAGES = [{ code: 'en' }, { code: 'de' }, { code: 'fr' }, { code: 'es' }, { code: 'it' }, { code: 'ru' }];
  const MAX_STATE_CANDIDATES_PER_LANGUAGE = 80;
  const MAX_STATE_SOURCES_PER_CANDIDATE = 12;
  const MAX_STATE_WARNING_LENGTH = 240;
  const MAX_STATE_EXPLANATION_LENGTH = 1200;
  function finiteOrNull(value) { const number = Number(value); return Number.isFinite(number) ? number : null; }
  ${persistenceHelpers}
  return compactAssociativeLanguages;
`)();
const sourceBeforeExport = { id: 'en:web:fixture', file: '/tmp/private/web-fixture.tsv', category: 'web', ipm: 0 };
const exportedLanguages = compactAssociativeLanguages({ en: [{ word: 'interact', sources: [sourceBeforeExport] }] });
const serializedLanguages = JSON.parse(JSON.stringify(exportedLanguages));
const importedLanguages = compactAssociativeLanguages(serializedLanguages);
const sourceAfterImport = importedLanguages.en[0].sources[0];
assert.deepEqual(sourceAfterImport, { id: sourceBeforeExport.id, file: 'web-fixture.tsv', category: sourceBeforeExport.category, ipm: sourceBeforeExport.ipm }, 'source survives export JSON import round-trip with canonical id/file/category/ipm');
assert.equal(Object.hasOwn(sourceAfterImport, 'value'), false, 'compact source does not replace ipm with value');
assert.equal(Object.hasOwn(sourceAfterImport, 'reference'), false, 'compact source does not replace id with reference');
assert.equal(sourceAfterImport.file.includes('/tmp/private'), false, 'compact source does not store absolute path');
const limitedSources = Array.from({ length: 13 }, (_, index) => ({ id: `src:${index}`, file: `source-${index}.tsv`, category: 'web', ipm: index }));
const limitedCandidate = compactAssociativeLanguages({ en: [{ word: 'truncate', sources: limitedSources }] }).en[0];
assert.equal(limitedCandidate.sources.length, 12, 'source limit is applied');
assert.equal(limitedCandidate.source_count, 13, 'source_count records full source count when truncated');
assert.equal(limitedCandidate.sources_truncated, true, 'sources_truncated does not hide truncation');

const matchCases = [
  { type: 'exact', distance: 0, similarity: 1, fragment: 'alter', index: 0 },
  { type: 'fuzzy', distance: 1, similarity: 0.8, fragment: 'altes', index: 0 },
  { type: 'special', distance: 0, similarity: 1, fragment: 'regul', index: 2 }
];
for (const match of matchCases) {
  const candidate = compactAssociativeLanguages({ en: [{ word: 'alteration', match }] }).en[0];
  assert.deepEqual(candidate.match, match, `${match.type} match survives export`);
  const restored = compactAssociativeLanguages({ en: [candidate] }).en[0];
  assert.deepEqual(restored.match, match, `${match.type} match survives import round-trip`);
  assert.equal(restored.match.distance, match.distance, `${match.type} distance survives details reload`);
  assert.equal(restored.match.similarity, match.similarity, `${match.type} similarity survives details reload`);
  assert.equal(restored.match.fragment, match.fragment, `${match.type} fragment survives details reload`);
  assert.equal(restored.match.index, match.index, `${match.type} index survives reload for model inference`);
  assert.equal(Object.hasOwn(restored.match, 'root'), false, `${match.type} match does not store fake root`);
  assert.equal(Object.hasOwn(restored.match, 'matched'), false, `${match.type} match does not store fake matched`);
  assert.equal(Object.hasOwn(restored.match, 'search_form'), false, `${match.type} match does not store fake search_form`);
}
assert.equal(compactAssociativeLanguages({ en: [{ word: 'zero', match: { type: 'exact', distance: 0, similarity: 0, fragment: 'z', index: 0 } }] }).en[0].match.similarity, 0, 'numeric zero in match survives and does not become null');
assert.equal(compactAssociativeLanguages({ en: [{ word: 'bad', match: { type: 'exact', distance: 0, similarity: 1, fragment: '', index: 0 } }] }).en[0].match, null, 'invalid match is safely normalized to null');
assert.equal(compactAssociativeLanguages({ en: [{ word: 'bad', match: { type: 'made-up', distance: 0, similarity: 1, fragment: 'x', index: 0 } }] }).en[0].match, null, 'unknown match type is safely normalized to null');
assert.equal(compactAssociativeLanguages({ en: [{ word: 'bad', match: { type: 'exact', distance: 0, similarity: 1, fragment: 'x', index: -1 } }] }).en[0].match, null, 'invalid match index is safely normalized to null');

console.log('associativvordes persistence tests passed');
