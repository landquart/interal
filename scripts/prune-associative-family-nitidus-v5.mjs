#!/usr/bin/env node
// Collapse duplicate Latin nitid/nitidus keys and retain reviewed sense-level anchors.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

import { recountMaterializedMembers, refreshFamilySummaries, repositoryTreeMetadata } from './lib/associative-repository-materialization.mjs';

const root = process.argv[2] || 'associativvordes/family-index-v5';
const ledgerBytes = await readFile('audit/associative-family-v5/nitidus-family-decisions.json');
const ledger = JSON.parse(ledgerBytes);
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function bucket(value) {
  let hash = 0x811c9dc5;
  for (const c of value) { hash ^= c.codePointAt(0); hash = Math.imul(hash, 0x01000193); }
  return ((hash >>> 0) % 256).toString(16).padStart(2, '0');
}
const readJson = async path => JSON.parse((path.endsWith('.gz') ? gunzipSync(await readFile(path)) : await readFile(path)).toString('utf8'));
const writeJson = (path, value) => writeFile(path, path.endsWith('.gz') ? gzipSync(JSON.stringify(value), { level: 6 }) : `${JSON.stringify(value, null, 2)}\n`);
const familyPath = id => join(root, 'families', `${bucket(id)}.json.gz`);
const memberPath = (id, language) => join(root, 'members', language, `${bucket(id)}.json.gz`);
const aliasPath = alias => join(root, 'aliases', `${bucket(alias)}.json.gz`);
const oldId = 'ety:03193cddd861';
const id = 'ety:94c776d13c76';
const repair = 'consolidate_and_prune_latin_nitidus';
const surfaceId = 'surface:es:nitid';
const unrelatedNetTargets = ['ety:10929f75019c', 'ety:3c9ed8371259', 'ety:c1b6e2919722'];
assert(ledger.source_run_id === 35647932153 && ledger.deleted_duplicate_family_id === oldId && ledger.canonical_family_id === id && ledger.expected_final_support === 18, 'unexpected decision ledger');
const manifest = await readJson(join(root, 'manifest.json'));
const report = await readJson(join(root, 'report.json'));
const provenancePath = join(root, 'repository-provenance.json');
const provenance = await readJson(provenancePath);
assert(manifest.repository_storage.immutable_source_run_id === ledger.source_run_id && provenance.source_run_id === ledger.source_run_id, 'source changed');
assert(!provenance.repository_repairs.some(item => item.repair === repair), 'already applied');
const familyShards = new Map();
const memberShards = new Map();
const aliasShards = new Map();
const get = async (map, path) => {
  if (!map.has(path)) map.set(path, await readJson(path));
  return map.get(path);
};
const oldFamily = (await get(familyShards, familyPath(oldId)))[oldId];
const family = (await get(familyShards, familyPath(id)))[id];
assert(oldFamily?.support === 4967 && family?.support === 4967, 'family support changed');
assert(JSON.stringify(oldFamily.aliases) === JSON.stringify(family.aliases) && JSON.stringify(family.aliases) === '["neat","net","nett","nitid","nitty"]', 'aliases changed');
assert(oldFamily.review_status === 'needs_review' && family.review_status === 'needs_review', 'review status changed');
assert(JSON.stringify(oldFamily.language_support) === JSON.stringify(family.language_support), 'duplicate family support differs');
const languageMembers = new Map();
let removed = 0;
// Verify the whole original ordered list and each evidence class before any write.
for (const language of Object.keys(ledger.original_members[id])) {
  const current = (await get(memberShards, memberPath(id, language)))[id];
  const duplicate = (await get(memberShards, memberPath(oldId, language)))[oldId];
  for (const [familyId, list] of [[id, current], [oldId, duplicate]]) {
    const lock = ledger.original_members[familyId][language];
    assert(list?.length === lock.count, `count ${familyId}/${language}`);
    assert(sha256(JSON.stringify(list.map(item => [item.lemma_id, item.word]))) === lock.ordered_id_word_sha256, `member digest ${familyId}/${language}`);
    const evidence = {};
    for (const item of list) for (const component of item.components) for (const entry of component.evidence) {
      const key = `${entry.type}:${entry.source}`;
      evidence[key] = (evidence[key] || 0) + 1;
    }
    assert(JSON.stringify(evidence) === JSON.stringify(lock.evidence), `evidence ${familyId}/${language}`);
  }
  assert(JSON.stringify(current) === JSON.stringify(duplicate), `duplicate arrays differ ${language}`);
  const controls = ledger.retained.filter(item => item.language === language);
  const retained = current.filter(item => controls.some(control => control.lemma_id === item.lemma_id && control.word === item.word));
  assert(retained.length === controls.length, `missing reviewed member ${language}`);
  removed += current.length + duplicate.length - retained.length;
  languageMembers.set(language, retained);
}
for (const addition of ledger.added) {
  const source = (await get(memberShards, memberPath(addition.source_family_id, addition.language)))[addition.source_family_id];
  const item = source?.find(member => member.lemma_id === addition.lemma_id && member.word === addition.word);
  assert(item && sha256(JSON.stringify(item)) === addition.source_member_sha256, `missing positive addition ${addition.word}`);
  const member = structuredClone(item);
  member.components = [{
    surface: member.search_form,
    canonical_candidate: family.canonical,
    confidence: 1,
    evidence: [{ type: 'manual_override', source: 'linguistic_review', path: [addition.language, addition.word, id], confidence: 1 }]
  }];
  assert(!languageMembers.get(addition.language).some(x => x.lemma_id === member.lemma_id), `duplicate added lemma ${addition.word}`);
  languageMembers.get(addition.language).push(member);
}
assert(removed === 9918 && [...languageMembers.values()].reduce((n, list) => n + list.length, 0) === 18, 'wrong removal/support totals');
const surfaceFamily = (await get(familyShards, familyPath(surfaceId)))[surfaceId];
const surfaceMembers = (await get(memberShards, memberPath(surfaceId, 'es')))[surfaceId];
assert(surfaceFamily?.source === 'surface_singleton' && surfaceFamily.support === 6 && JSON.stringify(surfaceFamily.aliases) === '["nitid"]', 'Spanish surface family changed');
assert(sha256(JSON.stringify(surfaceMembers.map(item => [item.lemma_id, item.word]))) === '9b428e1045450ffd531763895ecdf67453baf9891075abe7eb085b3b4ce7ca07', 'Spanish surface members changed');
assert(surfaceMembers.some(item => item.word === 'nítido' && ledger.added.some(added => added.lemma_id === item.lemma_id)), 'reviewed Spanish member missing');
// Validate reverse aliases, then remove the duplicate's targets and the
// unrelated nitty alias. Preserve every other family sharing those aliases.
for (const alias of oldFamily.aliases) {
  const aliases = await get(aliasShards, aliasPath(alias));
  assert(aliases[alias]?.includes(oldId) && aliases[alias]?.includes(id), `alias target missing ${alias}`);
}
for (const alias of oldFamily.aliases) {
  const aliases = aliasShards.get(aliasPath(alias));
  aliases[alias] = aliases[alias].filter(target => target !== oldId && (alias !== 'nitty' || target !== id));
  if (!aliases[alias].length) delete aliases[alias];
}
for (const target of unrelatedNetTargets) {
  const unrelated = (await get(familyShards, familyPath(target)))[target];
  assert(unrelated?.aliases.includes('net') && !['net', 'nett', 'nitid'].includes(unrelated.canonical), `unexpected net target ${target}`);
  unrelated.aliases = unrelated.aliases.filter(alias => alias !== 'net');
  const netAliases = await get(aliasShards, aliasPath('net'));
  assert(netAliases.net.includes(target), `missing reverse net target ${target}`);
  netAliases.net = netAliases.net.filter(item => item !== target);
}
let aliasesAdded = 0;
for (const alias of ['nitidus', 'neto', 'nitido']) {
  const aliases = await get(aliasShards, aliasPath(alias));
  if (!aliases[alias]) aliasesAdded += 1;
  aliases[alias] ||= [];
  assert(!aliases[alias].includes(id), `already registered ${alias}`);
  aliases[alias].push(id);
  aliases[alias].sort();
}
const aliasesRemoved = oldFamily.aliases.filter(alias => !(aliasShards.get(aliasPath(alias))[alias])).length;
delete familyShards.get(familyPath(oldId))[oldId];
delete familyShards.get(familyPath(surfaceId))[surfaceId];
delete memberShards.get(memberPath(surfaceId, 'es'))[surfaceId];
const nitidAliases = await get(aliasShards, aliasPath('nitid'));
nitidAliases.nitid = nitidAliases.nitid.filter(target => target !== surfaceId);
family.aliases = [...family.aliases.filter(alias => alias !== 'nitty'), 'nitidus', 'neto', 'nitido'].sort();
const allowedWords = new Set([...ledger.retained, ...ledger.added].map(item => `${item.language}\0${item.word}`));
const uniqueEvidence = new Set();
family.relation_evidence = [...family.relation_evidence, ...oldFamily.relation_evidence].filter(entry => {
  const key = JSON.stringify(entry);
  if (!allowedWords.has(`${entry.language}\0${entry.word}`) || uniqueEvidence.has(key)) return false;
  uniqueEvidence.add(key);
  return true;
});
family.support = 18;
family.language_support = Object.fromEntries([...languageMembers].map(([language, list]) => [language, list.length]));
family.suspicion_score = 20;
family.suspicion_reasons = ['short_root'];
family.review_status_reason = 'net_homonyms_require_sense_review';
family.runtime_curated = true;
for (const [language, kept] of languageMembers) {
  for (const member of kept) member.components = [{ surface: member.search_form, canonical_candidate: family.canonical, confidence: 1, evidence: [{ type: 'manual_override', source: 'linguistic_review', path: [language, member.word, id], confidence: 1 }] }];
  delete memberShards.get(memberPath(oldId, language))[oldId];
  memberShards.get(memberPath(id, language))[id] = kept;
}
assert((await get(aliasShards, aliasPath('net'))).net.length <= 25, 'net fanout remains excessive');
manifest.counts.families -= 2;
manifest.counts.aliases += aliasesAdded - aliasesRemoved;
report.total_families -= 2;
report.aliases_in_lookup += aliasesAdded - aliasesRemoved;
report.merged_families -= 1;
report.generated_non_proto_families -= 1;
report.multi_branch_families -= 1;
report.review_required_families -= 1;

