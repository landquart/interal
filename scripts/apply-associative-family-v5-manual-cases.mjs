#!/usr/bin/env node
// Mechanical materialization of explicit case-by-case judgments; never infers linguistic labels.
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const root = process.argv[2] || 'associativvordes/family-index-v5';
const ledgerPath = 'audit/associative-family-v5/manual-case-decisions.json';
const ledgerBytes = await readFile(ledgerPath);
const ledger = JSON.parse(ledgerBytes);
const expectedRunId = 35647932153;
const assert = (condition, reason) => { if (!condition) throw new Error(reason); };
const readJson = async path => JSON.parse((path.endsWith('.gz') ? gunzipSync(await readFile(path)) : await readFile(path)).toString('utf8'));
const writeJson = (path, value) => writeFile(path, path.endsWith('.gz') ? gzipSync(JSON.stringify(value), { level: 6 }) : JSON.stringify(value, null, 2) + '\n');
function bucket(value) {
  let hash = 0x811c9dc5;
  for (const char of value) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 0x01000193); }
  return ((hash >>> 0) % 256).toString(16).padStart(2, '0');
}
const memberPath = (language, familyId) => join(root, 'members', language, `${bucket(familyId)}.json.gz`);
const familyPath = familyId => join(root, 'families', `${bucket(familyId)}.json.gz`);
const decisions = ledger.rejected_memberships;
assert(ledger.source_run_id === expectedRunId && decisions.length === 22 && ledger.quarantined_families.length === 1, 'unexpected source/decision count');
const manifest = await readJson(join(root, 'manifest.json'));
const report = await readJson(join(root, 'report.json'));
const provenancePath = join(root, 'repository-provenance.json');
const provenance = await readJson(provenancePath);
assert(Number(manifest.repository_storage?.immutable_source_run_id) === expectedRunId, 'manifest source mismatch');
assert(Number(report.provenance?.workflow_run_id) === expectedRunId, 'report source mismatch');
assert(provenance.source_run_id === expectedRunId, 'provenance source mismatch');
const ledgerSha = createHash('sha256').update(ledgerBytes).digest('hex');
const keyOf = ({ family_id, language, lemma_id }) => `${family_id}\0${language}\0${lemma_id}`;
assert(new Set(decisions.map(keyOf)).size === decisions.length, 'duplicate decision tuple');

// Preflight every member and preserved positive control before changing any file.
const memberShards = new Map();
for (const item of [...decisions, ...ledger.preserved_positive_controls]) {
  assert(manifest.languages.includes(item.language), `invalid language ${item.language}`);
  const path = memberPath(item.language, item.family_id);
  if (!memberShards.has(path)) memberShards.set(path, await readJson(path));
  const matching = (memberShards.get(path)[item.family_id] || []).filter(member => member.word === item.word && (!item.lemma_id || member.lemma_id === item.lemma_id));
  assert(matching.length === 1, `expected exactly one member ${item.family_id}/${item.language}/${item.word}`);
  if (item.lemma_id) assert(!matching[0].components?.some(component => component.evidence?.some(e => e.type === 'manual_override')), `refuse to remove manual override ${keyOf(item)}`);
}
const familyShards = new Map();
for (const item of decisions) {
  const path = familyPath(item.family_id);
  if (!familyShards.has(path)) familyShards.set(path, await readJson(path));
  const family = familyShards.get(path)[item.family_id];
  assert(family && family.support > 1 && family.language_support?.[item.language] > 1, `invalid family support ${keyOf(item)}`);
}
for (const item of ledger.quarantined_families) {
  const path = familyPath(item.family_id);
  if (!familyShards.has(path)) familyShards.set(path, await readJson(path));
  assert(familyShards.get(path)[item.family_id]?.review_status === item.previous_status, `unexpected quarantine status ${item.family_id}`);
}
const deltas = new Map();
for (const item of decisions) {
  const members = memberShards.get(memberPath(item.language, item.family_id))[item.family_id];
  const index = members.findIndex(value => value.lemma_id === item.lemma_id && value.word === item.word);
  assert(index >= 0, `preflight discrepancy ${keyOf(item)}`);
  members.splice(index, 1);
  const counts = deltas.get(item.family_id) || {};
  counts[item.language] = (counts[item.language] || 0) + 1;
  deltas.set(item.family_id, counts);
}
for (const [familyId, perLanguage] of deltas) {
  const family = familyShards.get(familyPath(familyId))[familyId];
  for (const [language, count] of Object.entries(perLanguage)) {
    assert(family.language_support[language] > count, `family language would become empty ${familyId}/${language}`);
    family.language_support[language] -= count;
    family.support -= count;
  }
}
for (const item of ledger.quarantined_families) familyShards.get(familyPath(item.family_id))[item.family_id].review_status = item.new_status;
for (const field of ['largest_families', 'highest_suspicion_families']) {
  for (const item of report[field] || []) {
    if (deltas.has(item.id)) {
      for (const [language, count] of Object.entries(deltas.get(item.id))) item.language_support[language] -= count;
      item.support -= Object.values(deltas.get(item.id)).reduce((a, b) => a + b, 0);
      assert(item.support === Object.values(item.language_support).reduce((a, b) => a + b, 0), `report support mismatch ${item.id}`);
    }
  }
}
assert(!provenance.repository_repairs?.some(repair => repair.repair === 'remove_individually_reviewed_false_memberships'), 'repair has already been applied');
report.repository_materialization = {
  ...report.repository_materialization,
  individually_reviewed_false_memberships_removed: decisions.length,
  manually_quarantined_sense_ambiguous_families: ledger.quarantined_families.length,
  manual_case_ledger_sha256: ledgerSha
};
provenance.repository_repairs.push({
  repair: 'remove_individually_reviewed_false_memberships',
  removed_memberships: decisions.length,
  affected_families: deltas.size,
  quarantined_families: ledger.quarantined_families.map(item => item.family_id),
  source_run_id: expectedRunId,
  decision_ledger_sha256: ledgerSha,
  not_human_statistical_annotation: true
});
for (const [path, shard] of memberShards) if (decisions.some(item => path === memberPath(item.language, item.family_id))) await writeJson(path, shard);
for (const [path, shard] of familyShards) await writeJson(path, shard);
await writeJson(join(root, 'report.json'), report);

// The repository's provenance hash covers the exact gzip bytes, not decompressed JSON.
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
console.log(`Removed ${decisions.length} explicitly reviewed memberships from ${deltas.size} families; quarantined ${ledger.quarantined_families.length} sense-ambiguous family; SOURCE_RUN_ID ${expectedRunId} unchanged.`);
