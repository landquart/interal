import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const dictionary = JSON.parse(await readFile('indoeuropanvordes/pie_vordes', 'utf8'));
assert.deepEqual(dictionary.languages, ['en', 'de', 'fr', 'es', 'it', 'ru', 'el', 'hi', 'fa']);
assert.ok(dictionary.items.length >= 198, `expected expanded PIE dictionary, got ${dictionary.items.length}`);

for (const item of dictionary.items) {
  for (const code of ['hi', 'fa']) {
    const entry = item[code];
    assert.ok(entry && typeof entry === 'object', `${item.id}: ${code} entry is required`);
    for (const field of ['word', 'romanization', 'ipa', 'pronunciation']) {
      assert.ok(typeof entry[field] === 'string' && entry[field].trim(), `${item.id}: ${code} ${field} is required`);
    }
  }
  for (const code of dictionary.languages) {
    const entry = item[code];
    if (!entry || typeof entry !== 'object') continue;
    assert.ok(typeof entry.root === 'string', `${item.id}: ${code} root is required`);
    assert.ok(typeof entry.root_ipa === 'string', `${item.id}: ${code} root_ipa is required`);
    if (entry.word.trim()) {
      assert.ok(entry.root.trim(), `${item.id}: ${code} root must not be empty`);
      assert.ok(entry.root_ipa.trim(), `${item.id}: ${code} root_ipa must not be empty`);
    }
    if (['hi', 'fa'].includes(code)) {
      assert.ok(typeof entry.root_romanization === 'string' && entry.root_romanization.trim(), `${item.id}: ${code} root_romanization is required`);
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
assert.equal(byId(165).ru.root, 'вид');
assert.equal(byId(165).ru.root_ipa, 'vʲid');
assert.equal(byId(165).it.root, 'ved');
assert.equal(byId(165).it.root_ipa, 'ved');
assert.equal(byId(165).hi.root_romanization, 'dekh');
assert.equal(byId(165).hi.root_ipa, 'd̪eːkʰ');
assert.equal(byId(165).fa.root_romanization, 'did');
assert.equal(byId(165).fa.root_ipa, 'diːd');
assert.equal(byId(52).es.root, 'vin');
assert.equal(byId(52).ru.root, 'вин');
assert.equal(byId(52).el.root, 'κρασ');
assert.equal(byId(18).ru.word, 'матерь');
assert.equal(byId(18).ru.root, 'матер');
assert.equal(byId(18).ru.ipa, 'ˈmatʲɪrʲ');
assert.equal(byId(18).ru.root_ipa, 'matʲɪrʲ');

assert.equal(byId(29).ru.word, 'глаз');
assert.equal(byId(32).ru.word, 'ярмо');
assert.equal(byId(37).fr.word, "s'allonger");
assert.equal(byId(40).el.word, 'χιόνι');
assert.equal(byId(41).ru.word, 'брод');
assert.equal(byId(43).el.word, 'σπόρος');
assert.equal(byId(44).fr.word, 'manger');
assert.equal(byId(45).el.word, 'κάθομαι');
assert.equal(byId(48).el.word, 'αυτί');
assert.equal(byId(49).el.word, 'πόρτα');
assert.equal(byId(52).el.word, 'κρασί');
assert.equal(byId(54).es.word, 'ratón');
assert.equal(byId(58).en.word, 'sea');
assert.equal(byId(58).hi.word, 'समुद्र');
assert.equal(byId(58).fa.word, 'دریا');
assert.equal(byId(60).ru.word, 'огонь');
assert.equal(byId(61).el.word, 'νερό');
assert.equal(byId(78).ru.word, 'юный');
assert.equal(byId(93).ru.word, 'голый');
assert.equal(byId(100).ru.word, 'ткать');
assert.equal(byId(104).de.word, 'gerade');
assert.equal(byId(114).ru.word, 'тепловатый');
assert.equal(byId(129).fr.word, 'haricot');
assert.equal(byId(138).ru.word, 'кабан');
assert.equal(byId(140).en.word, 'moose');
assert.equal(byId(143).de.word, 'Weizen');
assert.equal(byId(162).hi.word, 'वैगन');
assert.equal(byId(187).it.word, 'sentire');

// These historical/cognate-biased substitutions must not return to PI data.
assert.notEqual(byId(58).en.word, 'mere');
assert.notEqual(byId(60).ru.word, 'пир');
assert.notEqual(byId(61).el.word, 'ύδωρ');
assert.equal(byId(78).ru.root, 'юн');
assert.equal(byId(4).en.word, 'you');
assert.notEqual(byId(4).en.word, 'thee');
assert.equal(byId(36).es.word, 'estar de pie');
assert.equal(byId(36).it.word, 'stare in piedi');
assert.equal(byId(71).fr.word, 'droit');
assert.equal(byId(71).es.word, 'derecho');
assert.equal(byId(71).it.word, 'destro');
assert.equal(byId(71).el.word, 'δεξιός');
assert.equal(byId(108).fa.word, 'آب‌میوه');
assert.equal(byId(128).el.word, 'αγριόλευκα');
assert.equal(byId(132).hi.word, 'भूर्ज');
assert.equal(byId(196).en.word, 'big');

const ui = await readFile('indoeuropanvordes/index.html', 'utf8');
const aline = await readFile('indoeuropanvordes/aline.js', 'utf8');
const alineContext = {};
vm.runInNewContext(aline, alineContext);
for (const item of dictionary.items) {
  for (const code of dictionary.languages) {
    const entry = item[code];
    if (!entry || typeof entry !== 'object') continue;
    for (const field of ['ipa', 'root_ipa']) {
      const value = String(entry[field] || '').trim();
      if (!value) continue;
      const unknown = alineContext.ALINE.unknownSegments(value);
      assert.equal(
        unknown.length,
        0,
        `${item.id}: ${code} ${field} contains unsupported IPA segment(s): ${unknown.join(', ')}`
      );
    }
  }
}
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
assert.match(ui, /roots: splitVariants\(cell\.root \|\| cell\.roots \|\| ""\)/);
assert.match(ui, /rootRomanization: String\(cell\.root_romanization \|\| ""\)/);
assert.match(ui, /rootIpa: String\(cell\.root_ipa \|\| ""\)/);
assert.match(ui, /const interalRoot = getInteralComparisonRoot/);
assert.match(ui, /normalizeGraphicInput\(root, lang\.code, rootRomanization\)/);
assert.match(ui, /calcAlineSimilarity\(interalIPAComparable, rootIpa\)/);
assert.match(ui, /const root = pieCell\?\.roots\[0\] \|\| "";/);
assert.match(ui, /const rootRomanization = pieCell\?\.rootRomanization \|\| "";/);
assert.match(ui, /const rootIpa = pieCell\?\.rootIpa \|\| "";/);
assert.doesNotMatch(ui, /const root = pieCell\?\.roots\[0\] \|\| word;/);
assert.doesNotMatch(ui, /const rootIpa = pieCell\?\.rootIpa \|\| ipa;/);
assert.doesNotMatch(ui, /root: row\.root \|\| row\.word/);
assert.doesNotMatch(ui, /root_ipa: row\.rootIpa \|\| row\.ipa/);

assert.match(ui, /id="semanticOk"/);
assert.match(ui, /const semanticOk = semanticOkInput\.checked === true/);
assert.doesNotMatch(ui, /const semanticOk = true/);
assert.match(ui, /semanticOk: semanticOkInput\.checked === true/);
assert.match(ui, /semantic_correspondence_confirmed: payload\.semanticOk === true/);
assert.match(aline, /mergeDiphthongs: false/);
assert.match(aline, /insertionCost: 1/);
assert.match(aline, /deletionCost: 1/);

console.log('Indo-European Hindi/Persian tests passed');
