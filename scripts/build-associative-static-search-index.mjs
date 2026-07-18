#!/usr/bin/env node
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { once } from 'node:events';
import readline from 'node:readline';
import { buildSearchForm, SEARCH_NORMALIZER_VERSION } from '../associativvordes/js/search-normalizer.js';

const STATIC_MANIFEST_VERSION = '3';
const STATIC_INDEX_FORMAT = 'static-inverted-ngram-v2';
const DEFAULT_INPUT_ROOT = 'associativvordes/candidate-index';
const DEFAULT_OUTPUT_ROOT = 'associativvordes/search-index';
const DEFAULT_BLOCK_SIZE = 2048;
const DEFAULT_BUCKET_COUNT = 128;

function parseArgs(argv) {
  const options = { inputRoot: DEFAULT_INPUT_ROOT, outputRoot: DEFAULT_OUTPUT_ROOT, blockSize: DEFAULT_BLOCK_SIZE, bucketCount: DEFAULT_BUCKET_COUNT };
  for (const arg of argv) {
    if (arg.startsWith('--language=')) options.language = arg.slice('--language='.length).trim().toLowerCase();
    else if (arg.startsWith('--input-root=')) options.inputRoot = arg.slice('--input-root='.length);
    else if (arg.startsWith('--output-root=')) options.outputRoot = arg.slice('--output-root='.length);
    else if (arg.startsWith('--block-size=')) options.blockSize = Number(arg.slice('--block-size='.length));
    else if (arg.startsWith('--bucket-count=')) options.bucketCount = Number(arg.slice('--bucket-count='.length));
    else if (arg.startsWith('--report=')) options.reportPath = arg.slice('--report='.length);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!['en', 'de', 'fr', 'es', 'it', 'ru'].includes(options.language)) throw new Error('--language must be one of: en, de, fr, es, it, ru');
  if (!Number.isInteger(options.blockSize) || options.blockSize < 128 || options.blockSize > 16384) throw new Error('--block-size must be an integer from 128 to 16384');
  if (!Number.isInteger(options.bucketCount) || options.bucketCount < 16 || options.bucketCount > 1024) throw new Error('--bucket-count must be an integer from 16 to 1024');
  return options;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase().normalize('NFC');
}

export function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function bucketWidth(count) {
  return Math.max(2, Math.ceil(Math.log(count) / Math.log(16)));
}

export function bucketName(gram, count) {
  return (fnv1a(gram) % count).toString(16).padStart(bucketWidth(count), '0');
}

