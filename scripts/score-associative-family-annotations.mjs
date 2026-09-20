#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { cohensKappa, confusionMatrix, stratifiedClusterBootstrap, weightedPrecision } from './lib/associative-annotation-stats.mjs';

const MEMBERSHIP = ['true_positive', 'false_positive', 'uncertain'];
const EVIDENCE = new Set(['supported', 'contradicted', 'insufficient']);
const CORPUS = new Set(['accepted', 'suspicious', 'rejected', 'requires_manual_review']);
const RUNTIME = new Set(['eligible', 'ineligible', 'uncertain']);
const ERRORS = new Set(['normalization_error', 'morphology_error', 'etymology_error', 'homonymy', 'distant_relation', 'corpus_noise', 'wrong_language', 'wrong_sense', 'unsupported_evidence', 'policy_error', 'other']);
const [aPath, bPath, adjudicationPath, reportPath = 'precision-recall-report.json'] = process.argv.slice(2);
if (!aPath || !bPath || !adjudicationPath) throw new Error('Usage: score-associative-family-annotations.mjs <annotation-a.jsonl> <annotation-b.jsonl> <adjudication.jsonl> [report.json]');

async function rows(path, optional = false) {
  try {
    const text = await readFile(path, 'utf8');
    return text.split('\n').filter(Boolean).map((line, index) => {
      try { return JSON.parse(line); } catch { throw new Error(`${path}:${index + 1}: invalid JSON`); }
    });
  } catch (error) {
    if (optional && error.code === 'ENOENT') return [];
    throw error;
  }
}

function index(values, name) {
  const out = new Map();
  for (const row of values) {
    if (!row.sample_id || out.has(row.sample_id)) throw new Error(`${name}: missing or duplicate sample_id ${row.sample_id}`);
    out.set(row.sample_id, row);
  }
  return out;
}

function problems(row) {
  const found = [];
  if (!row.annotator_id) found.push('annotator_id');
  if (!['human', 'llm'].includes(row.annotator_kind)) found.push('annotator_kind');
  if (!row.protocol_version) found.push('protocol_version');
  if (!MEMBERSHIP.includes(row.membership_verdict)) found.push('membership_verdict');
  if (!Array.isArray(row.error_categories) || row.error_categories.some(value => !ERRORS.has(value))) found.push('error_categories');
  if (!EVIDENCE.has(row.evidence_verdict)) found.push('evidence_verdict');
  if (!CORPUS.has(row.corpus_verdict)) found.push('corpus_verdict');
  if (!RUNTIME.has(row.runtime_eligibility_verdict)) found.push('runtime_eligibility_verdict');
  if (!['low', 'medium', 'high'].includes(row.confidence)) found.push('confidence');
  if (!row.reason?.trim()) found.push('reason');
  if (!Array.isArray(row.sources) || !row.sources.length) found.push('sources');
  if (!row.completed_at || Number.isNaN(Date.parse(row.completed_at))) found.push('completed_at');
  for (const key of ['language', 'family_id', 'sampling_stratum', 'stratum_population', 'stratum_sample_size', 'inclusion_probability', 'sampling_weight']) {
    if (row[key] === undefined || row[key] === null) found.push(key);
  }
  return found;
}

function grouped(values, key) {
  const groups = new Map();
  for (const row of values) {
    const value = String(row[key] ?? 'missing');
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(row);
  }
  return Object.fromEntries([...groups].sort(([a], [b]) => a.localeCompare(b)).map(([name, items]) => [name, items.length < 30 ? { status: 'insufficient_evidence', n: items.length } : { n: items.length, ...weightedPrecision(items) }]));
}

const a = index(await rows(aPath), 'annotation-a');
const b = index(await rows(bPath), 'annotation-b');
if (a.size !== b.size || [...a.keys()].some(id => !b.has(id))) throw new Error('Annotation sample IDs do not match');
const invalidA = [...a.values()].flatMap(row => problems(row).map(field => ({ sample_id: row.sample_id, field })));
const invalidB = [...b.values()].flatMap(row => problems(row).map(field => ({ sample_id: row.sample_id, field })));
const dual = [...a.keys()].filter(id => !problems(a.get(id)).length && !problems(b.get(id)).length);
const sameAnnotator = dual.filter(id => a.get(id).annotator_id === b.get(id).annotator_id);
const withoutHuman = dual.filter(id => a.get(id).annotator_kind !== 'human' && b.get(id).annotator_kind !== 'human');
const disagreements = dual.filter(id => a.get(id).membership_verdict !== b.get(id).membership_verdict);
const uncertain = dual.filter(id => a.get(id).membership_verdict === 'uncertain' || b.get(id).membership_verdict === 'uncertain');

const adjudication = index(await rows(adjudicationPath, true), 'adjudication');
const requiresAdjudication = new Set([...disagreements, ...uncertain]);
const unresolved = [...requiresAdjudication].filter(id => !MEMBERSHIP.includes(adjudication.get(id)?.final_membership_verdict) || adjudication.get(id)?.resolution_status === 'unresolved_uncertain');
const resolved = dual.map(id => {
  const left = a.get(id), right = b.get(id), decision = adjudication.get(id);
  const verdict = left.membership_verdict === right.membership_verdict && left.membership_verdict !== 'uncertain'
    ? left.membership_verdict : decision?.final_membership_verdict;
  return { ...left, final_membership_verdict: verdict };
}).filter(row => MEMBERSHIP.includes(row.final_membership_verdict));

const left = dual.map(id => a.get(id).membership_verdict);
const right = dual.map(id => b.get(id).membership_verdict);
const complete = a.size === 9600 && invalidA.length === 0 && invalidB.length === 0 && sameAnnotator.length === 0 && withoutHuman.length === 0 && unresolved.length === 0;
const report = {
  schema_version: 2,
  generated_at: new Date().toISOString(),
  sample_rows: a.size,
  complete,
  qa: { invalid_annotation_a: invalidA.length, invalid_annotation_b: invalidB.length, same_annotator_rows: sameAnnotator.length, rows_without_human: withoutHuman.length, unresolved_adjudication: unresolved.length },
  agreement: {
    n: dual.length,
    raw: dual.length ? left.filter((value, i) => value === right[i]).length / dual.length : null,
    cohens_kappa: cohensKappa(left, right, MEMBERSHIP),
    confusion_matrix: confusionMatrix(left, right, MEMBERSHIP),
    uncertain_rate_a: dual.length ? left.filter(value => value === 'uncertain').length / dual.length : null,
    uncertain_rate_b: dual.length ? right.filter(value => value === 'uncertain').length / dual.length : null
  },
  precision: resolved.length ? { ...weightedPrecision(resolved), confidence_interval: stratifiedClusterBootstrap(resolved) } : null,
  by_language: grouped(resolved, 'language'),
  by_family_source: grouped(resolved, 'family_source'),
  by_review_status: grouped(resolved, 'review_status'),
  recall: null,
  recall_status: 'requires_independently_sampled_dual_reviewed_gold'
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!complete) process.exitCode = 2;
