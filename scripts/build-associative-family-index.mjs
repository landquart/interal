#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { once } from 'node:events';
import { rootBoundarySegments, buildSearchForm, exactRootMatchAtBoundary } from '../associativvordes/js/root-matcher.js';
import { getAffixSearchConfig } from '../associativvordes/js/affix-search-config.js';
import { SEARCH_NORMALIZER_VERSION } from '../associativvordes/js/search-normalizer.js';

const LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'ru'];
const LANGUAGE_BITS = Object.freeze(Object.fromEntries(LANGUAGES.map((language, index) => [language, 1 << index])));
const FAMILY_INDEX_VERSION = '1';
const MIN_ROOT_LENGTH = 3;
const MIN_PREFIX_LENGTH = 2;
const MAX_ROOT_LENGTH = 24;
const MAX_SUFFIX_LAYERS = 2;
const MIN_SURFACE_FAMILY_MEMBERS = 2;

const CURATED_ROOT_FAMILIES = Object.freeze([
  Object.freeze({ id: 'curated:alter', label: 'alter', aliases: ['alter', 'altern', 'altru'], confidence: 'A', note: 'Latin alter family; includes alternative/altruism branches.' }),
  Object.freeze({ id: 'curated:pede', label: 'pede', aliases: ['pede', 'ped', 'pedi'], confidence: 'A', note: 'Ped-/pedi- foot family; includes pedal/pedicure branches.' }),
  Object.freeze({ id: 'curated:ocul', label: 'ocul', aliases: ['ocul', 'okul'], confidence: 'A', note: 'Ocul-/okul- eye family.' }),
  Object.freeze({ id: 'curated:regul', label: 'regul', aliases: ['regul', 'regol'], confidence: 'A', note: 'Regul-/regol- rule family.' })
]);

const CONTROL_FAMILIES = Object.freeze([
  Object.freeze({ family: 'curated:alter', words: ['alternative', 'altruism'] }),
  Object.freeze({ family: 'curated:pede', words: ['pedal', 'pedicure'] }),
  Object.freeze({ family: 'curated:ocul', words: ['ocular', 'oculist'] }),
  Object.freeze({ family: 'curated:regul', words: ['regular', 'regulation'] })
]);

function parseArgs(argv) {
  const options = { candidateRoot: null, outputRoot: null, languages: LANGUAGES, minMembers: MIN_SURFACE_FAMILY_MEMBERS };
  for (const arg of argv) {
    if (arg.startsWith('--candidate-root=')) options.candidateRoot = arg.slice('--candidate-root='.length);
    else if (arg.startsWith('--output-root=')) options.outputRoot = arg.slice('--output-root='.length);
    else if (arg.startsWith('--languages=')) options.languages = arg.slice('--languages='.length).split(',').map(v => v.trim()).filter(Boolean);
    else if (arg.startsWith('--min-members=')) options.minMembers = Number(arg.slice('--min-members='.length));
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.candidateRoot || !options.outputRoot) throw new Error('--candidate-root and --output-root are required');
  for (const language of options.languages) if (!LANGUAGES.includes(language)) throw new Error(`Unsupported language: ${language}`);
  if (!Number.isInteger(options.minMembers) || options.minMembers < 2) throw new Error('--min-members must be an integer >= 2');
  return options;
}

async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }
function normalizeAlias(value) { return buildSearchForm(value).replace(/[^a-z0-9]/g, ''); }

const suffixCache = new Map();
function normalizedSuffixes(language) {
  if (suffixCache.has(language)) return suffixCache.get(language);
  const values = [...new Set((getAffixSearchConfig(language).suffixes || []).map(normalizeAlias).filter(value => value.length >= 2).filter(value => value.length <= 10))]
    .sort((a, b) => b.length - a.length || a.localeCompare(b));
  suffixCache.set(language, values);
  return values;
}

