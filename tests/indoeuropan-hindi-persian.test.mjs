import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dictionary = JSON.parse(await readFile('indoeuropanvordes/pie_vordes', 'utf8'));
assert.deepEqual(dictionary.languages, ['en', 'de', 'fr', 'es', 'it', 'ru', 'el', 'hi', 'fa']);
assert.equal(dictionary.items.length, 167);

for (const item of dictionary.items) {
  for (const code of ['hi', 'fa']) {
    const entry = item[code];
    assert.ok(entry && typeof entry === 'object', `${item.id}: ${code} entry is required`);
    for (const field of ['word', 'romanization', 'ipa', 'pronunciation']) {
      assert.ok(typeof entry[field] === 'string' && entry[field].trim(), `${item.id}: ${code} ${field} is required`);
    }
  }
  assert.doesNotMatch(item.hi.romanization, /[\u0900-\u097f]/, `${item.id}: Hindi romanization must use Latin script`);
  assert.doesNotMatch(item.fa.romanization, /[\u0600-\u06ff]/, `${item.id}: Persian romanization must use Latin script`);
  if (/\s/.test(item.fa.word)) {
    assert.match(item.fa.romanization, /\s/, `${item.id}: Persian word boundary must be preserved in romanization`);
    assert.match(item.fa.ipa, /\s/, `${item.id}: Persian word boundary must be preserved in IPA`);
  }
  if (item.fa.word.includes('\u200c')) {
    assert.match(item.fa.romanization, /-/, `${item.id}: Persian ZWNJ must be visible as a hyphen`);
  }
}

const byId = (id) => dictionary.items.find((item) => item.id === id);
assert.deepEqual(
  { word: byId(18).hi.word, romanization: byId(18).hi.romanization, ipa: byId(18).hi.ipa },
  { word: 'माँ', romanization: 'mā̃', ipa: 'mɑ̃ː' }
);
assert.deepEqual(
  { word: byId(18).fa.word, romanization: byId(18).fa.romanization, ipa: byId(18).fa.ipa },
  { word: 'مادر', romanization: 'mâdar', ipa: 'mɒːˈd̪æɹ' }
);
assert.equal(byId(11).fa.romanization, 'panj');
assert.equal(byId(66).fa.romanization, "ġahve-'i");
assert.equal(byId(67).fa.romanization, "ba'-ba' kardan");
assert.equal(byId(90).fa.romanization, 'âsiâb kardan');
assert.equal(byId(139).fa.romanization, 'juje-tiġi');
assert.equal(byId(154).fa.romanization, 'laġzidan');
assert.equal(byId(159).fa.romanization, 'tof kardan');

const ui = await readFile('indoeuropanvordes/index.html', 'utf8');
const aline = await readFile('indoeuropanvordes/aline.js', 'utf8');
assert.match(ui, /code: "hi"[\s\S]*speakers: 611000/);
assert.match(ui, /code: "fa"[\s\S]*speakers: 82000/);
assert.match(ui, /Final PI requires all 9 control languages/);
assert.match(ui, /romanization-national/);
assert.match(ui, /Iranian Persian/);
assert.match(ui, /function transliterateHindi\(text\)/);
assert.match(ui, /function transliteratePersian\(text\)/);
assert.ok(ui.includes('if (ch === "\\u200c") { result += "-";'), 'Persian ZWNJ is represented by a visible hyphen');
assert.ok(ui.includes('.replace(/هٔ|ه\\u200cی/g, "e-ye")'), 'Persian ezafe after he is handled explicitly');
assert.match(ui, /explicitRomanization \|\| transliterateHindi/);
assert.match(ui, /explicitRomanization \|\| transliteratePersian/);

assert.match(ui, /id="semanticOk"/);
assert.match(ui, /const semanticOk = semanticOkInput\.checked === true/);
assert.doesNotMatch(ui, /const semanticOk = true/);
assert.match(ui, /semanticOk: semanticOkInput\.checked === true/);
assert.match(ui, /semantic_correspondence_confirmed: payload\.semanticOk === true/);
assert.match(aline, /mergeDiphthongs: false/);
assert.match(aline, /insertionCost: 1/);
assert.match(aline, /deletionCost: 1/);

console.log('Indo-European Hindi/Persian tests passed');
