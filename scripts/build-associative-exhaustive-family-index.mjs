#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createGunzip, createGzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { buildSearchForm, normalizeText, rootBoundarySegments } from '../associativvordes/js/root-matcher.js';
import { getAffixSearchConfig } from '../associativvordes/js/affix-search-config.js';

const LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'ru'];
const INDEX_VERSION = '2';
const MIN_ROOT = 3;
const MAX_SUFFIX_LAYERS = 2;
const MAX_ROOT_OPTIONS = 6;
const MAX_ETYM_KEY_ROOTS = 25000;

const VERIFIED_SEEDS = Object.freeze([
  { id: 'family:inter', canonical: 'inter', aliases: ['inter'], element_type: 'preposition' },
  { id: 'family:ocul', canonical: 'ocul', aliases: ['ocul', 'okul', 'ocule'], element_type: 'root' },
  { id: 'family:regul', canonical: 'regul', aliases: ['regul', 'regol', 'regule'], element_type: 'root' },
  { id: 'family:alter', canonical: 'alter', aliases: ['alter', 'altern', 'altru'], element_type: 'root' },
  { id: 'family:pede', canonical: 'pede', aliases: ['pede', 'ped', 'pedi'], element_type: 'root' },
  { id: 'family:manu', canonical: 'manu', aliases: ['manu'], element_type: 'root' },
  { id: 'family:libert', canonical: 'libert', aliases: ['libert', 'liberta', 'liber'], element_type: 'root' }
]);

const CONTROL_WORDS = Object.freeze({
  'family:alter': { en: ['alternative', 'altruism'] },
  'family:pede': { en: ['pedal', 'pedicure'] },
  'family:ocul': { en: ['ocular', 'monocle', 'monocular'] },
  'family:regul': { en: ['regular', 'regulation'] },
  'family:manu': { en: ['manual', 'manufacture'] },
  'family:libert': { en: ['liberty'] }
});

const RELATION_NAMES = new Set([
  'der', 'uder', 'bor', 'bor+', 'inh', 'lbor', 'slbor', 'learned borrowing',
  'semi-learned borrowing', 'derived', 'derived from', 'inherited', 'borrowed',
  'etymon', 'ety', 'af', 'affix', 'compound', 'confix', 'blend', 'prefix', 'suffix',
  'clipping of', 'back-form', 'back-formation', 'short for', 'ellipsis of'
]);
const DIRECT_RELATIONS = new Set(['der', 'uder', 'bor', 'bor+', 'inh', 'lbor', 'slbor', 'learned borrowing', 'semi-learned borrowing', 'derived', 'derived from', 'inherited', 'borrowed']);
const COMPONENT_RELATIONS = new Set(['af', 'affix', 'compound', 'confix', 'blend', 'prefix', 'suffix']);
const SAME_LANGUAGE_RELATIONS = new Set(['clipping of', 'back-form', 'back-formation', 'short for', 'ellipsis of']);

function parseArgs(argv) {
  const out = { languages: LANGUAGES };
  for (const arg of argv) {
    if (arg.startsWith('--candidate-root=')) out.candidateRoot = arg.slice(17);
    else if (arg.startsWith('--output-root=')) out.outputRoot = arg.slice(14);
    else if (arg.startsWith('--etymology-gzip=')) out.etymologyGzip = arg.slice(18);
    else if (arg.startsWith('--languages=')) out.languages = arg.slice(12).split(',').map(v => v.trim()).filter(Boolean);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!out.candidateRoot || !out.outputRoot) throw new Error('--candidate-root and --output-root are required');
  if (!out.etymologyGzip) throw new Error('--etymology-gzip is required');
  for (const lang of out.languages) if (!LANGUAGES.includes(lang)) throw new Error(`Unsupported language: ${lang}`);
  return out;
}

const nfcLower = value => String(value || '').normalize('NFC').toLocaleLowerCase('und').trim();
const rootNorm = value => buildSearchForm(value).replace(/[^a-z0-9]/g, '');
const sha12 = value => createHash('sha1').update(value).digest('hex').slice(0, 12);

