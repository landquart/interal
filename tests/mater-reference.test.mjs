// Independent exhaustive alignment oracle for the fixed nine-language example.
// Shares the declared IPA inventory, but never calls the production distance/DP
// when constructing expected costs. Ordinary cross-class pairs are impossible;
// this fixture has no glide/high-vowel exception pairs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { graphicSimilarityDetails } from '../shared/methodology-calculation.mjs';
const context = {};
vm.runInNewContext(fs.readFileSync('indoeuropanvordes/aline.js', 'utf8'), context);
const engine = context.ALINE;
const consonants = { manner: 12, place: 24, nasal: 11, voice: 13, lateral: 8, aspirated: 9, retroflex: 4, rhotic: 7, long: 7, round: 5 };
const vowels = { height: 32, back: 29, nasal: 12, round: 14, rhotic: 7, long: 6 };
const rows = [
  ['mother', 'mʌðə', ['m','ʌ','ð','ə'], 1493000, 2/3],
  ['mutter', 'mʊtɐ', ['m','ʊ','t','ɐ'], 133000, 3/4],
  ['mère', 'mɛʁ', ['m','ɛ','ʁ'], 334000, 1/2],
  ['madr', 'maðɾ', ['m','a','ð','ɾ'], 561000, 3/5],
  ['madr', 'madr', ['m','a','d','r'], 66000, 3/5],
  ['mater', 'matʲɪrʲ', ['m','a','tʲ','ɪ','rʲ'], 210000, 1],
  ['miter', 'miter', ['m','i','t','e','r'], 13500, 4/5],
  ['mā̃', 'mɑ̃ː', ['m','ɑ̃ː'], 611000, 3/10],
  ['mâdar', 'mɒːd̪æɹ', ['m','ɒː','d̪','æ','ɹ'], 82000, 1/2],
];
const source = ['m','a','t','e','r'].map(x => engine.getFeatures(x));
function substitution(a, b) {
  if (a._type !== b._type) return Infinity;
  const weights = a._type === 'V' ? vowels : consonants;
  return Object.entries(weights).reduce((sum, [feature, weight]) => {
    const range = feature === 'place' ? .9 : feature === 'manner' ? .4 : 1;
    return sum + weight * Math.min(1, Math.abs((a[feature] ?? 0) - (b[feature] ?? 0)) / range) / 100;
  }, 0);
}
// Enumerate every insertion/deletion/substitution path, without a DP table.
function exhaustive(a, b) {
  let minimum = Infinity;
  function visit(i, j, cost) {
    if (i === a.length && j === b.length) { minimum = Math.min(minimum, cost); return; }
    if (i < a.length) visit(i + 1, j, cost + 1);
    if (j < b.length) visit(i, j + 1, cost + 1);
    if (i < a.length && j < b.length) {
      const delta = substitution(a[i], b[j]);
      if (Number.isFinite(delta)) visit(i + 1, j + 1, cost + delta);
    }
  }
  visit(0, 0, 0);
  return minimum;
}
let numerator = 0, population = 0;
for (const [word, ipa, tokens, n, graphic] of rows) {
  assert.equal(JSON.stringify(engine.tokenize(ipa)), JSON.stringify(tokens));
  assert.ok(Math.abs(graphicSimilarityDetails('mater', word).score - graphic) < 1e-12);
  const distance = exhaustive(source, tokens.map(x => engine.getFeatures(x)));
  const phonetic = Math.max(0, 1 - distance / Math.max(source.length, tokens.length));
  assert.ok(Math.abs(engine.normalizedSimilarity('mater', ipa) - phonetic) < 1e-12);
  numerator += n * (graphic + phonetic) / 2;
  population += n;
}
assert.equal(population, 3503500);
assert.ok(Math.abs(numerator / population * 100 - 60.515946719946726) < 1e-10);
console.log('Exhaustive mater oracle agrees with PH v4; no production formulas changed.');
