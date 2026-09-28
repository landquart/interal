#!/usr/bin/env node
// Reconcile the repository-backed materialization after the illas/illos/illis repairs.
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const root = process.argv[2] || 'associativvordes/family-index-v5';
const assert = (value, message) => { if (!value) throw new Error(message); };
const readJson = async path => JSON.parse((path.endsWith('.gz') ? gunzipSync(await readFile(path)) : await readFile(path)).toString('utf8'));
const writeJson = (path, value) => writeFile(path, path.endsWith('.gz') ? gzipSync(JSON.stringify(value), { level: 6 }) : `${JSON.stringify(value, null, 2)}\n`);
function bucket(value) {
  let hash = 0x811c9dc5;
  for (const char of value) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 0x01000193); }
  return ((hash >>> 0) % 256).toString(16).padStart(2, '0');
}
const manifest = await readJson(join(root, 'manifest.json'));
const report = await readJson(join(root, 'report.json'));
const provenancePath = join(root, 'repository-provenance.json');
const provenance = await readJson(provenancePath);
assert(manifest.repository_storage.immutable_source_run_id === 35647932153 && provenance.source_run_id === 35647932153, 'source run changed');
assert(report.invariants.lemmas_with_zero_family === 0 && report.invariants.classified_unique_lemmas === manifest.counts.lemmas, 'report already reconciled');
assert(!provenance.repository_repairs.some(item => item.repair === 'reconcile_pronoun_review_and_materialized_lemmas'), 'repair already applied');
const ids = ['ety:1e9cc0c12192', 'ety:315724e202e2', 'ety:ca11c4d91dcb'];
const changedShards = new Map();
for (const id of ids) {
  const path = join(root, 'families', `${bucket(id)}.json.gz`);
  const shard = await readJson(path);
  const family = shard[id];
  assert(family?.support === 4 || family?.support === 3, `${id} unexpected support`);
  assert(family.suspicion_score === 40 && JSON.stringify(family.suspicion_reasons) === '["short_root","large_family"]' && family.review_status === 'needs_review', `${id} metadata changed`);
  family.suspicion_score = 20;
  family.suspicion_reasons = ['short_root'];
  // The materialized links retain candidate-index evidence, so individual
  // review remains required despite the now small size of the family.
  family.review_status_reason = 'candidate_index_memberships_require_review';
  changedShards.set(path, shard);
}

let uniqueTotal = 0;
for (const language of manifest.languages) {
  const unique = new Set();
  for (let index = 0; index < 256; index += 1) {
    const path = join(root, 'members', language, `${index.toString(16).padStart(2, '0')}.json.gz`);
    const shard = await readJson(path);
    for (const values of Object.values(shard)) for (const value of values) unique.add(value.lemma_id);
  }
  uniqueTotal += unique.size;
}
const withoutFamily = manifest.counts.lemmas - uniqueTotal;
assert(uniqueTotal === 4924403 && withoutFamily === 577, `materialized lemma count changed: ${uniqueTotal}/${withoutFamily}`);
report.invariants.classified_unique_lemmas = uniqueTotal;
report.invariants.lemmas_with_zero_family = withoutFamily;
report.repository_materialization.materialized_unique_lemmas = uniqueTotal;
report.repository_materialization.lemmas_without_materialized_family = withoutFamily;

const largest = [];
const suspicious = [];
function keepTop(list, family, compare) {
  if (list.length === 50 && compare(family, list[49]) >= 0) return;
  list.push(family);
  list.sort(compare);
  if (list.length > 50) list.length = 50;
}
for (let index = 0; index < 256; index += 1) {
  const path = join(root, 'families', `${index.toString(16).padStart(2, '0')}.json.gz`);
  const shard = changedShards.get(path) || await readJson(path);
  for (const family of Object.values(shard)) {
    keepTop(largest, family, (a, b) => b.support - a.support || a.id.localeCompare(b.id));
    keepTop(suspicious, family, (a, b) => b.suspicion_score - a.suspicion_score || b.support - a.support || a.id.localeCompare(b.id));
  }
}
const prior = new Map([...report.largest_families, ...report.highest_suspicion_families].map(item => [item.id, item]));
report.largest_families = largest.map(item => ({ ...(prior.get(item.id) || {}), ...item }));
report.highest_suspicion_families = suspicious.map(item => ({ ...(prior.get(item.id) || {}), ...item }));
provenance.repository_repairs.push({
  repair: 'reconcile_pronoun_review_and_materialized_lemmas',
  affected_families: ids,
  materialized_unique_lemmas: uniqueTotal,
  lemmas_without_materialized_family: withoutFamily,
  source_run_id: 35647932153,
  note: 'No memberships added; malformed áquellos remains excluded. The original build-time zero-family claim was stale after repository pruning.'
});
for (const [path, shard] of changedShards) await writeJson(path, shard);
await writeJson(join(root, 'report.json'), report);

async function files(directory) {
  const out = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) out.push(...await files(path)); else out.push(path);
  }
  return out;
}
const paths = (await files(root)).filter(path => path !== provenancePath).sort();
const hash = createHash('sha256');
let bytes = 0;
for (const path of paths) {
  const data = await readFile(path);
  bytes += data.length;
  hash.update(path.slice(root.length + 1)).update('\0').update(data);
}
provenance.file_count_before_provenance = paths.length;
provenance.total_bytes_before_provenance = bytes;
provenance.tree_content_sha256 = hash.digest('hex');
await writeJson(provenancePath, provenance);
console.log(`Reconciled ${ids.length} family risk records; ${uniqueTotal} materialized lemmas, ${withoutFamily} without a stored family.`);