function rootCandidates(searchForm, language) {
  const text = buildSearchForm(searchForm);
  if (!text) return [];
  const suffixes = normalizedSuffixes(language);
  const out = new Set();
  for (const boundary of rootBoundarySegments(text, language)) {
    const token = text.slice(boundary.start, boundary.end).replace(/[^a-z0-9]/g, '');
    if (token.length < MIN_ROOT_LENGTH || token.length > MAX_ROOT_LENGTH) continue;
    out.add(token);
    let frontier = new Set([token]);
    for (let layer = 0; layer < MAX_SUFFIX_LAYERS; layer += 1) {
      const next = new Set();
      for (const form of frontier) {
        for (const suffix of suffixes) {
          if (!form.endsWith(suffix)) continue;
          const stem = form.slice(0, -suffix.length);
          if (stem.length < MIN_ROOT_LENGTH || stem.length > MAX_ROOT_LENGTH || !/[a-z]/.test(stem)) continue;
          out.add(stem);
          next.add(stem);
        }
      }
      if (!next.size) break;
      frontier = next;
    }
  }
  return [...out];
}

function prefixCandidates(searchForm, language) {
  const text = buildSearchForm(searchForm);
  const out = new Set();
  for (const boundary of rootBoundarySegments(text, language)) {
    for (const prefix of boundary.prefixes || []) {
      const alias = normalizeAlias(prefix.value);
      if (alias.length >= MIN_PREFIX_LENGTH) out.add(alias);
    }
  }
  return [...out];
}

function statIncrement(map, alias, language) {
  if (!alias) return;
  const previous = map.get(alias) || 0;
  const count = Math.floor(previous / 64);
  const mask = previous % 64;
  map.set(alias, (count + 1) * 64 + (mask | LANGUAGE_BITS[language]));
}
function statCount(value) { return Math.floor((value || 0) / 64); }
function statLanguageCount(value) {
  let mask = (value || 0) % 64;
  let count = 0;
  while (mask) { count += mask & 1; mask >>= 1; }
  return count;
}
function familyShard(id) { return createHash('sha1').update(id).digest('hex').slice(0, 2); }
function lookupShard(alias) { const first = normalizeAlias(alias)[0]; return first && /[a-z0-9]/.test(first) ? first : '_other'; }
function surfaceFamilyId(alias) { return `surface:${alias}`; }
function prefixFamilyId(alias) { return `prefix:${alias}`; }
function chooseAutomaticRootAlias(candidates, validAliases) {
  return candidates.filter(alias => validAliases.has(alias)).sort((a, b) => a.length - b.length || a.localeCompare(b))[0] || null;
}

const curatedByAlias = new Map();
for (const family of CURATED_ROOT_FAMILIES) for (const alias of family.aliases) curatedByAlias.set(normalizeAlias(alias), family);

function curatedMatches(row, language) {
  const matches = new Map();
  for (const family of CURATED_ROOT_FAMILIES) {
    let best = null;
    for (const aliasRaw of family.aliases) {
      const alias = normalizeAlias(aliasRaw);
      const match = exactRootMatchAtBoundary(row.search_form || row.word, alias, language);
      if (!match) continue;
      if (!best || alias.length > best.alias.length) best = { family, alias, match };
    }
    if (best) matches.set(family.id, best);
  }
  return [...matches.values()];
}

async function candidateManifest(candidateRoot) { return readJson(join(candidateRoot, 'manifest.json')); }
async function* candidateRows(candidateRoot, manifest, languages) {
  for (const language of languages) {
    const meta = manifest.languages?.[language];
    if (!meta) throw new Error(`Candidate index missing language ${language}`);
    for (const shard of meta.shards || []) {
      const rows = await readJson(join(candidateRoot, shard.file));
      if (!Array.isArray(rows)) throw new Error(`Candidate shard is not an array: ${shard.file}`);
      for (const row of rows) yield { language, row };
    }
  }
}

