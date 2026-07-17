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
assert.match(script, /match: item\.match/, 'match metadata is preserved compactly');
assert.match(script, /MAX_STATE_SOURCES_PER_CANDIDATE[\s\S]*compactStateSource/, 'sources are compact and bounded');
assert.doesNotMatch(script.match(/function collectAssociativePageState[\s\S]*?function unwrapAssociativePageState/)?.[0] || '', /manifest|shard|loader|cache/i, 'full shard/loader cache is not exported by persistence adapter');
assert.doesNotMatch(script.match(/function collectAssociativePageState[\s\S]*?function unwrapAssociativePageState/)?.[0] || '', /diagnosticsState|diagnostics/i, 'diagnostics are not exported');
assert.match(formDraft, /interal_associative_state/, 'legacy Associativ vordes migration key remains readable');
assert.match(script, /console\.warn\('Associativ vordes state version is incompatible; using defaults\.'\)/, 'incompatible versions are safely rejected');
assert.match(script, /function nextRunId\(\)[\s\S]*activeRunId \+= 1/, 'new calculation after restore gets a new run id');
assert.match(script, /MAX_STATE_CANDIDATES_PER_LANGUAGE = 80[\s\S]*MAX_STATE_WARNING_LENGTH = 240[\s\S]*MAX_STATE_EXPLANATION_LENGTH = 1200/, 'URL share state remains compact');
assert.match(script, /return JSON\.parse\(JSON\.stringify\(payload\)\)/, 'export normalizes JSON and rejects circular values');
assert.doesNotMatch(script.match(/function collectAssociativePageState[\s\S]*?function unwrapAssociativePageState/)?.[0] || '', /new Map|new Set|AbortController|Promise|undefined/, 'export avoids non-JSON runtime objects');

console.log('associativvordes persistence tests passed');
