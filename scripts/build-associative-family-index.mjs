#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { createInterface } from 'node:readline';

const ISO3 = { en: 'eng', de: 'deu', fr: 'fra', es: 'spa', it: 'ita', ru: 'rus' };
const DEFAULT_LANGUAGES = Object.keys(ISO3);
const SOURCE_PRIORITY = new Map([
  ['lat', 0], ['grc', 0],
  ['fro', 1], ['frm', 1], ['enm', 1], ['ang', 1], ['goh', 1], ['gmh', 1],
  ['ita', 2], ['fra', 2], ['spa', 2], ['eng', 2], ['deu', 2], ['rus', 2]
]);
const ACCEPTED_RELATIONS = new Set([
  'rel:is_derived_from', 'rel:etymology',
  'rel:has_derived_form', 'rel:etymological_origin_of'
]);
const INVERSE_RELATIONS = new Set(['rel:has_derived_form', 'rel:etymological_origin_of']);
const BROAD_PROTO_RE = /(?:-pro|^ine-pro$|^gem-pro$|^itc-pro$|^sla-pro$)/;

function parseArgs(argv) {
  const out = { languages: DEFAULT_LANGUAGES, maxDepth: 7, maxFamiliesPerLemma: 8 };
  for (const arg of argv) {
    if (arg.startsWith('--candidate-root=')) out.candidateRoot = arg.slice(17);
    else if (arg.startsWith('--etymwn=')) out.etymwn = arg.slice(9);
    else if (arg.startsWith('--output-root=')) out.outputRoot = arg.slice(14);
    else if (arg.startsWith('--languages=')) out.languages = arg.slice(12).split(',').filter(Boolean);
    else if (arg.startsWith('--max-depth=')) out.maxDepth = Number(arg.slice(12));
    else if (arg.startsWith('--max-families-per-lemma=')) out.maxFamiliesPerLemma = Number(arg.slice(25));
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!out.candidateRoot || !out.etymwn || !out.outputRoot) {
    throw new Error('--candidate-root, --etymwn and --output-root are required');
  }
  if (!Number.isInteger(out.maxDepth) || out.maxDepth < 1 || out.maxDepth > 12) throw new Error('Invalid --max-depth');
  return out;
}

function normWord(value) {
  return String(value ?? '').normalize('NFC').trim().toLocaleLowerCase('und');
}

function nodeKey(lang, word) {
  return `${lang}\t${normWord(word)}`;
}

