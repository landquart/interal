#!/usr/bin/env node
// Apply complete-list, source-locked decisions for two Latin pronoun families.
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const root = process.argv[2] || 'associativvordes/family-index-v5';
const ledgerBytes = await readFile('audit/associative-family-v5/illos-illis-family-decisions.json');
const ledger = JSON.parse(ledgerBytes);
const assert = (value, message) => { if (!value) throw new Error(message); };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const readJson = async path => JSON.parse((path.endsWith('.gz') ? gunzipSync(await readFile(path)) : await readFile(path)).toString('utf8'));
const writeJson = (path, value) => writeFile(path, path.endsWith('.gz') ? gzipSync(JSON.stringify(value), { level: 6 }) : JSON.stringify(value, null, 2) + '\n');
function bucket(value) {
  let hash = 0x811c9dc5;
  for (const char of value) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 0x01000193); }
  return ((hash >>> 0) % 256).toString(16).padStart(2, '0');
}
assert(ledger.source_run_id === 35647932153 && ledger.decisions.length === 2 && ledger.expected_total_removed_memberships === 14129, 'unexpected ledger');
assert(ledger.decisions[0].family_id === 'ety:315724e202e2' && ledger.decisions[1].family_id === 'ety:ca11c4d91dcb', 'unexpected families');
const manifest = await readJson(join(root, 'manifest.json'));
const report = await readJson(join(root, 'report.json'));
const provenancePath = join(root, 'repository-provenance.json');
const provenance = await readJson(provenancePath);
assert(manifest.repository_storage.immutable_source_run_id === ledger.source_run_id, 'manifest source mismatch');
assert(Number(report.provenance.workflow_run_id) === ledger.source_run_id && provenance.source_run_id === ledger.source_run_id, 'source mismatch');
assert(!provenance.repository_repairs.some(x => x.repair === 'prune_candidate_only_illos_illis_memberships'), 'already applied');
const familyShards = new Map();
const memberShards = new Map();
let removed = 0;
for (const decision of ledger.decisions) {
  const { family_id: id } = decision;
  const fPath = join(root, 'families', `${bucket(id)}.json.gz`);
  if (!familyShards.has(fPath)) familyShards.set(fPath, await readJson(fPath));
  const family = familyShards.get(fPath)[id];
  const originalCount = Object.values(decision.original_members).reduce((sum, x) => sum + x.count, 0);
  assert(family?.support === originalCount && family.review_status === 'needs_review', `${id} family changed`);
  assert(originalCount - decision.expected_final_support === decision.expected_removed_memberships, `${id} wrong removal count`);
  for (const [language, lock] of Object.entries(decision.original_members)) {
    const path = join(root, 'members', language, `${bucket(id)}.json.gz`);
    if (!memberShards.has(path)) memberShards.set(path, await readJson(path));
    const shard = memberShards.get(path);
    const members = shard[id];
    assert(members?.length === lock.count, `${id}/${language} changed count`);
    assert(sha256(JSON.stringify(members.map(x => [x.lemma_id, x.word]))) === lock.ordered_id_word_sha256, `${id}/${language} changed member list`);
    const counts = { compound_morphology: 0, morphological_parse: 0 };
    for (const member of members) {
      assert(member.components?.length === 1 && member.components[0].evidence?.length === 1, `${id}/${language}/${member.word} multiple evidence`);
      const entry = member.components[0].evidence[0];
      assert(entry.source === 'candidate_index' && entry.path?.length === 3, `${id}/${language}/${member.word} unexpected source`);
      assert(entry.path[1] === entry.path[2] && family.aliases.includes(entry.path[1]), `${id}/${language}/${member.word} unexpected alias`);
      assert(Object.hasOwn(counts, entry.type), `${id}/${language}/${member.word} unexpected evidence type`);
      counts[entry.type] += 1;
    }
    assert(Object.entries(counts).every(([type, count]) => lock[type] === count), `${id}/${language} evidence distribution changed`);
    const controls = decision.retained.filter(x => x.language === language);
    const anchors = members.filter(x => controls.some(c => c.lemma_id === x.lemma_id && c.word === x.word));
    assert(anchors.length === controls.length && controls.every(c => anchors.some(x => x.lemma_id === c.lemma_id && x.word === c.word)), `${id}/${language} control missing`);
    assert(family.language_support[language] === members.length, `${id}/${language} support mismatch`);
    shard[id] = anchors;
    family.language_support[language] = anchors.length;
    removed += members.length - anchors.length;
  }
  family.support = decision.expected_final_support;
}
assert(removed === ledger.expected_total_removed_memberships, 'total removal mismatch');
const largest = [];
const suspicious = [];
const largestCompare = (a, b) => b.support - a.support || a.id.localeCompare(b.id);
const suspiciousCompare = (a, b) => b.suspicion_score - a.suspicion_score || b.support - a.support || a.id.localeCompare(b.id);
function keepTop(list, item, compare) {
  if (list.length === 50 && compare(item, list[49]) >= 0) return;
  list.push(item);
  list.sort(compare);
  if (list.length > 50) list.length = 50;
}
for (let index = 0; index < 256; index += 1) {
  const path = join(root, 'families', `${index.toString(16).padStart(2, '0')}.json.gz`);
  const shard = familyShards.get(path) || await readJson(path);
  for (const family of Object.values(shard)) {
    keepTop(largest, family, largestCompare);
    keepTop(suspicious, family, suspiciousCompare);
  }
}
const prior = new Map([...report.largest_families, ...report.highest_suspicion_families].map(item => [item.id, item]));
report.largest_families = largest.map(item => ({ ...(prior.get(item.id) || {}), ...item }));
report.highest_suspicion_families = suspicious.map(item => ({ ...(prior.get(item.id) || {}), ...item }));
report.repository_materialization = {
  ...report.repository_materialization,
  illos_illis_candidate_only_memberships_removed: removed,
  illos_illis_family_decisions_sha256: sha256(ledgerBytes)
};
provenance.repository_repairs.push({
  repair: 'prune_candidate_only_illos_illis_memberships',
  removed_memberships: removed,
  affected_families: ledger.decisions.length,
  source_run_id: ledger.source_run_id,
  decision_ledger_sha256: sha256(ledgerBytes),
  not_human_statistical_annotation: true
});
for (const [path, shard] of memberShards) await writeJson(path, shard);
for (const [path, shard] of familyShards) await writeJson(path, shard);
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
console.log(`Removed ${removed} candidate-only memberships in la:illos and la:illis; retained seven pronoun forms.`);
