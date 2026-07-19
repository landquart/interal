import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { extractFrequencyRecords } from '../scripts/lib/associative-index-core.mjs';
import { streamFrequencyRecords } from '../scripts/lib/frequency-record-stream.mjs';

const sourceId = 'normative/russian.json';
const records = [
  { word: 'ь', ipm: 10 },
  { word: 'ъ', ipm: 9 },
  { word: 'моль', ipm: 8 },
  { word: 'дом', ipm: 7 }
];

const legacy = extractFrequencyRecords(records, sourceId);
assert.deepEqual(legacy.map(record => record.normalized), ['моль', 'дом'], 'legacy parser skips standalone signs with no searchable Latin content');
assert.deepEqual(legacy.map(record => record.search_form), ['mol', 'dom'], 'legacy parser preserves usable Russian search forms');

const tmpRoot = '.tmp/associative-index-empty-search-form';
const tmpFile = `${tmpRoot}/records.json`;
await rm(tmpRoot, { recursive: true, force: true });
await mkdir(tmpRoot, { recursive: true });
await writeFile(tmpFile, `${JSON.stringify(records)}\n`);

const streamed = [];
for await (const record of streamFrequencyRecords({ filePath: tmpFile, sourceId, format: 'legacy-json' })) streamed.push(record);
assert.deepEqual(streamed.map(record => record.normalized), ['моль', 'дом'], 'stream parser skips standalone signs with no searchable Latin content');
assert.deepEqual(streamed.map(record => record.search_form), ['mol', 'dom'], 'stream parser preserves usable Russian search forms');

await rm(tmpRoot, { recursive: true, force: true });
console.log('associative index empty search_form tests passed');
