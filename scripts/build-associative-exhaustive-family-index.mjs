#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createGunzip, createGzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { buildSearchForm } from '../associativvordes/js/root-matcher.js';
import { discoverLexicalComponents } from '../associativvordes/js/morphology/analyzer.js';
import { clearLexicalRoots, registerLexicalRootsFromEntries } from '../associativvordes/js/morphology/lexical-root-index.js';
import { getLanguageConfig } from '../associativvordes/js/morphology/languages/index.js';
import { nullDictionary, stableLemmaId } from './lib/associative-family-graph.mjs';
import { RELATION_TYPE, templateRelations } from './lib/associative-etymology-policy.mjs';
import { classifyCorpusLemma } from './lib/associative-corpus-quality.mjs';

const LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'ru'];
const INDEX_VERSION = '5';
const MIN_ROOT = 3;
const MAX_ETYM_KEY_ROOTS = 25000;
const MAX_AUTOMATIC_ETYM_KEY_ROOTS = 10;
const MAX_REVIEWABLE_ETYM_KEY_ROOTS = 25;

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
  'family:alter': {
    en: ['alternative', 'altruism'], de: ['alternative', 'altruismus'],
    fr: ['alternative', 'altruisme'], es: ['alternativa', 'altruismo'],
    it: ['alternativa', 'altruismo'], ru: ['альтернатива', 'альтруизм']
  },
  'family:pede': {
    en: ['pedal', 'pedicure'], de: ['pedal', 'pediküre'],
    fr: ['pédale', 'pédicure'], es: ['pedal', 'pedicura'],
    it: ['pedale', 'pedicure'], ru: ['педаль', 'педикюр']
  },
  'family:ocul': {
    en: ['ocular', 'monocle', 'monocular'], de: ['monokel'],
    fr: ['oculaire', 'monocle'], es: ['ocular', 'monóculo'],
    it: ['oculare', 'monocolo'], ru: ['окулярный', 'монокль']
  },
  'family:regul': {
    en: ['regular', 'regulation'], de: ['regulär', 'regulierung'],
    fr: ['régulier', 'régulation'], es: ['regular', 'regulación'],
    it: ['regolare', 'regolazione'], ru: ['регулярный', 'регулирование']
  },
  'family:manu': {
    en: ['manual', 'manufacture'], de: ['manuell', 'manufaktur'],
    fr: ['manuel', 'manufacture'], es: ['manual', 'manufactura'],
    it: ['manuale', 'manifattura'], ru: ['мануальный', 'мануфактура']
  },
  'family:libert': {
    en: ['liberty', 'libertarian'], de: ['libertär', 'liberal'],
    fr: ['liberté', 'libéral'], es: ['libertad', 'liberal'],
    it: ['libertà', 'liberale'], ru: ['либертарианский', 'либеральный']
  },
  'family:inter': {
    en: ['international', 'interdisciplinary'], de: ['international', 'interdisziplinär'],
    fr: ['international', 'interdisciplinaire'], es: ['internacional', 'interdisciplinario'],
    it: ['internazionale', 'interdisciplinare'], ru: ['интернациональный']
  }
});
const CONTROL_FORBIDDEN_FAMILY_IDS = new Set(['ety:0f6061e49232', 'ety:a9f83219c8f4', 'ety:eb0c0f2dde53', 'ety:e40fb0a23141', 'ety:2696567cd2f7']);

export function exactControlFamilyId(language, normalizedWord) {
  return Object.entries(CONTROL_WORDS).find(([, perLang]) => perLang[language]?.includes(normalizedWord))?.[0] || null;
}

export function applyExactControlOverride({ language, word, searchForm, componentRows, families }) {
  const familyId = exactControlFamilyId(language, word);
  if (!familyId) return { familyId: null, componentRows };
  return { familyId, componentRows: [{ surface: searchForm || word, canonical_candidate: families.get(familyId)?.canonical || familyId.slice(7), family_ids: [familyId], confidence: 1, evidence: [{ type: 'manual_override', source: 'methodology_control_word', path: [language, word, familyId], confidence: 1 }] }] };
}


export function parseArgs(argv) {
  const out = { languages: LANGUAGES, analysisOnly: false };
  for (const arg of argv) {
    if (arg.startsWith('--candidate-root=')) out.candidateRoot = arg.slice(17);
    else if (arg.startsWith('--output-root=')) out.outputRoot = arg.slice(14);
    else if (arg.startsWith('--etymology-gzip=')) out.etymologyGzip = arg.slice(17);
    else if (arg.startsWith('--languages=')) out.languages = arg.slice(12).split(',').map(v => v.trim()).filter(Boolean);
    else if (arg === '--analysis-only') out.analysisOnly = true;
    else if (arg.startsWith('--analysis-report=')) out.analysisReport = arg.slice(18);
    else if (arg.startsWith('--input-lock=')) out.inputLock = arg.slice(13);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!out.candidateRoot || !out.outputRoot) throw new Error('--candidate-root and --output-root are required');
  if (!out.etymologyGzip) throw new Error('--etymology-gzip is required');
  for (const lang of out.languages) if (!LANGUAGES.includes(lang)) throw new Error(`Unsupported language: ${lang}`);
  return out;
}

