#!/usr/bin/env node
// Apply one locked family-language review without rebuilding the source index.
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const root = process.argv[2] || 'associativvordes/family-index-v5';
const ledgerBytes = await readFile('audit/associative-family-v5/genea-german-decision.json');
const ledger = JSON.parse(ledgerBytes);
const repairName = 'prune_genea_german_false_memberships';
const assert = (value, message) => { if (!value) throw new Error(message); };
const bucket = value => {
  let hash = 0x811c9dc5;
  for (const char of value) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 0x01000193); }
  return ((hash >>> 0) % 256).toString(16).padStart(2, '0');
};
const readJson = async path => JSON.parse((path.endsWith('.gz') ? gunzipSync(await readFile(path)) : await readFile(path)).toString('utf8'));
const writeJson = (path, value) => writeFile(path, path.endsWith('.gz') ? gzipSync(JSON.stringify(value), { level: 6 }) : JSON.stringify(value, null, 2) + '\n');
const shard = bucket(ledger.family_id);
const familyPath = join(root, 'families', `${shard}.json.gz`);
const memberPath = join(root, 'members', ledger.language, `${shard}.json.gz`);
const manifestPath = join(root, 'manifest.json');
const reportPath = join(root, 'report.json');
const provenancePath = join(root, 'repository-provenance.json');
const [families, members, manifest, report, provenance] = await Promise.all([familyPath, memberPath, manifestPath, reportPath, provenancePath].map(readJson));
assert(ledger.source_run_id === 35647932153 && ledger.family_id === 'ety:cf2897b18b16' && ledger.language === 'de', 'unexpected ledger');
assert(Number(manifest.repository_storage.immutable_source_run_id) === ledger.source_run_id && provenance.source_run_id === ledger.source_run_id, 'source mismatch');
assert(!provenance.repository_repairs.some(item => item.repair === repairName), 'already applied');
const family = families[ledger.family_id];
const values = members[ledger.family_id];
assert(family?.source === 'wiktionary_non_proto_etymology' && family.etymon_keys?.includes('grc:γενεα'), 'family changed');
assert(family.language_support.de === ledger.expected_members && values?.length === ledger.expected_members, 'member count changed');
const digest = createHash('sha256');
const evidence = {};
for (const value of values.slice().sort((a, b) => a.lemma_id.localeCompare(b.lemma_id))) {
  digest.update(`${value.lemma_id}\0${value.word}\n`);
  for (const component of value.components) for (const entry of component.evidence) {
    const key = `${entry.type}:${entry.source}`;
    evidence[key] = (evidence[key] || 0) + 1;
  }
}
assert(digest.digest('hex') === ledger.member_list_sha256, 'member set changed');
assert(Object.keys(evidence).length === Object.keys(ledger.expected_evidence).length && Object.entries(ledger.expected_evidence).every(([key, count]) => evidence[key] === count), 'evidence changed');
const keep = new Map(ledger.keep.map(item => [item.lemma_id, item.word]));
assert(keep.size === ledger.keep.length && keep.size === 3, 'invalid keep list');
const retained = values.filter(value => keep.has(value.lemma_id));
assert(retained.length === keep.size && retained.every(value => keep.get(value.lemma_id) === value.word), 'keep list changed');
const removed = values.length - retained.length;
members[ledger.family_id] = retained;
family.language_support.de = retained.length;
family.support -= removed;
assert(family.support === Object.values(family.language_support).reduce((sum, count) => sum + count, 0), 'family support mismatch');
const largest = [];
const suspicious = [];
const keepTop = (list, item, compare) => { list.push(item); list.sort(compare); if (list.length > 50) list.length = 50; };
for (let index = 0; index < 256; index += 1) {
  const path = join(root, 'families', `${index.toString(16).padStart(2, '0')}.json.gz`);
  for (const item of Object.values(path === familyPath ? families : await readJson(path))) {
    keepTop(largest, item, (a, b) => b.support - a.support || a.id.localeCompare(b.id));
    keepTop(suspicious, item, (a, b) => b.suspicion_score - a.suspicion_score || b.support - a.support || a.id.localeCompare(b.id));
  }
}
report.largest_families = largest;
report.highest_suspicion_families = suspicious;
const ledgerSha = createHash('sha256').update(ledgerBytes).digest('hex');
report.repository_materialization.genea_german_memberships_removed = removed;
report.repository_materialization.genea_german_ledger_sha256 = ledgerSha;
provenance.repository_repairs.push({ repair: repairName, family_id: ledger.family_id, language: ledger.language, removed_memberships: removed, retained_memberships: retained.length, decision_ledger_sha256: ledgerSha, source_run_id: ledger.source_run_id, not_individual_lexical_annotation: true });
await Promise.all([[familyPath, families], [memberPath, members], [reportPath, report]].map(([path, value]) => writeJson(path, value)));
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
console.log(JSON.stringify({ family_id: ledger.family_id, language: ledger.language, removed_memberships: removed, retained_memberships: retained.length }, null, 2));