const { uniqueTotal, multiTotal, unassigned } = await recountMaterializedMembers(root, manifest, report, memberShards);
await refreshFamilySummaries(root, report, familyShards);
const ledgerSha = sha256(ledgerBytes);
report.repository_materialization.nitidus_net_memberships_removed = removed + surfaceMembers.length;
report.repository_materialization.nitidus_net_memberships_added = ledger.added.length;
report.repository_materialization.nitidus_ledger_sha256 = ledgerSha;
provenance.repository_repairs.push({ repair, source_run_id: ledger.source_run_id, deleted_duplicate_family: oldId, deleted_surface_family: surfaceId, retained_family: id, removed_memberships: removed + surfaceMembers.length, added_memberships: ledger.added.length, removed_unrelated_net_alias_targets: unrelatedNetTargets, added_lookup_aliases: ['nitidus', 'neto', 'nitido'], deleted_aliases: aliasesRemoved, materialized_unique_lemmas: uniqueTotal, lemmas_without_materialized_family: unassigned, multi_family_lemmas: multiTotal, decision_ledger_sha256: ledgerSha, not_individual_lexical_annotation: true });
for (const [path, shard] of [...familyShards, ...memberShards, ...aliasShards]) await writeJson(path, shard);
await writeJson(join(root, 'manifest.json'), manifest);
await writeJson(join(root, 'report.json'), report);
Object.assign(provenance, await repositoryTreeMetadata(root));
await writeJson(provenancePath, provenance);
console.log(JSON.stringify({ removed: removed + surfaceMembers.length, added: ledger.added.length, retained: 18, aliasesRemoved, uniqueTotal, unassigned, multiTotal }));
