import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dictionary = JSON.parse(await readFile('indoeuropanvordes/pie_vordes', 'utf8'));
assert.deepEqual(dictionary.languages, ['en', 'de', 'fr', 'es', 'it', 'ru', 'el', 'hi', 'fa']);
assert.equal(dictionary.items.length, 167);

for (const item of dictionary.items) {
  for (const code of ['hi', 'fa']) {
    assert.ok(item[code] && typeof item[code].word === 'string' && item[code].word.trim(), `${item.id}: ${code} word is required`);
    assert.equal(typeof item[code].romanization, 'string', `${item.id}: ${code} romanization field is required`);
    assert.equal(typeof item[code].ipa, 'string', `${item.id}: ${code} IPA field is required`);
    if (!item[code].romanization || !item[code].ipa) {
      assert.equal(item[code].needs_verification, true, `${item.id}: incomplete ${code} data must be marked for verification`);
    }
  }
}

const mother = dictionary.items.find((item) => item.id === 18);
assert.deepEqual(mother.hi, { word: 'माँ', romanization: 'mā̃', ipa: 'mɑ̃ː', pronunciation: 'Standard Hindi' });
assert.deepEqual(mother.fa, { word: 'مادر', romanization: 'mâdar', ipa: 'mɒːˈd̪æɹ', pronunciation: 'Iranian Persian, formal' });

const ui = await readFile('indoeuropanvordes/index.html', 'utf8');
assert.match(ui, /code: "hi"[\s\S]*speakers: 611000/);
assert.match(ui, /code: "fa"[\s\S]*speakers: 82000/);
assert.match(ui, /Final PI requires all 9 control languages/);
assert.match(ui, /romanization-national/);
assert.match(ui, /Iranian Persian/);

console.log('Indo-European Hindi/Persian tests passed');
