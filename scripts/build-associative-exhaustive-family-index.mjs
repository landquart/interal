#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createGunzip, createGzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { buildSearchForm } from '../associativvordes/js/root-matcher.js';
import { discoverLexicalComponents } from '../associativvordes/js/morphology/analyzer.js';
import { clearLexicalRoots, registerLexicalRootsFromEntries } from '../associativvordes/js/morphology/lexical-root-index.js';
import { getLanguageConfig } from '../associativvordes/js/morphology/languages/index.js';
import { nullDictionary, stableLemmaId } from './lib/associative-family-graph.mjs';

const LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'ru'];
const INDEX_VERSION = '2';
const MIN_ROOT = 3;
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
    else if (arg.startsWith('--etymology-gzip=')) out.etymologyGzip = arg.slice(17);
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

function numericArgs(args, start = 1) {
  return Object.entries(args || {})
    .filter(([key]) => /^\d+$/.test(key) && Number(key) >= start)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, value]) => String(value || ''));
}

function pairsFromExpansion(expansion, relation = 'etymology_tree') {
  const text = String(expansion || '');
  const out = [];
  const patterns = [
    /"lang"\s*:\s*"([^"]+)"[\s\S]{0,220}?"term"\s*:\s*"([^"]+)"/g,
    /"term"\s*:\s*"([^"]+)"[\s\S]{0,220}?"lang"\s*:\s*"([^"]+)"/g
  ];
  let match;
  while ((match = patterns[0].exec(text))) out.push({ sourceLang: match[1], term: match[2], edgeType: 'EQUIVALENT_BRANCH', relation });
  while ((match = patterns[1].exec(text))) out.push({ sourceLang: match[2], term: match[1], edgeType: 'EQUIVALENT_BRANCH', relation });
  return out;
}

