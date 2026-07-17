import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const script = await readFile('associativvordes/script.js', 'utf8');

function extractFunction(name) {
  const start = script.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const braceStart = script.indexOf('{', start);
  let depth = 0;
  for (let index = braceStart; index < script.length; index += 1) {
    const char = script[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return script.slice(start, index + 1);
  }
  throw new Error(`Could not parse ${name}`);
}

const source = [
  extractFunction('shouldSkipAssociativeInvalidation'),
  extractFunction('invalidateSearchResult'),
  extractFunction('invalidateFinalCalculation'),
  extractFunction('updateItem'),
  extractFunction('deleteItem'),
  extractFunction('addRow')
].join('\n');

function createHarness() {
  const calls = { renderAll: 0, save: 0, checked: 0, json: 0, aborted: 0, analyze: [] };
  const LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'ru'];
  const emptyState = () => ({
    languages: Object.fromEntries(LANGUAGES.map(code => [code, []])),
    languageStatuses: Object.fromEntries(LANGUAGES.map(code => [code, { status: 'idle' }]))
  });
  const state = {
    root: 'inter',
    meaning: 'between',
    elementType: 'root',
    checked: true,
    globalStatus: 'completed',
    languageStatuses: {
      en: { status: 'completed' },
      de: { status: 'completed' },
      fr: { status: 'index_error' },
      es: { status: 'no_candidates' },
      it: { status: 'completed' },
      ru: { status: 'completed' }
    },
    languages: {
      en: [
        { word: 'interact', model: 'inter-...', selected: true, final_score: 42, association_score: 50, frequency_score: 20, analysis: { association: { semantic_confirmed: true } } },
        { word: 'internal', model: 'inter-...', selected: false, final_score: 20 }
      ],
      de: [{ word: 'international', model: 'inter-...', selected: true, final_score: 45 }],
      fr: [{ word: 'intérieur', model: 'inter-...', selected: true, final_score: 44 }],
      es: [],
      it: [{ word: 'intero', model: 'inter-...', selected: true, final_score: 50 }],
      ru: [{ word: 'интервал', model: 'inter-...', selected: true, final_score: 48 }]
    }
  };

  const factory = new Function('state', 'emptyState', 'calls', `
    let isImportingAssociativeState = false;
    const window = { InteralFormDraft: { isRestoring: () => false, save: () => { calls.save += 1; } } };
    function invalidateActiveRuns() { calls.aborted += 1; }
    function syncCheckedVisibility() { calls.checked += 1; }
    function syncJsonCardButtonVisibility() { calls.json += 1; }
    function renderAll() { calls.renderAll += 1; }
    function normalizeText(value) { return String(value || '').trim().toLowerCase(); }
    function inferModel(value, root) { return String(value || '').startsWith(root) ? root + '-...' : 'manual'; }
    function analyzeItem(lang, idx) { calls.analyze.push({ lang, idx, word: state.languages[lang][idx]?.word }); }
    ${source}
    return { invalidateSearchResult, invalidateFinalCalculation, updateItem, deleteItem, addRow };
  `);

  return { api: factory(state, emptyState, calls), state, calls };
}

{
  const { api, state, calls } = createHarness();
  api.addRow('en');
  assert.equal(state.languages.en.length, 3, 'addRow keeps the new row');
  assert.equal(state.languages.de.length, 1, 'addRow does not clear other languages');
  assert.deepEqual(state.languageStatuses.fr, { status: 'index_error' }, 'addRow preserves language statuses');
  assert.equal(state.checked, false, 'addRow invalidates only the final checked state');
  assert.equal(calls.save, 1, 'addRow persists the changed state');
}

{
  const { api, state, calls } = createHarness();
  api.updateItem('en', 0, 'word', 'interstellar');
  assert.equal(state.languages.en.length, 2, 'editing a word does not remove its row');
  assert.equal(state.languages.en[0].word, 'interstellar', 'word edit is applied');
  assert.equal(state.languages.en[0].analysis, null, 'word edit clears stale analysis for that item only');
  assert.equal(state.languages.de[0].word, 'international', 'word edit leaves other languages intact');
  assert.deepEqual(state.languageStatuses.es, { status: 'no_candidates' }, 'word edit does not clear all language statuses');
  assert.deepEqual(calls.analyze, [{ lang: 'en', idx: 0, word: 'interstellar' }], 'manual analysis starts for a non-empty edited word');
  assert.equal(calls.save, 1, 'word edit persists invalidated final calculation');
}

{
  const { api, state, calls } = createHarness();
  api.updateItem('ru', 0, 'selected', false);
  assert.equal(state.languages.ru.length, 1, 'checkbox edit keeps the language rows');
  assert.equal(state.languages.ru[0].selected, false, 'checkbox value is applied');
  assert.equal(state.languages.en.length, 2, 'checkbox edit does not clear all languages');
  assert.equal(state.languageStatuses.en.status, 'completed', 'checkbox edit preserves language statuses');
  assert.equal(state.checked, false, 'checkbox edit invalidates final calculation');
  assert.equal(calls.save, 1, 'checkbox edit persists changes');
}

{
  const { api, state, calls } = createHarness();
  api.deleteItem('en', 1);
  assert.deepEqual(state.languages.en.map(item => item.word), ['interact'], 'deleteItem removes only the selected row');
  assert.deepEqual(state.languages.de.map(item => item.word), ['international'], 'deleteItem leaves other languages intact');
  assert.equal(state.languageStatuses.fr.status, 'index_error', 'deleteItem preserves statuses');
  assert.equal(calls.save, 1, 'deleteItem persists changes');
}

{
  const { api, state, calls } = createHarness();
  api.invalidateSearchResult();
  assert.deepEqual(state.languages.en, [], 'search invalidation clears candidates');
  assert.deepEqual(state.languages.ru, [], 'search invalidation clears all candidate languages');
  assert.equal(state.languageStatuses.fr.status, 'idle', 'search invalidation clears statuses');
  assert.equal(state.checked, false, 'search invalidation clears checked final result');
  assert.equal(calls.aborted, 1, 'search invalidation aborts active calculations');
  assert.equal(calls.save, 1, 'search invalidation persists changes');
}

console.log('associativvordes state invalidation tests passed');