function splitNode(raw) {
  const match = /^([^:]+):\s*(.*)$/.exec(raw);
  if (!match) return null;
  const lang = match[1].trim();
  const word = normWord(match[2]);
  if (!lang || !word) return null;
  return { lang, word, key: nodeKey(lang, word) };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function loadCandidateEntries(candidateRoot, languages) {
  const manifest = await readJson(join(candidateRoot, 'manifest.json'));
  const entries = [];
  for (const language of languages) {
    const meta = manifest.languages?.[language];
    if (!meta) throw new Error(`Candidate index missing language ${language}`);
    for (const shard of meta.shards) {
      const rows = await readJson(join(candidateRoot, shard.file));
      for (const row of rows) {
        const word = normWord(row.word || row.normalized);
        if (!word) continue;
        entries.push({
          id: `${language}\t${word}`,
          language,
          iso3: ISO3[language],
          word,
          display: row.word || row.normalized,
          frequency_score: Number(row.frequency_score) || 0,
          node: nodeKey(ISO3[language], word)
        });
      }
    }
  }
  return entries;
}

function orientEdge(left, relation, right) {
  if (!ACCEPTED_RELATIONS.has(relation)) return null;
  const a = splitNode(left);
  const b = splitNode(right);
  if (!a || !b) return null;
  return INVERSE_RELATIONS.has(relation)
    ? { child: b, parent: a, relation }
    : { child: a, parent: b, relation };
}

async function collectParentGraph(etymwnPath, targetNodes, maxDepth) {
  const parents = new Map();
  const seen = new Set(targetNodes);
  let frontier = new Set(targetNodes);
  const stats = [];

  for (let depth = 1; depth <= maxDepth && frontier.size; depth += 1) {
    const next = new Set();
    let matched = 0;
    const input = createReadStream(etymwnPath, { encoding: 'utf8' });
    const rl = createInterface({ input, crlfDelay: Infinity });
    for await (const line of rl) {
      const [left, relation, right] = line.split('\t');
      if (!right) continue;
      const edge = orientEdge(left, relation, right);
      if (!edge || !frontier.has(edge.child.key)) continue;
      matched += 1;
      const list = parents.get(edge.child.key) ?? [];
      if (!list.some(item => item.parent === edge.parent.key)) {
        list.push({ parent: edge.parent.key, relation: edge.relation });
        parents.set(edge.child.key, list);
      }
      if (!seen.has(edge.parent.key)) {
        seen.add(edge.parent.key);
        next.add(edge.parent.key);
      }
    }
    stats.push({ depth, frontier: frontier.size, matched_edges: matched, new_ancestors: next.size });
    frontier = next;
  }
  return { parents, stats };
}

function ancestorDistances(start, parents, maxDepth) {
  const distances = new Map();
  const queue = [{ key: start, depth: 0 }];
  for (let i = 0; i < queue.length; i += 1) {
    const current = queue[i];
    if (current.depth >= maxDepth) continue;
    for (const edge of parents.get(current.key) ?? []) {
      const depth = current.depth + 1;
      if ((distances.get(edge.parent) ?? Infinity) <= depth) continue;
      distances.set(edge.parent, depth);
      queue.push({ key: edge.parent, depth });
    }
  }
  return distances;
}

function parseKey(key) {
  const at = key.indexOf('\t');
  return { lang: key.slice(0, at), word: key.slice(at + 1) };
}

function validFamilyAncestor(key) {
  const { lang, word } = parseKey(key);
  if (!word || word.length < 3 || word.startsWith('-') || word.endsWith('-')) return false;
  if (BROAD_PROTO_RE.test(lang)) return false;
  if (/^[\W_]+$/u.test(word)) return false;
  return true;
}

function familyPriority(key) {
  const { lang } = parseKey(key);
  return SOURCE_PRIORITY.get(lang) ?? 4;
}

function setEquals(a, b) {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

function isAncestorOf(ancestor, node, ancestorCache) {
  return ancestorCache.get(node)?.has(ancestor) ?? false;
}

function inferObservedPrefix(members) {
  const counts = new Map();
  for (const member of members) {
    const w = member.word.replace(/[^\p{L}\p{M}]/gu, '');
    for (let len = 3; len <= Math.min(8, w.length); len += 1) {
      const prefix = w.slice(0, len);
      counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
    }
  }
  const threshold = Math.max(2, Math.ceil(members.length * 0.5));
  return [...counts.entries()]
    .filter(([, count]) => count >= threshold)
    .sort((a, b) => b[0].length - a[0].length || b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}

function controlChecks(families, memberships) {
  const findTogether = (a, b) => {
    for (const family of families) {
      const words = new Set(family.members.map(m => m.word));
      if (words.has(a) && words.has(b)) return { ok: true, family_id: family.id, label: family.label };
    }
    return { ok: false };
  };
  const anyMembership = word => [...memberships.values()].some(rows => rows.some(row => row.word === word));
  return {
    alternative_altruism: findTogether('alternative', 'altruism'),
    pedal_pedicure: findTogether('pedal', 'pedicure'),
    ocular_oculist: findTogether('ocular', 'oculist'),
    regular_regulation: findTogether('regular', 'regulation'),
    presence: Object.fromEntries(['alternative','altruism','pedal','pedicure','ocular','oculist','regular','regulation'].map(w => [w, anyMembership(w)]))
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await mkdir(options.outputRoot, { recursive: true });

  const entries = await loadCandidateEntries(options.candidateRoot, options.languages);
  const byNode = new Map();
  for (const entry of entries) {
    const list = byNode.get(entry.node) ?? [];
    list.push(entry);
    byNode.set(entry.node, list);
  }

  const { parents, stats: graphStats } = await collectParentGraph(options.etymwn, new Set(byNode.keys()), options.maxDepth);

  const ancestorsByNode = new Map();
  const candidateMembers = new Map();
  const candidateDistances = new Map();
  for (const node of byNode.keys()) {
    const distances = ancestorDistances(node, parents, options.maxDepth);
    ancestorsByNode.set(node, distances);
    for (const [ancestor, distance] of distances) {
      if (!validFamilyAncestor(ancestor)) continue;
      const members = candidateMembers.get(ancestor) ?? new Set();
      members.add(node);
      candidateMembers.set(ancestor, members);
      const d = candidateDistances.get(ancestor) ?? [];
      d.push(distance);
      candidateDistances.set(ancestor, d);
    }
  }

  let candidates = [...candidateMembers.entries()]
    .filter(([, members]) => members.size >= 2)
    .map(([ancestor, members]) => ({ ancestor, members }));

  // Drop a deeper/older node when a more specific descendant explains exactly the same member set.
  const redundant = new Set();
  const bySize = [...candidates].sort((a, b) => a.members.size - b.members.size || familyPriority(a.ancestor) - familyPriority(b.ancestor));
  for (let i = 0; i < bySize.length; i += 1) {
    const specific = bySize[i];
    for (let j = i + 1; j < bySize.length; j += 1) {
      const broad = bySize[j];
      if (specific.members.size !== broad.members.size) break;
      if (!setEquals(specific.members, broad.members)) continue;
      if (isAncestorOf(broad.ancestor, specific.ancestor, ancestorsByNode)) redundant.add(broad.ancestor);
    }
  }
  candidates = candidates.filter(c => !redundant.has(c.ancestor));

  // Prefer interpretable source nodes and avoid gigantic accidental clusters.
  candidates.sort((a, b) => {
    const pa = familyPriority(a.ancestor), pb = familyPriority(b.ancestor);
    if (pa !== pb) return pa - pb;
    const da = candidateDistances.get(a.ancestor) ?? [], db = candidateDistances.get(b.ancestor) ?? [];
    const aa = da.reduce((x, y) => x + y, 0) / Math.max(1, da.length);
    const ab = db.reduce((x, y) => x + y, 0) / Math.max(1, db.length);
    return aa - ab || b.members.size - a.members.size || a.ancestor.localeCompare(b.ancestor);
  });

  const memberships = new Map(options.languages.map(lang => [lang, []]));
  const families = [];
  const familyIdsByNode = new Map();

  for (const candidate of candidates) {
    const { lang, word } = parseKey(candidate.ancestor);
    const memberEntries = [...candidate.members].flatMap(node => byNode.get(node) ?? []);
    const languages = [...new Set(memberEntries.map(m => m.language))].sort();
    const distances = candidateDistances.get(candidate.ancestor) ?? [];
    const avgDistance = distances.reduce((a, b) => a + b, 0) / Math.max(1, distances.length);
    const id = `${lang}:${word}`;
    const observedPrefix = inferObservedPrefix(memberEntries);
    const label = observedPrefix && observedPrefix.length >= 3 ? observedPrefix : word;
    const family = {
      id,
      label,
      etymon: { language: lang, word },
      member_count: memberEntries.length,
      language_count: languages.length,
      languages,
      average_etymological_distance: Number(avgDistance.toFixed(3)),
      confidence: familyPriority(candidate.ancestor) <= 1 && avgDistance <= 5 ? 'A' : avgDistance <= 5 ? 'B' : 'C',
      members: memberEntries
        .sort((a, b) => b.frequency_score - a.frequency_score || a.language.localeCompare(b.language) || a.word.localeCompare(b.word))
        .map(m => ({ language: m.language, word: m.word, display: m.display, frequency_score: m.frequency_score }))
    };
    families.push(family);
    for (const node of candidate.members) {
      const ids = familyIdsByNode.get(node) ?? [];
      ids.push({ id, priority: familyPriority(candidate.ancestor), avgDistance });
      familyIdsByNode.set(node, ids);
    }
  }

  for (const [node, entryList] of byNode) {
    const ids = (familyIdsByNode.get(node) ?? [])
      .sort((a, b) => a.priority - b.priority || a.avgDistance - b.avgDistance || a.id.localeCompare(b.id))
      .slice(0, options.maxFamiliesPerLemma)
      .map(x => x.id);
    if (!ids.length) continue;
    for (const entry of entryList) memberships.get(entry.language).push({ word: entry.word, display: entry.display, families: ids });
  }

  families.sort((a, b) => b.member_count - a.member_count || a.id.localeCompare(b.id));
  await writeFile(join(options.outputRoot, 'families.json'), JSON.stringify(families));
  for (const language of options.languages) {
    memberships.get(language).sort((a, b) => a.word.localeCompare(b.word));
    await writeFile(join(options.outputRoot, `${language}.json`), JSON.stringify(memberships.get(language)));
  }

  const report = {
    version: 1,
    source: basename(options.etymwn),
    languages: options.languages,
    candidate_lemmas: entries.length,
    unique_etymology_nodes: byNode.size,
    nodes_with_parents: parents.size,
    families: families.length,
    memberships: Object.fromEntries(options.languages.map(lang => [lang, memberships.get(lang).length])),
    graph_passes: graphStats,
    control_checks: controlChecks(families, memberships),
    largest_families: families.slice(0, 30).map(f => ({ id: f.id, label: f.label, members: f.member_count, languages: f.language_count, confidence: f.confidence }))
  };
  await writeFile(join(options.outputRoot, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
