#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';

const LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'ru'];
const DEFAULT_SEED = 'associative-family-v5-semantic-audit-2026-09-19';
const PER_LANGUAGE = 1600;
const PRE_SAMPLE = 24000;

export function parseArgs(argv) {
  const options = { seed: DEFAULT_SEED, perLanguage: PER_LANGUAGE, preSample: PRE_SAMPLE };
  for (const arg of argv) {
    if (arg.startsWith('--root=')) options.root = arg.slice(7);
    else if (arg.startsWith('--output=')) options.output = arg.slice(9);
    else if (arg.startsWith('--seed=')) options.seed = arg.slice(7);
    else if (arg.startsWith('--per-language=')) options.perLanguage = Number(arg.slice(15));
    else if (arg.startsWith('--pre-sample=')) options.preSample = Number(arg.slice(13));
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.root || !options.output) throw new Error('--root and --output are required');
  if (!Number.isInteger(options.perLanguage) || options.perLanguage < 1) throw new Error('--per-language must be a positive integer');
  if (!Number.isInteger(options.preSample) || options.preSample < options.perLanguage) throw new Error('--pre-sample must be >= --per-language');
  return options;
}

const hash = value => createHash('sha256').update(value).digest('hex');
const bucket = value => {
  let valueHash = 0x811c9dc5;
  for (const char of String(value)) { valueHash ^= char.codePointAt(0); valueHash = Math.imul(valueHash, 0x01000193); }
  return ((valueHash >>> 0) % 256).toString(16).padStart(2, '0');
};

function retainLowest(values, item, limit) {
  values.push(item);
  if (values.length >= limit * 2) {
    values.sort((a, b) => a.selection_hash.localeCompare(b.selection_hash));
    values.length = limit;
  }
}

async function preliminarySample(options) {
  const byLanguage = Object.fromEntries(LANGUAGES.map(language => [language, []]));
  for (const language of LANGUAGES) {
    const path = join(options.root, 'assignments', `${language}.jsonl.gz`);
    const lines = createInterface({ input: createReadStream(path).pipe(createGunzip()), crlfDelay: Infinity });
    for await (const line of lines) {
      if (!line) continue;
      const row = JSON.parse(line);
      for (const familyId of row.family_ids || []) {
        const selectionHash = hash(`${options.seed}\0${language}\0${row.lemma_id}\0${familyId}`);
        retainLowest(byLanguage[language], {
          sample_id: selectionHash.slice(0, 20),
          selection_hash: selectionHash,
          seed: options.seed,
          language,
          lemma_id: row.lemma_id,
          word: row.word,
          normalized: row.normalized,
          rank: row.rank,
          frequency_score: row.frequency_score,
          family_id: familyId,
          corpus_quality: row.corpus_quality || { status: 'unclassified', reasons: [] },
          component_count: Array.isArray(row.components) ? row.components.length : 0,
          evidence_types: [...new Set((row.components || []).filter(component => component.family_ids?.includes(familyId)).flatMap(component => (component.evidence || []).map(evidence => evidence.type)).filter(Boolean))].sort()
        }, options.preSample);
      }
    }
    byLanguage[language].sort((a, b) => a.selection_hash.localeCompare(b.selection_hash));
    byLanguage[language].length = Math.min(options.preSample, byLanguage[language].length);
  }
  return byLanguage;
}

