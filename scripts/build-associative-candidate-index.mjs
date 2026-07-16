#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE_CATEGORY_WEIGHTS, CATEGORY_ORDER, LANGUAGE_SOURCES } from '../associativvordes/js/config-frequency-sources.js';
import { SCORE_CONFIG } from '../associativvordes/js/frequency-loader.js';
import {
  calculateCategoryProfile,
  calculateFrequencyScore,
  extractFrequencyRecords,
  mergeFrequencyRecord,
  stableSortEntries
} from './lib/associative-index-core.mjs';

const DEFAULT_INPUT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'associativvordes', 'frequency lists');
const DEFAULT_OUTPUT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'associativvordes', 'candidate-index');
const MANIFEST_VERSION = '1';
const NORMALIZER_VERSION = '1';

function parseArgs(argv) {
  const options = { dryRun: false, noWrite: false };
  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--no-write') options.noWrite = true;
    else if (arg.startsWith('--languages=')) options.languages = arg.slice('--languages='.length).split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
    else if (arg.startsWith('--input-root=')) options.inputRoot = arg.slice('--input-root='.length);
    else if (arg.startsWith('--output-root=')) options.outputRoot = arg.slice('--output-root='.length);
    else if (arg.startsWith('--max-records=')) options.maxRecords = Number(arg.slice('--max-records='.length));
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.languages?.length) throw new Error('--languages is required');
  if (options.maxRecords != null && (!Number.isInteger(options.maxRecords) || options.maxRecords < 0)) throw new Error('--max-records must be a non-negative integer');
  options.inputRoot ??= DEFAULT_INPUT_ROOT;
  options.outputRoot ??= DEFAULT_OUTPUT_ROOT;
  if (!options.dryRun && !options.noWrite && options.inputRoot === DEFAULT_INPUT_ROOT && options.maxRecords == null) {
    throw new Error('Refusing to read production frequency lists without --dry-run or --max-records');
  }
  if (options.outputRoot === DEFAULT_OUTPUT_ROOT) throw new Error('Refusing to write production candidate-index in this task');
  return options;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function configHash(languages) {
  const config = { version: MANIFEST_VERSION, normalizer_version: NORMALIZER_VERSION, languages, CATEGORY_ORDER, BASE_CATEGORY_WEIGHTS, SCORE_CONFIG, sources: Object.fromEntries(languages.map(lang => [lang, LANGUAGE_SOURCES[lang] ?? {}])) };
  return createHash('sha256').update(stableJson(config)).digest('hex');
}

async function loadJsonFile(path) {
  // Extension point: production can replace this with a streaming JSON reader. Fixture builds intentionally parse one small file at a time.
  return JSON.parse(await readFile(path, 'utf8'));
}

function shardName(searchForm) {
  const first = String(searchForm || '')[0]?.toLowerCase();
  return first && first >= 'a' && first <= 'z' ? first : '_other';
}

function assertValidEntry(entry, seen) {
  if (!entry.word) throw new Error(`Invalid empty word for ${entry.normalized}`);
  if (!entry.search_form) throw new Error(`Invalid empty search_form for ${entry.normalized}`);
  if (!Number.isFinite(entry.frequency_score)) throw new Error(`Invalid frequency_score for ${entry.normalized}`);
  if (entry.frequency_score < 0 || entry.frequency_score > 100) throw new Error(`frequency_score out of range for ${entry.normalized}`);
  if (!Array.isArray(entry.sources) || entry.sources.length === 0) throw new Error(`Missing sources for ${entry.normalized}`);
  if (seen.has(entry.normalized)) throw new Error(`Duplicate normalized entry: ${entry.normalized}`);
  seen.add(entry.normalized);
  const text = JSON.stringify(entry);
  if (text.includes('null') && Number.isNaN(entry.frequency_score)) throw new Error(`NaN in entry: ${entry.normalized}`);
  for (const source of entry.sources) {
    if (!source.id) throw new Error(`Missing source id for ${entry.normalized}`);
    if (!Number.isFinite(source.ipm) || source.ipm < 0) throw new Error(`Invalid IPM for ${entry.normalized} from ${source.id}`);
  }
}


