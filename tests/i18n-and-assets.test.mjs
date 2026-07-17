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


const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
assert.equal(packageJson.scripts['check:associative-index-deployment'], 'node scripts/check-associative-index-deployment.mjs', 'package.json must expose the production associative index deployment check');
assert.equal(packageJson.scripts.test.includes('check:associative-index-deployment'), false, 'npm test must not require the production candidate-index');

const deploymentCheck = await readFile('scripts/check-associative-index-deployment.mjs', 'utf8');
assert.match(deploymentCheck, /fetch\(manifestUrl\)/, 'deployment check must smoke-test fetching ./candidate-index/manifest.json');
assert.match(deploymentCheck, /REQUIRED_LANGUAGES = \['en', 'de', 'fr', 'es', 'it', 'ru'\]/, 'deployment check must require all published languages');

const publishWorkflow = await readFile('.github/workflows/publish-associative-index.yml', 'utf8');
assert.match(publishWorkflow, /npm run check:associative-index-deployment/, 'publish workflow must run the deployment check after copying the merged index');

const registry = JSON.parse(await readFile('cards/registry.json', 'utf8'));
const registryIds = new Set(registry.cards.map((card) => card.id));
const removedDreCardIds = [
  'iv_87a000fffebf1bd56cfef409b113f69f',
  'iv_e7d447a815b619ba34f6c2d00c13c3c7',
  'iv_mEqRDoJ3dEv2',
  'iv_oXx9cc3X8GFC',
  'iv_0d98acfb4af3ca6daa6ea95ce8d851a5'
];
for (const id of removedDreCardIds) {
  assert.equal(registryIds.has(id), false, `${id} must not be present in the registry`);
}
assert.equal(registry.cards.filter((card) => card.word === 'dre').length, 1, 'registry must contain exactly one dre card');
assert.equal(registry.cards.filter((card) => card.word === 'matre').length, 1, 'registry must contain exactly one matre card');
assert.equal(registryIds.has('iv_1KjajlU3SH8Z'), true, 'one dre card must remain in the registry');
assert.equal(registryIds.has('iv_3e1e5e67755f4b9aabe2758a1fe414e2'), true, 'matre card must remain in the registry');

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
