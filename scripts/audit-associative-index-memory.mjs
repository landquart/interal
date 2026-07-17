#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { performance } from 'node:perf_hooks';

const BUILDER = 'scripts/build-associative-candidate-index.mjs';
const DEFAULT_INPUT_ROOT = 'tests/fixtures/associative-frequency';
const DEFAULT_LIMITS = [1000, 5000];

function parseArgs(argv) {
  const options = { language: 'en', inputRoot: DEFAULT_INPUT_ROOT, limits: DEFAULT_LIMITS, report: '.tmp/associative-index-memory-report.json' };
  for (const arg of argv) {
    if (arg.startsWith('--language=')) options.language = arg.slice('--language='.length).trim().toLowerCase();
    else if (arg.startsWith('--input-root=')) options.inputRoot = arg.slice('--input-root='.length);
    else if (arg.startsWith('--source-file=')) options.sourceFile = arg.slice('--source-file='.length);
    else if (arg.startsWith('--limits=')) options.limits = arg.slice('--limits='.length).split(',').map(Number);
    else if (arg.startsWith('--report=')) options.report = arg.slice('--report='.length);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!['en', 'de', 'fr', 'es', 'it', 'ru'].includes(options.language)) throw new Error(`Unsupported language: ${options.language}`);
  if (!options.limits.length || options.limits.some(limit => !Number.isInteger(limit) || limit <= 0 || limit > 250000)) {
    throw new Error('--limits must contain positive integers not exceeding 250000');
  }
  return options;
}

async function readLinuxRss(pid) {
  try {
    const status = await readFile(`/proc/${pid}/status`, 'utf8');
    const rss = Number(status.match(/^VmRSS:\s+(\d+)\s+kB$/m)?.[1] || 0) * 1024;
    const hwm = Number(status.match(/^VmHWM:\s+(\d+)\s+kB$/m)?.[1] || 0) * 1024;
    return { rss, hwm };
  } catch {
    return { rss: 0, hwm: 0 };
  }
}

async function runSample(options, maxRecords) {
  const args = [
    BUILDER,
    `--languages=${options.language}`,
    `--input-root=${options.inputRoot}`,
    `--max-records=${maxRecords}`,
    '--dry-run',
    '--no-write'
  ];
  if (options.sourceFile) args.push(`--source-file=${options.sourceFile}`);

  const started = performance.now();
  const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  let peakRss = 0;
  let peakHwm = 0;
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });

  const sampler = setInterval(async () => {
    const memory = await readLinuxRss(child.pid);
    peakRss = Math.max(peakRss, memory.rss);
    peakHwm = Math.max(peakHwm, memory.hwm);
  }, 25);

  const exit = await new Promise(resolve => {
    child.on('exit', (code, signal) => resolve({ code: code ?? 1, signal: signal || null }));
  });
  clearInterval(sampler);
  const finalMemory = await readLinuxRss(child.pid);
  peakRss = Math.max(peakRss, finalMemory.rss);
  peakHwm = Math.max(peakHwm, finalMemory.hwm);

  let diagnostics = null;
  try { diagnostics = stdout.trim() ? JSON.parse(stdout) : null; } catch { diagnostics = null; }

  return {
    max_records: maxRecords,
    exit_code: exit.code,
    signal: exit.signal,
    duration_ms: Math.round((performance.now() - started) * 100) / 100,
    peak_rss_bytes: peakRss,
    peak_hwm_bytes: peakHwm,
    records_read: diagnostics?.records_read ?? null,
    valid_lemmas: diagnostics?.valid_lemmas ?? null,
    parser_mode: options.inputRoot === DEFAULT_INPUT_ROOT ? 'fixture_legacy_json' : 'builder_selected',
    stderr: stderr.trim().slice(0, 2000)
  };
}

export async function auditAssociativeIndexMemory(options) {
  const samples = [];
  for (const limit of options.limits) {
    const sample = await runSample(options, limit);
    samples.push(sample);
    if (sample.exit_code !== 0 || sample.signal) break;
  }
  return {
    generated_at: new Date().toISOString(),
    language: options.language,
    input_root: options.inputRoot,
    source_file: options.sourceFile || null,
    bounded: true,
    limits: options.limits,
    samples,
    conclusion: samples.some(sample => sample.exit_code !== 0 || sample.signal)
      ? 'A bounded sample failed; inspect stderr before increasing the limit.'
      : 'Bounded samples completed. This report does not prove that a full production build fits in memory.'
  };
}

const options = parseArgs(process.argv.slice(2));
const report = await auditAssociativeIndexMemory(options);
await mkdir(dirname(options.report), { recursive: true });
await writeFile(options.report, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (report.samples.some(sample => sample.exit_code !== 0 || sample.signal)) process.exitCode = 1;