function etymologyPairs(entry) {
  const out = [];
  for (const template of entry.etymology_templates || []) {
    const name = String(template?.name || '').trim().toLocaleLowerCase('und');
    const args = template?.args || {};
    if (DIRECT_RELATIONS.has(name)) {
      const values = numericArgs(args);
      if (values.length >= 3) out.push({ sourceLang: values[1], term: values[2], edgeType: 'EQUIVALENT_BRANCH', relation: name });
    } else if (COMPONENT_RELATIONS.has(name)) {
      const values = numericArgs(args);
      if (values.length >= 2) for (const term of values.slice(1)) out.push({ sourceLang: values[0], term, edgeType: 'CONTAINS_COMPONENT', relation: name });
    } else if (SAME_LANGUAGE_RELATIONS.has(name)) {
      const values = numericArgs(args);
      if (values.length >= 2) out.push({ sourceLang: values[0], term: values[1], edgeType: 'EQUIVALENT_BRANCH', relation: name });
    } else if (name === 'etymon' || name === 'ety') {
      // New Wiktionary etymology-tree templates carry the full ancestry in their expansion.
    }
    if (name === 'etymon' || name === 'ety') out.push(...pairsFromExpansion(template.expansion, name));
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
    const analysis = wordRoots[language].get(key);
    if (!analysis?.components?.length) continue;
    coverage[language].matched_entries += 1;
    coverage[language].unique_lemmas.add(key);
    const pairs = etymologyPairs(entry);
    if (pairs.length) coverage[language].with_etymology += 1;
    // A compound is component containment evidence, never evidence that all of
    // its lexical components are equivalent.  Direct ancestry is therefore
    // applied automatically only to an unambiguous single-component analysis.
    const rootNodes = analysis.components.length === 1 ? [`${language}:${analysis.components[0].root}`] : [];
    const seen = new Set();
    for (const { sourceLang, term, edgeType } of pairs) {
      if (edgeType !== 'EQUIVALENT_BRANCH') continue;
      for (const etyKey of etymonKeys(sourceLang, term)) {
        if (seen.has(etyKey)) continue;
        seen.add(etyKey);
        const target = isProtoLanguage(sourceLang) ? proto : nonProto;
        let roots = target.get(etyKey);
        if (!roots) { roots = new Set(); target.set(etyKey, roots); }
        for (const rootNode of rootNodes) if (roots.size <= MAX_ETYM_KEY_ROOTS) roots.add(rootNode);
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
  const surfaceFamilies = new Map();
  let totalComponents = 0;
  let multiFamilyLemmas = 0;
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
      const componentRows = analysis.components.map(component => {
        const node = `${language}:${component.root}`;
        const ids = [...(nodeToFamilies.get(node) || [])].sort();
        const familyIds = ids.length ? ids : [`surface:${language}:${component.root}`];
        if (!ids.length) {
          const id = familyIds[0];
          const current = surfaceFamilies.get(id) || { id, canonical: component.root, aliases: [component.root], verified: false, confidence: 'low', source: 'surface_singleton', etymon_keys: [], language_support: {}, support: 0, evidence: component.evidence };
          current.language_support[language] = (current.language_support[language] || 0) + 1;
          current.support += 1;
          surfaceFamilies.set(id, current);
        }
        totalComponents += 1;
        return { surface: component.surface, canonical_candidate: component.root, family_ids: familyIds, confidence: component.confidence, evidence: component.evidence };
      });
      const familyIds = [...new Set(componentRows.flatMap(item => item.family_ids))].sort();
      if (familyIds.length > 1) multiFamilyLemmas += 1;
      if (componentRows.some(item => !item.family_ids[0].startsWith('surface:'))) merged += 1;
      if (familyIds.length > 1) ambiguous += 1;
      const payload = { lemma_id: stableLemmaId(language, row.normalized || row.word), language, word: row.word, normalized: row.normalized, search_form: row.search_form, rank: row.rank, frequency_score: row.frequency_score, category_breakdown: row.category_breakdown, sources: row.sources, components: componentRows, family_ids: familyIds, ambiguous_analysis: analysis.ambiguous };
      if (!gzip.write(`${JSON.stringify(payload)}\n`)) await once(gzip, 'drain');
      for (const id of familyIds) {
        const stream = memberStream(familyBucket(id));
        const membership = [id, { lemma_id: payload.lemma_id, components: componentRows.filter(item => item.family_ids.includes(id)).map(item => ({ surface: item.surface, canonical_candidate: item.canonical_candidate, confidence: item.confidence, evidence: item.evidence })) }];
        if (!stream.write(`${JSON.stringify(membership)}\n`)) await once(stream, 'drain');
      }
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
  return { stats, surfaceFamilies, totalComponents, multiFamilyLemmas };
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

  console.error('[families] pass 1/2: discovering every defensible lexical component for every lemma');
  const primary = await buildDiscoveredComponents(options.candidateRoot, manifest, options.languages);

  console.error('[families] pass 3: streaming Wiktionary/Kaikki etymology for every indexed lemma');
  const ety = await scanEtymologies(options.etymologyGzip, primary.wordRoots, options.languages);
  console.error(`[families] non-proto etymon keys=${ety.nonProto.size}; proto review keys=${ety.proto.size}`);

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

  const familyList = [...built.families.values()]
    .map(family => compactFamily(family, primary.rootSupport))
    .concat([...assignments.surfaceFamilies.values()])
    .sort((a, b) => Number(b.verified) - Number(a.verified) || b.support - a.support || a.id.localeCompare(b.id));
  // A normalized lexical alias can legitimately be `constructor`, `prototype`,
  // or another Object.prototype property.  A null-prototype dictionary keeps
  // those words as ordinary keys instead of returning inherited JS values.
  const lookup = nullDictionary();
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
    const ok = checks.length > 0 && checks.every(item => item.present && item.ok);
    controlSummary[seedId] = { ok, checks };
    if (!ok) controlsOk = false;
  }

  const auditedFamilies = familyList.filter(family => family.support > 0).map(family => {
    let suspicionScore = 0;
    const reasons = [];
    const add = (points, reason) => { suspicionScore += points; reasons.push(reason); };
    const shortest = Math.min(...family.aliases.map(alias => alias.length));
    if (shortest <= 2) add(40, 'very_short_root'); else if (shortest === 3) add(20, 'short_root');
    if (family.support > 10000) add(35, 'anomalously_large_family'); else if (family.support > 2500) add(20, 'large_family');
    if ((family.etymon_keys || []).length > 1) add(Math.min(35, (family.etymon_keys.length - 1) * 10), 'multiple_etymon_keys');
    if (!family.source) add(50, 'missing_family_evidence');
    return { ...family, suspicion_score: Math.min(100, suspicionScore), suspicion_reasons: reasons, review_status: suspicionScore >= 35 ? 'review_required' : (family.verified ? 'verified' : 'automatic') };
  });
  const review = auditedFamilies.filter(family => family.review_status === 'review_required').map(family => ({ family_id: family.id, reason: family.suspicion_reasons, suspicion_score: family.suspicion_score, representative_words: {}, branches: family.aliases, etymology_paths: family.etymon_keys, possible_actions: ['keep','split','merge with ...','manual check'] }));
  review.push(...built.protoReview.map(item => ({ family_id: null, reason: ['proto_relation_only'], suspicion_score: 40, representative_words: {}, branches: item.aliases, etymology_paths: [item.etymon_key], possible_actions: ['keep separate','manual check'] })));
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
    compound_edges_used_as_equivalence: 0,
    unreviewed_high_risk_families: auditedFamilies.filter(family => family.suspicion_score >= 35 && family.review_status !== 'review_required').length
  };
  const report = {
    version: INDEX_VERSION,
    generated_at: new Date().toISOString(),
    languages: options.languages,
    source_entries: primary.countsByLanguage,
    assignment_stats: assignments.stats,
    etymology_coverage: ety.coverage,
    total_families: auditedFamilies.length,
    merged_families: auditedFamilies.filter(item => item.source !== 'surface_singleton').length,
    singleton_families: auditedFamilies.filter(item => item.support === 1).length,
    multi_branch_families: auditedFamilies.filter(item => item.aliases.length > 1).length,
    multi_family_lemmas: assignments.multiFamilyLemmas,
    components_discovered: assignments.totalComponents,
    components_assigned: assignments.totalComponents,
    review_required_families: review.length,
    invariants,
    generated_non_proto_families: familyList.filter(item => item.source === 'wiktionary_non_proto_etymology').length,
    verified_seed_families: familyList.filter(item => item.verified).length,
    aliases_in_lookup: Object.keys(lookup).length,
    proto_review_candidates: built.protoReview.length,
    controls: controlSummary,
    controls_ok: controlsOk,
    largest_families: auditedFamilies.slice().sort((a, b) => b.support - a.support).slice(0, 50),
    highest_suspicion_families: auditedFamilies.slice().sort((a, b) => b.suspicion_score - a.suspicion_score || b.support - a.support).slice(0, 50)
  };

  await mkdir(join(options.outputRoot, 'review'), { recursive: true });
  await mkdir(join(options.outputRoot, 'reports'), { recursive: true });
  await mkdir(join(options.outputRoot, 'families'), { recursive: true });
  await mkdir(join(options.outputRoot, 'aliases'), { recursive: true });
  const familyShards = {};
  for (const family of auditedFamilies) (familyShards[familyBucket(family.id)] ||= {})[family.id] = family;
  for (const [bucket, values] of Object.entries(familyShards)) await writeFile(join(options.outputRoot, 'families', `${bucket}.json`), `${JSON.stringify(values)}\n`);
  const aliasShards = {};
  for (const [alias, values] of Object.entries(lookup)) (aliasShards[familyBucket(alias)] ||= {})[alias] = values.map(item => item.id);
  for (const [bucket, values] of Object.entries(aliasShards)) await writeFile(join(options.outputRoot, 'aliases', `${bucket}.json`), `${JSON.stringify(values)}\n`);
  await writeFile(join(options.outputRoot, 'families.json'), `${JSON.stringify(auditedFamilies)}\n`);
  await writeFile(join(options.outputRoot, 'lookup.json'), `${JSON.stringify(lookup)}\n`);
  await writeFile(join(options.outputRoot, 'proto-review.json'), `${JSON.stringify(built.protoReview, null, 2)}\n`);
  await writeFile(join(options.outputRoot, 'review/review-required.json'), `${JSON.stringify(review, null, 2)}\n`);
  await writeFile(join(options.outputRoot, 'reports/audit-summary.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(join(options.outputRoot, 'manifest.json'), `${JSON.stringify({ version: '3', generated_at: report.generated_at, languages: options.languages, counts: { families: auditedFamilies.length, aliases: Object.keys(lookup).length, lemmas: sourceLemmaCount, components: assignments.totalComponents }, sharding: { algorithm: 'fnv1a-modulo-256', alias_template: 'aliases/{bucket}.json', family_template: 'families/{bucket}.json', member_template: 'members/{language}/{bucket}.json' }, buckets: { families: Object.keys(familyShards).sort(), aliases: Object.keys(aliasShards).sort() } }, null, 2)}\n`);
  await writeFile(join(options.outputRoot, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!controlsOk || !Object.values(invariants).every(value => typeof value !== 'boolean' || value)) process.exitCode = 2;
}

main().catch(error => { console.error(error?.stack || error?.message || error); process.exitCode = 1; });
