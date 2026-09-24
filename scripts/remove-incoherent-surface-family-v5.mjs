#!/usr/bin/env node
// Apply the locked family-level decision for German surface:de:ten; no heuristic deletions.
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const root = process.argv[2] || 'associativvordes/family-index-v5';
const ledgerPath = 'audit/associative-family-v5/surface-ten-decision.json';
const ledgerBytes = await readFile(ledgerPath);
const ledger = JSON.parse(ledgerBytes);
const assert = (value, message) => { if (!value) throw new Error(message); };
const bucket = value => {
  let hash = 0x811c9dc5;
  for (const char of value) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 0x01000193); }
  return ((hash >>> 0) % 256).toString(16).padStart(2, '0');
};
const readJson = async path => JSON.parse((path.endsWith('.gz') ? gunzipSync(await readFile(path)) : await readFile(path)).toString('utf8'));
const writeJson = (path, value) => writeFile(path, path.endsWith('.gz') ? gzipSync(JSON.stringify(value), { level: 6 }) : JSON.stringify(value, null, 2) + '\n');
const familyPath = join(root, 'families', `${bucket(ledger.family_id)}.json.gz`);
const membersPath = join(root, 'members', ledger.language, `${bucket(ledger.family_id)}.json.gz`);
const manifestPath = join(root, 'manifest.json');
const reportPath = join(root, 'report.json');
const provenancePath = join(root, 'repository-provenance.json');
const [families, members, manifest, report, provenance] = await Promise.all([familyPath, membersPath, manifestPath, reportPath, provenancePath].map(readJson));
assert(ledger.family_id === 'surface:de:ten' && ledger.language === 'de' && ledger.source_run_id === 35647932153, 'wrong decision input');
assert(Number(manifest.repository_storage.immutable_source_run_id) === ledger.source_run_id && provenance.source_run_id === ledger.source_run_id, 'source mismatch');
assert(!provenance.repository_repairs.some(item => item.repair === 'remove_incoherent_surface_de_ten'), 'already applied');
const family = families[ledger.family_id];
const values = members[ledger.family_id];
assert(family?.source === 'surface_singleton' && family?.review_status === 'needs_review', 'family source/status changed');
assert(family.support === ledger.expected_members && values?.length === ledger.expected_members, 'family membership count changed');
assert(Object.keys(family.language_support).length === 1 && family.language_support.de === ledger.expected_members, 'language support changed');
assert(family.aliases.length === 1 && family.aliases[0] === 'ten', 'alias changed');
const words = createHash('sha256');
const evidence = {};
for (const value of values.slice().sort((a, b) => a.lemma_id.localeCompare(b.lemma_id))) {
  words.update(`${value.lemma_id}\0${value.word}\n`);
  for (const component of value.components) for (const item of component.evidence) {
    const key = `${item.type}:${item.source}`;
    evidence[key] = (evidence[key] || 0) + 1;
  }
}
assert(words.digest('hex') === ledger.member_list_sha256, 'unexpected member set');
assert(JSON.stringify(evidence) === JSON.stringify(ledger.expected_evidence), 'unexpected evidence class/count');
const aliasPath = join(root, 'aliases', `${bucket('ten')}.json.gz`);
const aliases = await readJson(aliasPath);
assert(aliases.ten?.includes(ledger.family_id), 'reverse alias missing');
// All preflight conditions have passed; update only the named family and its lookup.
delete families[ledger.family_id];
delete members[ledger.family_id];
aliases.ten = aliases.ten.filter(id => id !== ledger.family_id);
const deletedAlias = aliases.ten.length === 0 ? 1 : 0;
if (deletedAlias) delete aliases.ten;
manifest.counts.families -= 1;
manifest.counts.aliases -= deletedAlias;
report.total_families -= 1;
report.aliases_in_lookup -= deletedAlias;
for (const field of ['largest_families', 'highest_suspicion_families']) report[field] = (report[field] || []).filter(item => item.id !== ledger.family_id);
const ledgerSha = createHash('sha256').update(ledgerBytes).digest('hex');
report.repository_materialization.incoherent_surface_ten_removed = ledger.expected_members;
report.repository_materialization.surface_ten_ledger_sha256 = ledgerSha;
provenance.repository_repairs.push({ repair: 'remove_incoherent_surface_de_ten', removed_memberships: ledger.expected_members, deleted_families: [ledger.family_id], deleted_aliases: deletedAlias, decision_ledger_sha256: ledgerSha, source_run_id: ledger.source_run_id, not_individual_lexical_annotation: true });
await Promise.all([[familyPath, families], [membersPath, members], [aliasPath, aliases], [manifestPath, manifest], [reportPath, report]].map(([path, value]) => writeJson(path, value)));
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
console.log(JSON.stringify({ deleted_family: ledger.family_id, removed_memberships: ledger.expected_members, deleted_alias: deletedAlias }, null, 2));
