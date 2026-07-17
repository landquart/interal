#!/usr/bin/env node
import { cp, mkdir, readdir, readFile, rm, rename, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

const LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'ru'];
const ARTIFACT_PREFIX = 'associative-index-';
const SUPPORTED_VERSION = '1';
const SUPPORTED_NORMALIZER_VERSION = '2';

function parseArgs(argv) {
  const options = {};
  for (const arg of argv) {
    if (arg.startsWith('--input-root=')) options.inputRoot = arg.slice('--input-root='.length);
    else if (arg.startsWith('--output-root=')) options.outputRoot = arg.slice('--output-root='.length);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.inputRoot) throw new Error('--input-root is required');
  if (!options.outputRoot) throw new Error('--output-root is required');
  return { inputRoot: resolve(options.inputRoot), outputRoot: resolve(options.outputRoot) };
}

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid ${label} JSON at ${path}: ${error.message}`);
  }
}

function assertRelativeCandidatePath(file, language) {
  if (typeof file !== 'string' || !file) throw new Error(`Invalid shard path for ${language}`);
  if (file.startsWith('/') || file.includes('\\') || file.split('/').includes('..')) throw new Error(`Shard path must be relative to candidate-index: ${file}`);
  if (!file.startsWith(`${language}/`)) throw new Error(`Shard path for ${language} must stay under ${language}/: ${file}`);
}

function assertFiniteScore(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid finite number at ${label}`);
}

function signatureOfEntry(entry) {
  return Object.keys(entry).sort().join(',');
}

function compatibleMetadata(manifest) {
  const { generated_at, languages, config_hash, global_config_hash, ...metadata } = manifest;
  return metadata;
}

