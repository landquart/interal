import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createCandidateIndexLoader } from '../associativvordes/js/candidate-index-loader.js';
import { buildSearchForm } from '../associativvordes/js/search-normalizer.js';

const fetchFromRepository = async (url) => {
  const relative = String(url).replace(/^\.\//, '');
  const path = join('associativvordes', relative);
  try {
    const text = await readFile(path, 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(text) };
  } catch (error) {
    return { ok: false, status: error?.code === 'ENOENT' ? 404 : 500, json: async () => ({}) };
  }
};

const loader = createCandidateIndexLoader({
  searchBaseUrl: './search-index/',
  legacyBaseUrl: './missing-candidate-index/',
  fetch: fetchFromRepository,
  maxCachedResources: 32
});

async function assertIndexed(language, query, expectedWords) {
  const entries = await loader.loadCandidateEntries(language, query);
  const indexed = new Set(entries.map(entry => buildSearchForm(entry.word)));
  for (const word of expectedWords) {
    assert.ok(indexed.has(buildSearchForm(word)), `${language} static index contains ${word}`);
  }
}

await assertIndexed('en', 'altru', ['altruism', 'altruist']);
await assertIndexed('ru', 'альтру', ['альтруизм', 'альтруист']);

console.log('Associative Qwen local-index verification tests passed.');