async function firstPass(candidateRoot, manifest, languages) {
  const rootStats = new Map();
  const prefixStats = new Map();
  let rows = 0;
  for await (const { language, row } of candidateRows(candidateRoot, manifest, languages)) {
    for (const alias of new Set(rootCandidates(row.search_form || row.word, language))) statIncrement(rootStats, alias, language);
    for (const alias of new Set(prefixCandidates(row.search_form || row.word, language))) statIncrement(prefixStats, alias, language);
    rows += 1;
    if (rows % 250000 === 0) console.error(`[family-index] counted ${rows} lemmas`);
  }
  return { rootStats, prefixStats, rows };
}

function buildFamilies(rootStats, prefixStats, minMembers) {
  const families = new Map();
  const validRoots = new Set();
  const validPrefixes = new Set();
  for (const [alias, stat] of rootStats) {
    if (statCount(stat) < minMembers || curatedByAlias.has(alias)) continue;
    validRoots.add(alias);
    const id = surfaceFamilyId(alias);
    families.set(id, { id, element_type: 'root', label: alias, aliases: [alias], confidence: statLanguageCount(stat) >= 2 ? 'A' : 'B', support: { members: statCount(stat), languages: statLanguageCount(stat) }, source: 'exact_surface_morphology' });
  }
  for (const family of CURATED_ROOT_FAMILIES) {
    families.set(family.id, { id: family.id, element_type: 'root', label: family.label, aliases: [...new Set(family.aliases.map(normalizeAlias).filter(Boolean))], confidence: family.confidence, support: { members: 0, languages: 0 }, source: 'verified_alias_registry', note: family.note });
  }
  for (const [alias, stat] of prefixStats) {
    if (statCount(stat) < minMembers) continue;
    validPrefixes.add(alias);
    const id = prefixFamilyId(alias);
    families.set(id, { id, element_type: 'preposition', label: alias, aliases: [alias], confidence: statLanguageCount(stat) >= 2 ? 'A' : 'B', support: { members: statCount(stat), languages: statLanguageCount(stat) }, source: 'exact_prefix_morphology' });
  }
  return { families, validRoots, validPrefixes };
}

async function ensureDir(path) { await mkdir(path, { recursive: true }); }
async function writeJsonLine(stream, value) { if (!stream.write(`${JSON.stringify(value)}\n`)) await once(stream, 'drain'); }

async function secondPass({ candidateRoot, manifest, languages, outputRoot, families, validRoots, validPrefixes }) {
  const tempRoot = join(outputRoot, '.member-lines');
  await rm(tempRoot, { recursive: true, force: true });
  await ensureDir(tempRoot);
  const streams = new Map();
  const familyMembers = new Map();
  const familyLanguageMask = new Map();
  const controlPresence = Object.fromEntries(CONTROL_FAMILIES.flatMap(control => control.words).map(word => [word, []]));
  function streamFor(language, shard) {
    const key = `${language}:${shard}`;
    if (streams.has(key)) return streams.get(key);
    const stream = createWriteStream(join(tempRoot, `${language}-${shard}.jsonl`), { encoding: 'utf8' });
    streams.set(key, stream);
    return stream;
  }
  let rows = 0;
  for await (const { language, row } of candidateRows(candidateRoot, manifest, languages)) {
    const assignments = new Map();
    for (const match of curatedMatches(row, language)) assignments.set(match.family.id, { id: match.family.id, anchor: match.alias, element_type: 'root' });
    const automaticRoot = chooseAutomaticRootAlias(rootCandidates(row.search_form || row.word, language), validRoots);
    if (automaticRoot && ![...assignments.values()].some(item => item.element_type === 'root')) assignments.set(surfaceFamilyId(automaticRoot), { id: surfaceFamilyId(automaticRoot), anchor: automaticRoot, element_type: 'root' });
    const prefixes = prefixCandidates(row.search_form || row.word, language).filter(alias => validPrefixes.has(alias)).sort((a, b) => b.length - a.length || a.localeCompare(b));
    for (const prefix of prefixes.slice(0, 2)) assignments.set(prefixFamilyId(prefix), { id: prefixFamilyId(prefix), anchor: prefix, element_type: 'preposition' });
    for (const assignment of assignments.values()) {
      const family = families.get(assignment.id);
      if (!family) continue;
      const shard = familyShard(assignment.id);
      const member = { ...row, language, family_surface_anchor: assignment.anchor, family_id: assignment.id };
      await writeJsonLine(streamFor(language, shard), { family_id: assignment.id, member });
      familyMembers.set(assignment.id, (familyMembers.get(assignment.id) || 0) + 1);
      familyLanguageMask.set(assignment.id, (familyLanguageMask.get(assignment.id) || 0) | LANGUAGE_BITS[language]);
      const normalizedWord = String(row.normalized || row.word || '').normalize('NFC').toLocaleLowerCase('und');
      if (controlPresence[normalizedWord]) controlPresence[normalizedWord].push(assignment.id);
    }
    rows += 1;
    if (rows % 250000 === 0) console.error(`[family-index] assigned ${rows} lemmas`);
  }
  for (const stream of streams.values()) { stream.end(); await once(stream, 'finish'); }
  for (const [id, family] of families) family.support = { members: familyMembers.get(id) || 0, languages: statLanguageCount(familyLanguageMask.get(id) || 0) };
  return { tempRoot, familyMembers, familyLanguageMask, controlPresence, rows };
}

