#!/usr/bin/env node
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

function fail(message) {
  throw new Error(message);
}

function scanFinite(value, path) {
  if (typeof value === 'number' && !Number.isFinite(value)) fail(`Non-finite number at ${path}`);
  if (Array.isArray(value)) value.forEach((item, index) => scanFinite(item, `${path}[${index}]`));
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) scanFinite(child, `${path}.${key}`);
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function main(argv = process.argv.slice(2)) {
  const [root = 'associativvordes/candidate-index', language = 'en'] = argv;
  const manifest = await readJson(join(root, 'manifest.json'));
  const languageManifest = manifest.languages?.[language] ?? fail(`Missing ${language} manifest`);
  if (languageManifest.entries <= 0) fail('manifest entries must be > 0');
  if (!Array.isArray(languageManifest.shards) || languageManifest.shards.length <= 0) fail('manifest shards must be > 0');

  const diskShards = new Set((await readdir(join(root, language))).filter(file => file.endsWith('.json')).map(file => `${language}/${file}`));
  const manifestShards = new Set(languageManifest.shards.map(shard => shard.file));
  for (const file of manifestShards) if (!diskShards.has(file)) fail(`Manifest shard missing on disk: ${file}`);
  for (const file of diskShards) if (!manifestShards.has(file)) fail(`Disk shard missing from manifest: ${file}`);

  let actualEntries = 0;
  const seen = new Set();
  for (const shard of languageManifest.shards) {
    const entries = await readJson(join(root, shard.file));
    if (!Array.isArray(entries)) fail(`Shard is not an array: ${shard.file}`);
    if (entries.length !== shard.entries) fail(`Shard count mismatch: ${shard.file}`);
    for (const entry of entries) {
      scanFinite(entry, `${shard.file}:${entry.normalized ?? entry.word ?? actualEntries}`);
      if (!entry.normalized || seen.has(entry.normalized)) fail(`Duplicate or empty normalized entry: ${entry.normalized}`);
      seen.add(entry.normalized);
      if (!Array.isArray(entry.sources) || entry.sources.length === 0) fail(`Entry without sources: ${entry.normalized}`);
      if (!Number.isFinite(entry.frequency_score) || entry.frequency_score < 0 || entry.frequency_score > 100) fail(`frequency_score out of range: ${entry.normalized}`);
      for (const source of entry.sources) {
        if (!source.id) fail(`Source without id: ${entry.normalized}`);
        if (!Number.isFinite(source.ipm) || source.ipm < 0) fail(`Invalid IPM: ${entry.normalized}`);
      }
    }
    actualEntries += entries.length;
  }
  if (actualEntries !== languageManifest.entries) fail(`Manifest entry count ${languageManifest.entries} != actual ${actualEntries}`);

  const report = await readJson(join(root, 'build-report.json'));
  if (report.language !== language) fail('Report language mismatch');
  if (report.entries !== actualEntries) fail('Report entries mismatch');
  if (!Array.isArray(report.alter_candidates) || report.alter_candidates.length > 20) fail('Report alter_candidates invalid');
  const totalBytes = (await stat(join(root, 'manifest.json'))).size
    + (await stat(join(root, 'build-report.json'))).size
    + (await Promise.all(languageManifest.shards.map(shard => stat(join(root, shard.file))))).reduce((sum, info) => sum + info.size, 0);
  if (report.total_bytes <= 0 || report.total_bytes > totalBytes) fail('Report total_bytes invalid');
  console.log(`Validated ${actualEntries} ${language} entries across ${languageManifest.shards.length} shards.`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
