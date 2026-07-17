import assert from 'node:assert/strict';
import { compactAssociativeState, restoreAssociativeState } from '../associativvordes/js/associative-state.js';
import { associativeWordWeight, rankSortValue } from '../associativvordes/js/associative-numeric.js';

const languages = ['en', 'de', 'fr', 'es', 'it', 'ru'];
const createLanguageStatus = (status = 'idle', extra = {}) => ({ status, errorCode: null, message: null, ...extra });
const emptyLanguages = () => Object.fromEntries(languages.map(code => [code, []]));
const baseState = () => ({
  root: 'inter',
  meaning: 'between',
  elementType: 'root',
  maxModels: 5,
  checked: false,
  globalStatus: 'idle',
  languageStatuses: Object.fromEntries(languages.map(code => [code, createLanguageStatus('idle') ])),
  languages: emptyLanguages()
});

function compactFirst(candidate) {
  const state = baseState();
  state.languages.en.push({ word: 'interact', selected: true, model: 'inter', ...candidate });
  return compactAssociativeState(state, { languages, activeLang: 'en' }).state.languages.en[0];
}

assert.equal(compactFirst({ rank: null }).rank, null, 'compactAssociativeState keeps rank:null as null');
assert.equal(compactFirst({ final_score: null }).final_score, null, 'compactAssociativeState keeps final_score:null as null');
assert.equal(compactFirst({ final_score: 0 }).final_score, 0, 'compactAssociativeState keeps real final_score:0 as 0');
assert.equal(compactFirst({ final_score: '35' }).final_score, 35, 'compactAssociativeState converts non-empty finite numeric strings');
assert.equal(compactFirst({ final_score: '', rank: false }).final_score, null, 'compactAssociativeState treats an empty string as missing');
assert.equal(compactFirst({ final_score: '', rank: false }).rank, null, 'compactAssociativeState treats boolean rank as missing');

const state = baseState();
state.languages.en.push({
  word: 'interact',
  selected: true,
  model: 'inter',
  rank: null,
  frequency_score: null,
  association_score: null,
  final_score: null,
  analysis: { final_score: null, frequency: { frequency_score: null }, warnings: [] }
});
state.languages.de.push({
  word: 'Interaktion',
  selected: true,
  model: 'inter',
  rank: 1,
  frequency_score: 0,
  association_score: 0,
  final_score: 0,
  analysis: { final_score: 0, frequency: { frequency_score: 0 }, warnings: [] }
});
const exported = compactAssociativeState(state, { languages, activeLang: 'en' });
const imported = restoreAssociativeState(exported, { languages, createLanguageStatus, currentLang: () => 'en' }).state;
assert.equal(imported.languages.en[0].rank, null, 'export/import does not convert missing rank to zero');
assert.equal(imported.languages.en[0].final_score, null, 'export/import does not convert missing final_score to zero');
assert.equal(imported.languages.en[0].analysis.final_score, null, 'export/import does not convert missing analysis.final_score to zero');
assert.equal(imported.languages.de[0].final_score, 0, 'export/import keeps real final_score zero');
assert.equal(imported.languages.de[0].analysis.final_score, 0, 'export/import keeps real analysis.final_score zero');

const ranked = { word: 'ranked', model: 'same', final_score: 50, rank: 1 };
const unranked = { word: 'unranked', model: 'same', final_score: 50, rank: null };
const betterAtTie = [unranked, ranked].reduce((current, item) => {
  if (!current) return item;
  const itemScore = associativeWordWeight(item);
  const currentScore = associativeWordWeight(current);
  if (itemScore > currentScore) return item;
  if (itemScore === currentScore && rankSortValue(item.rank) < rankSortValue(current.rank)) return item;
  return current;
}, null);
assert.equal(betterAtTie.word, 'ranked', 'rank:1 wins over rank:null when final scores tie');

assert.equal(associativeWordWeight({ final_score: null, analysis: {} }), null, 'missing final_score is not treated as a zero score');
assert.equal(associativeWordWeight({ analysis: { final_score: null } }), null, 'missing analysis.final_score is not treated as a zero score');
assert.equal(associativeWordWeight({ final_score: 0, analysis: { final_score: 50 } }), 0, 'real final_score zero remains a real score');
assert.equal(Number.isFinite(associativeWordWeight({ final_score: null, analysis: {} })), false, 'candidate with missing final_score is skipped by finite-score filtering');

console.log('associativvordes null numeric tests passed');
