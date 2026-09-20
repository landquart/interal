#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { wilson } from './lib/associative-annotation-stats.mjs';

const LABELS = new Set(['true_positive','false_positive','uncertain','normalization_error','morphology_error','etymology_error','homonymy','distant_relation','corpus_noise']);
const [aPath, bPath, adjudicationPath, reportPath = 'precision-recall-report.json'] = process.argv.slice(2);
if (!aPath || !bPath || !adjudicationPath) throw new Error('Usage: score-associative-family-annotations.mjs <annotation-a.jsonl> <annotation-b.jsonl> <adjudication.jsonl> [report.json]');

async function rows(path) {
  const text = await readFile(path, 'utf8');
  return text.split('\n').filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); } catch { throw new Error(`${path}:${index + 1}: invalid JSON`); }
  });
}

function index(values, name) {
  const out = new Map();
  for (const row of values) {
    if (!row.sample_id || out.has(row.sample_id)) throw new Error(`${name}: missing or duplicate sample_id ${row.sample_id}`);
    out.set(row.sample_id, row);
  }
  return out;
}

function precision(values) {
  const decided = values.filter(row => row.label !== 'uncertain');
  const positives = decided.filter(row => row.label === 'true_positive').length;
  return { ...wilson(positives, decided.length), numerator: positives, denominator: decided.length, uncertain: values.length - decided.length };
}

function grouped(values, key) {
  const groups = new Map();
  for (const row of values) {
    const value = String(row[key] ?? 'missing');
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(row);
  }
  return Object.fromEntries([...groups].sort(([a],[b]) => a.localeCompare(b)).map(([name, items]) => [name, precision(items)]));
}

const a = index(await rows(aPath), 'annotation-a');
const b = index(await rows(bPath), 'annotation-b');
if (a.size !== b.size || [...a.keys()].some(id => !b.has(id))) throw new Error('Annotation sample IDs do not match');
const incompleteA = [...a.values()].filter(row => !LABELS.has(row.label));
const incompleteB = [...b.values()].filter(row => !LABELS.has(row.label));
const annotatorsA = new Set([...a.values()].map(row => row.annotator).filter(Boolean));
const annotatorsB = new Set([...b.values()].map(row => row.annotator).filter(Boolean));
const sharedAnnotators = [...annotatorsA].filter(value => annotatorsB.has(value));
const disagreements = [...a.keys()].filter(id => LABELS.has(a.get(id).label) && LABELS.has(b.get(id).label) && a.get(id).label !== b.get(id).label);

let adjudication = new Map();
try { adjudication = index(await rows(adjudicationPath), 'adjudication'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const unresolved = disagreements.filter(id => !LABELS.has(adjudication.get(id)?.label));
const resolved = [...a.keys()].map(id => {
  const left = a.get(id), right = b.get(id);
  const final = left.label === right.label ? left.label : adjudication.get(id)?.label;
  return { ...left, label: final, annotation_a: left.label, annotation_b: right.label, adjudication: adjudication.get(id) || null };
}).filter(row => LABELS.has(row.label));

const agreementDenominator = a.size - incompleteA.length - incompleteB.length;
const agreements = agreementDenominator - disagreements.length;
const report = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  sample_rows: a.size,
  complete: incompleteA.length === 0 && incompleteB.length === 0 && sharedAnnotators.length === 0 && unresolved.length === 0,
  annotation_a_incomplete: incompleteA.length,
  annotation_b_incomplete: incompleteB.length,
  shared_annotators: sharedAnnotators,
  raw_agreement: agreementDenominator ? agreements / agreementDenominator : null,
  disagreements: disagreements.length,
  unresolved_disagreements: unresolved.length,
  precision: precision(resolved),
  by_language: grouped(resolved, 'language'),
  by_family_source: grouped(resolved, 'family_source'),
  by_review_status: grouped(resolved, 'review_status'),
  by_relation_type: grouped(resolved.map(row => ({ ...row, relation_type: row.relation_types?.[0] || 'none' })), 'relation_type'),
  recall: null,
  recall_status: 'requires_completed_false-negative-gold'
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.complete) process.exitCode = 2;
