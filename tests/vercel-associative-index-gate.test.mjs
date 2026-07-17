import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile('vercel.json', 'utf8'));
assert.equal(config.$schema, 'https://openapi.vercel.sh/vercel.json');
assert.equal(config.framework, null, 'the static site keeps the Other framework preset');
assert.equal(config.buildCommand, 'npm run check:associative-index-deployment', 'every Vercel build runs the associative index gate');
assert.equal(config.outputDirectory, '.', 'the build gate still serves the repository root as the static output');

const headerMap = new Map((config.headers || []).map(entry => [entry.source, entry.headers]));
for (const source of ['/associativvordes/script.js', '/associativvordes/js/(.*)', '/shared/button-status.js']) {
  const headers = headerMap.get(source);
  assert.ok(Array.isArray(headers), `cache policy exists for ${source}`);
  assert.ok(headers.some(header => header.key === 'Cache-Control' && /no-cache/.test(header.value)), `${source} is revalidated after frontend changes`);
}

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
assert.equal(packageJson.scripts['check:associative-index-deployment'], 'node scripts/check-associative-index-deployment.mjs');

const gateSource = await readFile('scripts/check-associative-index-deployment.mjs', 'utf8');
for (const language of ['en', 'de', 'fr', 'es', 'it', 'ru']) {
  assert.match(gateSource, new RegExp(`['\"]${language}['\"]`), `deployment gate requires ${language}`);
}
assert.match(gateSource, /candidate-index\/manifest\.json/);
assert.match(gateSource, /response\.status !== 200/);
assert.match(gateSource, /manifest\.normalizer_version/);

console.log('Vercel associative index deployment gate tests passed');