async function compileMemberShards({ tempRoot, outputRoot, languages, families }) {
  const memberRoot = join(outputRoot, 'members');
  await ensureDir(memberRoot);
  const memberShards = Object.fromEntries(languages.map(language => [language, []]));
  const files = await readdir(tempRoot);
  for (const language of languages) {
    await ensureDir(join(memberRoot, language));
    const languageFiles = files.filter(name => name.startsWith(`${language}-`) && name.endsWith('.jsonl')).sort();
    for (const name of languageFiles) {
      const shard = name.slice(language.length + 1, -'.jsonl'.length);
      const text = await readFile(join(tempRoot, name), 'utf8');
      const buckets = {};
      for (const line of text.split(/\r?\n/)) {
        if (!line) continue;
        const parsed = JSON.parse(line);
        const family = families.get(parsed.family_id);
        if (!family) continue;
        const bucket = buckets[parsed.family_id] ||= { meta: { id: family.id, element_type: family.element_type, label: family.label, aliases: family.aliases, confidence: family.confidence, source: family.source }, members: [] };
        bucket.members.push(parsed.member);
      }
      for (const bucket of Object.values(buckets)) bucket.members.sort((a, b) => Number(b.frequency_score || 0) - Number(a.frequency_score || 0) || (Number.isInteger(a.rank) ? a.rank : Number.POSITIVE_INFINITY) - (Number.isInteger(b.rank) ? b.rank : Number.POSITIVE_INFINITY) || String(a.word || '').localeCompare(String(b.word || '')));
      const file = `members/${language}/${shard}.json`;
      await writeFile(join(outputRoot, file), `${JSON.stringify(buckets)}\n`);
      memberShards[language].push({ shard, file, families: Object.keys(buckets).length, members: Object.values(buckets).reduce((sum, bucket) => sum + bucket.members.length, 0) });
    }
  }
  return memberShards;
}

