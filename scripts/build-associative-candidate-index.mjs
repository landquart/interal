#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE_CATEGORY_WEIGHTS, CATEGORY_ORDER, LANGUAGE_SOURCES } from '../associativvordes/js/config-frequency-sources.js';
import { SCORE_CONFIG } from '../associativvordes/js/frequency-loader.js';
import {
  calculateCategoryProfile,
  calculateFrequencyScore,
  extractFrequencyRecords,
  mergeFrequencyRecord,
  stableSortEntries,
  validRank
} from './lib/associative-index-core.mjs';
import { streamFrequencyRecords } from './lib/frequency-record-stream.mjs';

const DEFAULT_INPUT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'associativvordes', 'frequency lists');
const DEFAULT_OUTPUT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'associativvordes', 'candidate-index');
const MANIFEST_VERSION = '1';
const NORMALIZER_VERSION = '2';
const SUPPORTED_LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'ru'];
const ENTRY_STRUCTURE = ['word', 'normalized', 'search_form', 'rank', 'frequency_score', 'category_breakdown', 'sources'];
const SHARDING_RULES = { version: '1', strategy: 'first-lowercase-latin-letter-else-_other', shard_filename: '<language>/<shard>.json' };
const DRY_RUN_SOURCE_BY_LANGUAGE = {
  en: 'normative/bnc-clean2.lemmatized_spacy_ipm6.json'
};

export const SOURCE_FORMATS = {
  // Verified against every production LANGUAGE_SOURCES file: all production corpora are
  // JSON objects keyed by rank, with each rank containing one or more lemma -> IPM pairs.
  production: {
    subtitles: 'ranked-word-ipm-object',
    normative: 'ranked-word-ipm-object',
    web: 'ranked-word-ipm-object',
    mixed: 'ranked-word-ipm-object'
  },
  // Fixtures intentionally cover the legacy parser's accepted shapes. They remain small
  // enough to parse as whole JSON in tests and local fixture builds.
  fixtures: {
    subtitles: 'legacy-json',
    normative: 'legacy-json',
    web: 'legacy-json',
    mixed: 'legacy-json'
  }
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
    else if (arg.startsWith('--source-file=')) options.sourceFile = arg.slice('--source-file='.length);
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

function hashConfig(config) {
  return createHash('sha256').update(stableJson(config)).digest('hex');
}

export function globalConfigHash({ languageSources = LANGUAGE_SOURCES, baseCategoryWeights = BASE_CATEGORY_WEIGHTS, scoreConfig = SCORE_CONFIG } = {}) {
  const sources = Object.fromEntries(SUPPORTED_LANGUAGES.map(lang => [lang, languageSources[lang] ?? {}]));
  return hashConfig({
    version: MANIFEST_VERSION,
    normalizer_version: NORMALIZER_VERSION,
    entry_structure: ENTRY_STRUCTURE,
    formulas_and_weights: { CATEGORY_ORDER, BASE_CATEGORY_WEIGHTS: baseCategoryWeights, SCORE_CONFIG: scoreConfig },
    sharding_rules: SHARDING_RULES,
    supported_languages: SUPPORTED_LANGUAGES,
    language_sources: sources
  });
}

export function languageConfigHash(language, { languageSources = LANGUAGE_SOURCES } = {}) {
  return hashConfig({
    version: MANIFEST_VERSION,
    normalizer_version: NORMALIZER_VERSION,
    language,
    category_order: CATEGORY_ORDER,
    sources: languageSources[language] ?? {}
  });
}

async function loadJsonFile(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function parserModeForOptions(options) {
  return options.inputRoot === DEFAULT_INPUT_ROOT ? 'stream' : 'legacy_json';
}

function sourceFormatsForOptions(options) {
  return parserModeForOptions(options) === 'stream' ? SOURCE_FORMATS.production : SOURCE_FORMATS.fixtures;
}

function formatForSource(sourceId, options) {
  const formats = sourceFormatsForOptions(options);
  const [family] = String(sourceId).split('/');
  const format = formats[family];
  if (!format) throw new Error(`No frequency source format configured for ${sourceId}`);
  return format;
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

function canonicalSourceFromId(id, ipm) {
  const [category, ...rest] = String(id || '').split('/');
  const file = rest.join('/');
  if (!CATEGORY_ORDER.includes(category) || !file || basename(file) !== file) throw new Error(`Invalid source id: ${id}`);
  if (!Number.isFinite(ipm) || ipm < 0) throw new Error(`Invalid IPM for ${id}`);
  return { id: `${category}/${file}`, file, category, ipm };
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
    if (!source.file) throw new Error(`Missing source file for ${entry.normalized} from ${source.id}`);
    if (!source.category) throw new Error(`Missing source category for ${entry.normalized} from ${source.id}`);
    if (source.id !== `${source.category}/${source.file}`) throw new Error(`Invalid canonical source id for ${entry.normalized}: ${source.id}`);
    if (!CATEGORY_ORDER.includes(source.category)) throw new Error(`Invalid source category for ${entry.normalized} from ${source.id}`);
    if (basename(source.file) !== source.file || source.file.includes('://')) throw new Error(`Invalid source file for ${entry.normalized} from ${source.id}`);
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
      .filter(entry => entry.search_form.includes(root) || (root === 'ocul' && entry.search_form.includes('okul')))
      .slice(0, limit)
      .map(entry => entry.word)
  ]));
}

