import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const pages = ['', 'indoeuropanvordes', 'associativvordes', 'determinatorofvalentyp', 'internationalismes', 'vordesofcommunites', 'grammaticebrevivordes', 'altervordes', 'affixes', 'registre', 'logotypenomine'];
for (const page of pages) {
  const file = page ? path.join(page, 'index.html') : 'index.html';
  const html = await readFile(file, 'utf8');
  assert.match(html, /shared\/ui\.css\?v=/, `${file} must include shared/ui.css with cache busting`);
  assert.match(html, /shared\/ui\.js\?v=/, `${file} must include shared/ui.js with cache busting`);
}

const registry = JSON.parse(await readFile('cards/registry.json', 'utf8'));
assert.equal(registry.cards.some((card) => card.word === 'dre' || card.id === 'dre'), false, 'dre must not be present as a registry word/id');

const repoFiles = (await readdir('.', { recursive: true })).filter((file) => typeof file === 'string' && !file.startsWith('node_modules/') && !file.startsWith('.git/'));
const forbidden = [
  { text: 'ind' + 'oeropan vordes', allow: ['cards/registry.json'] },
  { text: 'InteralJsonCards is' + ' not loaded.', allow: [] },
  { text: 'JSON должен быть объектом' + ' формата', allow: ['associativvordes/script.js'] }
];
for (const file of repoFiles) {
  if (!/\.(js|mjs|html|json)$/.test(file)) continue;
  const text = await readFile(file, 'utf8').catch(() => '');
  for (const item of forbidden) {
    if (item.allow.includes(file)) continue;
    assert.equal(text.includes(item.text), false, `${item.text} must not appear in ${file}`);
  }
}
console.log('i18n/assets tests passed');
