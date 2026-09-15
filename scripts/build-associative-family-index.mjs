#!/usr/bin/env node
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { createInterface } from 'node:readline';
import { once } from 'node:events';

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
const CONTROL_PAIRS = [
  ['alternative', 'altruism'],
  ['pedal', 'pedicure'],
  ['ocular', 'oculist'],
  ['regular', 'regulation']
];

function parseArgs(argv) {
  const out = { languages: DEFAULT_LANGUAGES, maxDepth: 7, maxFamiliesPerLemma: 8 };
  for (const arg of argv) {
    if (arg.startsWith('--candidate-root=')) out.candidateRoot = arg.slice(17);
    else if (arg.startsWith('--etymwn=')) out.etymwn = arg.slice(9);
    else if (arg.startsWith('--output-root=')) out.outputRoot = arg.slice(14);
    else if (arg.startsWith('--languages=')) out.languages = arg.slice(12).split(',').map(v => v.trim()).filter(Boolean);
    else if (arg.startsWith('--max-depth=')) out.maxDepth = Number(arg.slice(12));
    else if (arg.startsWith('--max-families-per-lemma=')) out.maxFamiliesPerLemma = Number(arg.slice(25));
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!out.candidateRoot || !out.etymwn || !out.outputRoot) {
    throw new Error('--candidate-root, --etymwn and --output-root are required');
  }
  if (!Number.isInteger(out.maxDepth) || out.maxDepth < 1 || out.maxDepth > 12) throw new Error('Invalid --max-depth');
  if (!Number.isInteger(out.maxFamiliesPerLemma) || out.maxFamiliesPerLemma < 1 || out.maxFamiliesPerLemma > 16) throw new Error('Invalid --max-families-per-lemma');
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

function parseKey(key) {
  const at = key.indexOf('\t');
  return { lang: key.slice(0, at), word: key.slice(at + 1) };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function loadCandidateNodes(candidateRoot, languages) {
  const manifest = await readJson(join(candidateRoot, 'manifest.json'));
  const byNode = new Map();
  let candidateCount = 0;
  for (const language of languages) {
    const meta = manifest.languages?.[language];
    if (!meta) throw new Error(`Candidate index missing language ${language}`);
    for (const shard of meta.shards) {
      const rows = await readJson(join(candidateRoot, shard.file));
      for (const row of rows) {
        const word = normWord(row.word || row.normalized);
        if (!word) continue;
        const node = nodeKey(ISO3[language], word);
        const previous = byNode.get(node);
        const current = {
          language,
          word,
          display: row.word || row.normalized,
          frequency_score: Number(row.frequency_score) || 0
        };
        if (!previous || current.frequency_score > previous.frequency_score) byNode.set(node, current);
        candidateCount += 1;
      }
    }
  }
  return { byNode, candidateCount };
}

function orientEdge(left, relation, right) {
  if (!ACCEPTED_RELATIONS.has(relation)) return null;
  const a = splitNode(left);
  const b = splitNode(right);
  if (!a || !b) return null;
  return INVERSE_RELATIONS.has(relation)
    ? { child: b, parent: a }
    : { child: a, parent: b };
}

async function collectParentGraph(etymwnPath, targetNodes, maxDepth) {
  const parents = new Map();
  const seenAncestors = new Set();
  let frontier = new Set(targetNodes);
  const stats = [];

  for (let depth = 1; depth <= maxDepth && frontier.size; depth += 1) {
    const next = new Set();
    let matched = 0;
    const input = createReadStream(etymwnPath, { encoding: 'utf8' });
    const rl = createInterface({ input, crlfDelay: Infinity });
    for await (const line of rl) {
      const first = line.indexOf('\t');
      if (first < 0) continue;
      const second = line.indexOf('\t', first + 1);
      if (second < 0) continue;
      const left = line.slice(0, first);
      const relation = line.slice(first + 1, second);
      if (!ACCEPTED_RELATIONS.has(relation)) continue;
      const right = line.slice(second + 1);
      const edge = orientEdge(left, relation, right);
      if (!edge || !frontier.has(edge.child.key)) continue;
      matched += 1;
      const list = parents.get(edge.child.key) ?? [];
      if (!list.includes(edge.parent.key)) {
        list.push(edge.parent.key);
        parents.set(edge.child.key, list);
      }
      if (!targetNodes.has(edge.parent.key) && !seenAncestors.has(edge.parent.key)) {
        seenAncestors.add(edge.parent.key);
        next.add(edge.parent.key);
      }
    }
    stats.push({ depth, frontier: frontier.size, matched_edges: matched, new_ancestors: next.size });
    console.error(`[family-index] graph depth ${depth}: frontier=${frontier.size} matched=${matched} new=${next.size}`);
    frontier = next;
  }
  return { parents, stats };
}

function ancestorDistances(start, parents, maxDepth) {
  const distances = new Map();
  const queueKeys = [start];
  const queueDepths = [0];
  for (let i = 0; i < queueKeys.length; i += 1) {
    const key = queueKeys[i];
    const currentDepth = queueDepths[i];
    if (currentDepth >= maxDepth) continue;
    for (const parent of parents.get(key) ?? []) {
      const depth = currentDepth + 1;
      if ((distances.get(parent) ?? Infinity) <= depth) continue;
      distances.set(parent, depth);
      queueKeys.push(parent);
      queueDepths.push(depth);
    }
  }
  return distances;
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

function selectFamilyAncestors(distances, limit) {
  const eligible = [];
  let bestPriority = Infinity;
  for (const [ancestor, distance] of distances) {
    if (!validFamilyAncestor(ancestor)) continue;
    const priority = familyPriority(ancestor);
    if (priority < bestPriority) bestPriority = priority;
    eligible.push({ ancestor, distance, priority });
  }
  if (!eligible.length) return [];
  const preferred = eligible
    .filter(item => item.priority === bestPriority)
    .sort((a, b) => b.distance - a.distance || a.ancestor.localeCompare(b.ancestor));

  // Keeping a small number of deepest ancestors preserves multiple branches in compounds
  // (e.g. pedicure) without materializing every intermediate ancestor of every lemma.
  const selected = [];
  const seenWords = new Set();
  for (const item of preferred) {
    const { word } = parseKey(item.ancestor);
    if (seenWords.has(word)) continue;
    selected.push(item);
    seenWords.add(word);
    if (selected.length >= limit) break;
  }
  return selected;
}

function inferObservedPrefix(memberNodes, byNode) {
  const counts = new Map();
  let total = 0;
  for (const node of memberNodes) {
    const member = byNode.get(node);
    if (!member) continue;
    total += 1;
    const w = member.word.replace(/[^\p{L}\p{M}]/gu, '');
    for (let len = 3; len <= Math.min(8, w.length); len += 1) {
      const prefix = w.slice(0, len);
      counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
    }
  }
  const threshold = Math.max(2, Math.ceil(total * 0.5));
  return [...counts.entries()]
    .filter(([, count]) => count >= threshold)
    .sort((a, b) => b[0].length - a[0].length || b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}

async function writeJsonlLine(stream, value) {
  if (!stream.write(`${JSON.stringify(value)}\n`)) await once(stream, 'drain');
}

function newControlState() {
  return Object.fromEntries(CONTROL_PAIRS.map(([a, b]) => [`${a}_${b}`, { ok: false }]));
}

function updateControlState(state, familyId, label, memberNodes, byNode) {
  const words = new Set();
  for (const node of memberNodes) {
    const member = byNode.get(node);
    if (member) words.add(member.word);
  }
  for (const [a, b] of CONTROL_PAIRS) {
    const key = `${a}_${b}`;
    if (!state[key].ok && words.has(a) && words.has(b)) state[key] = { ok: true, family_id: familyId, label };
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await mkdir(options.outputRoot, { recursive: true });

  const { byNode, candidateCount } = await loadCandidateNodes(options.candidateRoot, options.languages);
  console.error(`[family-index] loaded ${byNode.size} unique candidate lemmas from ${candidateCount} index entries`);

  const targetNodes = new Set(byNode.keys());
  const { parents, stats: graphStats } = await collectParentGraph(options.etymwn, targetNodes, options.maxDepth);
  targetNodes.clear();
  console.error(`[family-index] parent graph nodes=${parents.size}`);

  const candidateMembers = new Map();
  const distanceStats = new Map();
  let processedNodes = 0;
  for (const node of byNode.keys()) {
    const distances = ancestorDistances(node, parents, options.maxDepth);
    const selected = selectFamilyAncestors(distances, options.maxFamiliesPerLemma);
    for (const { ancestor, distance } of selected) {
      let members = candidateMembers.get(ancestor);
      if (!members) {
        members = new Set();
        candidateMembers.set(ancestor, members);
      }
      members.add(node);
      const stats = distanceStats.get(ancestor) ?? { sum: 0, count: 0 };
      stats.sum += distance;
      stats.count += 1;
      distanceStats.set(ancestor, stats);
    }
    processedNodes += 1;
    if (processedNodes % 250000 === 0) console.error(`[family-index] classified ${processedNodes}/${byNode.size}`);
  }
  parents.clear();
  console.error(`[family-index] raw family roots=${candidateMembers.size}`);

  const validFamilies = [...candidateMembers.entries()]
    .filter(([, members]) => members.size >= 2)
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]));

  const familyIdsByNode = new Map();
  const summaries = [];
  const controlChecks = newControlState();
  const familyStream = createWriteStream(join(options.outputRoot, 'family-members.jsonl'), { encoding: 'utf8' });

  for (const [ancestor, memberNodes] of validFamilies) {
    const { lang, word } = parseKey(ancestor);
    const id = `${lang}:${word}`;
    const distance = distanceStats.get(ancestor) ?? { sum: 0, count: 1 };
    const avgDistance = distance.sum / Math.max(1, distance.count);
    const observedPrefix = inferObservedPrefix(memberNodes, byNode);
    const label = observedPrefix || word;
    const languages = new Set();
    const members = [];
    for (const node of memberNodes) {
      const member = byNode.get(node);
      if (!member) continue;
      languages.add(member.language);
      members.push({ language: member.language, word: member.word, display: member.display, frequency_score: member.frequency_score });
      const ids = familyIdsByNode.get(node) ?? [];
      if (ids.length < options.maxFamiliesPerLemma) ids.push(id);
      familyIdsByNode.set(node, ids);
    }
    members.sort((a, b) => b.frequency_score - a.frequency_score || a.language.localeCompare(b.language) || a.word.localeCompare(b.word));
    const confidence = familyPriority(ancestor) <= 1 && avgDistance <= 5 ? 'A' : avgDistance <= 5 ? 'B' : 'C';
    const summary = {
      id,
      label,
      etymon: { language: lang, word },
      member_count: members.length,
      language_count: languages.size,
      languages: [...languages].sort(),
      average_etymological_distance: Number(avgDistance.toFixed(3)),
      confidence,
      sample: members.slice(0, 20)
    };
    summaries.push(summary);
    updateControlState(controlChecks, id, label, memberNodes, byNode);
    await writeJsonlLine(familyStream, { ...summary, members });
  }
  familyStream.end();
  await once(familyStream, 'finish');
  candidateMembers.clear();
  distanceStats.clear();

  await writeFile(join(options.outputRoot, 'families.json'), JSON.stringify(summaries, null, 2));

  const membershipStreams = new Map();
  for (const language of options.languages) {
    membershipStreams.set(language, createWriteStream(join(options.outputRoot, `${language}.jsonl`), { encoding: 'utf8' }));
  }
  const membershipCounts = Object.fromEntries(options.languages.map(lang => [lang, 0]));
  const controlPresence = Object.fromEntries(CONTROL_PAIRS.flat().map(word => [word, false]));
  for (const [node, member] of byNode) {
    const families = familyIdsByNode.get(node);
    if (!families?.length) continue;
    await writeJsonlLine(membershipStreams.get(member.language), {
      word: member.word,
      display: member.display,
      families
    });
    membershipCounts[member.language] += 1;
    if (Object.hasOwn(controlPresence, member.word)) controlPresence[member.word] = true;
  }
  for (const stream of membershipStreams.values()) stream.end();
  await Promise.all([...membershipStreams.values()].map(stream => once(stream, 'finish')));

  const report = {
    version: 2,
    source: basename(options.etymwn),
    languages: options.languages,
    candidate_index_entries: candidateCount,
    unique_candidate_lemmas: byNode.size,
    nodes_with_parents: graphStats.length ? graphStats[0].frontier : 0,
    families: summaries.length,
    memberships: membershipCounts,
    graph_passes: graphStats,
    control_checks: { ...controlChecks, presence: controlPresence },
    largest_families: summaries.slice(0, 30).map(f => ({
      id: f.id,
      label: f.label,
      members: f.member_count,
      languages: f.language_count,
      confidence: f.confidence,
      sample: f.sample.slice(0, 8).map(m => `${m.language}:${m.word}`)
    }))
  };
  await writeFile(join(options.outputRoot, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