function sourceMatchesOption(sourceId, fileName, sourceFile) {
  if (!sourceFile) return true;
  return sourceFile === sourceId || sourceFile === fileName || sourceId.endsWith(`/${sourceFile}`);
}

function normalizeLanguageSource(category, source) {
  if (typeof source === 'string') return { fileName: source, sourceId: `${category}/${source}`, optional: false };
  if (!source || typeof source !== 'object') throw new Error(`Invalid LANGUAGE_SOURCES entry for ${category}`);
  const fileName = source.file;
  if (typeof fileName !== 'string' || !fileName || basename(fileName) !== fileName) throw new Error(`Invalid LANGUAGE_SOURCES file for ${category}`);
  if (source.optional != null && source.optional !== true) throw new Error(`Invalid optional metadata for ${category}/${fileName}: use optional: true or omit it`);
  return { fileName, sourceId: `${category}/${fileName}`, optional: source.optional === true };
}

function expectedLanguageSources(sources) {
  return CATEGORY_ORDER.flatMap(category => (sources[category] ?? []).map(source => normalizeLanguageSource(category, source)));
}

function countSearchFormCollisions(entries) {
  const originalsBySearchForm = new Map();
  for (const entry of entries) {
    if (!entry.search_form) continue;
    const originals = originalsBySearchForm.get(entry.search_form) ?? new Set();
    originals.add(entry.normalized);
    originalsBySearchForm.set(entry.search_form, originals);
  }
  let collisions = 0;
  for (const originals of originalsBySearchForm.values()) {
    if (originals.size > 1) collisions += originals.size - 1;
  }
  return collisions;
}