async function buildLookup({ outputRoot, families }) {
  const byShard = new Map();
  for (const family of families.values()) {
    if (!family.support?.members) continue;
    const shard = familyShard(family.id);
    for (const aliasRaw of family.aliases || []) {
      const alias = normalizeAlias(aliasRaw);
      if (!alias) continue;
      const lookupName = lookupShard(alias);
      const lookup = byShard.get(lookupName) || {};
      const refs = lookup[alias] ||= [];
      refs.push({ id: family.id, shard, element_type: family.element_type, label: family.label, confidence: family.confidence, members: family.support.members, languages: family.support.languages });
      byShard.set(lookupName, lookup);
    }
  }
  await ensureDir(join(outputRoot, 'lookup'));
  const lookupShards = [];
  for (const [shard, lookup] of [...byShard.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    for (const refs of Object.values(lookup)) refs.sort((a, b) => b.languages - a.languages || b.members - a.members || a.id.localeCompare(b.id));
    const file = `lookup/${shard}.json`;
    await writeFile(join(outputRoot, file), `${JSON.stringify(lookup)}\n`);
    lookupShards.push({ shard, file, aliases: Object.keys(lookup).length });
  }
  return lookupShards;
}

function validateControls(controlPresence) {
  const result = {};
  for (const control of CONTROL_FAMILIES) {
    const sets = control.words.map(word => new Set(controlPresence[word] || []));
    const common = [...sets[0]].filter(id => sets.slice(1).every(set => set.has(id)));
    result[control.family] = { ok: common.includes(control.family), expected_family: control.family, words: Object.fromEntries(control.words.map((word, index) => [word, [...sets[index]].sort()])), common_families: common.sort() };
  }
  return result;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await rm(options.outputRoot, { recursive: true, force: true });
  await ensureDir(options.outputRoot);
  const manifest = await candidateManifest(options.candidateRoot);
  console.error('[family-index] pass 1: counting exact surface roots and prefixes');
  const first = await firstPass(options.candidateRoot, manifest, options.languages);
  console.error(`[family-index] counted ${first.rows} lemmas; root aliases=${first.rootStats.size}; prefix aliases=${first.prefixStats.size}`);
  const built = buildFamilies(first.rootStats, first.prefixStats, options.minMembers);
  console.error(`[family-index] candidate families=${built.families.size}`);
  console.error('[family-index] pass 2: assigning family memberships');
  const second = await secondPass({ candidateRoot: options.candidateRoot, manifest, languages: options.languages, outputRoot: options.outputRoot, ...built });
  const memberShards = await compileMemberShards({ tempRoot: second.tempRoot, outputRoot: options.outputRoot, languages: options.languages, families: built.families });
  await rm(second.tempRoot, { recursive: true, force: true });
  const lookupShards = await buildLookup({ outputRoot: options.outputRoot, families: built.families });
  const families = [...built.families.values()].filter(family => family.support?.members).sort((a, b) => b.support.languages - a.support.languages || b.support.members - a.support.members || a.id.localeCompare(b.id));
  await writeFile(join(options.outputRoot, 'families.json'), `${JSON.stringify(families, null, 2)}\n`);
  const controls = validateControls(second.controlPresence);
  for (const [name, check] of Object.entries(controls)) if (!check.ok) throw new Error(`Control associative family failed: ${name} ${JSON.stringify(check)}`);
  const familyManifest = {
    version: FAMILY_INDEX_VERSION,
    normalizer_version: SEARCH_NORMALIZER_VERSION,
    generated_at: new Date().toISOString(),
    languages: options.languages,
    algorithm: { version: 'surface-family-v1', fuzzy_matching: false, edit_distance_matching: false, root_method: 'exact boundary segmentation plus deterministic derivational suffix stripping', prefix_method: 'exact configured prefix/combining-form boundaries', divergent_branches: 'verified alias registry' },
    lookup_shards: lookupShards,
    member_shards: memberShards,
    families: families.length,
    source_candidate_entries: first.rows
  };
  await writeFile(join(options.outputRoot, 'manifest.json'), `${JSON.stringify(familyManifest, null, 2)}\n`);
  const report = {
    version: 1,
    source_candidate_entries: first.rows,
    root_aliases_seen: first.rootStats.size,
    prefix_aliases_seen: first.prefixStats.size,
    families: families.length,
    family_memberships: [...second.familyMembers.values()].reduce((sum, value) => sum + value, 0),
    controls,
    curated_families: families.filter(family => family.source === 'verified_alias_registry'),
    largest_families: families.slice(0, 50).map(family => ({ id: family.id, element_type: family.element_type, label: family.label, aliases: family.aliases, members: family.support.members, languages: family.support.languages, confidence: family.confidence, source: family.source }))
  };
  await writeFile(join(options.outputRoot, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => { console.error(error?.stack || error?.message || error); process.exitCode = 1; });
