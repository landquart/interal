import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { FamilyIndexLoader } from '../associativvordes/js/family-index-loader.js';

const root = 'associativvordes/family-index-v5';
const loader = new FamilyIndexLoader({
  baseUrl: '/family-index-v5',
  fetchJson: async url => {
    const path = join(root, url.slice('/family-index-v5/'.length));
    const data = await readFile(path);
    return JSON.parse(url.endsWith('.gz') ? gunzipSync(data).toString('utf8') : data.toString('utf8'));
  }
});

test('individually rejected etymologies are absent from repository-backed runtime', async () => {
  for (const [query, language, rejected, preserved] of [
    ['ten', 'de', ['gelten', 'retten', 'erwarten'], []],
    ['gene', 'de', ['liegen', 'fragen', 'abänderungen'], []],
    ['actu', 'en', ['contact'], ['act']],
    ['neat', 'en', ['network', 'internet', 'planet'], ['neat']],
    ['liber', 'en', ['liber', 'calliber'], ['liberty', 'libertarian']],
    ['liber', 'es', ['líber', 'avenidalibertad'], ['libertad', 'liberal']]
  ]) {
    const entries = await loader.candidateEntries(query, language);
    const words = new Set(entries.map(entry => entry.word));
    for (const word of rejected) assert(!words.has(word), `${query}/${language}: false member ${word}`);
    for (const word of preserved) assert(words.has(word), `${query}/${language}: lost positive control ${word}`);
  }
});

test('sense-ambiguous enm:net is quarantined without deleting its member data', async () => {
  const id = 'ety:111ecf2b9102';
  assert.equal((await loader.family(id)).review_status, 'split_required');
  assert((await loader.members(id, 'en')).some(member => member.word === 'network'));
});
