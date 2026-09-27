#!/usr/bin/env node
// Review the complete la:illas candidate arrays before retaining only lexical headwords.
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const root = process.argv[2] || 'associativvordes/family-index-v5';
const ledgerBytes = await readFile('audit/associative-family-v5/illas-family-decision.json');
const ledger = JSON.parse(ledgerBytes);
const id = 'ety:1e9cc0c12192';
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const readJson = async path => JSON.parse((path.endsWith('.gz') ? gunzipSync(await readFile(path)) : await readFile(path)).toString('utf8'));
const writeJson = (path, value) => writeFile(path, path.endsWith('.gz') ? gzipSync(JSON.stringify(value), { level: 6 }) : JSON.stringify(value, null, 2) + '\n');
const sha256 = data => createHash('sha256').update(data).digest('hex');
function bucket(value) {
  let hash = 0x811c9dc5;
  for (const char of value) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 0x01000193); }
  return ((hash >>> 0) % 256).toString(16).padStart(2, '0');
}
assert(ledger.source_run_id === 35647932153 && ledger.family_id === id && ledger.etymon_key === 'la:illas', 'wrong source or family');
assert(ledger.expected_removed_memberships === 7736 && ledger.expected_final_support === 2, 'unexpected decision scope');
const manifest = await readJson(join(root, 'manifest.json'));
const report = await readJson(join(root, 'report.json'));
const provenancePath = join(root, 'repository-provenance.json');
const provenance = await readJson(provenancePath);
assert(manifest.repository_storage.immutable_source_run_id === ledger.source_run_id, 'manifest source mismatch');
assert(Number(report.provenance.workflow_run_id) === ledger.source_run_id && provenance.source_run_id === ledger.source_run_id, 'source mismatch');
assert(!provenance.repository_repairs.some(x => x.repair === 'prune_candidate_only_illas_memberships'), 'already applied');
const familyPath = join(root, 'families', `${bucket(id)}.json.gz`);
const families = await readJson(familyPath);
const family = families[id];
assert(family?.support === 7738 && family.review_status === 'needs_review', 'family metadata changed');
const retained = new Map(ledger.retained.map(x => [x.language, x]));
assert(retained.size === 2 && retained.has('es') && retained.has('fr'), 'invalid controls');
const memberFiles = [];
for (const language of ['es', 'fr']) {
  const path = join(root, 'members', language, `${bucket(id)}.json.gz`);
  const shard = await readJson(path);
  const members = shard[id];
  const lock = ledger.original_members[language];
  assert(members.length === lock.count, `${language} member count changed`);
  assert(sha256(JSON.stringify(members.map(x => [x.lemma_id, x.word]))) === lock.ordered_id_word_sha256, `${language} member list changed`);
  const counts = { compound_morphology: 0, morphological_parse: 0 };
  for (const member of members) {
    assert(member.components?.length === 1, `${language} multiple components: ${member.word}`);
    const evidence = member.components[0].evidence;
    assert(evidence?.length === 1, `${language} multiple evidence records: ${member.word}`);
    const entry = evidence[0];
    assert(entry.source === 'candidate_index' && entry.path?.slice(-2).join('\0') === [retained.get(language).word, retained.get(language).word].join('\0'), `${language} unsupported evidence: ${member.word}`);
    assert(Object.hasOwn(counts, entry.type), `${language} unexpected evidence type: ${member.word}`);
    counts[entry.type] += 1;
  }
  assert(Object.entries(counts).every(([type, count]) => count === lock[type]), `${language} evidence distribution changed`);
  const control = retained.get(language);
  const anchors = members.filter(x => x.lemma_id === control.lemma_id && x.word === control.word);
  assert(anchors.length === 1, `${language} missing lexical control`);
  assert(family.language_support[language] === members.length, `${language} family support mismatch`);
  shard[id] = anchors;
  family.language_support[language] = 1;
  memberFiles.push([path, shard]);
}
family.support = 2;
family.review_status = 'needs_review';
const top = report.largest_families.find(x => x.id === id);
assert(top && top.support === 7738, 'report family summary missing');
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
  const shardName = index.toString(16).padStart(2, '0');
  const shard = shardName === bucket(id) ? families : await readJson(join(root, 'families', `${shardName}.json.gz`));
  for (const item of Object.values(shard)) {
    keepTop(largest, item, largestCompare);
    keepTop(suspicious, item, suspiciousCompare);
  }
}
const byId = new Map([...report.largest_families, ...report.highest_suspicion_families].map(item => [item.id, item]));
for (const field of [['largest_families', largest], ['highest_suspicion_families', suspicious]]) {
  report[field[0]] = field[1].map(item => ({ ...(byId.get(item.id) || {}), ...item }));
}
report.repository_materialization = {
  ...report.repository_materialization,
  illas_candidate_only_memberships_removed: ledger.expected_removed_memberships,
  illas_family_decision_sha256: sha256(ledgerBytes)
};
provenance.repository_repairs.push({
  repair: 'prune_candidate_only_illas_memberships',
  removed_memberships: ledger.expected_removed_memberships,
  affected_families: 1,
  source_run_id: ledger.source_run_id,
  decision_ledger_sha256: sha256(ledgerBytes),
  not_human_statistical_annotation: true
});
for (const [path, shard] of memberFiles) await writeJson(path, shard);
await writeJson(familyPath, families);
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
console.log('Removed 7,736 candidate-only la:illas memberships; retained es:las and fr:elles.');
