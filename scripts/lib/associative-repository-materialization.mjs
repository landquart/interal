import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { gunzipSync } from 'node:zlib';

const readShard = async path => JSON.parse(gunzipSync(await readFile(path)).toString('utf8'));

// Shared with the exhaustive audit: all materialization bytes except provenance.
export async function repositoryTreeMetadata(root) {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (relative(root, path) !== 'repository-provenance.json') files.push(path);
    }
  }
  await visit(root);
  files.sort();
  const hash = createHash('sha256');
  let bytes = 0;
  for (const path of files) {
    const data = await readFile(path);
    bytes += data.length;
    hash.update(relative(root, path)).update('\0').update(data);
  }
  return { file_count_before_provenance: files.length, total_bytes_before_provenance: bytes, tree_content_sha256: hash.digest('hex') };
}

export async function recountMaterializedMembers(root, manifest, report, pending = new Map()) {
  let uniqueTotal = 0, multiTotal = 0, membershipTotal = 0;
  const uniqueByLanguage = {}, membershipsByLanguage = {};
  for (const language of manifest.languages) {
    const counts = new Map();
    let memberships = 0;
    for (const name of (await readdir(join(root, 'members', language))).filter(name => name.endsWith('.json.gz')).sort()) {
      const path = join(root, 'members', language, name);
      const shard = pending.get(path) || await readShard(path);
      for (const values of Object.values(shard)) for (const member of values) {
        counts.set(member.lemma_id, (counts.get(member.lemma_id) || 0) + 1);
        memberships += 1;
      }
    }
    uniqueByLanguage[language] = counts.size;
    membershipsByLanguage[language] = memberships;
    uniqueTotal += counts.size;
    membershipTotal += memberships;
    for (const count of counts.values()) if (count > 1) multiTotal += 1;
  }
  const unassigned = manifest.counts.lemmas - uniqueTotal;
  if (unassigned < 0) throw new Error('Materialized lemma count exceeds source count');
  report.invariants.classified_unique_lemmas = uniqueTotal;
  report.invariants.lemmas_with_zero_family = unassigned;
  Object.assign(report.repository_materialization, {
    materialized_unique_lemmas: uniqueTotal,
    lemmas_without_materialized_family: unassigned,
    unique_lemmas_by_language: uniqueByLanguage,
    memberships_by_language: membershipsByLanguage,
    memberships: membershipTotal
  });
  report.multi_family_lemmas = multiTotal;
  return { uniqueTotal, multiTotal, unassigned, membershipTotal, uniqueByLanguage, membershipsByLanguage };
}

export async function refreshFamilySummaries(root, report, pending = new Map()) {
  const largest = [], suspicious = [];
  const counts = { total_families:0, merged_families:0, singleton_families:0, multi_branch_families:0, generated_non_proto_families:0, verified_seed_families:0, review_required_families:0 };
  const reviewStatuses = new Set(['needs_review','blocked_from_runtime','rejected','split_required']);
  let highRisk = 0;
  const keep = (list, family, compare) => { list.push(family); list.sort(compare); if (list.length > 50) list.length = 50; };
  for (const name of (await readdir(join(root, 'families'))).filter(name => name.endsWith('.json.gz')).sort()) {
    const path = join(root, 'families', name);
    const shard = pending.get(path) || await readShard(path);
    for (const family of Object.values(shard)) {
      counts.total_families += 1;
      if (family.source !== 'surface_singleton') counts.merged_families += 1;
      if (family.support === 1) counts.singleton_families += 1;
      if (family.aliases.length > 1) counts.multi_branch_families += 1;
      if (family.source === 'wiktionary_non_proto_etymology') counts.generated_non_proto_families += 1;
      if (family.verified) counts.verified_seed_families += 1;
      if (reviewStatuses.has(family.review_status)) counts.review_required_families += 1;
      if (family.suspicion_score >= 35 && !reviewStatuses.has(family.review_status)) highRisk += 1;
      keep(largest, family, (a,b) => b.support - a.support || a.id.localeCompare(b.id));
      keep(suspicious, family, (a,b) => b.suspicion_score - a.suspicion_score || b.support - a.support || a.id.localeCompare(b.id));
    }
  }
  Object.assign(report, counts);
  report.invariants.unreviewed_high_risk_families = highRisk;
  report.largest_families = largest;
  report.highest_suspicion_families = suspicious;
}
