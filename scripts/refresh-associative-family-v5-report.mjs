#!/usr/bin/env node
// Recompute existing family report summaries from committed family shards; no index rebuild.
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

const root = process.argv[2] || 'associativvordes/family-index-v5';
const reportPath = join(root, 'report.json');
const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
const report = JSON.parse(await readFile(reportPath, 'utf8'));
const assert = (value, message) => { if (!value) throw new Error(message); };
const statuses = new Set(['needs_review', 'blocked_from_runtime', 'rejected', 'split_required']);
const count = { total: 0, merged: 0, singleton: 0, multiBranch: 0, nonProto: 0, verifiedSeed: 0, reviewRequired: 0, unreviewedHighRisk: 0 };
const largest = [];
const suspicious = [];
const keepTop = (array, family, compare) => { array.push(family); array.sort(compare); if (array.length > 50) array.length = 50; };
for (let index = 0; index < 256; index += 1) {
  const shard = index.toString(16).padStart(2, '0');
  const families = JSON.parse(gunzipSync(await readFile(join(root, 'families', `${shard}.json.gz`))));
  for (const family of Object.values(families)) {
    count.total += 1;
    if (family.source !== 'surface_singleton') count.merged += 1;
    if (family.support === 1) count.singleton += 1;
    if (family.aliases.length > 1) count.multiBranch += 1;
    if (family.source === 'wiktionary_non_proto_etymology') count.nonProto += 1;
    if (family.verified) count.verifiedSeed += 1;
    if (statuses.has(family.review_status)) count.reviewRequired += 1;
    if (family.suspicion_score >= 35 && !statuses.has(family.review_status)) count.unreviewedHighRisk += 1;
    keepTop(largest, family, (a, b) => b.support - a.support || a.id.localeCompare(b.id));
    keepTop(suspicious, family, (a, b) => b.suspicion_score - a.suspicion_score || b.support - a.support || a.id.localeCompare(b.id));
  }
}
assert(count.total === manifest.counts.families, 'manifest family count changed');
Object.assign(report, {
  total_families: count.total,
  merged_families: count.merged,
  singleton_families: count.singleton,
  multi_branch_families: count.multiBranch,
  generated_non_proto_families: count.nonProto,
  verified_seed_families: count.verifiedSeed,
  review_required_families: count.reviewRequired,
  largest_families: largest,
  highest_suspicion_families: suspicious
});
report.invariants.unreviewed_high_risk_families = count.unreviewedHighRisk;
assert(count.unreviewedHighRisk === 0, 'unsafe high-risk family');
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
async function files(directory) {
  const out = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) out.push(...await files(path)); else out.push(path);
  }
  return out;
}
const provenancePath = join(root, 'repository-provenance.json');
const provenance = JSON.parse(await readFile(provenancePath, 'utf8'));
const hash = createHash('sha256');
const paths = (await files(root)).filter(path => path !== provenancePath).sort();
let bytes = 0;
for (const path of paths) {
  const data = await readFile(path);
  bytes += data.length;
  hash.update(path.slice(root.length + 1)).update('\0').update(data);
}
provenance.file_count_before_provenance = paths.length;
provenance.total_bytes_before_provenance = bytes;
provenance.tree_content_sha256 = hash.digest('hex');
await writeFile(provenancePath, JSON.stringify(provenance, null, 2) + '\n');
console.log(JSON.stringify({ count, top_list_lengths: [largest.length, suspicious.length] }, null, 2));