function scanForInvalidData(value, sourceId, path = 'root') {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) scanForInvalidData(value[index], sourceId, `${path}[${index}]`);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (['ipm', 'IPM', 'frequency', 'freq'].includes(key)) {
      const number = Number(child);
      if (!Number.isFinite(number)) throw new Error(`Invalid IPM in ${sourceId} at ${path}.${key}`);
      if (number < 0) throw new Error(`Negative IPM in ${sourceId} at ${path}.${key}`);
    }
    scanForInvalidData(child, sourceId, `${path}.${key}`);
  }
}

async function buildLanguage(language, options) {
  const sources = LANGUAGE_SOURCES[language];
  if (!sources) throw new Error(`Unknown language: ${language}`);
  const merged = new Map();
  const sourceFiles = [];
  let processed = 0;

  for (const category of CATEGORY_ORDER) {
    for (const fileName of sources[category] ?? []) {
      if (options.maxRecords != null && processed >= options.maxRecords) break;
      const sourceId = `${category}/${fileName}`;
      sourceFiles.push(sourceId);
      if (options.dryRun && options.inputRoot === DEFAULT_INPUT_ROOT) continue;
      const data = await loadJsonFile(join(options.inputRoot, language, fileName));
      scanForInvalidData(data, sourceId);
      for (const record of extractFrequencyRecords(data, sourceId)) {
        if (options.maxRecords != null && processed >= options.maxRecords) break;
        if (record.ipm < 0) throw new Error(`Negative IPM in ${sourceId}: ${record.normalized}`);
        mergeFrequencyRecord(merged, record, sourceId);
        processed += 1;
      }
    }
  }

  const entries = stableSortEntries(Array.from(merged.values()).map(record => {
    const category_breakdown = {};
    for (const category of CATEGORY_ORDER) {
      const values = Object.entries(record.sources).filter(([id]) => id.startsWith(`${category}/`)).map(([, ipm]) => ipm);
      if (values.length) category_breakdown[category] = calculateCategoryProfile(values);
    }
    const frequency_score = calculateFrequencyScore(category_breakdown);
    return {
      word: record.original,
      normalized: record.normalized,
      search_form: record.search_form,
      rank: null,
      frequency_score,
      category_breakdown,
      sources: Object.entries(record.sources).sort(([a], [b]) => a.localeCompare(b)).map(([id, ipm]) => ({ id, ipm }))
    };
  }));

  const seen = new Set();
  for (const entry of entries) assertValidEntry(entry, seen);
  const shards = new Map();
  for (const entry of entries) {
    const shard = shardName(entry.search_form);
    if (!shards.has(shard)) shards.set(shard, []);
    shards.get(shard).push(entry);
  }
  return { entries, sourceFiles, shards: Array.from(shards.entries()).sort(([a], [b]) => a.localeCompare(b)) };
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const manifest = { version: MANIFEST_VERSION, normalizer_version: NORMALIZER_VERSION, config_hash: configHash(options.languages), generated_at: new Date().toISOString(), languages: {} };
  const built = new Map();

  for (const language of options.languages) {
    const result = await buildLanguage(language, options);
    built.set(language, result);
    manifest.languages[language] = { entries: result.entries.length, source_files: result.sourceFiles, shards: result.shards.map(([name, entries]) => ({ file: `${language}/${name}.json`, entries: entries.length })) };
  }

  if (!options.noWrite && !options.dryRun) {
    await mkdir(options.outputRoot, { recursive: true });
    for (const [language, result] of built) {
      await mkdir(join(options.outputRoot, language), { recursive: true });
      for (const [name, entries] of result.shards) await writeFile(join(options.outputRoot, language, `${name}.json`), `${JSON.stringify(entries, null, 2)}\n`);
    }
    await writeFile(join(options.outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  return manifest;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
