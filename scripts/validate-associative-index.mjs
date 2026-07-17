#!/usr/bin/env node
import { access, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findCandidatesForRoot } from '../associativvordes/js/candidate-finder.js';
import { candidateIndexEntryComparator } from './lib/associative-index-core.mjs';

const SUPPORTED_VERSION = '1';
const SUPPORTED_NORMALIZER_VERSION = '2';
const DEFAULT_LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'ru'];
const ROOT_SAMPLES = ['alter', 'regul', 'ocul', 'inter'];
const SOURCE_CATEGORIES = new Set(['subtitles', 'normative', 'web', 'mixed']);
const EXIT = { OK: 0, VALIDATION: 1, CLI: 2, MANIFEST: 3, VERSION: 4 };

function parseArgs(argv) {
  const options = { languages: null, strict: false, maxErrors: 100 };
  for (const arg of argv) {
    if (arg.startsWith('--index-root=')) options.indexRoot = arg.slice(13);
    else if (arg.startsWith('--languages=')) options.languages = arg.slice(12).split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
    else if (arg.startsWith('--report=')) options.report = arg.slice(9);
    else if (arg === '--strict') options.strict = true;
    else if (arg.startsWith('--max-errors=')) options.maxErrors = Number(arg.slice(13));
    else throw Object.assign(new Error(`Unknown argument: ${arg}`), { exitCode: EXIT.CLI });
  }
  if (!options.indexRoot) throw Object.assign(new Error('--index-root is required'), { exitCode: EXIT.CLI });
  if (!Number.isInteger(options.maxErrors) || options.maxErrors < 1) throw Object.assign(new Error('--max-errors must be a positive integer'), { exitCode: EXIT.CLI });
  return { ...options, indexRoot: resolve(options.indexRoot) };
}

