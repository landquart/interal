#!/usr/bin/env node
// Apply five explicit family-level judgments; all member sets/evidence are locked before writing.
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const root = process.argv[2] || 'associativvordes/family-index-v5';
const ledgerBytes = await readFile('audit/associative-family-v5/surface-inflection-decisions.json');
const ledger = JSON.parse(ledgerBytes);
const repairName = 'remove_incoherent_inflection_surface_families';
const assert = (value, message) => { if (!value) throw new Error(message); };
const bucket = value => {
  let hash = 0x811c9dc5;
  for (const char of value) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 0x01000193); }
  return ((hash >>> 0) % 256).toString(16).padStart(2, '0');
};
const readJson = async path => JSON.parse((path.endsWith('.gz') ? gunzipSync(await readFile(path)) : await readFile(path)).toString('utf8'));
const writeJson = (path, value) => writeFile(path, path.endsWith('.gz') ? gzipSync(JSON.stringify(value), { level: 6 }) : JSON.stringify(value, null, 2) + '\n');
const paths = {
  family: id => join(root, 'families', `${bucket(id)}.json.gz`),
  member: (id, language) => join(root, 'members', language, `${bucket(id)}.json.gz`),
  alias: alias => join(root, 'aliases', `${bucket(alias)}.json.gz`)
};
const manifestPath = join(root, 'manifest.json');
const reportPath = join(root, 'report.json');
const provenancePath = join(root, 'repository-provenance.json');
const [manifest, report, provenance] = await Promise.all([manifestPath, reportPath, provenancePath].map(readJson));
assert(ledger.source_run_id === 35647932153 && ledger.decisions.length === 5, 'unexpected ledger/source');
assert(Number(manifest.repository_storage.immutable_source_run_id) === ledger.source_run_id && provenance.source_run_id === ledger.source_run_id, 'source mismatch');
assert(!provenance.repository_repairs.some(item => item.repair === repairName), 'already applied');
const familyShards = new Map();
const memberShards = new Map();
const aliasShards = new Map();
let removedMembers = 0;
// No writes until every listed family, member digest, evidence set and reverse alias passes.
for (const item of ledger.decisions) {
  assert(manifest.languages.includes(item.language) && item.family_id.startsWith(`surface:${item.language}:`), `wrong family/language ${item.family_id}`);
  const familyPath = paths.family(item.family_id);
  const memberPath = paths.member(item.family_id, item.language);
  if (!familyShards.has(familyPath)) familyShards.set(familyPath, await readJson(familyPath));
  if (!memberShards.has(memberPath)) memberShards.set(memberPath, await readJson(memberPath));
  const family = familyShards.get(familyPath)[item.family_id];
  const members = memberShards.get(memberPath)[item.family_id];
  assert(family?.source === 'surface_singleton' && family.review_status === item.expected_status, `source/status ${item.family_id}`);
  assert(family.support === item.expected_members && members?.length === item.expected_members, `count ${item.family_id}`);
  assert(Object.keys(family.language_support).length === 1 && family.language_support[item.language] === item.expected_members, `language support ${item.family_id}`);
  assert(family.aliases.length === 1 && family.aliases[0] === family.canonical, `aliases ${item.family_id}`);
  const digest = createHash('sha256');
  const evidence = {};
  for (const member of members.slice().sort((a, b) => a.lemma_id.localeCompare(b.lemma_id))) {
    digest.update(`${member.lemma_id}\0${member.word}\n`);
    for (const component of member.components) for (const entry of component.evidence) {
      const key = `${entry.type}:${entry.source}`;
      evidence[key] = (evidence[key] || 0) + 1;
    }
  }
  assert(digest.digest('hex') === item.member_list_sha256, `member digest ${item.family_id}`);
  assert(Object.keys(evidence).length === Object.keys(item.expected_evidence).length && Object.entries(item.expected_evidence).every(([key, value]) => evidence[key] === value), `evidence changed ${item.family_id}`);
  const aliasPath = paths.alias(family.canonical);
  if (!aliasShards.has(aliasPath)) aliasShards.set(aliasPath, await readJson(aliasPath));
  assert(aliasShards.get(aliasPath)[family.canonical]?.includes(item.family_id), `reverse alias ${item.family_id}`);
  removedMembers += members.length;
}
let deletedAliases = 0;
for (const item of ledger.decisions) {
  const families = familyShards.get(paths.family(item.family_id));
  const alias = families[item.family_id].canonical;
  const aliases = aliasShards.get(paths.alias(alias));
  aliases[alias] = aliases[alias].filter(id => id !== item.family_id);
  if (!aliases[alias].length) { delete aliases[alias]; deletedAliases += 1; }
  delete families[item.family_id];
  delete memberShards.get(paths.member(item.family_id, item.language))[item.family_id];
}
manifest.counts.families -= ledger.decisions.length;
manifest.counts.aliases -= deletedAliases;
report.total_families -= ledger.decisions.length;
report.aliases_in_lookup -= deletedAliases;
const removedIds = new Set(ledger.decisions.map(item => item.family_id));
for (const field of ['largest_families', 'highest_suspicion_families']) report[field] = (report[field] || []).filter(item => !removedIds.has(item.id));
const ledgerSha = createHash('sha256').update(ledgerBytes).digest('hex');
report.repository_materialization.incoherent_inflection_memberships_removed = removedMembers;
report.repository_materialization.inflection_family_ledger_sha256 = ledgerSha;
provenance.repository_repairs.push({ repair: repairName, removed_memberships: removedMembers, deleted_families: ledger.decisions.map(item => item.family_id), deleted_aliases: deletedAliases, decision_ledger_sha256: ledgerSha, source_run_id: ledger.source_run_id, not_individual_lexical_annotation: true });
for (const [path, value] of [...familyShards, ...memberShards, ...aliasShards]) await writeJson(path, value);
await writeJson(manifestPath, manifest);
await writeJson(reportPath, report);
async function allFiles(directory) {
  const out = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) out.push(...await allFiles(path)); else out.push(path);
  }
  return out;
}
const filePaths = (await allFiles(root)).filter(path => path !== provenancePath).sort();
const hash = createHash('sha256');
let bytes = 0;
for (const path of filePaths) {
  const data = await readFile(path);
  bytes += data.length;
  hash.update(path.slice(root.length + 1)).update('\0').update(data);
}
provenance.file_count_before_provenance = filePaths.length;
provenance.total_bytes_before_provenance = bytes;
provenance.tree_content_sha256 = hash.digest('hex');
await writeJson(provenancePath, provenance);
console.log(JSON.stringify({ removed_memberships: removedMembers, deleted_families: [...removedIds], deleted_aliases: deletedAliases }, null, 2));
