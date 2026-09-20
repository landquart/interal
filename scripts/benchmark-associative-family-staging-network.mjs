import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
import { FamilyIndexLoader } from '../associativvordes/js/family-index-loader.js';

const [prefix, output] = process.argv.slice(2);
if (!prefix || !output) throw new Error('Usage: benchmark-associative-family-staging-network.mjs <staging-prefix> <output.json>');
process.env.ASSOCIATIVE_FAMILY_PREFIX = prefix;
const { default: handler } = await import(`../api/family-index.js?prefix=${encodeURIComponent(prefix)}`);

async function invoke(path) {
  const started = performance.now();
  let statusCode = 200, body, headers = {};
  const response = {
    status(value) { statusCode = value; return this; },
    setHeader(key, value) { headers[key.toLowerCase()] = value; },
    json(value) { body = Buffer.from(JSON.stringify(value)); return this; },
    send(value) { body = Buffer.isBuffer(value) ? value : Buffer.from(String(value)); return this; }
  };
  await handler({ query: { path } }, response);
  if (statusCode !== 200) throw new Error(`Staging API ${path} returned ${statusCode}: ${body}`);
  return { json: JSON.parse(body), elapsed_ms: performance.now() - started, response_bytes: body.length, headers };
}

const requests = [];
const artifactManifest = (await invoke('manifest.json')).json;
const buildReport = (await invoke('report.json')).json;
const loader = new FamilyIndexLoader({ baseUrl: '/staging?path=', fetchJson: async url => {
  const result = await invoke(url.slice(url.indexOf('path=') + 5));
  requests.push({ path: url.slice(url.indexOf('path=') + 5), elapsed_ms: result.elapsed_ms, response_bytes: result.response_bytes });
  return result.json;
} });
const cases = [];
for (const alias of ['manu','pede','ocul','alter','regul','libert','inter']) {
  for (const language of ['en','de','fr','es','it','ru']) {
    const started = performance.now();
    const entries = await loader.candidateEntries(alias, language);
    cases.push({ alias, language, elapsed_ms: performance.now() - started, entries: entries.length, top5: entries.slice(0, 5).map(item => item.word) });
  }
}
let overflow_error = null;
try { await new FamilyIndexLoader({ baseUrl: '/staging?path=', fetchJson: async url => (await invoke(url.slice(url.indexOf('path=') + 5))).json }).candidateEntries('net', 'en'); }
catch (error) { overflow_error = error.message; }
const elapsed = cases.map(item => item.elapsed_ms).sort((a,b)=>a-b);
const pct = p => elapsed[Math.min(elapsed.length - 1, Math.ceil(elapsed.length * p) - 1)];
const report = { schema_version: 1, generated_at: new Date().toISOString(), prefix, network: 'private Vercel Blob Range through API handler', artifact_manifest: artifactManifest, build_summary: { version: buildReport.version, generated_at: buildReport.generated_at, provenance: buildReport.provenance, total_families: buildReport.total_families, aliases_in_lookup: buildReport.aliases_in_lookup, source_entries: buildReport.source_entries, assignment_stats: buildReport.assignment_stats, controls_ok: buildReport.controls_ok, invariants: buildReport.invariants }, cases, requests, latency: { p50_ms: pct(.5), p95_ms: pct(.95), p99_ms: pct(.99), max_ms: elapsed.at(-1) }, overflow_error, verdict: overflow_error?.includes('fan-out 28 exceeds runtime limit 25') && pct(.95) <= 4000 ? 'pass' : 'fail', limitations: ['local Node runner invokes the serverless handler directly; Vercel edge routing overhead is not included'] };
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ verdict: report.verdict, latency: report.latency, requests: requests.length, overflow_error }, null, 2));
if (report.verdict !== 'pass') process.exitCode = 2;