function buildReport(language, result, manifestLanguage, totalBytes = 0) {
  return {
    language,
    parser_mode: result.parserMode,
    peak_records_buffered: result.peakRecordsBuffered,
    source_formats: result.sourceFormats,
    entries: result.entries.length,
    duplicates_merged: result.diagnostics.duplicate_lemmas,
    invalid_records: result.diagnostics.invalid_records,
    expected_source_files: result.expectedSourceFiles,
    loaded_source_files: result.sourceFiles,
    missing_optional_sources: result.missingOptionalSources,
    source_files: result.sourceFiles,
    shards: manifestLanguage.shards.map(shard => ({ file: shard.file, entries: shard.entries })),
    total_bytes: totalBytes,
    ...(language === 'ru' ? {
      transliteration: {
        version: '1',
        entries_with_search_form: result.entries.filter(entry => entry.search_form).length,
        entries_without_search_form: result.entries.filter(entry => !entry.search_form).length,
        collisions: countSearchFormCollisions(result.entries)
      }
    } : {}),
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

  const expectedSources = expectedLanguageSources(sources);
  const expectedSourceFiles = expectedSources.map(source => source.sourceId);
  const missingOptionalSources = [];
  const parserMode = parserModeForOptions(options);
  const sourceFormats = {};
  let peakRecordsBuffered = 0;

  for (const source of expectedSources) {
    const { fileName, sourceId, optional } = source;
    const matchesRequestedSource = sourceMatchesOption(sourceId, fileName, options.sourceFile);
    if (options.sourceFile && !matchesRequestedSource) continue;
    if (dryRunSource && sourceId !== dryRunSource) continue;
    const path = join(options.inputRoot, language, fileName);
    if (!(await fileExists(path))) {
      if (dryRunSource === sourceId) throw new Error(`Dry-run source not found: ${path}`);
      if (optional) {
        missingOptionalSources.push(sourceId);
        continue;
      }
      throw new Error(`Missing required source for ${language}: ${sourceId} at ${path}`);
    }
    if (options.maxRecords != null && processed >= options.maxRecords) continue;
    sourceFiles.push(sourceId);
    const format = formatForSource(sourceId, options);
    sourceFormats[sourceId] = format;
    let recordIterable;
    if (parserMode === 'stream') {
      recordIterable = streamFrequencyRecords({ filePath: path, sourceId, format, maxRecords: options.maxRecords == null ? undefined : options.maxRecords - processed });
    } else {
      const data = await loadJsonFile(path);
      scanForInvalidData(data, sourceId);
      recordIterable = extractFrequencyRecords(data, sourceId);
      peakRecordsBuffered = Math.max(peakRecordsBuffered, recordIterable.length);
    }
    for await (const record of recordIterable) {
      if (options.maxRecords != null && processed >= options.maxRecords) break;
      if (record.ipm < 0) throw new Error(`Negative IPM in ${sourceId}: ${record.normalized}`);
      if (record.frequency_lookup_key !== record.normalized) throw new Error(`Frequency lookup key must equal normalized original word in ${sourceId}: ${record.normalized}`);
      if (!record.normalized || !Number.isFinite(record.ipm)) {
        invalidRecords += 1;
        continue;
      }
      mergeFrequencyRecord(merged, record, sourceId);
      processed += 1;
      peakRecordsBuffered = Math.max(peakRecordsBuffered, merged.size);
    }
    if (dryRunSource) break;
  }

  const entries = stableSortEntries(Array.from(merged.values()).map(record => {
    const category_breakdown = {};
    for (const category of CATEGORY_ORDER) {
      const values = Object.entries(record.sources).filter(([id]) => id.startsWith(`${category}/`)).map(([, ipm]) => ipm);
      if (values.length) category_breakdown[category] = calculateCategoryProfile(values);
    }
    const frequency_score = calculateFrequencyScore(category_breakdown);
    const ranks = Object.values(record.ranks ?? {}).map(validRank).filter(rank => rank != null);
    return {
      word: record.original,
      normalized: record.normalized,
      search_form: record.search_form,
      rank: ranks.length ? Math.min(...ranks) : null,
      frequency_score,
      category_breakdown,
      sources: Object.entries(record.sources).sort(([a], [b]) => a.localeCompare(b)).map(([id, ipm]) => canonicalSourceFromId(id, ipm))
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
  const ipmValues = entries.flatMap(entry => entry.sources.map(source => source.ipm)).filter(Number.isFinite);
  const diagnostics = {
    language,
    source_file: sourceFiles.length === 1 ? sourceFiles[0] : sourceFiles,
    records_read: processed,
    valid_lemmas: entries.length,
    invalid_records: invalidRecords,
    duplicate_lemmas: Math.max(0, processed - entries.length - invalidRecords),
    lemmas_with_search_form: entries.filter(entry => entry.search_form).length,
    lemmas_without_search_form: entries.filter(entry => !entry.search_form).length,
    min_ipm: ipmValues.length ? Math.min(...ipmValues) : 0,
    max_ipm: ipmValues.length ? Math.max(...ipmValues) : 0,
    min_frequency_score: frequencyScores.length ? Math.min(...frequencyScores) : 0,
    max_frequency_score: frequencyScores.length ? Math.max(...frequencyScores) : 0,
    root_samples: rootSamples(entries),
    ...(language === 'ru' ? { search_form_collisions: countSearchFormCollisions(entries) } : {})
  };
  if (options.sourceFile && sourceFiles.length === 0) throw new Error(`--source-file did not match an existing source for ${language}: ${options.sourceFile}`);
  return { entries, sourceFiles, expectedSourceFiles, missingOptionalSources, parserMode, peakRecordsBuffered, sourceFormats, shards: Array.from(shards.entries()).sort(([a], [b]) => a.localeCompare(b)), diagnostics };
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const manifest = { version: MANIFEST_VERSION, normalizer_version: NORMALIZER_VERSION, global_config_hash: globalConfigHash(), generated_at: new Date().toISOString(), languages: {} };
  const built = new Map();

  for (const language of options.languages) {
    const result = await buildLanguage(language, options);
    built.set(language, result);
    manifest.languages[language] = { language_config_hash: languageConfigHash(language), entries: result.entries.length, source_files: result.sourceFiles, shards: result.shards.map(([name, entries]) => ({ file: `${language}/${name}.json`, entries: entries.length })) };
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
    let totalBytes = 0;
    for (const writtenFile of writtenFiles) totalBytes += await pathSize(writtenFile);
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
