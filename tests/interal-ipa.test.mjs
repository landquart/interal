import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transcribeInteral } from '../shared/interal-ipa.mjs';

assert.equal(transcribeInteral('pesar', { partOfSpeech: 'verb' }), 'peˈzar');
assert.equal(transcribeInteral('PESAR', { partOfSpeech: 'verb' }), 'peˈzar');
assert.equal(transcribeInteral('casa'), 'ˈkaza');
assert.equal(transcribeInteral('dre'), 'dre');
assert.equal(transcribeInteral('exámen'), 'eˈkzamen');

const hookSource = await readFile('shared/altervordes-ipa-hook.js', 'utf8');
assert.match(hookSource, /section === 'altervordes'/);
assert.match(hookSource, /transcribeInteral\(word/);
assert.match(hookSource, /existingIpa/);

const altervordesHtml = await readFile('altervordes/index.html', 'utf8');
assert.match(altervordesHtml, /shared\/altervordes-ipa-hook\.js/);

const card = JSON.parse(
  await readFile('cards/accepted/al/al_PJGrBLWQYMqT.json', 'utf8')
);
assert.equal(card.interal.word, 'pesar');
assert.equal(card.interal.ipa, 'peˈzar');

const registry = JSON.parse(await readFile('cards/registry.json', 'utf8'));
const registryCard = registry.cards.find((item) => item.id === 'al_PJGrBLWQYMqT');
assert.ok(registryCard);
assert.equal(registryCard.ipa, 'peˈzar');
assert.match(registryCard.search_blob, /peˈzar/);

console.log('Interal IPA generation tests passed.');
