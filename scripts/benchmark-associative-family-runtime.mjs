#!/usr/bin/env node
import { performance } from 'node:perf_hooks';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { FamilyIndexLoader, MAX_FAMILY_ALIAS_FANOUT } from '../associativvordes/js/family-index-loader.js';

const LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'ru'];
const CONTROL_ALIASES = ['manu', 'pede', 'ocul', 'alter', 'regul', 'libert', 'inter'];

export function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
}

function summary(values) {
  return { samples: values.length, p50_ms: percentile(values, 0.50), p95_ms: percentile(values, 0.95), p99_ms: percentile(values, 0.99), max_ms: Math.max(...values, 0) };
}

async function discoverOverflowAlias(root) {
  for (const file of (await readdir(join(root, 'aliases'))).sort()) {
    const aliases = JSON.parse(await readFile(join(root, 'aliases', file), 'utf8'));
    for (const [alias, ids] of Object.entries(aliases)) if (ids.length > MAX_FAMILY_ALIAS_FANOUT) return { alias, fanout: ids.length };
  }
  throw new Error(`No alias exceeds runtime fan-out limit ${MAX_FAMILY_ALIAS_FANOUT}`);
}

function instrumentedLoader(root) {
  const metrics = { reads: 0, bytes: 0, paths: [] };
  const loader = new FamilyIndexLoader({
    baseUrl: '/artifact',
    fetchJson: async url => {
      const path = url.replace(/^\/artifact\//, '');
      const data = await readFile(join(root, path));
      metrics.reads += 1;
      metrics.bytes += data.length;
      metrics.paths.push(path);
      return JSON.parse(data);
    }
  });
  return { loader, metrics };
}

async function timed(loader, alias, language) {
  const started = performance.now();
  const entries = await loader.candidateEntries(alias, language);
  return { elapsed_ms: performance.now() - started, entries };
}

async function benchmark(root) {
  const cold = [], warm = [], cases = [];
  for (const alias of CONTROL_ALIASES) {
    for (const language of LANGUAGES) {
      const coldRun = instrumentedLoader(root);
      const first = await timed(coldRun.loader, alias, language);
      cold.push(first.elapsed_ms);
      const before = { reads: coldRun.metrics.reads, bytes: coldRun.metrics.bytes };
      const second = await timed(coldRun.loader, alias, language);
      warm.push(second.elapsed_ms);
      cases.push({ alias, language, entries: first.entries.length, cold_ms: first.elapsed_ms, warm_ms: second.elapsed_ms, cold_reads: before.reads, cold_bytes: before.bytes, additional_warm_reads: coldRun.metrics.reads - before.reads, additional_warm_bytes: coldRun.metrics.bytes - before.bytes });
    }
  }

  const overflow = await discoverOverflowAlias(root);
  const overflowRun = instrumentedLoader(root);
  let overflowError = null;
  try { await overflowRun.loader.candidateEntries(overflow.alias, 'en'); }
  catch (error) { overflowError = error.message; }
  const forbiddenOverflowReads = overflowRun.metrics.paths.filter(path => path.startsWith('families/') || path.startsWith('members/'));
  if (!overflowError?.includes('exceeds runtime limit') || forbiddenOverflowReads.length) throw new Error(`Fan-out did not fail closed: ${JSON.stringify({ overflow, overflowError, paths: overflowRun.metrics.paths })}`);

  const concurrency = {};
  for (const level of [1, 10, 50, 100]) {
    const run = instrumentedLoader(root);
    const started = performance.now();
    await Promise.all(Array.from({ length: level }, (_, index) => run.loader.candidateEntries(CONTROL_ALIASES[index % CONTROL_ALIASES.length], LANGUAGES[index % LANGUAGES.length])));
    concurrency[level] = { elapsed_ms: performance.now() - started, reads: run.metrics.reads, bytes: run.metrics.bytes };
  }

  const maximumColdReads = Math.max(...cases.map(item => item.cold_reads));
  const maximumColdBytes = Math.max(...cases.map(item => item.cold_bytes));
  const report = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    environment: { node: process.version, storage: 'downloaded_immutable_github_artifacts', network_included: false },
    cold: summary(cold), warm: summary(warm), cases, concurrency,
    fanout_overflow: { ...overflow, error: overflowError, reads: overflowRun.metrics.reads, bytes: overflowRun.metrics.bytes, family_or_member_reads: forbiddenOverflowReads.length },
    slo: {
      maximum_object_reads: { target: 8, observed: maximumColdReads, pass: maximumColdReads <= 8 },
      maximum_transferred_bytes: { target: 2_000_000, observed: maximumColdBytes, pass: maximumColdBytes <= 2_000_000 },
      warm_p95_ms: { target: 1500, observed: summary(warm).p95_ms, pass: summary(warm).p95_ms <= 1500 },
      warm_p99_ms: { target: 3000, observed: summary(warm).p99_ms, pass: summary(warm).p99_ms <= 3000 },
      note: 'Latency excludes Blob, Vercel Function and browser network time; production/staging network SLO remains separately required.'
    }
  };
  report.slo_pass = Object.values(report.slo).every(item => !item || typeof item !== 'object' || item.pass !== false);
  return report;
}

async function main() {
  const root = process.argv[2];
  const output = process.argv[3];
  if (!root || !output) throw new Error('Usage: benchmark-associative-family-runtime.mjs <artifact-root> <output.json>');
  const report = await benchmark(root);
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(error?.stack || error); process.exitCode = 1; });
