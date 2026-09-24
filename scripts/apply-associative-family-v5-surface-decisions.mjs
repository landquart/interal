#!/usr/bin/env node
// Materialize only the complete case reviews in manual-surface-family-decisions.json.
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const root = process.argv[2] || 'associativvordes/family-index-v5';
const ledgerPath = process.argv[3] || 'audit/associative-family-v5/manual-surface-family-decisions.json';
const repairName = process.argv[4] || 'remove_reviewed_surface_families';
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
const shardPath = (type, key, language) => join(root, type, ...(language ? [language] : []), `${bucket(key)}.json.gz`);
const manifestPath = join(root, 'manifest.json');
const reportPath = join(root, 'report.json');
const provenancePath = join(root, 'repository-provenance.json');
const [manifest, report, provenance] = await Promise.all([readJson(manifestPath), readJson(reportPath), readJson(provenancePath)]);
assert(ledger.source_run_id === 35647932153 && ledger.decisions.length === 3, 'unexpected ledger or source');
assert(Number(manifest.repository_storage.immutable_source_run_id) === ledger.source_run_id && provenance.source_run_id === ledger.source_run_id, 'source mismatch');
assert(!provenance.repository_repairs.some(item => item.repair === repairName), 'already applied');
const familiesPath = shardPath('families', ledger.decisions[0].family_id);
const membersPath = shardPath('members', ledger.decisions[0].family_id, 'en');
const families = await readJson(familiesPath);
const members = await readJson(membersPath);
const aliasShards = new Map();
let count = 0;
let deletedAliases = 0;
// Validate the complete current member sets and lookup entries before the first write.
for (const item of ledger.decisions) {
  assert(item.action === 'delete_family' && item.language === 'en', `invalid action ${item.family_id}`);
  assert(shardPath('families', item.family_id) === familiesPath && shardPath('members', item.family_id, item.language) === membersPath, 'unexpected family bucket');
  const family = families[item.family_id];
  const values = members[item.family_id];
  assert(family?.source === 'surface_singleton' && family?.support === values?.length && family?.language_support?.en === values.length, `support mismatch ${item.family_id}`);
  assert(Object.keys(family.language_support).length === 1 && family.aliases.length === 1 && family.aliases[0] === family.canonical, `unexpected family shape ${item.family_id}`);
  const found = values.map(value => value.word).sort();
  const reviewed = [...item.reviewed_words].sort();
  assert(new Set(found).size === found.length && JSON.stringify(found) === JSON.stringify(reviewed), `unreviewed member in ${item.family_id}`);
  assert(!values.some(value => value.components.some(component => component.evidence.some(evidence => evidence.type === 'manual_override'))), `manual override ${item.family_id}`);
  const aliasPath = shardPath('aliases', family.canonical);
  if (!aliasShards.has(aliasPath)) aliasShards.set(aliasPath, await readJson(aliasPath));
  assert(aliasShards.get(aliasPath)[family.canonical]?.includes(item.family_id), `missing alias ${item.family_id}`);
  count += values.length;
}
for (const item of ledger.decisions) {
  const family = families[item.family_id];
  const alias = family.canonical;
  const aliases = aliasShards.get(shardPath('aliases', alias));
  aliases[alias] = aliases[alias].filter(id => id !== item.family_id);
  if (aliases[alias].length === 0) { delete aliases[alias]; deletedAliases += 1; }
  delete families[item.family_id];
  delete members[item.family_id];
}
manifest.counts.families -= ledger.decisions.length;
manifest.counts.aliases -= deletedAliases;
report.total_families -= ledger.decisions.length;
report.aliases_in_lookup -= deletedAliases;
for (const field of ['largest_families', 'highest_suspicion_families']) {
  assert(!(report[field] || []).some(item => ledger.decisions.some(decision => decision.family_id === item.id)), `report contains deleted family in ${field}`);
}
const ledgerSha = createHash('sha256').update(ledgerBytes).digest('hex');
report.repository_materialization.reviewed_surface_memberships_removed = (report.repository_materialization.reviewed_surface_memberships_removed || 0) + count;
report.repository_materialization.reviewed_surface_families_removed = (report.repository_materialization.reviewed_surface_families_removed || 0) + ledger.decisions.length;
report.repository_materialization[repairName === 'remove_reviewed_surface_families' ? 'surface_case_ledger_sha256' : 'surface_case_ledger_2_sha256'] = ledgerSha;
provenance.repository_repairs.push({ repair: repairName, removed_memberships: count, deleted_families: ledger.decisions.map(item => item.family_id), deleted_aliases: deletedAliases, source_run_id: ledger.source_run_id, decision_ledger_sha256: ledgerSha, not_human_statistical_annotation: true });
await writeJson(familiesPath, families);
await writeJson(membersPath, members);
for (const [path, shard] of aliasShards) await writeJson(path, shard);
await writeJson(manifestPath, manifest);
await writeJson(reportPath, report);
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
console.log(JSON.stringify({ deleted_families: ledger.decisions.map(item => item.family_id), removed_memberships: count, deleted_aliases: deletedAliases, source_run_id: ledger.source_run_id }, null, 2));
