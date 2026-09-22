#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const root = process.argv[2] || 'associativvordes/family-index-v5';
const languages = ['en', 'de', 'fr', 'es', 'it', 'ru'];
const rejected = new Set(['brokethemouldaftertheymadepeter','pediatricianand','pediatricianwho','helpedallof','eroticizedit','dutheillet','madrillet','ennuyeux']);
const readJson = async path => {
  const data = await readFile(path);
  return JSON.parse(path.endsWith('.gz') ? gunzipSync(data).toString('utf8') : data.toString('utf8'));
};
const writeJson = async (path, value) => {
  const text = JSON.stringify(value, null, 2) + '\n';
  await writeFile(path, path.endsWith('.gz') ? gzipSync(text, { level: 6 }) : text);
};
const shardNames = async path => (await readdir(path)).filter(name => name.endsWith('.json.gz')).sort();
const removedByFamily = new Map();
const removedRows = [];

for (const language of languages) {
  for (const file of await shardNames(join(root, 'members', language))) {
    const path = join(root, 'members', language, file);
    const shard = await readJson(path);
    let changed = false;
    for (const [familyId, values] of Object.entries(shard)) {
      const kept = values.filter(value => {
        const remove = rejected.has(String(value.word).toLowerCase());
        if (remove) removedRows.push({ language, family_id: familyId, lemma_id: value.lemma_id, word: value.word });
        return !remove;
      });
      if (kept.length !== values.length) {
        changed = true;
        const counts = removedByFamily.get(familyId) || {};
        counts[language] = (counts[language] || 0) + values.length - kept.length;
        removedByFamily.set(familyId, counts);
        if (kept.length) shard[familyId] = kept; else delete shard[familyId];
      }
    }
    if (changed) await writeJson(path, shard);
  }
}

const deletedFamilies = new Set();
let familyCount = 0;
for (const file of await shardNames(join(root, 'families'))) {
  const path = join(root, 'families', file);
  const shard = await readJson(path);
  let changed = false;
  for (const [familyId, family] of Object.entries(shard)) {
    const removals = removedByFamily.get(familyId) || {};
    for (const language of languages) {
      if (!removals[language]) continue;
      const next = (family.language_support?.[language] || 0) - removals[language];
      if (next < 0) throw new Error(`negative language support ${familyId}/${language}`);
      if (next === 0) delete family.language_support[language]; else family.language_support[language] = next;
      family.support -= removals[language];
      changed = true;
    }
    const aliases = [...new Set((family.aliases || []).filter(alias => !rejected.has(String(alias).toLowerCase())))].sort();
    if (JSON.stringify(aliases) !== JSON.stringify(family.aliases)) { family.aliases = aliases; changed = true; }
    if (family.support === 0) {
      delete shard[familyId];
      deletedFamilies.add(familyId);
      changed = true;
    } else {
      if (!family.aliases.length) throw new Error(`nonempty family lost every alias ${familyId}`);
      familyCount += 1;
    }
  }
  if (changed) await writeJson(path, shard);
}

let aliasCount = 0;
for (const file of await shardNames(join(root, 'aliases'))) {
  const path = join(root, 'aliases', file);
  const shard = await readJson(path);
  let changed = false;
  for (const [alias, ids] of Object.entries(shard)) {
    if (rejected.has(String(alias).toLowerCase())) {
      delete shard[alias];
      changed = true;
      continue;
    }
    const kept = ids.filter(id => !deletedFamilies.has(id));
    if (kept.length !== ids.length) {
      changed = true;
      if (kept.length) shard[alias] = kept; else delete shard[alias];
    }
  }
  aliasCount += Object.keys(shard).length;
  if (changed) await writeJson(path, shard);
}

const manifestPath = join(root, 'manifest.json');
const reportPath = join(root, 'report.json');
const manifest = await readJson(manifestPath);
const report = await readJson(reportPath);
manifest.counts.families = familyCount;
manifest.counts.aliases = aliasCount;
report.total_families = familyCount;
report.aliases_in_lookup = aliasCount;
report.repository_materialization = {
  source_run_id: 35647932153,
  rejected_corpus_noise_removed_from_runtime: removedRows.length,
  deleted_empty_families: deletedFamilies.size
};
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
const provenancePath = join(root, 'repository-provenance.json');
const provenance = await readJson(provenancePath);
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
provenance.repository_repairs = [{
  repair: 'exclude_known_rejected_corpus_noise_from_runtime',
  removed_memberships: removedRows.length,
  removed_lemmas: new Set(removedRows.map(row => row.lemma_id)).size,
  deleted_empty_families: deletedFamilies.size,
  source_run_id: 35647932153
}];
await writeJson(provenancePath, provenance);
console.log(JSON.stringify({ removed_rows: removedRows, deleted_families: [...deletedFamilies].sort(), counts: { families: familyCount, aliases: aliasCount } }, null, 2));