function suffixesFor(language) {
  return [...new Set((getAffixSearchConfig(language).suffixes || [])
    .map(rootNorm)
    .filter(x => x.length >= 2 && x.length <= 12))]
    .sort((a, b) => b.length - a.length || a.localeCompare(b));
}

const suffixCache = new Map();
function rootOptions(searchForm, language) {
  const text = buildSearchForm(searchForm);
  if (!text) return [];
  let suffixes = suffixCache.get(language);
  if (!suffixes) { suffixes = suffixesFor(language); suffixCache.set(language, suffixes); }
  const byRoot = new Map();
  const put = option => {
    if (!option.root || option.root.length < MIN_ROOT) return;
    const prev = byRoot.get(option.root);
    if (!prev || option.removed > prev.removed || (option.removed === prev.removed && option.boundaryStart > prev.boundaryStart)) byRoot.set(option.root, option);
  };
  for (const boundary of rootBoundarySegments(text, language)) {
    const segment = rootNorm(text.slice(boundary.start, boundary.end));
    if (segment.length < MIN_ROOT) continue;
    put({ root: segment, removed: 0, layers: 0, boundaryStart: boundary.start, boundaryKind: boundary.kind });
    let frontier = [{ form: segment, removed: 0 }];
    for (let layer = 1; layer <= MAX_SUFFIX_LAYERS; layer += 1) {
      const next = [];
      for (const state of frontier) {
        for (const suffix of suffixes) {
          if (!state.form.endsWith(suffix)) continue;
          const stem = state.form.slice(0, -suffix.length);
          if (stem.length < MIN_ROOT) continue;
          const item = { root: stem, removed: state.removed + suffix.length, layers: layer, boundaryStart: boundary.start, boundaryKind: boundary.kind };
          put(item);
          next.push({ form: stem, removed: item.removed });
        }
      }
      if (!next.length) break;
      frontier = next;
    }
  }
  return [...byRoot.values()]
    .sort((a, b) => b.root.length - a.root.length || b.removed - a.removed || a.root.localeCompare(b.root))
    .slice(0, MAX_ROOT_OPTIONS);
}

function choosePrimary(options, counts) {
  if (!options.length) return '';
  let best = options[0];
  let bestScore = -Infinity;
  for (const option of options) {
    const support = counts.get(option.root) || 1;
    let score = Math.min(12, Math.log2(support + 1)) * 2.2;
    score += Math.min(10, option.root.length) * 0.18;
    score += option.removed > 0 ? Math.min(8, option.removed) * 0.65 + 1.5 : 0;
    score += option.boundaryStart > 0 ? 0.8 : 0;
    if (option.root.length === 3) score -= 3.5;
    if (option.removed > 0 && support < 2) score -= 2.5;
    if (score > bestScore || (score === bestScore && option.root.length > best.root.length)) { best = option; bestScore = score; }
  }
  return best.root;
}

async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }
async function* candidateRows(candidateRoot, manifest, language) {
  const meta = manifest.languages?.[language];
  if (!meta) throw new Error(`Candidate index missing language ${language}`);
  for (const shard of meta.shards || []) {
    const rows = await readJson(join(candidateRoot, shard.file));
    if (!Array.isArray(rows)) throw new Error(`Candidate shard is not an array: ${shard.file}`);
    for (const row of rows) yield row;
  }
}

async function buildPrimaryRoots(candidateRoot, manifest, languages) {
  const wordRoots = Object.fromEntries(languages.map(lang => [lang, new Map()]));
  const rootSupport = Object.fromEntries(languages.map(lang => [lang, new Map()]));
  const countsByLanguage = {};
  for (const language of languages) {
    const counts = rootSupport[language];
    let words = 0;
    for await (const row of candidateRows(candidateRoot, manifest, language)) {
      const seen = new Set();
      for (const option of rootOptions(row.search_form || row.word, language)) {
        if (seen.has(option.root)) continue;
        seen.add(option.root);
        counts.set(option.root, (counts.get(option.root) || 0) + 1);
      }
      words += 1;
    }
    countsByLanguage[language] = words;
    console.error(`[families] ${language}: counted root options for ${words} lemmas (${counts.size} roots)`);
    let assigned = 0;
    for await (const row of candidateRows(candidateRoot, manifest, language)) {
      const key = nfcLower(row.normalized || row.word);
      const options = rootOptions(row.search_form || row.word, language);
      const root = choosePrimary(options, counts) || rootNorm(row.search_form || row.word) || rootNorm(row.word);
      wordRoots[language].set(key, root);
      assigned += 1;
    }
    console.error(`[families] ${language}: assigned primary roots to ${assigned} lemmas`);
  }
  return { wordRoots, rootSupport, countsByLanguage };
}

