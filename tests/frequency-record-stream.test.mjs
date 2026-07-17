import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractFrequencyRecords } from '../scripts/lib/associative-index-core.mjs';
import { streamFrequencyRecords } from '../scripts/lib/frequency-record-stream.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(__dirname, 'fixtures/associative-frequency');

async function oldRecords(relativePath, sourceId) {
  const data = JSON.parse(await readFile(join(fixtureRoot, relativePath), 'utf8'));
  return extractFrequencyRecords(data, sourceId);
}

async function streamedRecords(relativePath, sourceId, options = {}) {
  const records = [];
  for await (const record of streamFrequencyRecords({ filePath: join(fixtureRoot, relativePath), sourceId, format: options.format, maxRecords: options.maxRecords })) {
    records.push(record);
  }
  return records;
}

async function assertStreamingMatchesOld(relativePath, sourceId, message) {
  assert.deepEqual(await streamedRecords(relativePath, sourceId), await oldRecords(relativePath, sourceId), message);
}

await assertStreamingMatchesOld(
  'en/hermit_2016_en_full_lemmatized_ipm6_spacy_lookup_cleaned_v8.json',
  'en-array',
  'streams top-level array records like the legacy parser'
);

await assertStreamingMatchesOld(
  'ru/ruwac.out.gz.lpos-clean2-biwt.cleaned_recommended_min100_ipm6.json',
  'ru-object',
  'streams plain word-to-ipm objects like the legacy parser'
);

await assertStreamingMatchesOld(
  'de/hermit_2018_de_full_lemmatized_ipm6_spacy_lookup_cleaned_v8.json',
  'de-rank-keyed',
  'streams rank-keyed objects like the legacy parser'
);

await assertStreamingMatchesOld(
  'en/hermit_2018_en_full_lemmatized_ipm6_spacy_lookup_cleaned_v8.json',
  'en-nested',
  'streams nested lemma/ipm objects like the legacy parser'
);

await assertStreamingMatchesOld(
  'de/deu_lemma_rank_word_ipm_corrected.json',
  'de-object-ipm',
  'streams object records with explicit ipm and rank like the legacy parser'
);

const limited = await streamedRecords('ru/hermit_2018_ru_full_lemmatized_pymorphy3_ipm6.json', 'ru-array', { maxRecords: 3 });
const expectedLimited = (await oldRecords('ru/hermit_2018_ru_full_lemmatized_pymorphy3_ipm6.json', 'ru-array')).slice(0, 3);
assert.deepEqual(limited, expectedLimited, 'streaming honors maxRecords');
