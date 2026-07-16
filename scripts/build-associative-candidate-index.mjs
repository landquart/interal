#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
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
const NORMALIZER_VERSION = '2';
const DRY_RUN_SOURCE_BY_LANGUAGE = {
  en: 'normative/bnc-clean2.lemmatized_spacy_ipm6.json'
};

function parseArgs(argv) {
  const options = { dryRun: false, noWrite: false };
  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--no-write') options.noWrite = true;
    else if (arg.startsWith('--languages=')) options.languages = arg.slice('--languages='.length).split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
    else if (arg.startsWith('--input-root=')) options.inputRoot = arg.slice('--input-root='.length);
    else if (arg.startsWith('--output-root=')) options.outputRoot = arg.slice('--output-root='.length);
    else if (arg.startsWith('--max-records=')) options.maxRecords = Number(arg.slice('--max-records='.length));
    else if (arg.startsWith('--report=')) options.reportPath = arg.slice('--report='.length);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.languages?.length) throw new Error('--languages is required');
  if (options.maxRecords != null && (!Number.isInteger(options.maxRecords) || options.maxRecords < 0)) throw new Error('--max-records must be a non-negative integer');
  options.inputRoot ??= DEFAULT_INPUT_ROOT;
  options.outputRoot ??= DEFAULT_OUTPUT_ROOT;
  if (!process.env.GITHUB_ACTIONS && !options.dryRun && !options.noWrite && options.inputRoot === DEFAULT_INPUT_ROOT && options.maxRecords == null) {
    throw new Error('Refusing to read production frequency lists without --dry-run or --max-records outside GitHub Actions');
  }
  if (!process.env.GITHUB_ACTIONS && !options.noWrite && !options.dryRun && options.outputRoot === DEFAULT_OUTPUT_ROOT) throw new Error('Refusing to write production candidate-index outside GitHub Actions');
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

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
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


async function pathSize(path) {
  const info = await stat(path);
  return info.size;
}

function rootSamples(entries, roots = ['alter', 'regul', 'ocul', 'inter'], limit = 20) {
  return Object.fromEntries(roots.map(root => [
    root,
    entries
      .filter(entry => entry.search_form.includes(root) || entry.normalized.includes(root))
      .slice(0, limit)
      .map(entry => entry.word)
  ]));
}

function buildReport(language, result, manifestLanguage, totalBytes = 0) {
  return {
    language,
    entries: result.entries.length,
    duplicates_merged: result.diagnostics.duplicate_lemmas,
    invalid_records: result.diagnostics.invalid_records,
    source_files: result.sourceFiles,
    shards: manifestLanguage.shards.map(shard => ({ file: shard.file, entries: shard.entries })),
    total_bytes: totalBytes,
    root_samples: rootSamples(result.entries)
  };
}

async function buildLanguage(language, options) {
  const sources = LANGUAGE_SOURCES[language];
  if (!sources) throw new Error(`Unknown language: ${language}`);
  const merged = new Map();
  const sourceFiles = [];
  let processed = 0;
  let invalidRecords = 0;
  const dryRunSource = options.dryRun && options.noWrite && options.inputRoot === DEFAULT_INPUT_ROOT
    ? DRY_RUN_SOURCE_BY_LANGUAGE[language]
    : null;

  for (const category of CATEGORY_ORDER) {
    for (const fileName of sources[category] ?? []) {
      if (options.maxRecords != null && processed >= options.maxRecords) break;
      const sourceId = `${category}/${fileName}`;
      if (dryRunSource && sourceId !== dryRunSource) continue;
      const path = join(options.inputRoot, language, fileName);
      if (!(await fileExists(path))) {
        if (dryRunSource === sourceId) throw new Error(`Dry-run source not found: ${path}`);
        continue;
      }
      sourceFiles.push(sourceId);
      const data = await loadJsonFile(path);
      scanForInvalidData(data, sourceId);
      for (const record of extractFrequencyRecords(data, sourceId)) {
        if (options.maxRecords != null && processed >= options.maxRecords) break;
        if (record.ipm < 0) throw new Error(`Negative IPM in ${sourceId}: ${record.normalized}`);
        if (!record.normalized || !Number.isFinite(record.ipm)) {
          invalidRecords += 1;
          continue;
        }
        mergeFrequencyRecord(merged, record, sourceId);
        processed += 1;
      }
      if (dryRunSource) break;
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
  const frequencyScores = entries.map(entry => entry.frequency_score).filter(Number.isFinite);
  const diagnostics = {
    language,
    source: sourceFiles.length === 1 ? sourceFiles[0] : sourceFiles,
    records_read: processed,
    valid_lemmas: entries.length,
    invalid_records: invalidRecords,
    duplicate_lemmas: Math.max(0, processed - entries.length - invalidRecords),
    min_frequency_score: frequencyScores.length ? Math.min(...frequencyScores) : 0,
    max_frequency_score: frequencyScores.length ? Math.max(...frequencyScores) : 0
  };
  return { entries, sourceFiles, shards: Array.from(shards.entries()).sort(([a], [b]) => a.localeCompare(b)), diagnostics };
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

  if (options.dryRun) {
    const diagnostics = options.languages.length === 1
      ? built.get(options.languages[0]).diagnostics
      : Object.fromEntries(Array.from(built, ([language, result]) => [language, result.diagnostics]));
    console.log(JSON.stringify(diagnostics, null, 2));
  }

  const writtenFiles = [];
  if (!options.noWrite && !options.dryRun) {
    await mkdir(options.outputRoot, { recursive: true });
    for (const [language, result] of built) {
      await mkdir(join(options.outputRoot, language), { recursive: true });
      for (const [name, entries] of result.shards) {
        const shardPath = join(options.outputRoot, language, `${name}.json`);
        await writeFile(shardPath, `${JSON.stringify(entries, null, 2)}\n`);
        writtenFiles.push(shardPath);
      }
    }
    const manifestPath = join(options.outputRoot, 'manifest.json');
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    writtenFiles.push(manifestPath);
  }

  if (options.reportPath) {
    if (options.languages.length !== 1) throw new Error('--report currently supports exactly one language');
    const language = options.languages[0];
    const result = built.get(language);
    const totalBytes = writtenFiles.length ? (await Promise.all(writtenFiles.map(pathSize))).reduce((sum, size) => sum + size, 0) : 0;
    const report = buildReport(language, result, manifest.languages[language], totalBytes);
    await mkdir(dirname(options.reportPath), { recursive: true });
    await writeFile(options.reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  return manifest;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