function uniqueGrams(value, length) {
  const grams = new Set();
  const text = buildSearchForm(value);
  if (text.length < length) return grams;
  for (let index = 0; index <= text.length - length; index += 1) grams.add(text.slice(index, index + length));
  return grams;
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function sourceDescriptor(id) {
  const [category, ...parts] = String(id || '').split('/');
  const file = parts.join('/');
  if (!['subtitles', 'normative', 'web', 'mixed'].includes(category) || !file || basename(file) !== file) throw new Error(`Invalid source id: ${id}`);
  return { id: `${category}/${file}`, file, category };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value)}\n`);
}

async function closeStream(stream) {
  if (!stream) return;
  stream.end();
  await once(stream, 'close');
}

class PostingSpool {
  constructor(root, bucketCount) {
    this.root = root;
    this.bucketCount = bucketCount;
    this.streams = new Map();
  }

  write(length, gram, id) {
    const bucket = bucketName(gram, this.bucketCount);
    const key = `${length}/${bucket}`;
    let stream = this.streams.get(key);
    if (!stream) {
      const path = join(this.root, String(length), `${bucket}.tsv`);
      stream = createWriteStream(path, { flags: 'a', encoding: 'utf8', highWaterMark: 64 * 1024 });
      this.streams.set(key, stream);
    }
    return stream.write(`${gram}\t${id}\n`) ? null : once(stream, 'drain');
  }

  async close() {
    const streams = [...this.streams.values()];
    this.streams.clear();
    await Promise.all(streams.map(closeStream));
  }
}

function encodeDeltas(ids) {
  let previous = 0;
  return ids.map((id, index) => {
    const value = index === 0 ? id : id - previous;
    previous = id;
    return value;
  });
}

async function convertSpoolBucket(inputPath, outputPath) {
  const postings = new Map();
  const input = createReadStream(inputPath, { encoding: 'utf8' });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line) continue;
    const tab = line.lastIndexOf('\t');
    if (tab <= 0) throw new Error(`Invalid posting spool line in ${inputPath}`);
    const gram = line.slice(0, tab);
    const id = Number(line.slice(tab + 1));
    if (!Number.isInteger(id) || id < 0) throw new Error(`Invalid posting id in ${inputPath}`);
    const ids = postings.get(gram) ?? [];
    if (ids.length && id <= ids[ids.length - 1]) throw new Error(`Posting ids are not strictly increasing for ${gram}`);
    ids.push(id);
    postings.set(gram, ids);
  }
  const payload = {};
  for (const gram of [...postings.keys()].sort((a, b) => a.localeCompare(b))) payload[gram] = encodeDeltas(postings.get(gram));
  await writeJson(outputPath, payload);
  return { grams: postings.size, bytes: (await stat(outputPath)).size };
}

function validateCandidateEntry(entry, language, index) {
  if (!isPlainObject(entry) || typeof entry.word !== 'string' || !entry.word || typeof entry.normalized !== 'string' || !entry.normalized || typeof entry.search_form !== 'string' || !entry.search_form) throw new Error(`Invalid ${language} candidate entry ${index}`);
  if (!(entry.rank === null || (Number.isInteger(entry.rank) && entry.rank > 0))) throw new Error(`Invalid rank for ${language} candidate entry ${index}`);
  if (typeof entry.frequency_score !== 'number' || !Number.isFinite(entry.frequency_score) || entry.frequency_score < 0 || entry.frequency_score > 100) throw new Error(`Invalid frequency_score for ${language} candidate entry ${index}`);
  if (!Array.isArray(entry.sources) || !entry.sources.length) throw new Error(`Missing sources for ${language} candidate entry ${index}`);
  if (entry.search_form !== buildSearchForm(entry.word)) throw new Error(`Non-canonical search_form for ${language} candidate entry ${index}`);
}

function compactEntry(entry, sourceIndex) {
  const sourcePairs = entry.sources.map(source => {
    if (!isPlainObject(source) || typeof source.id !== 'string' || typeof source.ipm !== 'number' || !Number.isFinite(source.ipm) || source.ipm < 0) throw new Error(`Invalid source for ${entry.normalized}`);
    let index = sourceIndex.get(source.id);
    if (index == null) {
      index = sourceIndex.size;
      sourceIndex.set(source.id, index);
    }
    return [index, source.ipm];
  }).sort((a, b) => a[0] - b[0]);
  return [
    entry.word,
    normalizeText(entry.word) === entry.normalized ? null : entry.normalized,
    entry.search_form === entry.normalized ? null : entry.search_form,
    entry.rank,
    entry.frequency_score,
    sourcePairs
  ];
}

async function listSpoolBuckets(spoolRoot, length, bucketCount) {
  const buckets = [];
  for (let index = 0; index < bucketCount; index += 1) {
    const bucket = index.toString(16).padStart(bucketWidth(bucketCount), '0');
    const path = join(spoolRoot, String(length), `${bucket}.tsv`);
    try {
      const info = await stat(path);
      if (info.isFile() && info.size > 0) buckets.push(bucket);
    } catch {}
  }
  return buckets;
}

export async function buildStaticSearchIndex(options) {
  const sourceManifest = await readJson(join(options.inputRoot, 'manifest.json'));
  if (sourceManifest.version !== '1' || !['2', SEARCH_NORMALIZER_VERSION].includes(sourceManifest.normalizer_version) || !isPlainObject(sourceManifest.languages?.[options.language])) throw new Error(`Input candidate index is incompatible for ${options.language}`);
  const sourceLanguage = sourceManifest.languages[options.language];
  if (!Array.isArray(sourceLanguage.shards) || !sourceLanguage.shards.length) throw new Error(`Input candidate index has no shards for ${options.language}`);

  const languageRoot = join(options.outputRoot, options.language);
  await rm(languageRoot, { recursive: true, force: true });
  await mkdir(languageRoot, { recursive: true });
  const spoolRoot = await mkdtemp(join(tmpdir(), `interal-static-${options.language}-`));
  for (const length of [1, 2, 3]) await mkdir(join(spoolRoot, String(length)), { recursive: true });
  const spool = new PostingSpool(spoolRoot, options.bucketCount);
  const sourceIndex = new Map((sourceLanguage.source_files || []).map((id, index) => [id, index]));
  const entryBlocks = [];
  let block = [];
  let blockFirstId = 0;
  let entryId = 0;

  async function flushBlock() {
    if (!block.length) return;
    const file = `${options.language}/entries/${String(entryBlocks.length).padStart(6, '0')}.json`;
    await writeJson(join(options.outputRoot, file), { first_id: blockFirstId, entries: block });
    entryBlocks.push({ file, first_id: blockFirstId, entries: block.length });
    blockFirstId += block.length;
    block = [];
  }

  try {
    for (const shard of sourceLanguage.shards) {
      const entries = await readJson(join(options.inputRoot, shard.file));
      if (!Array.isArray(entries) || entries.length !== shard.entries) throw new Error(`Input shard mismatch: ${shard.file}`);
      for (const entry of entries) {
        validateCandidateEntry(entry, options.language, entryId);
        block.push(compactEntry(entry, sourceIndex));
        for (const length of [1, 2, 3]) {
          for (const gram of uniqueGrams(entry.search_form, length)) {
            const wait = spool.write(length, gram, entryId);
            if (wait) await wait;
          }
        }
        entryId += 1;
        if (block.length >= options.blockSize) await flushBlock();
      }
    }
    await flushBlock();
    await spool.close();

    if (entryId !== sourceLanguage.entries) throw new Error(`Entry count mismatch for ${options.language}: expected ${sourceLanguage.entries}, built ${entryId}`);

    const postings = {};
    let postingBytes = 0;
    let postingGrams = 0;
    for (const length of [1, 2, 3]) {
      const buckets = await listSpoolBuckets(spoolRoot, length, options.bucketCount);
      for (const bucket of buckets) {
        const outputFile = `${options.language}/postings/${length}/${bucket}.json`;
        const result = await convertSpoolBucket(join(spoolRoot, String(length), `${bucket}.tsv`), join(options.outputRoot, outputFile));
        postingBytes += result.bytes;
        postingGrams += result.grams;
      }
      postings[String(length)] = {
        bucket_count: options.bucketCount,
        template: `${options.language}/postings/${length}/{bucket}.json`,
        buckets
      };
    }

    const sourceIds = [...sourceIndex.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
    const sources = sourceIds.map(sourceDescriptor);
    const manifest = {
      version: STATIC_MANIFEST_VERSION,
      normalizer_version: SEARCH_NORMALIZER_VERSION,
      index_format: STATIC_INDEX_FORMAT,
      source_manifest_version: sourceManifest.version,
      source_normalizer_version: sourceManifest.normalizer_version,
      global_config_hash: sourceManifest.global_config_hash ?? sourceManifest.config_hash,
      generated_at: new Date().toISOString(),
      languages: {
        [options.language]: {
          language_config_hash: sourceLanguage.language_config_hash,
          entries: entryId,
          source_files: sourceLanguage.source_files || [],
          sources,
          block_size: options.blockSize,
          entry_blocks: entryBlocks,
          postings
        }
      }
    };
    await writeJson(join(options.outputRoot, 'manifest.json'), manifest);

    let entryBytes = 0;
    for (const blockMeta of entryBlocks) entryBytes += (await stat(join(options.outputRoot, blockMeta.file))).size;
    const report = {
      language: options.language,
      entries: entryId,
      entry_blocks: entryBlocks.length,
      source_dictionary_entries: sources.length,
      posting_grams: postingGrams,
      entry_bytes: entryBytes,
      posting_bytes: postingBytes,
      total_bytes: entryBytes + postingBytes + (await stat(join(options.outputRoot, 'manifest.json'))).size,
      block_size: options.blockSize,
      bucket_count: options.bucketCount
    };
    if (options.reportPath) await writeJson(options.reportPath, report);
    return { manifest, report };
  } finally {
    await spool.close().catch(() => {});
    await rm(spoolRoot, { recursive: true, force: true });
  }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = await buildStaticSearchIndex(options);
  console.log(JSON.stringify(result.report, null, 2));
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error?.stack || error?.message || error);
    process.exitCode = 1;
  });
}