function normalizeEtymonTerm(value) {
  let term = String(value || '').replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim();
  term = term.replace(/^\*+/, '').replace(/[“”"'`´]/g, '').replace(/\([^)]*\)/g, '').trim();
  term = term.normalize('NFKD').replace(/\p{M}+/gu, '').toLocaleLowerCase('und');
  term = term.replace(/æ/g, 'ae').replace(/œ/g, 'oe').replace(/ß/g, 'ss');
  term = term.replace(/^[^\p{L}\p{N}-]+|[^\p{L}\p{N}-]+$/gu, '');
  if (!term || term.includes(' ') || term.includes('/') || term.startsWith('-') || term.endsWith('-')) return '';
  return term;
}

function isProtoLanguage(code) {
  const c = String(code || '').toLowerCase();
  return c.endsWith('-pro') || c === 'ine-pro' || c.includes('proto');
}

function etymonKeys(language, term) {
  const lang = String(language || '').toLowerCase();
  const normalized = normalizeEtymonTerm(term);
  if (!lang || !normalized || normalized.length < 3) return [];
  const keys = new Set([`${lang}:${normalized}`]);
  if (lang === 'la' || lang === 'la-lat' || lang === 'la-vul') {
    for (const ending of ['ibus','arum','orum','ium','ae','am','em','is','os','as','um','us','i','o','a','e']) {
      if (!normalized.endsWith(ending)) continue;
      const stem = normalized.slice(0, -ending.length);
      if (stem.length >= 4) keys.add(`la:${stem}`);
    }
  }
  return [...keys];
}

function numericArgs(args, start = 1) {
  return Object.entries(args || {})
    .filter(([key]) => /^\d+$/.test(key) && Number(key) >= start)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, value]) => String(value || ''));
}

function pairsFromExpansion(expansion) {
  const text = String(expansion || '');
  const out = [];
  const patterns = [
    /"lang"\s*:\s*"([^"]+)"[\s\S]{0,220}?"term"\s*:\s*"([^"]+)"/g,
    /"term"\s*:\s*"([^"]+)"[\s\S]{0,220}?"lang"\s*:\s*"([^"]+)"/g
  ];
  let match;
  while ((match = patterns[0].exec(text))) out.push([match[1], match[2]]);
  while ((match = patterns[1].exec(text))) out.push([match[2], match[1]]);
  return out;
}

function etymologyPairs(entry) {
  const out = [];
  for (const template of entry.etymology_templates || []) {
    const name = String(template?.name || '').trim().toLocaleLowerCase('und');
    const args = template?.args || {};
    if (DIRECT_RELATIONS.has(name)) {
      const values = numericArgs(args);
      if (values.length >= 3) out.push([values[1], values[2]]);
    } else if (COMPONENT_RELATIONS.has(name)) {
      const values = numericArgs(args);
      if (values.length >= 2) for (const term of values.slice(1)) out.push([values[0], term]);
    } else if (SAME_LANGUAGE_RELATIONS.has(name)) {
      const values = numericArgs(args);
      if (values.length >= 2) out.push([values[0], values[1]]);
    } else if (name === 'etymon' || name === 'ety') {
      // New Wiktionary etymology-tree templates carry the full ancestry in their expansion.
    }
    if (RELATION_NAMES.has(name) || name === 'etymon' || name === 'ety') out.push(...pairsFromExpansion(template.expansion));
  }
  return out;
}

