#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';

const root = process.argv[2];
if (!root) throw new Error('Usage: validate-associative-family-output.mjs <index-root>');
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const manifest = await readJson(join(root, 'manifest.json'));
const report = await readJson(join(root, 'report.json'));
if (!report.controls_ok) throw new Error('Methodology controls are not satisfied');
for (const [name, value] of Object.entries(report.invariants)) if (typeof value === 'boolean' && !value) throw new Error(`Invariant failed: ${name}`);

const parsedShards = {};
for (const directory of ['families', 'aliases', ...manifest.languages.map(language => `members/${language}`)]) {
  const files = (await readdir(join(root, directory))).filter(file => file.endsWith('.json')).sort();
  if (files.length !== 256) throw new Error(`${directory}: expected 256 shards, got ${files.length}`);
  for (const file of files) await readJson(join(root, directory, file));
  parsedShards[directory] = files.length;
}

const assignmentRows = {};
for (const language of manifest.languages) {
  const lines = createInterface({ input: createReadStream(join(root, 'assignments', `${language}.jsonl.gz`)).pipe(createGunzip()), crlfDelay: Infinity });
  let count = 0;
  for await (const line of lines) {
    if (!line) continue;
    const row = JSON.parse(line);
    if (!row.lemma_id || !row.word || !Array.isArray(row.family_ids) || row.family_ids.length === 0) throw new Error(`${language}: invalid assignment at row ${count + 1}`);
    for (const component of row.components || []) {
      if (!component.canonical_candidate || !component.family_ids?.length || !component.evidence?.length) throw new Error(`${language}: component without family/evidence at row ${count + 1}`);
    }
    count += 1;
  }
  if (count !== report.source_entries[language]) throw new Error(`${language}: ${count} assignments, expected ${report.source_entries[language]}`);
  assignmentRows[language] = count;
}

if (Object.values(assignmentRows).reduce((sum, value) => sum + value, 0) !== report.invariants.classified_unique_lemmas) throw new Error('Total classified lemma count mismatch');
console.log(JSON.stringify({ valid: true, controls_ok: report.controls_ok, assignment_rows: assignmentRows, parsed_shards: parsedShards, total_families: report.total_families, aliases: report.aliases_in_lookup }, null, 2));
