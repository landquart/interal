#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

const [samplePath, assignmentsDir, membersDir] = process.argv.slice(2);
if (!samplePath || !assignmentsDir) throw new Error('Usage: audit-associative-family-semantic-sample.mjs <sample.jsonl> <assignments-dir> [members-dir]');
const sample = (await readFile(samplePath, 'utf8')).split('\n').filter(Boolean).map(JSON.parse);
const pair = row => `${row.language}\u0000${row.lemma_id}\u0000${row.family_id}`;
const keys = new Set(sample.map(pair));
const byLanguage = {};
for (const row of sample) byLanguage[row.language] = (byLanguage[row.language] || 0) + 1;
const assignmentsFound = new Set();
for (const language of Object.keys(byLanguage).sort()) {
  const lines = createInterface({ input: createReadStream(join(assignmentsDir, `${language}.jsonl.gz`)).pipe(createGunzip()), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line) continue;
    const row = JSON.parse(line);
    for (const familyId of row.family_ids) {
      const key = `${language}\u0000${row.lemma_id}\u0000${familyId}`;
      if (keys.has(key)) assignmentsFound.add(key);
    }
  }
}
let membersFound = null;
if (membersDir) {
  membersFound = new Set();
  for (const language of Object.keys(byLanguage).sort()) {
    for (const file of (await readdir(join(membersDir, language))).filter(name => name.endsWith('.json')).sort()) {
      const shard = JSON.parse(await readFile(join(membersDir, language, file), 'utf8'));
      for (const [familyId, values] of Object.entries(shard)) for (const value of values) {
        const key = `${language}\u0000${value.lemma_id}\u0000${familyId}`;
        if (keys.has(key)) membersFound.add(key);
      }
    }
  }
}
const result = {
  schema_version: 1,
  rows: sample.length,
  unique_memberships: keys.size,
  duplicate_rows: sample.length - keys.size,
  by_language: byLanguage,
  assignments_found: assignmentsFound.size,
  assignments_missing: keys.size - assignmentsFound.size,
  members_found: membersFound?.size ?? null,
  members_missing: membersFound ? keys.size - membersFound.size : null,
  required_design_fields_present: sample.filter(row => ['sampling_stratum', 'stratum_population', 'stratum_sample_size', 'inclusion_probability', 'sampling_weight'].every(field => row[field] !== undefined && row[field] !== null)).length,
  valid_for_population_precision: sample.length === 9600 && keys.size === 9600 && assignmentsFound.size === 9600 && membersFound?.size === 9600 && sample.every(row => Number(row.inclusion_probability) > 0 && Number(row.sampling_weight) > 0)
};
console.log(JSON.stringify(result, null, 2));
if (result.rows !== 9600 || result.unique_memberships !== 9600 || result.assignments_missing || (membersFound && result.members_missing)) process.exitCode = 2;