async function scanEtymologies(gzipPath, wordRoots, languages) {
  const nonProto = new Map();
  const proto = new Map();
  const coverage = Object.fromEntries(languages.map(lang => [lang, { matched_entries: 0, with_etymology: 0, unique_lemmas: new Set() }]));
  const input = createReadStream(gzipPath).pipe(createGunzip());
  const lines = createInterface({ input, crlfDelay: Infinity });
  let parsed = 0;
  for await (const line of lines) {
    if (!line) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    const language = String(entry.lang_code || '').toLowerCase();
    if (!wordRoots[language]) continue;
    const key = nfcLower(entry.word);
    const surfaceRoot = wordRoots[language].get(key);
    if (!surfaceRoot) continue;
    coverage[language].matched_entries += 1;
    coverage[language].unique_lemmas.add(key);
    const pairs = etymologyPairs(entry);
    if (pairs.length) coverage[language].with_etymology += 1;
    const rootNode = `${language}:${surfaceRoot}`;
    const seen = new Set();
    for (const [sourceLang, term] of pairs) {
      for (const etyKey of etymonKeys(sourceLang, term)) {
        if (seen.has(etyKey)) continue;
        seen.add(etyKey);
        const target = isProtoLanguage(sourceLang) ? proto : nonProto;
        let roots = target.get(etyKey);
        if (!roots) { roots = new Set(); target.set(etyKey, roots); }
        if (roots.size <= MAX_ETYM_KEY_ROOTS) roots.add(rootNode);
      }
    }
    parsed += 1;
    if (parsed % 100000 === 0) console.error(`[families] Wiktionary matched ${parsed} entries`);
  }
  const serialCoverage = {};
  for (const [lang, value] of Object.entries(coverage)) serialCoverage[lang] = { matched_entries: value.matched_entries, with_etymology: value.with_etymology, unique_lemmas: value.unique_lemmas.size };
  return { nonProto, proto, coverage: serialCoverage };
}

function supportForNode(node, rootSupport) {
  const cut = node.indexOf(':');
  const lang = node.slice(0, cut);
  const root = node.slice(cut + 1);
  return rootSupport[lang]?.get(root) || 0;
}

function rootOfNode(node) { return node.slice(node.indexOf(':') + 1); }
function langOfNode(node) { return node.slice(0, node.indexOf(':')); }

function queryForms(value) {
  const normalized = rootNorm(value);
  const out = new Set([normalized]);
  if (normalized.length >= 5 && /[aeio]$/.test(normalized)) out.add(normalized.slice(0, -1));
  return [...out].filter(x => x.length >= MIN_ROOT);
}