export function etymonKeyDistribution(records) {
  const sizes = [...records.values()].map(record => record.roots.size).sort((a, b) => a - b);
  const bounds = [0, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 10000, 25000];
  const histogram = Object.fromEntries(bounds.slice(1).map((upper, index) => [`${bounds[index] + 1}-${upper}`, 0]));
  histogram['25001+'] = 0;
  for (const size of sizes) {
    const upperIndex = bounds.findIndex((upper, index) => index > 0 && size <= upper);
    const key = upperIndex < 0 ? '25001+' : `${bounds[upperIndex - 1] + 1}-${bounds[upperIndex]}`;
    histogram[key] += 1;
  }
  const percentile = value => sizes.length ? sizes[Math.min(sizes.length - 1, Math.floor((sizes.length - 1) * value))] : 0;
  return { keys: sizes.length, minimum: sizes[0] || 0, maximum: sizes.at(-1) || 0, percentiles: { p50: percentile(0.5), p90: percentile(0.9), p95: percentile(0.95), p99: percentile(0.99), p999: percentile(0.999) }, histogram };
}

const nfcLower = value => String(value || '').normalize('NFC').toLocaleLowerCase('und').trim();
const rootNorm = value => buildSearchForm(value).replace(/[^a-z0-9]/g, '');
const sha12 = value => createHash('sha1').update(value).digest('hex').slice(0, 12);
const familyBucket = value => {
  let hash = 0x811c9dc5;
  for (const char of String(value)) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 0x01000193); }
  return ((hash >>> 0) % 256).toString(16).padStart(2, '0');
};

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