function manifestGlobalConfigHash(manifest) {
  return manifest.global_config_hash ?? manifest.config_hash;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

async function validateArtifact(inputRoot, language) {
  const artifactName = `${ARTIFACT_PREFIX}${language}`;
  const artifactRoot = join(inputRoot, artifactName);
  const manifest = await readJson(join(artifactRoot, 'manifest.json'), `${artifactName} manifest`);
  const report = await readJson(join(artifactRoot, 'build-report.json'), `${artifactName} build-report`);

  if (!LANGUAGES.includes(language)) throw new Error(`Unknown language: ${language}`);
  if (manifest.version !== SUPPORTED_VERSION) throw new Error(`${artifactName}: unsupported version ${manifest.version}`);
  if (manifest.normalizer_version !== SUPPORTED_NORMALIZER_VERSION) throw new Error(`${artifactName}: unsupported normalizer_version ${manifest.normalizer_version}`);
  if (!manifestGlobalConfigHash(manifest) || typeof manifestGlobalConfigHash(manifest) !== 'string') throw new Error(`${artifactName}: global_config_hash is required`);
  if (!manifest.languages || typeof manifest.languages !== 'object') throw new Error(`${artifactName}: languages metadata is required`);
  const manifestLanguages = Object.keys(manifest.languages).sort();
  if (manifestLanguages.length !== 1 || manifestLanguages[0] !== language) throw new Error(`${artifactName}: manifest language must match artifact directory`);
  if (report.language !== language) throw new Error(`${artifactName}: build-report language must match artifact directory`);

  const info = manifest.languages[language];
  if (!Number.isInteger(info.entries) || info.entries <= 0) throw new Error(`${artifactName}: entries must be > 0`);
  if (!Array.isArray(info.shards) || info.shards.length <= 0) throw new Error(`${artifactName}: shards must be > 0`);
  if (info.language_config_hash != null && (typeof info.language_config_hash !== 'string' || !info.language_config_hash)) throw new Error(`${artifactName}: language_config_hash must be a non-empty string`);
  if (!Array.isArray(info.source_files)) throw new Error(`${artifactName}: source_files must be an array`);

  let countedEntries = 0;
  let totalBytes = 0;
  let entrySignature;
  for (const shard of info.shards) {
    assertRelativeCandidatePath(shard.file, language);
    if (!Number.isInteger(shard.entries) || shard.entries <= 0) throw new Error(`${artifactName}: invalid shard entry count for ${shard.file}`);
    const shardPath = join(artifactRoot, shard.file);
    let shardStat;
    try { shardStat = await stat(shardPath); } catch { throw new Error(`${artifactName}: missing shard ${shard.file}`); }
    if (!shardStat.isFile()) throw new Error(`${artifactName}: shard is not a file ${shard.file}`);
    const entries = await readJson(shardPath, `${artifactName} shard ${shard.file}`);
    if (!Array.isArray(entries)) throw new Error(`${artifactName}: shard ${shard.file} must contain an array`);
    if (entries.length !== shard.entries) throw new Error(`${artifactName}: shard ${shard.file} entry count mismatch`);
    countedEntries += entries.length;
    totalBytes += shardStat.size;
    for (const [index, entry] of entries.entries()) {
      if (!Array.isArray(entry.sources) || entry.sources.length === 0) throw new Error(`${artifactName}: candidate without sources in ${shard.file}[${index}]`);
      assertFiniteScore(entry.frequency_score, `${shard.file}[${index}].frequency_score`);
      const sig = signatureOfEntry(entry);
      entrySignature ??= sig;
      if (sig !== entrySignature) throw new Error(`${artifactName}: incompatible entry structure in ${shard.file}[${index}]`);
    }
  }
  if (countedEntries !== info.entries) throw new Error(`${artifactName}: entries metadata mismatch`);
  if (report.entries !== info.entries) throw new Error(`${artifactName}: build-report entries mismatch`);

  return { language, artifactRoot, manifest, report, info, totalBytes, entrySignature, metadataSignature: stableJson(compatibleMetadata(manifest)) };
}

function assertCompatible(artifacts) {
  const first = artifacts[0];
  const globalHashes = new Set(artifacts.map(a => manifestGlobalConfigHash(a.manifest)));
  if (globalHashes.size !== 1) throw new Error('Incompatible global_config_hash values');
  for (const artifact of artifacts.slice(1)) {
    if (artifact.manifest.version !== first.manifest.version) throw new Error('Incompatible schema versions');
    if (artifact.manifest.normalizer_version !== first.manifest.normalizer_version) throw new Error('Incompatible normalizer_version values');
    if (artifact.entrySignature !== first.entrySignature) throw new Error('Incompatible shard entry structures');
    if (artifact.metadataSignature !== first.metadataSignature) throw new Error('Incompatible manifest metadata');
  }
}

function buildMergedManifest(artifacts) {
  const first = artifacts[0].manifest;
  const manifest = {
    version: first.version,
    normalizer_version: first.normalizer_version,
    global_config_hash: manifestGlobalConfigHash(first),
    generated_at: first.generated_at,
    languages: {}
  };
  for (const artifact of artifacts) {
    manifest.languages[artifact.language] = {
      language_config_hash: artifact.info.language_config_hash ?? artifact.manifest.config_hash,
      entries: artifact.info.entries,
      source_files: [...artifact.info.source_files].sort(),
      shards: artifact.info.shards.map(shard => ({ file: shard.file, entries: shard.entries })).sort((a, b) => a.file.localeCompare(b.file)),
      total_bytes: artifact.totalBytes
    };
  }
  return manifest;
}

async function removeIfExists(path) {
  await rm(path, { recursive: true, force: true });
}

export async function main(argv = process.argv.slice(2)) {
  const { inputRoot, outputRoot } = parseArgs(argv);
  const tmpRoot = `${outputRoot}.tmp`;
  const backupRoot = `${outputRoot}.old-${process.pid}-${Date.now()}`;
  const names = (await readdir(inputRoot)).filter(name => name.startsWith(ARTIFACT_PREFIX)).sort();
  const seen = new Set();
  const languages = names.map(name => name.slice(ARTIFACT_PREFIX.length));
  for (const language of languages) {
    if (!LANGUAGES.includes(language)) throw new Error(`Unknown artifact language: ${language}`);
    if (seen.has(language)) throw new Error(`Duplicate artifact language: ${language}`);
    seen.add(language);
  }
  for (const language of LANGUAGES) if (!seen.has(language)) throw new Error(`Missing artifact for language: ${language}`);

  const artifacts = [];
  for (const language of LANGUAGES) artifacts.push(await validateArtifact(inputRoot, language));
  assertCompatible(artifacts);
  const manifest = buildMergedManifest(artifacts);

  try {
    await removeIfExists(tmpRoot);
    await mkdir(join(tmpRoot, 'candidate-index'), { recursive: true });
    for (const artifact of artifacts) {
      await mkdir(join(tmpRoot, 'candidate-index', artifact.language), { recursive: true });
      for (const shard of artifact.info.shards) {
        await cp(join(artifact.artifactRoot, shard.file), join(tmpRoot, 'candidate-index', shard.file));
      }
    }
    await writeFile(join(tmpRoot, 'candidate-index', 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    await validateMergedOutput(join(tmpRoot, 'candidate-index'), manifest);
    await removeIfExists(backupRoot);
    try { await rename(outputRoot, backupRoot); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await rename(tmpRoot, outputRoot);
    await removeIfExists(backupRoot);
  } catch (error) {
    await removeIfExists(tmpRoot);
    try {
      await stat(backupRoot);
      try { await rename(backupRoot, outputRoot); } catch { /* Keep the original error if restoration also fails. */ }
    } catch {
      // No backup was created before the failure.
    }
    throw error;
  }
  return manifest;
}

export async function validateMergedOutput(candidateRoot, manifest) {
  const manifestPath = join(candidateRoot, 'manifest.json');
  const onDisk = await readJson(manifestPath, 'merged manifest');
  if (stableJson(onDisk) !== stableJson(manifest)) throw new Error('Merged manifest validation failed');
  for (const [language, info] of Object.entries(manifest.languages)) {
    let count = 0;
    for (const shard of info.shards) {
      assertRelativeCandidatePath(shard.file, language);
      const shardPath = join(candidateRoot, shard.file);
      const rel = relative(candidateRoot, shardPath);
      if (rel.startsWith('..') || rel.startsWith(`${sep}`)) throw new Error(`Shard escapes candidate-index: ${shard.file}`);
      const entries = await readJson(shardPath, `merged shard ${shard.file}`);
      count += entries.length;
    }
    if (count !== info.entries) throw new Error(`Merged entry count mismatch for ${language}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
