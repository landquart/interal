import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  addManualCandidate,
  compactAssociativeState,
  createEmptyAssociativeState,
  deleteCandidate,
  invalidateSearchResult,
  restoreAssociativeState,
  updateCandidate
} from '../associativvordes/js/associative-state.js';

const LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'ru'];
const createLanguageStatus = (status = 'idle', extra = {}) => ({ status, errorCode: null, message: null, ...extra });

function populatedState() {
  const state = createEmptyAssociativeState({ languages: LANGUAGES, createLanguageStatus });
  Object.assign(state, {
    root: 'inter',
    meaning: 'between',
    checked: true,
    globalStatus: 'completed',
    languageStatuses: {
      en: createLanguageStatus('completed'),
      de: createLanguageStatus('completed'),
      fr: createLanguageStatus('index_error'),
      es: createLanguageStatus('no_candidates'),
      it: createLanguageStatus('completed'),
      ru: createLanguageStatus('completed')
    },
    languages: {
      en: [{ word: 'interact', selected: true, final_score: 42, frequency_score: 20, analysis: { association: { semantic_confirmed: true } } }],
      de: [{ word: 'international', selected: true, final_score: 45 }],
      fr: [{ word: 'intérieur', selected: true, final_score: 44 }],
      es: [],
      it: [{ word: 'intero', selected: true, final_score: 50 }],
      ru: [{ word: 'интервал', selected: true, final_score: 48 }]
    }
  });
  return state;
}

{
  const state = populatedState();
  const row = addManualCandidate(state, 'en');
  assert.equal(state.languages.en.at(-1), row, 'addRow stores the new row');
  assert.equal(state.languages.en.length, 2, 'addRow keeps existing language rows');
  assert.equal(state.languages.de.length, 1, 'addRow does not clear other languages');
  assert.equal(state.checked, true, 'addRow keeps existing results visible');
  assert.equal(state.globalStatus, 'completed', 'addRow preserves the completed result state');
}

{
  const state = populatedState();
  updateCandidate(state, 'en', 0, 'word', 'interstellar', {
    inferModel: (word, root) => String(word).startsWith(root) ? `${root}-...` : 'manual',
    normalizeText: value => String(value || '').trim().toLowerCase()
  });
  assert.equal(state.languages.en.length, 1, 'editing a word does not remove its row');
  assert.equal(state.languages.en[0].word, 'interstellar', 'word edit is applied');
  assert.equal(state.languages.en[0].model, 'inter-...', 'word edit refreshes model');
  assert.equal(state.languages.en[0].analysis, null, 'word edit clears stale analysis for that item');
  assert.equal(state.languages.de[0].word, 'international', 'word edit leaves other languages intact');
  assert.equal(state.checked, true, 'word edit keeps the results table visible while the item is reanalyzed');
}

{
  const state = populatedState();
  updateCandidate(state, 'ru', 0, 'selected', false);
  assert.equal(state.languages.ru[0].selected, false, 'checkbox value is applied');
  assert.equal(state.languages.en.length, 1, 'checkbox does not clear another language');
  assert.equal(state.languageStatuses.en.status, 'completed', 'checkbox does not clear language statuses');
  assert.equal(state.checked, true, 'checkbox keeps the full result visible');
  assert.equal(state.globalStatus, 'completed', 'checkbox preserves the completed calculation status');
}

{
  const state = populatedState();
  const removed = deleteCandidate(state, 'ru', 0);
  assert.equal(removed.word, 'интервал', 'delete removes only the requested candidate');
  assert.deepEqual(state.languages.ru, [], 'deleted candidate is removed from its language');
  assert.equal(state.languages.en.length, 1, 'delete keeps candidates in other languages');
  assert.equal(state.checked, true, 'delete keeps the remaining result visible');
}

{
  const state = populatedState();
  let aborted = 0;
  invalidateSearchResult(state, {
    languages: LANGUAGES,
    createEmptyState: () => createEmptyAssociativeState({ languages: LANGUAGES, createLanguageStatus }),
    onInvalidateActiveRuns: () => { aborted += 1; }
  });
  assert.deepEqual(state.languages.en, [], 'changing root clears old English results');
  assert.deepEqual(state.languages.ru, [], 'changing root clears old Russian results');
  assert.equal(state.languageStatuses.fr.status, 'idle', 'changing root resets stale language statuses');
  assert.equal(state.checked, false, 'changing a search input hides the obsolete result');
  assert.equal(aborted, 1, 'changing root aborts active work');
}

{
  const state = createEmptyAssociativeState({ languages: LANGUAGES, createLanguageStatus });
  state.languages.en.push({
    word: 'interact',
    selected: true,
    sources: [{ id: 'bnc-1', file: '/corpora/bnc.tsv', category: 'general', ipm: 12.5 }],
    match: { type: 'fuzzy', distance: 1, similarity: 0.91, fragment: 'inter', index: 0 },
    analysis: { swow: { bonus: 10, target_to_word: { found: true, r1_strength: 2, r123_strength: 4 }, word_to_target: { found: false, r1_strength: null, r123_strength: 1 } } }
  });
  const exported = compactAssociativeState(state, { languages: LANGUAGES, activeLang: 'en' });
  const imported = restoreAssociativeState(exported, { languages: LANGUAGES, createLanguageStatus });
  const candidate = imported.state.languages.en[0];
  assert.deepEqual(candidate.sources, [{ id: 'bnc-1', file: 'bnc.tsv', category: 'general', ipm: 12.5 }], 'export/import preserves sources');
  assert.deepEqual(candidate.match, { type: 'fuzzy', distance: 1, similarity: 0.91, fragment: 'inter', index: 0 }, 'export/import preserves match');
  assert.deepEqual(candidate.analysis.swow, { bonus: 10, target_to_word: { found: true, r1_strength: 2, r123_strength: 4 }, word_to_target: { found: false, r1_strength: null, r123_strength: 1 } }, 'export/import preserves SWOW');
}

{
  const exported = compactAssociativeState(populatedState(), { languages: LANGUAGES, activeLang: 'en' });
  exported.state.globalStatus = 'analyzing';
  exported.state.languageStatuses.en = createLanguageStatus('analyzing');
  const imported = restoreAssociativeState(exported, { languages: LANGUAGES, createLanguageStatus, currentLang: () => 'en' });
  assert.equal(imported.state.globalStatus, 'aborted', 'interrupted global state becomes aborted');
  assert.equal(imported.state.languageStatuses.en.status, 'aborted', 'interrupted language state becomes aborted');
}

{
  const exported = compactAssociativeState(populatedState(), { languages: LANGUAGES, activeLang: 'en' });
  const imported = restoreAssociativeState(exported, { languages: LANGUAGES, createLanguageStatus });
  assert.equal(imported.state.globalStatus, 'completed', 'completed state remains completed after import');
  assert.equal(imported.state.languageStatuses.en.status, 'completed', 'completed language state is not marked for re-analysis');
}

{
  const script = await readFile('associativvordes/script.js', 'utf8');
  assert.match(script, /from '\.\/js\/associative-state\.js'/, 'script.js is wired to the pure state module');
  assert.match(script, /addManualCandidate\(state, lang\)/, 'addRow delegates to the pure add candidate function');
  assert.match(script, /restoreAssociativeState\(saved/, 'import delegates to pure restore logic');
  assert.match(script, /element\.hidden = !checked/, 'result visibility remains controlled only by the completed-search flag');
}

console.log('associativvordes state behavior tests passed');