function buildFamilies(nonProto, proto, rootSupport) {
  const families = new Map();
  const nodeToFamilies = new Map();
  const addNodeFamily = (node, id) => {
    let values = nodeToFamilies.get(node);
    if (!values) { values = new Set(); nodeToFamilies.set(node, values); }
    values.add(id);
  };

  for (const [etyKey, roots] of nonProto) {
    if (roots.size < 2 || roots.size > MAX_ETYM_KEY_ROOTS) continue;
    const nodes = [...roots].sort();
    const id = `ety:${sha12(etyKey)}`;
    const aliases = [...new Set(nodes.map(rootOfNode))].sort();
    const family = { id, canonical: '', aliases, etymon_keys: [etyKey], root_nodes: nodes, verified: false, confidence: 'A', source: 'wiktionary_non_proto_etymology' };
    families.set(id, family);
    for (const node of nodes) addNodeFamily(node, id);
  }

  // Seed families from the methodology and manually verified historical allomorphs.
  for (const seed of VERIFIED_SEEDS) {
    if (seed.element_type === 'preposition') {
      families.set(seed.id, { ...seed, verified: true, confidence: 'A', source: 'methodology_seed', root_nodes: [], etymon_keys: [] });
      continue;
    }
    const wanted = new Set(seed.aliases.flatMap(queryForms));
    const absorbed = new Set();
    for (const [id, family] of families) {
      if (id === seed.id) continue;
      if (family.aliases.some(alias => wanted.has(alias))) {
        for (const node of family.root_nodes) absorbed.add(node);
      }
    }
    for (const [lang, counts] of Object.entries(rootSupport)) {
      for (const alias of wanted) if (counts.has(alias)) absorbed.add(`${lang}:${alias}`);
    }
    const aliases = [...new Set([...seed.aliases.flatMap(queryForms), ...[...absorbed].map(rootOfNode)])].sort();
    const etymonKeys = [];
    for (const family of families.values()) if (family.id !== seed.id && family.root_nodes?.some(node => absorbed.has(node))) etymonKeys.push(...family.etymon_keys);
    const seeded = { ...seed, aliases, root_nodes: [...absorbed].sort(), etymon_keys: [...new Set(etymonKeys)].sort(), verified: true, confidence: 'A', source: 'methodology_seed+wiktionary' };
    families.set(seed.id, seeded);
    for (const node of absorbed) addNodeFamily(node, seed.id);
  }

  // Choose a stable canonical alias for automatically generated families.
  for (const family of families.values()) {
    if (family.canonical) continue;
    family.canonical = family.aliases.slice().sort((a, b) => a.length - b.length || a.localeCompare(b))[0] || '';
  }

  const protoReview = [];
  for (const [etyKey, roots] of proto) {
    if (roots.size < 2 || roots.size > 2000) continue;
    const nodes = [...roots];
    const distinctAliases = new Set(nodes.map(rootOfNode));
    if (distinctAliases.size < 2) continue;
    let alreadyConnected = false;
    const first = nodeToFamilies.get(nodes[0]);
    if (first) {
      for (const familyId of first) {
        if (nodes.filter(node => nodeToFamilies.get(node)?.has(familyId)).length >= 2) { alreadyConnected = true; break; }
      }
    }
    if (alreadyConnected) continue;
    const support = nodes.reduce((sum, node) => sum + supportForNode(node, rootSupport), 0);
    protoReview.push({ etymon_key: etyKey, aliases: [...distinctAliases].sort(), root_nodes: nodes.sort(), support });
  }
  protoReview.sort((a, b) => b.support - a.support || b.aliases.length - a.aliases.length || a.etymon_key.localeCompare(b.etymon_key));
  return { families, nodeToFamilies, protoReview };
}

function familyForSeedAlias(families, seedId) { return families.get(seedId) || null; }

async function writeAssignments({ candidateRoot, manifest, languages, outputRoot, wordRoots, nodeToFamilies, families, controls }) {
  await mkdir(join(outputRoot, 'assignments'), { recursive: true });
  const stats = {};
  for (const language of languages) {
    const file = join(outputRoot, 'assignments', `${language}.jsonl.gz`);
    const gzip = createGzip({ level: 9 });
    const output = createWriteStream(file);
    gzip.pipe(output);
    let total = 0;
    let merged = 0;
    let ambiguous = 0;
    for await (const row of candidateRows(candidateRoot, manifest, language)) {
      const wordKey = nfcLower(row.normalized || row.word);
      const root = wordRoots[language].get(wordKey) || rootNorm(row.search_form || row.word);
      const node = `${language}:${root}`;
      const ids = [...(nodeToFamilies.get(node) || [])].sort();
      const familyIds = ids.length ? ids : [`surface:${language}:${root}`];
      if (ids.length) merged += 1;
      if (familyIds.length > 1) ambiguous += 1;
      const payload = [row.word, root, familyIds];
      if (!gzip.write(`${JSON.stringify(payload)}\n`)) await once(gzip, 'drain');
      total += 1;
      for (const [seedId, perLang] of Object.entries(CONTROL_WORDS)) {
        const expected = perLang[language];
        if (!expected?.includes(wordKey)) continue;
        controls[seedId] ||= {};
        controls[seedId][language] ||= {};
        controls[seedId][language][wordKey] = { family_ids: familyIds, ok: familyIds.includes(seedId) };
      }
    }
    gzip.end();
    await once(output, 'finish');
    stats[language] = { total, merged_family_entries: merged, ambiguous_family_entries: ambiguous };
  }
  return stats;
}

