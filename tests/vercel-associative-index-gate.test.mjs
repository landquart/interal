import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile('vercel.json', 'utf8'));
assert.equal(config.$schema, 'https://openapi.vercel.sh/vercel.json');
assert.equal(config.framework, null, 'the static site keeps the Other framework preset');
assert.equal(config.buildCommand, 'npm run check:associative-index-deployment && npm run check:associative-search-index-deployment', 'every Vercel build validates the active legacy or static associative index');
assert.equal(config.outputDirectory, '.', 'the build gate still serves the repository root as the static output');

const headerMap = new Map((config.headers || []).map(entry => [entry.source, entry.headers]));
for (const source of ['/associativvordes/script.js', '/associativvordes/js/(.*)', '/shared/button-status.js']) {
  const headers = headerMap.get(source);
  assert.ok(Array.isArray(headers), `cache policy exists for ${source}`);
  assert.ok(headers.some(header => header.key === 'Cache-Control' && /no-cache/.test(header.value)), `${source} is revalidated after frontend changes`);
}
const staticHeaders = headerMap.get('/associativvordes/search-index/(.*)');
assert.ok(Array.isArray(staticHeaders), 'static search index has an explicit cache policy');
assert.ok(staticHeaders.some(header => header.key === 'Cache-Control' && /public/.test(header.value) && /stale-while-revalidate/.test(header.value)), 'static search resources use bounded public caching');

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
assert.equal(packageJson.scripts['check:associative-index-deployment'], 'node scripts/check-associative-index-deployment.mjs');
assert.equal(packageJson.scripts['check:associative-search-index-deployment'], 'node scripts/check-associative-static-search-index-deployment.mjs');

const legacyGateSource = await readFile('scripts/check-associative-index-deployment.mjs', 'utf8');
const staticGateSource = await readFile('scripts/check-associative-static-search-index-deployment.mjs', 'utf8');
for (const language of ['en', 'de', 'fr', 'es', 'it', 'ru']) {
  assert.match(legacyGateSource, new RegExp(`['"]${language}['"]`), `legacy deployment gate recognizes ${language}`);
  assert.match(staticGateSource, new RegExp(`['"]${language}['"]`), `static deployment gate requires ${language}`);
}
assert.match(legacyGateSource, /candidate-index\/manifest\.json/);
assert.match(legacyGateSource, /STATIC_MANIFEST_PATH/);
assert.match(legacyGateSource, /response\.status !== 200/);
assert.match(legacyGateSource, /manifest\.normalizer_version/);
assert.match(staticGateSource, /search-index/);
assert.match(staticGateSource, /static-inverted-ngram-v1/);
assert.match(staticGateSource, /entry_blocks/);
assert.match(staticGateSource, /postings/);

console.log('Vercel associative index deployment gate tests passed');