function isObject(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function hasCyrillic(value) { return /[\u0400-\u04ff]/u.test(String(value)); }
function hasLatin(value) { return /[a-z]/iu.test(String(value)); }
function shardIdForSearchForm(searchForm) { const c = String(searchForm || '')[0]?.toLowerCase(); return c && c >= 'a' && c <= 'z' ? c : '_other'; }
function shardIdFromPath(file) { return String(file).split('/').pop().replace(/\.json$/i, ''); }
function isBadRelPath(file) { return typeof file !== 'string' || !file || isAbsolute(file) || file.includes('://') || file.includes('\\') || file.split('/').includes('..'); }
function isBareFileName(file) { return typeof file === 'string' && file.trim() && !isAbsolute(file) && !file.includes('://') && !file.includes('\\') && !file.includes('/') && !file.split('/').includes('..'); }

class Collector {
  constructor(max) { this.max = max; this.errors = []; this.warnings = []; this.errorCount = 0; this.warningCount = 0; }
  error(message) { this.errorCount += 1; if (this.errors.length < this.max) this.errors.push(message); }
  warn(message) { this.warningCount += 1; if (this.warnings.length < this.max) this.warnings.push(message); }
}

async function readJson(path, exitCode = EXIT.VALIDATION) {
  let text;
  try { text = await readFile(path, 'utf8'); }
  catch (cause) { throw Object.assign(new Error(`Cannot read ${path}: ${cause.message}`), { exitCode }); }
  try { return JSON.parse(text); }
  catch (cause) { throw Object.assign(new Error(`Invalid JSON in ${path}: ${cause.message}`), { exitCode }); }
}

async function exists(path) { try { await access(path); return true; } catch { return false; } }
async function listFiles(root, base = root) {
  const out = [];
  for (const dirent of await readdir(root, { withFileTypes: true })) {
    const path = join(root, dirent.name);
    const rel = relative(base, path).replaceAll('\\', '/');
    if (dirent.isDirectory()) out.push(...await listFiles(path, base)); else out.push(rel);
  }
  return out;
}

function validateManifest(manifest, languages, c) {
  if (!isObject(manifest)) return c.error('manifest must be an object');
  if (manifest.version !== SUPPORTED_VERSION) c.error(`unsupported manifest version: ${manifest.version}`);
  if (manifest.normalizer_version !== SUPPORTED_NORMALIZER_VERSION) c.error(`unsupported normalizer_version: ${manifest.normalizer_version}`);
  if (typeof (manifest.global_config_hash ?? manifest.config_hash) !== 'string' || !(manifest.global_config_hash ?? manifest.config_hash)) c.error('global_config_hash is required');
  if (!isObject(manifest.languages)) return c.error('manifest.languages must be an object');
  const seenPaths = new Set();
  for (const lang of languages) {
    const info = manifest.languages[lang];
    if (!isObject(info)) { c.error(`language missing from manifest: ${lang}`); continue; }
    if (info.language_config_hash != null && (typeof info.language_config_hash !== 'string' || !info.language_config_hash)) c.error(`${lang}: language_config_hash must be a non-empty string`);
    if (!Number.isInteger(info.entries) || info.entries < 0) c.error(`${lang}: entries must be a non-negative integer`);
    if (!Array.isArray(info.shards)) { c.error(`${lang}: shards must be an array`); continue; }
    for (const shard of info.shards) {
      if (!isObject(shard)) { c.error(`${lang}: shard metadata must be an object`); continue; }
      if (isBadRelPath(shard.file)) c.error(`${lang}: invalid relative shard path: ${shard.file}`);
      else if (!String(shard.file).startsWith(`${lang}/`)) c.error(`${lang}: shard path must stay under language directory: ${shard.file}`);
      if (seenPaths.has(shard.file)) c.error(`duplicate shard path in manifest: ${shard.file}`);
      seenPaths.add(shard.file);
      if (!Number.isInteger(shard.entries) || shard.entries < 0) c.error(`${lang}: shard entries must be non-negative for ${shard.file}`);
    }
  }
}

function scanFinite(value, label, c) {
  if (typeof value === 'number' && !Number.isFinite(value)) c.error(`non-finite number at ${label}`);
  if (Array.isArray(value)) value.forEach((v, i) => scanFinite(v, `${label}[${i}]`, c));
  else if (isObject(value)) for (const [k, v] of Object.entries(value)) scanFinite(v, `${label}.${k}`, c);
}

function validateEntry(entry, lang, shard, index, seenNormalized, c) {
  const label = `${shard.file}[${index}]`;
  if (!isObject(entry)) { c.error(`${label}: entry must be an object`); return; }
  scanFinite(entry, label, c);
  for (const key of ['word', 'normalized', 'search_form']) if (typeof entry[key] !== 'string' || !entry[key].trim()) c.error(`${label}: ${key} must be a non-empty string`);
  if (typeof entry.frequency_score !== 'number' || !Number.isFinite(entry.frequency_score) || entry.frequency_score < 0 || entry.frequency_score > 100) c.error(`${label}: frequency_score must be finite and in 0..100`);
  if (!(typeof entry.rank === 'number' || entry.rank === null) || (typeof entry.rank === 'number' && !Number.isFinite(entry.rank))) c.error(`${label}: rank must be a finite number or null`);
  if (!isObject(entry.category_breakdown)) c.error(`${label}: category_breakdown must be an object`);
  if (!Array.isArray(entry.sources) || entry.sources.length === 0) c.error(`${label}: sources must be a non-empty array`);
  else {
    let prevSourceId = null;
    for (const [si, source] of entry.sources.entries()) {
      if (!isObject(source)) { c.error(`${label}.sources[${si}]: source must be an object`); continue; }
      for (const field of ['id', 'file', 'category', 'ipm']) if (!Object.hasOwn(source, field)) c.error(`${label}.sources[${si}]: ${field} is required`);
      if (typeof source.id !== 'string' || !source.id.trim()) c.error(`${label}.sources[${si}]: id must be a non-empty string`);
      if (typeof source.id === 'string' && (isAbsolute(source.id) || source.id.includes('://') || source.id.includes('\\') || source.id.split('/').includes('..'))) c.error(`${label}.sources[${si}]: absolute source path or URL is forbidden`);
      if (!isBareFileName(source.file)) c.error(`${label}.sources[${si}]: file must be a bare filename`);
      if (!SOURCE_CATEGORIES.has(source.category)) c.error(`${label}.sources[${si}]: category must be one of subtitles, normative, web, mixed`);
      if (typeof source.id === 'string' && isBareFileName(source.file) && SOURCE_CATEGORIES.has(source.category) && source.id !== `${source.category}/${source.file}`) c.error(`${label}.sources[${si}]: id must equal category/file`);
      if (typeof source.id === 'string' && prevSourceId != null && prevSourceId.localeCompare(source.id) > 0) c.error(`${label}.sources[${si}]: sources must be sorted by id`);
      if (typeof source.id === 'string') prevSourceId = source.id;
      if (typeof source.ipm !== 'number' || !Number.isFinite(source.ipm)) c.error(`${label}.sources[${si}]: ipm must be finite`);
      if (Number.isFinite(source.ipm) && source.ipm < 0) c.error(`${label}.sources[${si}]: ipm must not be negative`);
    }
  }
  if (entry.normalized) { if (seenNormalized.has(entry.normalized)) c.error(`${lang}: duplicate normalized entry: ${entry.normalized}`); seenNormalized.add(entry.normalized); }
  if (entry.search_form && shardIdForSearchForm(entry.search_form) !== shardIdFromPath(shard.file)) c.error(`${label}: search_form belongs in shard ${shardIdForSearchForm(entry.search_form)}.json`);
  if (lang === 'ru') {
    if (hasCyrillic(entry.word) && !hasCyrillic(entry.normalized)) c.error(`${label}: Russian normalized lost Cyrillic`);
    if (hasCyrillic(entry.word) && !hasLatin(entry.search_form)) c.error(`${label}: Russian search_form is not usable for Latin search`);
    if (!hasCyrillic(entry.word) && hasCyrillic(entry.normalized)) c.warn(`${label}: Russian word may be transliterated while normalized is Cyrillic`);
  }
}

async function validateIndex(options) {
  const c = new Collector(options.maxErrors);
  const manifestPath = join(options.indexRoot, 'manifest.json');
  if (!(await exists(manifestPath))) throw Object.assign(new Error(`manifest not found: ${manifestPath}`), { exitCode: EXIT.MANIFEST });
  const manifest = await readJson(manifestPath, EXIT.MANIFEST);
  if (manifest.version !== SUPPORTED_VERSION || manifest.normalizer_version !== SUPPORTED_NORMALIZER_VERSION) {
    const tmp = new Collector(options.maxErrors); validateManifest(manifest, options.languages ?? Object.keys(manifest.languages ?? {}), tmp);
    if (tmp.errors.some(e => e.includes('unsupported'))) throw Object.assign(new Error(tmp.errors.find(e => e.includes('unsupported'))), { exitCode: EXIT.VERSION, validation: tmp });
  }
  const languages = options.languages ?? Object.keys(manifest.languages ?? {}).sort();
  validateManifest(manifest, languages, c);
  const report = { valid: true, version: manifest.version, normalizer_version: manifest.normalizer_version, languages: {}, errors: c.errors, warnings: c.warnings };
  const allFiles = await listFiles(options.indexRoot).catch(() => []);
  for (const file of allFiles) {
    if (file.endsWith('.tmp') || file.includes('.tmp/')) c.error(`temporary file inside index: ${file}`);
    if (file.includes('node_modules/')) c.error(`node_modules inside index: ${file}`);
    if (/fixture/i.test(file)) c.error(`fixture file inside production index: ${file}`);
    if (/corpus|frequency lists|\.out(\.gz)?\.|\.log$/i.test(file)) c.error(`source corpus or build log inside index: ${file}`);
  }
  for (const lang of languages) {
    const info = manifest.languages?.[lang];
    const langReport = report.languages[lang] = { entries: 0, shards: 0, bytes: 0, errors: 0, warnings: 0, root_samples: {} };
    const beforeE = c.errorCount, beforeW = c.warningCount;
    if (!isObject(info) || !Array.isArray(info.shards)) { langReport.errors = c.errorCount - beforeE; continue; }
    const manifestShards = new Set(info.shards.map(s => s.file));
    const disk = (await readdir(join(options.indexRoot, lang)).catch(() => [])).filter(f => f.endsWith('.json')).map(f => `${lang}/${f}`);
    for (const f of disk) if (!manifestShards.has(f)) c.error(`${lang}: shard on disk is not listed in manifest: ${f}`);
    const seen = new Set(); const entriesForSamples = [];
    for (const shard of info.shards) {
      if (isBadRelPath(shard.file)) continue;
      const path = join(options.indexRoot, shard.file);
      if (!(await exists(path))) { c.error(`${lang}: manifest shard missing on disk: ${shard.file}`); continue; }
      const st = await stat(path); langReport.bytes += st.size; langReport.shards += 1;
      const payload = await readJson(path).catch(e => (c.error(e.message), null));
      const entries = Array.isArray(payload) ? payload : payload?.entries;
      if (!Array.isArray(entries)) { c.error(`${shard.file}: shard must be an array or {entries}`); continue; }
      if (entries.length !== shard.entries) c.error(`${shard.file}: shard entries metadata mismatch`);
      let prev = null;
      for (const [i, entry] of entries.entries()) {
        if (prev != null && candidateIndexEntryComparator(prev, entry) > 0) c.error(`${shard.file}: entries are not deterministically sorted`);
        prev = entry;
        validateEntry(entry, lang, shard, i, seen, c);
      }
      langReport.entries += entries.length; entriesForSamples.push(...entries);
    }
    if (langReport.entries !== info.entries) c.error(`${lang}: manifest entries ${info.entries} != actual ${langReport.entries}`);
    for (const root of ROOT_SAMPLES) {
      const result = findCandidatesForRoot({ entries: entriesForSamples, root, language: lang, maxCandidates: 20 });
      langReport.root_samples[root] = result.candidates.map(x => ({ word: x.word, normalized: x.normalized, search_form: x.search_form, sources: x.sources.length }));
      if (root === 'alter' && result.candidates.some(x => ['inter', 'international', 'internet'].includes(String(x.normalized || x.word).toLowerCase()))) c.error(`${lang}: root sample regression alter returned inter/international/internet`);
      if (result.candidates.some(x => !Array.isArray(x.sources) || x.sources.length === 0)) c.error(`${lang}: root sample candidate without sources for ${root}`);
    }
    langReport.errors = c.errorCount - beforeE; langReport.warnings = c.warningCount - beforeW;
  }
  report.valid = c.errorCount === 0; report.errors = c.errors; report.warnings = c.warnings;
  return { report, errorCount: c.errorCount, warningCount: c.warningCount };
}

export { EXIT, validateIndex, parseArgs };

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  let result;
  try { result = await validateIndex(options); }
  catch (error) {
    if (error.validation) {
      if (options.report) await writeFile(options.report, `${JSON.stringify({ valid: false, errors: error.validation.errors, warnings: error.validation.warnings }, null, 2)}\n`);
    }
    throw error;
  }
  if (options.report) { await mkdir(dirname(resolve(options.report)), { recursive: true }).catch(() => {}); await writeFile(options.report, `${JSON.stringify(result.report, null, 2)}\n`); }
  if (result.errorCount) {
    console.error(`Associative index validation failed with ${result.errorCount} error(s).`);
    for (const error of result.report.errors) console.error(`- ${error}`);
    process.exitCode = options.strict ? EXIT.VALIDATION : EXIT.OK;
  } else {
    console.log(`Associative index valid: ${Object.keys(result.report.languages).join(', ')}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = error.exitCode ?? EXIT.VALIDATION; });
}