function compactFamily(family, rootSupport) {
  const languages = {};
  let support = 0;
  for (const node of family.root_nodes || []) {
    const lang = langOfNode(node);
    const value = supportForNode(node, rootSupport);
    languages[lang] = (languages[lang] || 0) + value;
    support += value;
  }
  return {
    id: family.id,
    canonical: family.canonical,
    aliases: family.aliases,
    verified: Boolean(family.verified),
    confidence: family.confidence,
    source: family.source,
    etymon_keys: family.etymon_keys || [],
    language_support: languages,
    support
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await rm(options.outputRoot, { recursive: true, force: true });
  await mkdir(options.outputRoot, { recursive: true });
  const manifest = await readJson(join(options.candidateRoot, 'manifest.json'));

  console.error('[families] pass 1/2: deriving a primary surface family for every lemma');
  const primary = await buildPrimaryRoots(options.candidateRoot, manifest, options.languages);

  console.error('[families] pass 3: streaming Wiktionary/Kaikki etymology for every indexed lemma');
  const ety = await scanEtymologies(options.etymologyGzip, primary.wordRoots, options.languages);
  console.error(`[families] non-proto etymon keys=${ety.nonProto.size}; proto review keys=${ety.proto.size}`);

  console.error('[families] pass 4: creating and merging associative families');
  const built = buildFamilies(ety.nonProto, ety.proto, primary.rootSupport);
  const controls = {};
  const assignmentStats = await writeAssignments({
    candidateRoot: options.candidateRoot,
    manifest,
    languages: options.languages,
    outputRoot: options.outputRoot,
    wordRoots: primary.wordRoots,
    nodeToFamilies: built.nodeToFamilies,
    families: built.families,
    controls
  });

  const familyList = [...built.families.values()]
    .map(family => compactFamily(family, primary.rootSupport))
    .sort((a, b) => Number(b.verified) - Number(a.verified) || b.support - a.support || a.id.localeCompare(b.id));
  const lookup = {};
  for (const family of familyList) {
    for (const alias of family.aliases) {
      const key = rootNorm(alias);
      if (!key) continue;
      const values = lookup[key] ||= [];
      values.push({ id: family.id, canonical: family.canonical, verified: family.verified, confidence: family.confidence, source: family.source, support: family.support });
    }
  }
  for (const values of Object.values(lookup)) values.sort((a, b) => Number(b.verified) - Number(a.verified) || b.support - a.support || a.id.localeCompare(b.id));

  const controlSummary = {};
  let controlsOk = true;
  for (const [seedId, perLang] of Object.entries(CONTROL_WORDS)) {
    const rows = controls[seedId] || {};
    const checks = [];
    for (const [lang, words] of Object.entries(perLang)) {
      for (const word of words) {
        const result = rows?.[lang]?.[word];
        if (!result) checks.push({ language: lang, word, present: false, ok: null });
        else checks.push({ language: lang, word, present: true, ok: result.ok, family_ids: result.family_ids });
      }
    }
    const presentChecks = checks.filter(item => item.present);
    const ok = presentChecks.length > 0 && presentChecks.every(item => item.ok);
    controlSummary[seedId] = { ok, checks };
    if (!ok) controlsOk = false;
  }

  const review = built.protoReview.slice(0, 5000);
  const report = {
    version: INDEX_VERSION,
    generated_at: new Date().toISOString(),
    languages: options.languages,
    source_entries: primary.countsByLanguage,
    assignment_stats: assignmentStats,
    etymology_coverage: ety.coverage,
    merged_families: familyList.length,
    generated_non_proto_families: familyList.filter(item => item.source === 'wiktionary_non_proto_etymology').length,
    verified_seed_families: familyList.filter(item => item.verified).length,
    aliases_in_lookup: Object.keys(lookup).length,
    proto_review_candidates: built.protoReview.length,
    controls: controlSummary,
    controls_ok: controlsOk,
    largest_families: familyList.slice().sort((a, b) => b.support - a.support).slice(0, 100)
  };

  await writeFile(join(options.outputRoot, 'families.json'), `${JSON.stringify(familyList)}\n`);
  await writeFile(join(options.outputRoot, 'lookup.json'), `${JSON.stringify(lookup)}\n`);
  await writeFile(join(options.outputRoot, 'proto-review.json'), `${JSON.stringify(review, null, 2)}\n`);
  await writeFile(join(options.outputRoot, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!controlsOk) process.exitCode = 2;
}

main().catch(error => { console.error(error?.stack || error?.message || error); process.exitCode = 1; });
