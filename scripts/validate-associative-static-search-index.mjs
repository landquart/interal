#!/usr/bin/env node
import { access, readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const REQUIRED_LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'ru'];

function parseArgs(argv) {
  const options = { indexRoot: 'associativvordes/search-index', strict: false };
  for (const arg of argv) {
    if (arg.startsWith('--index-root=')) options.indexRoot = arg.slice('--index-root='.length);
    else if (arg.startsWith('--languages=')) options.languages = arg.slice('--languages='.length).split(',').map(value => value.trim()).filter(Boolean);
    else if (arg === '--strict') options.strict = true;
    else if (arg.startsWith('--report=')) options.reportPath = arg.slice('--report='.length);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  options.languages ??= REQUIRED_LANGUAGES;
  for (const language of options.languages) if (!REQUIRED_LANGUAGES.includes(language)) throw new Error(`Unsupported language: ${language}`);
  return options;
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function isSafeRelativePath(file) {
  return typeof file === 'string' && file && !file.startsWith('/') && !file.includes('://') && !file.includes('\\') && !file.split('/').includes('..');
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function decodeDeltas(values) {
  if (!Array.isArray(values)) return null;
  const ids = [];
  let current = 0;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!Number.isInteger(value) || value < 0) return null;
    current = index === 0 ? value : current + value;
    if (ids.length && current <= ids[ids.length - 1]) return null;
    ids.push(current);
  }
  return ids;
}

function validateCompactEntry(record, sourceCount, label) {
  if (!Array.isArray(record) || record.length !== 6) throw new Error(`${label}: compact entry must have six fields`);
  const [word, normalized, searchForm, rank, frequencyScore, sources] = record;
  if (typeof word !== 'string' || !word) throw new Error(`${label}: word is invalid`);
  if (!(normalized === null || (typeof normalized === 'string' && normalized))) throw new Error(`${label}: normalized is invalid`);
  if (!(searchForm === null || (typeof searchForm === 'string' && searchForm))) throw new Error(`${label}: search_form is invalid`);
  if (!(rank === null || (Number.isInteger(rank) && rank > 0))) throw new Error(`${label}: rank is invalid`);
  if (typeof frequencyScore !== 'number' || !Number.isFinite(frequencyScore) || frequencyScore < 0 || frequencyScore > 100) throw new Error(`${label}: frequency_score is invalid`);
  if (!Array.isArray(sources) || !sources.length) throw new Error(`${label}: sources are missing`);
  for (const pair of sources) {
    if (!Array.isArray(pair) || pair.length !== 2 || !Number.isInteger(pair[0]) || pair[0] < 0 || pair[0] >= sourceCount || typeof pair[1] !== 'number' || !Number.isFinite(pair[1]) || pair[1] < 0) throw new Error(`${label}: source pair is invalid`);
  }
}

export async function validateStaticSearchIndex({ indexRoot, languages, strict = false }) {
  const errors = [];
  const warnings = [];
  const report = { valid: false, errors, warnings, languages: {} };
  let manifest;
  try {
    manifest = await readJson(join(indexRoot, 'manifest.json'));
  } catch (error) {
    errors.push(`manifest: ${error.message}`);
    return report;
  }
  if (!isPlainObject(manifest) || manifest.version !== '2' || manifest.normalizer_version !== '2' || manifest.index_format !== 'static-inverted-ngram-v1' || !isPlainObject(manifest.languages)) {
    errors.push('manifest shape or versions are invalid');
    return report;
  }
  if (typeof (manifest.global_config_hash ?? manifest.config_hash) !== 'string') errors.push('manifest global_config_hash is missing');

  for (const language of languages) {
    const info = manifest.languages[language];
    const languageReport = { entries: 0, entry_blocks: 0, posting_buckets: 0, posting_grams: 0, posting_ids: 0, bytes: 0, errors: 0, warnings: 0 };
    report.languages[language] = languageReport;
    const startErrors = errors.length;
    const startWarnings = warnings.length;
    if (!isPlainObject(info)) {
      errors.push(`${language}: language metadata is missing`);
      languageReport.errors = errors.length - startErrors;
      continue;
    }
    if (!Number.isInteger(info.entries) || info.entries <= 0 || !Array.isArray(info.sources) || !info.sources.length || !Array.isArray(info.entry_blocks) || !info.entry_blocks.length || !isPlainObject(info.postings)) {
      errors.push(`${language}: language metadata is invalid`);
      languageReport.errors = errors.length - startErrors;
      continue;
    }
    for (const [index, source] of info.sources.entries()) {
      if (!isPlainObject(source) || typeof source.id !== 'string' || typeof source.file !== 'string' || typeof source.category !== 'string') errors.push(`${language}: source dictionary entry ${index} is invalid`);
    }

    let expectedFirstId = 0;
    for (const block of info.entry_blocks) {
      if (!isPlainObject(block) || !isSafeRelativePath(block.file) || block.first_id !== expectedFirstId || !Number.isInteger(block.entries) || block.entries <= 0) {
        errors.push(`${language}: entry block metadata is invalid`);
        break;
      }
      try {
        const path = join(indexRoot, block.file);
        const payload = await readJson(path);
        languageReport.bytes += (await stat(path)).size;
        if (!isPlainObject(payload) || payload.first_id !== block.first_id || !Array.isArray(payload.entries) || payload.entries.length !== block.entries) throw new Error('payload shape mismatch');
        for (let offset = 0; offset < payload.entries.length; offset += 1) validateCompactEntry(payload.entries[offset], info.sources.length, `${language}:${block.first_id + offset}`);
      } catch (error) {
        errors.push(`${language}: ${block.file}: ${error.message}`);
      }
      expectedFirstId += block.entries;
      languageReport.entry_blocks += 1;
    }
    languageReport.entries = expectedFirstId;
    if (expectedFirstId !== info.entries) errors.push(`${language}: entry block total ${expectedFirstId} does not equal manifest entries ${info.entries}`);

    for (const length of ['1', '2', '3']) {
      const posting = info.postings[length];
      if (!isPlainObject(posting) || !Number.isInteger(posting.bucket_count) || posting.bucket_count <= 0 || typeof posting.template !== 'string' || !posting.template.includes('{bucket}') || !Array.isArray(posting.buckets)) {
        errors.push(`${language}: postings metadata ${length} is invalid`);
        continue;
      }
      const seenBuckets = new Set();
      for (const bucket of posting.buckets) {
        if (typeof bucket !== 'string' || seenBuckets.has(bucket)) {
          errors.push(`${language}: duplicate or invalid postings bucket ${length}/${bucket}`);
          continue;
        }
        seenBuckets.add(bucket);
        const file = posting.template.replace('{bucket}', bucket);
        if (!isSafeRelativePath(file)) {
          errors.push(`${language}: unsafe postings path ${file}`);
          continue;
        }
        try {
          const path = join(indexRoot, file);
          const payload = await readJson(path);
          languageReport.bytes += (await stat(path)).size;
          if (!isPlainObject(payload)) throw new Error('bucket payload must be an object');
          for (const [gram, deltas] of Object.entries(payload)) {
            if ([...gram].length !== Number(length)) throw new Error(`gram ${JSON.stringify(gram)} has wrong length`);
            const ids = decodeDeltas(deltas);
            if (ids == null) throw new Error(`gram ${JSON.stringify(gram)} has invalid delta postings`);
            if (ids.some(id => id >= info.entries)) throw new Error(`gram ${JSON.stringify(gram)} has an out-of-range id`);
            languageReport.posting_grams += 1;
            languageReport.posting_ids += ids.length;
          }
          languageReport.posting_buckets += 1;
        } catch (error) {
          errors.push(`${language}: ${file}: ${error.message}`);
        }
      }
    }
    if (strict && languageReport.posting_grams === 0) errors.push(`${language}: strict validation requires postings`);
    languageReport.errors = errors.length - startErrors;
    languageReport.warnings = warnings.length - startWarnings;
  }
  report.valid = errors.length === 0;
  return report;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  await access(join(options.indexRoot, 'manifest.json'));
  const report = await validateStaticSearchIndex(options);
  if (options.reportPath) {
    await mkdir(dirname(options.reportPath), { recursive: true });
    await writeFile(options.reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
  if (!report.valid) process.exitCode = 1;
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error?.stack || error?.message || error);
    process.exitCode = 1;
  });
}
