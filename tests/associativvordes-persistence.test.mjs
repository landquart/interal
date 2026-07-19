import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compactAssociativeState, restoreAssociativeState } from '../associativvordes/js/associative-state.js';
import { swowLabel } from '../associativvordes/js/render-results.js';

const script = await readFile('associativvordes/script.js', 'utf8');
const formDraft = await readFile('shared/form-draft.js', 'utf8');

assert.match(script, /compactAssociativeState\(state/, 'script exports through pure compact state adapter');
assert.match(script, /restoreAssociativeState\(saved/, 'script imports through pure restore state adapter');
assert.match(script, /importAssociativePageState[\s\S]*renderAll\(\)[\s\S]*setCalculateButtonStatus\(defaultCalculateButtonText\(\), false/, 'import restores result and leaves calculate button usable');
assert.match(script, /state = restored\.state;[\s\S]*for \(const lang of LANGUAGES\)[\s\S]*reconcileModelRepresentatives\(state\.languages\[lang\.code\], state\.root, lang\.code\)/, 'restored legacy rows are collapsed to one representative per canonical model before rendering');
assert.doesNotMatch(script.match(/function importAssociativePageState[\s\S]*?function resetAssociativePageState/)?.[0] || '', /analyzeAssociativeWord\(/, 'import does not call Qwen');
assert.doesNotMatch(script.match(/function importAssociativePageState[\s\S]*?function resetAssociativePageState/)?.[0] || '', /candidateIndexLoader\./, 'import does not load shards or index for display');
assert.match(formDraft, /if \(await restoreShortStateFromUrl\(\)\)[\s\S]*return true;[\s\S]*if \(restoreSharedStateFromUrl\(\)\)[\s\S]*return true;[\s\S]*initialRestoreSucceeded = restoreDraft\(\)/, 'URL priority remains ?s=, then ?state=, then local draft');
assert.match(formDraft, /if \(initialRestoreAttempted\) return initialRestoreSucceeded/, 'successful URL import prevents duplicate local restore');
assert.match(script, /window\.InteralFormDraft\?\.isRestoring\?\.\(\) \|\| isImportingAssociativeState/, 'isRestoring blocks invalidation during import');
assert.match(script, /invalidateAssociativeSearchResult\(state,[\s\S]*onInvalidateActiveRuns: invalidateActiveRuns/, 'root/meaning/element type changes invalidate previous result');
assert.match(formDraft, /window\.InteralPageReset\?\.\(\)/, 'reset calls page-specific reset hook');
assert.match(script, /function resetAssociativePageState\(\)[\s\S]*invalidateActiveRuns\(\)[\s\S]*state = emptyState\(\)/, 'reset cancels active run and clears only page state');
assert.match(script, /activeLang = restored\.activeLang/, 'active language is restored');
assert.match(script, /console\.warn\('Associativ vordes state version is incompatible; using defaults\.'\)/, 'incompatible versions are safely rejected');
assert.match(script, /function nextRunId\(\)[\s\S]*activeRunId \+= 1/, 'new calculation after restore gets a new run id');

const languages = ['en', 'de', 'fr', 'es', 'it', 'ru'];
const createLanguageStatus = (status = 'idle', extra = {}) => ({ status, errorCode: null, message: null, ...extra });
const state = {
  root: 'inter', meaning: 'between', elementType: 'root', maxModels: Number.MAX_SAFE_INTEGER, checked: true, globalStatus: 'completed',
  languageStatuses: Object.fromEntries(languages.map(code => [code, createLanguageStatus('completed')])),
  languages: Object.fromEntries(languages.map(code => [code, []]))
};
state.languages.en.push({
  word: 'interact', selected: true,
  model_key: 'en|latin|plain||inter|interact',
  sources: [{ id: 'en:web:fixture', file: '/tmp/private/web-fixture.tsv', category: 'web', ipm: 0 }],
  match: { type: 'exact', distance: 0, similarity: 1, fragment: 'inter', index: 0 },
  analysis: { swow: { bonus: 11, target_to_word: { found: true, r1_strength: 0.11, r123_strength: 0.22, diagnostic: { shard: 'not saved' } }, word_to_target: { found: false, r1_strength: null, r123_strength: null } } }
});

const exported = compactAssociativeState(state, { languages, activeLang: 'en', calculateResult: () => ({ finalAssociation: 40, totalAssociation: 50, representedLanguages: 1, representedGroups: 1, semanticConfirmed: true, accepted: true }) });
assert.equal(exported.version, 1, 'completed state exports through versioned compact page adapter');
assert.equal(exported.page, 'associativvordes', 'completed state exports page name');
assert.equal(exported.state.result.accepted, true, 'completed result is exported');
assert.equal(exported.state.languages.en[0].model_key, 'en|latin|plain||inter|interact', 'canonical model key survives compact export');
assert.doesNotMatch(JSON.stringify(exported), /diagnosticsState|manifest|shard|loader|cache|AbortController|Promise/, 'export avoids runtime diagnostics and non-JSON objects');

const imported = restoreAssociativeState(exported, { languages, createLanguageStatus, currentLang: () => 'en' });
const restored = imported.state.languages.en[0];
assert.deepEqual(restored.sources[0], { id: 'en:web:fixture', file: 'web-fixture.tsv', category: 'web', ipm: 0 }, 'source survives export/import with canonical id/file/category/ipm');
assert.equal(restored.sources[0].file.includes('/tmp/private'), false, 'compact source does not store absolute path');
assert.deepEqual(restored.match, { type: 'exact', distance: 0, similarity: 1, fragment: 'inter', index: 0 }, 'match survives export/import');
assert.equal(Object.hasOwn(restored.match, 'root'), false, 'match does not store fake root');
assert.equal(restored.model_key, 'en|latin|plain||inter|interact', 'canonical model identity survives restore');
assert.deepEqual(restored.analysis.swow, { bonus: 11, target_to_word: { found: true, r1_strength: 0.11, r123_strength: 0.22 }, word_to_target: { found: false, r1_strength: null, r123_strength: null } }, 'SWOW keeps only minimal evidence through round-trip');
assert.equal(swowLabel(restored.analysis.swow), 'SWOW direct', 'SWOW label is stable after reload');

const interrupted = structuredClone(exported);
interrupted.state.globalStatus = 'analyzing';
interrupted.state.languageStatuses.en = createLanguageStatus('loading_index');
const interruptedImport = restoreAssociativeState(interrupted, { languages, createLanguageStatus, currentLang: () => 'en' });
assert.equal(interruptedImport.state.globalStatus, 'aborted', 'interrupted global state becomes aborted');
assert.equal(interruptedImport.state.languageStatuses.en.status, 'aborted', 'interrupted language state becomes aborted');
assert.match(interruptedImport.state.languageStatuses.en.message, /previous calculation was interrupted/, 'English interrupted explanation is localized');

const completedImport = restoreAssociativeState(exported, { languages, createLanguageStatus });
assert.equal(completedImport.state.globalStatus, 'completed', 'completed state is not marked for re-analysis');
assert.equal(completedImport.state.languageStatuses.en.status, 'completed', 'completed language status is preserved');

console.log('associativvordes persistence tests passed');