async function enrichFamilies(root, byLanguage) {
  const wanted = new Set(Object.values(byLanguage).flat().map(item => item.family_id));
  const metadata = new Map();
  const byBucket = new Map();
  for (const id of wanted) {
    const name = bucket(id);
    if (!byBucket.has(name)) byBucket.set(name, new Set());
    byBucket.get(name).add(id);
  }
  for (const [name, ids] of byBucket) {
    const families = JSON.parse(await readFile(join(root, 'families', `${name}.json`), 'utf8'));
    for (const id of ids) if (families[id]) metadata.set(id, families[id]);
  }

  const aliasFanout = new Map();
  const wantedAliases = new Map();
  for (const [id, family] of metadata) {
    for (const alias of family.aliases || []) {
      const name = bucket(alias);
      if (!wantedAliases.has(name)) wantedAliases.set(name, new Map());
      const ids = wantedAliases.get(name);
      if (!ids.has(alias)) ids.set(alias, new Set());
      ids.get(alias).add(id);
    }
  }
  for (const [name, aliases] of wantedAliases) {
    const lookup = JSON.parse(await readFile(join(root, 'aliases', `${name}.json`), 'utf8'));
    for (const [alias, ids] of aliases) {
      const fanout = Array.isArray(lookup[alias]) ? lookup[alias].length : 0;
      for (const id of ids) aliasFanout.set(id, Math.max(aliasFanout.get(id) || 0, fanout));
    }
  }

  for (const values of Object.values(byLanguage)) {
    for (const item of values) {
      const family = metadata.get(item.family_id);
      if (!family) throw new Error(`Missing family metadata for ${item.family_id}`);
      Object.assign(item, {
        family_canonical: family.canonical,
        family_source: family.source,
        family_support: family.support,
        family_alias_count: family.aliases?.length || 0,
        family_language_count: Object.keys(family.language_support || {}).length,
        review_status: family.review_status,
        canonical_length: [...String(family.canonical || '')].length,
        alias_fanout: aliasFanout.get(item.family_id) || 0,
        relation_types: family.relation_types || [],
        word_structure: item.component_count > 1 ? 'compound' : 'simple'
      });
    }
  }
}

const sizeBand = support => support <= 2 ? '1-2' : support <= 10 ? '3-10' : support <= 100 ? '11-100' : support <= 1000 ? '101-1000' : '1001+';
const fanoutBand = value => value <= 1 ? '1' : value <= 2 ? '2' : value <= 5 ? '3-5' : value <= 10 ? '6-10' : value <= 25 ? '11-25' : '26+';
const canonicalBand = value => value <= 2 ? '0-2' : value <= 4 ? '3-4' : value <= 8 ? '5-8' : '9+';
const frequencyBand = value => value >= 66 ? 'high' : value >= 33 ? 'medium' : 'low';

function stratum(item) {
  return [item.family_source, sizeBand(item.family_support), fanoutBand(item.alias_fanout), item.review_status, canonicalBand(item.canonical_length), frequencyBand(Number(item.frequency_score) || 0), item.evidence_types[0] || 'none', item.relation_types[0] || 'none', item.word_structure, item.corpus_quality.status].join('|');
}

export function stratifiedSelection(values, count) {
  const groups = new Map();
  for (const item of values) {
    item.stratum = stratum(item);
    if (!groups.has(item.stratum)) groups.set(item.stratum, []);
    groups.get(item.stratum).push(item);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  const selected = [];
  for (let depth = 0; selected.length < count; depth += 1) {
    let added = 0;
    for (const [, items] of ordered) {
      if (items[depth] && selected.length < count) { selected.push(items[depth]); added += 1; }
    }
    if (!added) break;
  }
  if (selected.length !== count) throw new Error(`Unable to select ${count} rows; got ${selected.length}`);
  return selected.sort((a, b) => a.language.localeCompare(b.language) || a.selection_hash.localeCompare(b.selection_hash));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await mkdir(options.output, { recursive: true });
  const byLanguage = await preliminarySample(options);
  await enrichFamilies(options.root, byLanguage);
  const selected = LANGUAGES.flatMap(language => stratifiedSelection(byLanguage[language], options.perLanguage));
  const annotation = selected.map(item => ({ ...item, label: null, error_category: null, confidence: null, notes: null, evidence_url: null, annotator: null }));
  const lines = annotation.map(item => JSON.stringify(item)).join('\n') + '\n';
  await writeFile(join(options.output, 'gold-sample.jsonl'), lines);
  await writeFile(join(options.output, 'annotation-a.jsonl'), lines);
  await writeFile(join(options.output, 'annotation-b.jsonl'), lines);
  const report = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    source_root: basename(options.root),
    seed: options.seed,
    requested_per_language: options.perLanguage,
    total: selected.length,
    by_language: Object.fromEntries(LANGUAGES.map(language => [language, selected.filter(item => item.language === language).length])),
    unique_families: new Set(selected.map(item => item.family_id)).size,
    strata: new Set(selected.map(item => item.stratum)).size,
    annotation_state: 'unannotated_requires_two_independent_human_or_mixed_evaluators'
  };
  await writeFile(join(options.output, 'sampling-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error?.stack || error); process.exitCode = 1; });
}
