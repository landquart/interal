#!/usr/bin/env node
// Collapse duplicate Latin nitid/nitidus keys and retain reviewed sense-level anchors.
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

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
const aliasesRemoved = oldFamily.aliases.filter(alias => !(aliasShards.get(aliasPath(alias))[alias])).length;
delete familyShards.get(familyPath(oldId))[oldId];
family.aliases = family.aliases.filter(alias => alias !== 'nitty');
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
for (const [language, kept] of languageMembers) {
  delete memberShards.get(memberPath(oldId, language))[oldId];
  memberShards.get(memberPath(id, language))[id] = kept;
}
manifest.counts.families -= 1;
manifest.counts.aliases -= aliasesRemoved;
report.total_families -= 1;
report.aliases_in_lookup -= aliasesRemoved;
report.merged_families -= 1;
report.generated_non_proto_families -= 1;
report.multi_branch_families -= 1;
report.review_required_families -= 1;

let uniqueTotal = 0;
for (const language of manifest.languages) {
  const unique = new Set();
  for (let index = 0; index < 256; index += 1) {
    const path = join(root, 'members', language, `${index.toString(16).padStart(2, '0')}.json.gz`);
    const shard = memberShards.get(path) || await readJson(path);
    for (const values of Object.values(shard)) for (const member of values) unique.add(member.lemma_id);
  }
  uniqueTotal += unique.size;
}
const unassigned = manifest.counts.lemmas - uniqueTotal;
report.invariants.classified_unique_lemmas = uniqueTotal;
report.invariants.lemmas_with_zero_family = unassigned;
report.repository_materialization.materialized_unique_lemmas = uniqueTotal;
report.repository_materialization.lemmas_without_materialized_family = unassigned;

const largest = [];
const suspicious = [];
const keepTop = (list, item, compare) => { list.push(item); list.sort(compare); if (list.length > 50) list.length = 50; };
for (let index = 0; index < 256; index += 1) {
  const path = join(root, 'families', `${index.toString(16).padStart(2, '0')}.json.gz`);
  const shard = familyShards.get(path) || await readJson(path);
  for (const item of Object.values(shard)) {
    keepTop(largest, item, (a, b) => b.support - a.support || a.id.localeCompare(b.id));
    keepTop(suspicious, item, (a, b) => b.suspicion_score - a.suspicion_score || b.support - a.support || a.id.localeCompare(b.id));
  }
}
report.largest_families = largest;
report.highest_suspicion_families = suspicious;
const ledgerSha = sha256(ledgerBytes);
report.repository_materialization.nitidus_net_memberships_removed = removed;
report.repository_materialization.nitidus_net_memberships_added = ledger.added.length;
report.repository_materialization.nitidus_ledger_sha256 = ledgerSha;
provenance.repository_repairs.push({ repair, source_run_id: ledger.source_run_id, deleted_duplicate_family: oldId, retained_family: id, removed_memberships: removed, added_memberships: ledger.added.length, deleted_aliases: aliasesRemoved, materialized_unique_lemmas: uniqueTotal, lemmas_without_materialized_family: unassigned, decision_ledger_sha256: ledgerSha, not_individual_lexical_annotation: true });
for (const [path, shard] of [...familyShards, ...memberShards, ...aliasShards]) await writeJson(path, shard);
await writeJson(join(root, 'manifest.json'), manifest);
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
console.log(JSON.stringify({ removed, added: ledger.added.length, retained: 18, aliasesRemoved, uniqueTotal, unassigned }));