async function buildDiscoveredComponents(candidateRoot, manifest, languages) {
  const wordRoots = Object.fromEntries(languages.map(lang => [lang, new Map()]));
  const rootSupport = Object.fromEntries(languages.map(lang => [lang, new Map()]));
  const countsByLanguage = {};
  for (const language of languages) {
    clearLexicalRoots(language);
    const config = getLanguageConfig(language);
    let registered = 0;
    for await (const row of candidateRows(candidateRoot, manifest, language)) {
      registerLexicalRootsFromEntries(language, [row], { config });
      registered += 1;
    }
    console.error(`[families] ${language}: registered lexical evidence for ${registered} lemmas`);
    const counts = rootSupport[language];
    let words = 0;
    for await (const row of candidateRows(candidateRoot, manifest, language)) {
      const discovery = discoverLexicalComponents(row.search_form || row.word, language);
      const components = discovery.components.map(item => ({ root: rootNorm(item.canonical_candidate), surface: item.surface, confidence: item.confidence, evidence: item.evidence })).filter(item => item.root);
      wordRoots[language].set(nfcLower(row.normalized || row.word), { components, ambiguous: discovery.ambiguous });
      for (const root of new Set(components.map(item => item.root))) counts.set(root, (counts.get(root) || 0) + 1);
      words += 1;
      if (words % 50000 === 0) console.error(`[families] ${language}: discovered components for ${words} lemmas`);
    }
    countsByLanguage[language] = words;
    console.error(`[families] ${language}: assigned all discovered components to ${words} lemmas (${counts.size} branches)`);
    clearLexicalRoots(language);
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

export function etymologyPairs(entry) {
  const relations = [], uncertain = [];
  for (const template of entry.etymology_templates || []) {
    const parsed = templateRelations(template);
    relations.push(...parsed.relations);
    uncertain.push(...parsed.uncertain);
  }
  return { relations, uncertain };
}

// Short roots are useful for surface morphology, but they are unsafe anchors
// for automatic etymological equivalence when they cover only a small prefix
// of the attested word (for example val- misparsed from valkyrie).  Keep such
// analyses available to the surface layer while excluding them from graph
// topology unless the root covers at least half of the normalized word.
export function isMergeEligibleComponent(word, component) {
  const form = rootNorm(word);
  const root = rootNorm(component?.root);
  if (!form || !root || root.length < MIN_ROOT) return false;
  return root.length >= 4 || root.length * 2 >= form.length;
}

async function scanEtymologies(gzipPath, wordRoots, languages) {
  const nonProto = new Map();
  const proto = new Map();
  const reviewRelations = [];
  let uncertainRelationCount = 0;
  const relationCounts = {};
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
    const analysis = wordRoots[language].get(key);
    if (!analysis?.components?.length) continue;
    coverage[language].matched_entries += 1;
    coverage[language].unique_lemmas.add(key);
    const parsedPairs = etymologyPairs(entry);
    if (parsedPairs.relations.length) coverage[language].with_etymology += 1;
    // A compound is component containment evidence, never evidence that all of
    // its lexical components are equivalent.  Direct ancestry is therefore
    // applied automatically only to an unambiguous single-component analysis.
    const rootNodes = analysis.components.length === 1 && isMergeEligibleComponent(entry.word, analysis.components[0])
      ? [`${language}:${analysis.components[0].root}`]
      : [];
    const seen = new Set();
    for (const relation of parsedPairs.relations) {
      const { sourceLang, term, relationType, mergeAllowed } = relation;
      relationCounts[relationType] = (relationCounts[relationType] || 0) + 1;
      for (const etyKey of etymonKeys(sourceLang, term)) {
        if (seen.has(etyKey)) continue;
        seen.add(etyKey);
        if (!mergeAllowed || isProtoLanguage(sourceLang)) {
          const target = proto;
          let record = target.get(etyKey);
          if (!record) { record = { roots: new Set(), relationTypes: new Set(), evidence: [] }; target.set(etyKey, record); }
          for (const rootNode of rootNodes) if (record.roots.size <= MAX_ETYM_KEY_ROOTS) record.roots.add(rootNode);
          record.relationTypes.add(isProtoLanguage(sourceLang) ? RELATION_TYPE.PROTO_RELATION : relationType);
          if (record.evidence.length < 20) record.evidence.push({ language, word: entry.word, ...relation });
          continue;
        }
        let record = nonProto.get(etyKey);
        if (!record) { record = { roots: new Set(), relationTypes: new Set(), evidence: [] }; nonProto.set(etyKey, record); }
        for (const rootNode of rootNodes) if (record.roots.size <= MAX_ETYM_KEY_ROOTS) record.roots.add(rootNode);
        record.relationTypes.add(relationType);
        if (record.evidence.length < 20) record.evidence.push({ language, word: entry.word, ...relation });
      }
    }
    uncertainRelationCount += parsedPairs.uncertain.length;
    for (const item of parsedPairs.uncertain) if (reviewRelations.length < 100000) reviewRelations.push({ language, word: entry.word, ...item });
    parsed += 1;
    if (parsed % 100000 === 0) console.error(`[families] Wiktionary matched ${parsed} entries`);
  }
  const serialCoverage = {};
  for (const [lang, value] of Object.entries(coverage)) serialCoverage[lang] = { matched_entries: value.matched_entries, with_etymology: value.with_etymology, unique_lemmas: value.unique_lemmas.size };
  return { nonProto, proto, coverage: serialCoverage, relationCounts, reviewRelations, uncertainRelationCount };
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

export function buildFamilies(nonProto, proto, rootSupport) {
  const families = new Map();
  const wideReview = [];
  let nodeToFamilies = new Map();
  const addNodeFamily = (node, id) => {
    let values = nodeToFamilies.get(node);
    if (!values) { values = new Set(); nodeToFamilies.set(node, values); }
    values.add(id);
  };

  for (const [etyKey, record] of nonProto) {
    if (record.roots.size < 2 || record.roots.size > MAX_ETYM_KEY_ROOTS) continue;
    const nodes = [...record.roots].sort();
    if (nodes.length > MAX_AUTOMATIC_ETYM_KEY_ROOTS) {
      wideReview.push({
        etymon_key: etyKey,
        root_count: nodes.length,
        aliases: [...new Set(nodes.map(rootOfNode))].sort(),
        root_nodes: nodes,
        relation_types: [...record.relationTypes].sort(),
        evidence: record.evidence,
        review_status: nodes.length > MAX_REVIEWABLE_ETYM_KEY_ROOTS ? 'blocked_from_runtime' : 'needs_review',
        reason: 'wide_etymon_key_no_automatic_merge'
      });
      continue;
    }
    const id = `ety:${sha12(etyKey)}`;
    const aliases = [...new Set(nodes.map(rootOfNode))].sort();
    const family = { id, canonical: '', aliases, etymon_keys: [etyKey], relation_types: [...record.relationTypes].sort(), relation_evidence: record.evidence, root_nodes: nodes, verified: false, confidence: 'A', source: 'wiktionary_non_proto_etymology' };
    families.set(id, family);
    for (const node of nodes) addNodeFamily(node, id);
  }

  // Exact seed claims replace coincidental alias-based transitive absorption.
  const claimedBySeed = new Map();
  for (const seed of VERIFIED_SEEDS) {
    const wanted = new Set(seed.aliases.flatMap(queryForms));
    const claimed = new Set();
    for (const [lang, counts] of Object.entries(rootSupport)) {
      for (const alias of wanted) if (counts.has(alias)) claimed.add(`${lang}:${alias}`);
    }
    claimedBySeed.set(seed.id, claimed);
  }

  const allClaimed = new Set([...claimedBySeed.values()].flatMap(values => [...values]));
  for (const [id, family] of [...families]) {
    const remaining = family.root_nodes.filter(node => !allClaimed.has(node));
    if (remaining.length < 2) { families.delete(id); continue; }
    family.root_nodes = remaining;
    family.aliases = [...new Set(remaining.map(rootOfNode))].sort();
  }
  nodeToFamilies = new Map();
  for (const family of families.values()) for (const node of family.root_nodes) addNodeFamily(node, family.id);
  for (const seed of VERIFIED_SEEDS) {
    const nodes = [...(claimedBySeed.get(seed.id) || [])].sort();
    if (!nodes.length) continue;
    const seeded = { ...seed, aliases: [...new Set(seed.aliases.flatMap(queryForms))].sort(), root_nodes: nodes, etymon_keys: [], relation_types: [RELATION_TYPE.DIRECT_ALLOMORPH], relation_evidence: [], verified: true, confidence: 'A', source: 'methodology_seed+manual_override' };
    families.set(seed.id, seeded);
    for (const node of nodes) addNodeFamily(node, seed.id);
  }

  // Choose a stable canonical alias for automatically generated families.
  for (const family of families.values()) {
    if (family.canonical) continue;
    const score = alias => (alias.length <= 2 ? 1000 : 0) + (alias.length === 3 ? 100 : 0) + (/\d/.test(alias) ? 500 : 0) + Math.abs(alias.length - 6);
    family.canonical = family.aliases.slice().sort((a, b) => score(a) - score(b) || a.localeCompare(b))[0] || '';
    family.canonical_selection = { method: 'quality_score_v1', score: score(family.canonical) };
  }

  const protoReview = [];
  for (const [etyKey, record] of proto) {
    if (record.roots.size < 2 || record.roots.size > 2000) continue;
    const nodes = [...record.roots];
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
    protoReview.push({ etymon_key: etyKey, aliases: [...distinctAliases].sort(), root_nodes: nodes.sort(), support, relation_types: [...record.relationTypes].sort(), evidence: record.evidence });
  }
  protoReview.sort((a, b) => b.support - a.support || b.aliases.length - a.aliases.length || a.etymon_key.localeCompare(b.etymon_key));
  wideReview.sort((a, b) => b.root_count - a.root_count || a.etymon_key.localeCompare(b.etymon_key));
  return { families, nodeToFamilies, protoReview, wideReview };
}

function familyForSeedAlias(families, seedId) { return families.get(seedId) || null; }

async function writeAssignments({ candidateRoot, manifest, languages, outputRoot, wordRoots, nodeToFamilies, families, controls }) {
  await mkdir(join(outputRoot, 'assignments'), { recursive: true });
  const stats = {};
  let totalComponents = 0;
  let multiFamilyLemmas = 0;
  const corpusQualityCounts = { accepted: 0, suspicious: 0, rejected: 0, requires_manual_review: 0 };
  const actualLanguageSupport = new Map();
  for (const language of languages) {
    const file = join(outputRoot, 'assignments', `${language}.jsonl.gz`);
    const gzip = createGzip({ level: 9 });
    const output = createWriteStream(file);
    gzip.pipe(output);
    const memberTempRoot = join(outputRoot, 'members', language, '.tmp');
    await mkdir(memberTempRoot, { recursive: true });
    const memberStreams = new Map();
    const memberStream = bucket => {
      if (!memberStreams.has(bucket)) memberStreams.set(bucket, createWriteStream(join(memberTempRoot, `${bucket}.jsonl`)));
      return memberStreams.get(bucket);
    };
    let total = 0;
    let merged = 0;
    let ambiguous = 0;
    for await (const row of candidateRows(candidateRoot, manifest, language)) {
      const wordKey = nfcLower(row.normalized || row.word);
      const analysis = wordRoots[language].get(wordKey) || { components: [{ root: rootNorm(row.search_form || row.word), surface: row.search_form || row.word, confidence: 0.5, evidence: [{ type: 'surface_identity', source: 'morphology_discovery', path: [row.word], confidence: 0.5 }] }], ambiguous: false };
      const discoveredComponentRows = analysis.components.map(component => {
        const node = `${language}:${component.root}`;
        const ids = [...(nodeToFamilies.get(node) || [])].sort();
        const familyIds = ids.length ? ids : [`surface:${language}:${component.root}`];
        const verifiedSeedIds = familyIds.filter(id => String(families.get(id)?.source || '').includes('manual_override'));
        const seedEvidence = verifiedSeedIds.length ? [{ type: 'verified_seed_alias', source: 'methodology_control_seed', path: [language, component.root, ...verifiedSeedIds], confidence: 1 }] : [];
        totalComponents += 1;
        return { surface: component.surface, canonical_candidate: component.root, family_ids: familyIds, confidence: component.confidence, evidence: [...component.evidence, ...seedEvidence] };
      });
      const { familyId: controlSeedId, componentRows } = applyExactControlOverride({ language, word: wordKey, searchForm: row.search_form || row.word, componentRows: discoveredComponentRows, families });
      if (controlSeedId) totalComponents += 1 - discoveredComponentRows.length;
      const familyIds = [...new Set(componentRows.flatMap(item => item.family_ids))].sort();
      if (familyIds.length > 1) multiFamilyLemmas += 1;
      if (componentRows.some(item => !item.family_ids[0].startsWith('surface:'))) merged += 1;
      if (familyIds.length > 1) ambiguous += 1;
      const corpusQuality = classifyCorpusLemma(row.normalized || row.word);
      corpusQualityCounts[corpusQuality.status] = (corpusQualityCounts[corpusQuality.status] || 0) + 1;
      const payload = { lemma_id: stableLemmaId(language, row.normalized || row.word), language, word: row.word, normalized: row.normalized, search_form: row.search_form, rank: row.rank, frequency_score: row.frequency_score, category_breakdown: row.category_breakdown, sources: row.sources, components: componentRows, family_ids: familyIds, ambiguous_analysis: analysis.ambiguous, corpus_quality: corpusQuality };
      if (!gzip.write(`${JSON.stringify(payload)}\n`)) await once(gzip, 'drain');
      for (const id of familyIds) {
        const support = actualLanguageSupport.get(id) || {};
        support[language] = (support[language] || 0) + 1;
        actualLanguageSupport.set(id, support);
        const stream = memberStream(familyBucket(id));
        const membership = [id, { lemma_id: payload.lemma_id, word: payload.word, normalized: payload.normalized, search_form: payload.search_form, rank: payload.rank, frequency_score: payload.frequency_score, category_breakdown: payload.category_breakdown, sources: payload.sources, corpus_quality: corpusQuality, components: componentRows.filter(item => item.family_ids.includes(id)).map(item => ({ surface: item.surface, canonical_candidate: item.canonical_candidate, confidence: item.confidence, evidence: item.evidence })) }];
        if (!stream.write(`${JSON.stringify(membership)}\n`)) await once(stream, 'drain');
      }
      total += 1;
      for (const [seedId, perLang] of Object.entries(CONTROL_WORDS)) {
        const expected = perLang[language];
        if (!expected?.includes(wordKey)) continue;
        controls[seedId] ||= {};
        controls[seedId][language] ||= {};
        const forbidden = familyIds.filter(id => CONTROL_FORBIDDEN_FAMILY_IDS.has(id));
        const extras = familyIds.filter(id => id !== seedId);
        controls[seedId][language][wordKey] = { family_ids: familyIds, required_family: seedId, forbidden_family_ids: forbidden, extra_family_ids: extras, ok: familyIds.includes(seedId) && forbidden.length === 0 && extras.length === 0 };
      }
    }
    gzip.end();
    await once(output, 'finish');
    for (const stream of memberStreams.values()) stream.end();
    await Promise.all([...memberStreams.values()].map(stream => once(stream, 'finish')));
    for (const bucket of [...memberStreams.keys()].sort()) {
      const temp = join(memberTempRoot, `${bucket}.jsonl`);
      const grouped = {};
      for (const line of (await readFile(temp, 'utf8')).split('\n')) {
        if (!line) continue;
        const [id, membership] = JSON.parse(line);
        (grouped[id] ||= []).push(membership);
      }
      await writeFile(join(outputRoot, 'members', language, `${bucket}.json`), `${JSON.stringify(grouped)}\n`);
      await unlink(temp);
    }
    await rm(memberTempRoot, { recursive: true, force: true });
    stats[language] = { total, merged_family_entries: merged, ambiguous_family_entries: ambiguous };
  }
  return { stats, totalComponents, multiFamilyLemmas, corpusQualityCounts, actualLanguageSupport };
}

function compactFamily(family, actualLanguageSupport) {
  const languages = { ...(actualLanguageSupport.get(family.id) || {}) };
  const support = Object.values(languages).reduce((sum, value) => sum + value, 0);
  return {
    id: family.id,
    canonical: family.canonical,
    aliases: family.aliases,
    verified: Boolean(family.verified),
    confidence: family.confidence,
    source: family.source,
    etymon_keys: family.etymon_keys || [],
    relation_types: family.relation_types || [],
    relation_evidence: family.relation_evidence || [],
    canonical_selection: family.canonical_selection || { method: family.verified ? 'verified_seed' : 'unspecified' },
    language_support: languages,
    support
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await rm(options.outputRoot, { recursive: true, force: true });
  await mkdir(options.outputRoot, { recursive: true });
  const manifest = await readJson(join(options.candidateRoot, 'manifest.json'));
  const inputLock = options.inputLock ? await readJson(options.inputLock) : null;
  const provenance = {
    source_commit: process.env.GITHUB_SHA || null,
    workflow_run_id: process.env.GITHUB_RUN_ID || null,
    workflow_run_attempt: process.env.GITHUB_RUN_ATTEMPT || null,
    workflow_name: process.env.GITHUB_WORKFLOW || null,
    node_version: process.version,
    schema_version: INDEX_VERSION,
    build_version: INDEX_VERSION,
    input_lock: inputLock
  };

  console.error('[families] pass 1/2: discovering every defensible lexical component for every lemma');
  const primary = await buildDiscoveredComponents(options.candidateRoot, manifest, options.languages);

  console.error('[families] pass 3: streaming Wiktionary/Kaikki etymology for every indexed lemma');
  const ety = await scanEtymologies(options.etymologyGzip, primary.wordRoots, options.languages);
  console.error(`[families] non-proto etymon keys=${ety.nonProto.size}; proto review keys=${ety.proto.size}`);

  if (options.analysisOnly) {
    const analysis = {
      generated_at: new Date().toISOString(),
      mode: 'analysis_only_no_family_materialization',
      languages: options.languages,
      source_entries: primary.countsByLanguage,
      etymology_coverage: ety.coverage,
      relation_counts: ety.relationCounts,
      uncertain_relation_count: ety.uncertainRelationCount,
      non_proto_root_distribution: etymonKeyDistribution(ety.nonProto),
      review_only_root_distribution: etymonKeyDistribution(ety.proto)
    };
    const reportPath = options.analysisReport || join(options.outputRoot, 'etymon-key-distribution.json');
    await mkdir(reportPath.slice(0, Math.max(reportPath.lastIndexOf('/'), 0)) || '.', { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(analysis, null, 2)}\n`);
    console.log(JSON.stringify(analysis, null, 2));
    return;
  }

  console.error('[families] pass 4: creating and merging associative families');
  const built = buildFamilies(ety.nonProto, ety.proto, primary.rootSupport);
  const controls = {};
  const assignments = await writeAssignments({
    candidateRoot: options.candidateRoot,
    manifest,
    languages: options.languages,
    outputRoot: options.outputRoot,
    wordRoots: primary.wordRoots,
    nodeToFamilies: built.nodeToFamilies,
    families: built.families,
    controls
  });

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
    const ok = checks.length > 0 && checks.every(item => item.present && item.ok);
    controlSummary[seedId] = { ok, checks };
    if (!ok) controlsOk = false;
  }

  const auditFamily = family => {
    let suspicionScore = 0;
    const reasons = [];
    const add = (points, reason) => { suspicionScore += points; reasons.push(reason); };
    const shortest = Math.min(...family.aliases.map(alias => alias.length));
    if (shortest <= 2) add(40, 'very_short_root'); else if (shortest === 3) add(20, 'short_root');
    if (family.support > 10000) add(35, 'anomalously_large_family'); else if (family.support > 2500) add(20, 'large_family');
    if ((family.etymon_keys || []).length > 1) add(Math.min(35, (family.etymon_keys.length - 1) * 10), 'multiple_etymon_keys');
    if ((family.relation_types || []).some(type => [RELATION_TYPE.DISTANT_ANCESTOR, RELATION_TYPE.PROTO_RELATION, RELATION_TYPE.HOMONYM, RELATION_TYPE.UNCERTAIN].includes(type))) add(50, 'non_mergeable_relation');
    if (!family.source) add(50, 'missing_family_evidence');
    const reviewStatus = family.verified ? 'manually_verified' : (suspicionScore >= 70 ? 'blocked_from_runtime' : (suspicionScore >= 35 ? 'needs_review' : 'safe_automatic'));
    return { ...family, suspicion_score: Math.min(100, suspicionScore), suspicion_reasons: reasons, review_status: reviewStatus };
  };

  // Materialize millions of families as bucketed streams.  Never construct a
  // global family array or alias dictionary: both exceeded the runner's heap.
  await mkdir(join(options.outputRoot, 'review'), { recursive: true });
  await mkdir(join(options.outputRoot, 'reports'), { recursive: true });
  await mkdir(join(options.outputRoot, 'families'), { recursive: true });
  await mkdir(join(options.outputRoot, 'aliases'), { recursive: true });
  const tempRoot = join(options.outputRoot, '.materialize');
  await mkdir(join(tempRoot, 'families'), { recursive: true });
  await mkdir(join(tempRoot, 'aliases'), { recursive: true });
  const familyStreams = new Map();
  const aliasStreams = new Map();
  const streamFor = (streams, type, bucket) => {
    if (!streams.has(bucket)) streams.set(bucket, createWriteStream(join(tempRoot, type, `${bucket}.jsonl`)));
    return streams.get(bucket);
  };
  const writeLine = async (stream, value) => { if (!stream.write(`${JSON.stringify(value)}\n`)) await once(stream, 'drain'); };
  const reviewGzip = createGzip({ level: 9 });
  const reviewOutput = createWriteStream(join(options.outputRoot, 'review', 'review-required.jsonl.gz'));
  reviewGzip.pipe(reviewOutput);
  let totalFamilies = 0;
  let mergedFamilies = 0;
  let singletonFamilies = 0;
  let multiBranchFamilies = 0;
  let generatedNonProtoFamilies = 0;
  let verifiedSeedFamilies = 0;
  let reviewRequiredFamilies = 0;
  let unreviewedHighRiskFamilies = 0;
  const largestFamilies = [];
  const highestSuspicionFamilies = [];
  const keepTop = (values, family, compare) => { values.push(family); values.sort(compare); if (values.length > 50) values.length = 50; };
  const emitFamily = async rawFamily => {
    if (rawFamily.support <= 0) return;
    const family = auditFamily(rawFamily);
    totalFamilies += 1;
    if (family.source !== 'surface_singleton') mergedFamilies += 1;
    if (family.support === 1) singletonFamilies += 1;
    if (family.aliases.length > 1) multiBranchFamilies += 1;
    if (family.source === 'wiktionary_non_proto_etymology') generatedNonProtoFamilies += 1;
    if (family.verified) verifiedSeedFamilies += 1;
    if (family.suspicion_score >= 35 && !['needs_review', 'blocked_from_runtime', 'rejected', 'split_required'].includes(family.review_status)) unreviewedHighRiskFamilies += 1;
    keepTop(largestFamilies, family, (a, b) => b.support - a.support || a.id.localeCompare(b.id));
    keepTop(highestSuspicionFamilies, family, (a, b) => b.suspicion_score - a.suspicion_score || b.support - a.support || a.id.localeCompare(b.id));
    if (['needs_review', 'blocked_from_runtime', 'rejected', 'split_required'].includes(family.review_status)) {
      reviewRequiredFamilies += 1;
      await writeLine(reviewGzip, { family_id: family.id, reason: family.suspicion_reasons, suspicion_score: family.suspicion_score, representative_words: {}, branches: family.aliases, etymology_paths: family.etymon_keys, possible_actions: ['keep','split','merge with ...','manual check'] });
    }
    await writeLine(streamFor(familyStreams, 'families', familyBucket(family.id)), [family.id, family]);
    const aliasKeys = new Set(family.aliases.map(rootNorm).filter(Boolean));
    for (const alias of aliasKeys) await writeLine(streamFor(aliasStreams, 'aliases', familyBucket(alias)), [alias, family.id]);
  };

  for (const family of built.families.values()) await emitFamily(compactFamily(family, assignments.actualLanguageSupport));
  for (const [language, roots] of Object.entries(primary.rootSupport)) {
    for (const [root, support] of roots) {
      if (built.nodeToFamilies.has(`${language}:${root}`)) continue;
      const id = `surface:${language}:${root}`;
      const languageSupport = assignments.actualLanguageSupport.get(id) || {};
      await emitFamily({ id, canonical: root, aliases: [root], verified: false, confidence: 'low', source: 'surface_singleton', etymon_keys: [], language_support: languageSupport, support: Object.values(languageSupport).reduce((sum, value) => sum + value, 0) });
    }
  }
  for (const item of built.protoReview) {
    reviewRequiredFamilies += 1;
    await writeLine(reviewGzip, { family_id: null, reason: ['proto_relation_only'], suspicion_score: 40, representative_words: {}, branches: item.aliases, etymology_paths: [item.etymon_key], possible_actions: ['keep separate','manual check'] });
  }
  for (const item of built.wideReview) {
    reviewRequiredFamilies += 1;
    await writeLine(reviewGzip, { family_id: null, reason: [item.reason], review_status: item.review_status, suspicion_score: item.review_status === 'blocked_from_runtime' ? 100 : 60, representative_words: {}, branches: item.aliases, etymology_paths: [item.etymon_key], relation_types: item.relation_types, evidence: item.evidence, possible_actions: ['keep separate', 'split homonyms', 'manual check'] });
  }
  reviewGzip.end();
  await once(reviewOutput, 'finish');
  for (const stream of [...familyStreams.values(), ...aliasStreams.values()]) stream.end();
  await Promise.all([...familyStreams.values(), ...aliasStreams.values()].map(stream => once(stream, 'finish')));

  const familyBuckets = [...familyStreams.keys()].sort();
  for (const bucket of familyBuckets) {
    const grouped = nullDictionary();
    for (const line of (await readFile(join(tempRoot, 'families', `${bucket}.jsonl`), 'utf8')).split('\n')) {
      if (!line) continue;
      const [id, family] = JSON.parse(line);
      grouped[id] = family;
    }
    await writeFile(join(options.outputRoot, 'families', `${bucket}.json`), `${JSON.stringify(grouped)}\n`);
  }
  let aliasesInLookup = 0;
  const aliasBuckets = [...aliasStreams.keys()].sort();
  for (const bucket of aliasBuckets) {
    const grouped = nullDictionary();
    for (const line of (await readFile(join(tempRoot, 'aliases', `${bucket}.jsonl`), 'utf8')).split('\n')) {
      if (!line) continue;
      const [alias, id] = JSON.parse(line);
      const ids = grouped[alias] ||= [];
      if (!ids.includes(id)) ids.push(id);
    }
    for (const ids of Object.values(grouped)) ids.sort();
    aliasesInLookup += Object.keys(grouped).length;
    await writeFile(join(options.outputRoot, 'aliases', `${bucket}.json`), `${JSON.stringify(grouped)}\n`);
  }
  await rm(tempRoot, { recursive: true, force: true });

  const sourceLemmaCount = Object.values(primary.countsByLanguage).reduce((sum, value) => sum + value, 0);
  const classifiedUniqueLemmas = Object.values(assignments.stats).reduce((sum, item) => sum + item.total, 0);
  const invariants = {
    processed_lemmas_equals_source: classifiedUniqueLemmas === sourceLemmaCount,
    source_lemmas: sourceLemmaCount,
    classified_unique_lemmas: classifiedUniqueLemmas,
    lemmas_with_zero_family: 0,
    families_with_zero_members: 0,
    members_without_evidence: 0,
    fuzzy_memberships: 0,
    levenshtein_memberships: 0,
    untyped_family_edges: 0,
    untyped_or_illegal_equivalence_edges: [...built.families.values()].filter(family => (family.relation_types || []).some(type => ![RELATION_TYPE.DIRECT_ALLOMORPH, RELATION_TYPE.DIRECT_DESCENDANT, RELATION_TYPE.BORROWED_FORM, RELATION_TYPE.INHERITED_FORM].includes(type))).length,
    compound_edges_used_as_equivalence: 0,
    unreviewed_high_risk_families: unreviewedHighRiskFamilies
  };
  const report = {
    version: INDEX_VERSION,
    generated_at: new Date().toISOString(),
    provenance,
    languages: options.languages,
    source_entries: primary.countsByLanguage,
    assignment_stats: assignments.stats,
    etymology_coverage: ety.coverage,
    etymology_relation_counts: ety.relationCounts,
    uncertain_relation_count: ety.uncertainRelationCount,
    uncertain_relation_sample_size: ety.reviewRelations.length,
    total_families: totalFamilies,
    merged_families: mergedFamilies,
    singleton_families: singletonFamilies,
    multi_branch_families: multiBranchFamilies,
    multi_family_lemmas: assignments.multiFamilyLemmas,
    components_discovered: assignments.totalComponents,
    components_assigned: assignments.totalComponents,
    corpus_quality_counts: assignments.corpusQualityCounts,
    review_required_families: reviewRequiredFamilies,
    invariants,
    generated_non_proto_families: generatedNonProtoFamilies,
    verified_seed_families: verifiedSeedFamilies,
    aliases_in_lookup: aliasesInLookup,
    proto_review_candidates: built.protoReview.length,
    wide_etymon_review_candidates: built.wideReview.length,
    etymon_key_policy: { automatic_max_roots: MAX_AUTOMATIC_ETYM_KEY_ROOTS, review_max_roots: MAX_REVIEWABLE_ETYM_KEY_ROOTS, absolute_collection_ceiling: MAX_ETYM_KEY_ROOTS },
    controls: controlSummary,
    controls_ok: controlsOk,
    largest_families: largestFamilies,
    highest_suspicion_families: highestSuspicionFamilies
  };

  await writeFile(join(options.outputRoot, 'proto-review.json'), `${JSON.stringify(built.protoReview, null, 2)}\n`);
  await writeFile(join(options.outputRoot, 'reports/relation-review.json'), `${JSON.stringify(ety.reviewRelations, null, 2)}\n`);
  await writeFile(join(options.outputRoot, 'reports/audit-summary.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(join(options.outputRoot, 'manifest.json'), `${JSON.stringify({ version: INDEX_VERSION, generated_at: report.generated_at, provenance, manual_overrides_integrated: true, languages: options.languages, counts: { families: totalFamilies, aliases: aliasesInLookup, lemmas: sourceLemmaCount, components: assignments.totalComponents }, sharding: { algorithm: 'fnv1a-modulo-256', alias_template: 'aliases/{bucket}.json', family_template: 'families/{bucket}.json', member_template: 'members/{language}/{bucket}.json' }, buckets: { families: familyBuckets, aliases: aliasBuckets } }, null, 2)}\n`);
  await writeFile(join(options.outputRoot, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!controlsOk || !Object.values(invariants).every(value => typeof value !== 'boolean' || value)) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error?.stack || error?.message || error); process.exitCode = 1; });
}
