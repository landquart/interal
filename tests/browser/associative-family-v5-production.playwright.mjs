import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';

const productionUrl = (process.argv[2] || 'https://interal.vercel.app').replace(/\/$/, '');
const outputPath = resolve(process.argv[3] || '.tmp/family-v5-production-regression.json');
const browser = await chromium.launch({ headless: true });
const report = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  production_url: productionUrl,
  expected_source_run_id: 35647932153,
  scenarios: [],
  transport: {},
  console_errors: [],
  page_errors: []
};

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] || 0;
};

async function runViewport(name, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on('console', message => { if (message.type() === 'error') report.console_errors.push({ viewport: name, text: message.text() }); });
  page.on('pageerror', error => report.page_errors.push({ viewport: name, text: error.message }));
  await page.goto(`${productionUrl}/associativvordes/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  assert.ok((await page.locator('body').innerText()).trim().length > 0, `${name} page is blank`);

  const result = await page.evaluate(async () => {
    const { FamilyIndexLoader } = await import('./js/family-index-loader.js');
    const baseUrl = '/associativvordes/family-index-v5';
    const loader = new FamilyIndexLoader({ baseUrl });
    const manifestResponse = await fetch(`${baseUrl}/manifest.json`);
    const reportResponse = await fetch(`${baseUrl}/report.json`);
    const provenanceResponse = await fetch(`${baseUrl}/repository-provenance.json`);
    if (!manifestResponse.ok || !reportResponse.ok || !provenanceResponse.ok) throw new Error('Production metadata request failed');
    const [manifest, buildReport, provenance] = await Promise.all([manifestResponse.json(), reportResponse.json(), provenanceResponse.json()]);

    const controls = [];
    const aliases = ['manu', 'pede', 'ocul', 'alter', 'regul', 'liber', 'inter'];
    const languages = ['en', 'de', 'fr', 'es', 'it', 'ru'];
    const durations = [];
    for (const alias of aliases) for (const language of languages) {
      const started = performance.now();
      const entries = await loader.candidateEntries(alias, language);
      durations.push(performance.now() - started);
      controls.push({
        alias,
        language,
        family_ids: [...new Set(entries.map(item => item.family_id))].sort(),
        top5: entries.slice().sort((a, b) => (b.frequency_score || 0) - (a.frequency_score || 0)).slice(0, 5).map(item => item.word),
        validationErrors: []
      });
    }

    const beforeRepeat = performance.getEntriesByType('resource').length;
    await loader.candidateEntries('liber', 'en');
    const afterRepeat = performance.getEntriesByType('resource').length;

    const abort = new AbortController();
    abort.abort();
    let abortError = null;
    try { await new FamilyIndexLoader({ baseUrl }).candidateEntries('liber', 'en', { signal: abort.signal }); }
    catch (error) { abortError = error.name || error.message; }

    let overflowError = null;
    try { await new FamilyIndexLoader({ baseUrl }).candidateEntries('net', 'en'); }
    catch (error) { overflowError = error.message; }

    const raced = await Promise.all([
      new FamilyIndexLoader({ baseUrl }).candidateEntries('alter', 'en'),
      new FamilyIndexLoader({ baseUrl }).candidateEntries('ocul', 'en')
    ]);

    const resources = performance.getEntriesByType('resource')
      .filter(item => item.name.includes('/family-index-v5/'))
      .map(item => ({ name: item.name.replace(location.origin, ''), duration_ms: item.duration, encoded_bytes: item.encodedBodySize || 0, decoded_bytes: item.decodedBodySize || 0 }));

    return {
      manifest: { version: manifest.version, source_run_id: manifest.repository_storage?.immutable_source_run_id, encoding: manifest.repository_storage?.encoding },
      build_report: { source_run_id: buildReport.provenance?.workflow_run_id, controls_ok: buildReport.controls_ok, liber_ok: buildReport.controls?.['family:liber']?.ok, has_libert: Object.hasOwn(buildReport.controls || {}, 'family:libert'), invariants: buildReport.invariants },
      provenance,
      controls,
      durations,
      repeat_added_resources: afterRepeat - beforeRepeat,
      abort_error: abortError,
      overflow_error: overflowError,
      race_family_ids: raced.map(entries => [...new Set(entries.map(item => item.family_id))].sort()),
      resources
    };
  });

  for (const control of result.controls) {
    assert.equal(control.family_ids.includes('family:libert'), false, `stale family:libert in ${control.alias}/${control.language}`);
    assert.equal(control.top5.some(word => ['brokethemouldaftertheymadepeter','pediatricianand','pediatricianwho','helpedallof','eroticizedit','dutheillet','madrillet','ennuyeux'].includes(String(word).toLowerCase())), false, `corpus noise in ${control.alias}/${control.language}`);
  }
  assert.equal(result.manifest.version, '5');
  assert.equal(Number(result.manifest.source_run_id), 35647932153);
  assert.equal(result.manifest.encoding, 'gzip');
  assert.equal(String(result.build_report.source_run_id), '35647932153');
  assert.equal(result.build_report.controls_ok, true);
  assert.equal(result.build_report.liber_ok, true);
  assert.equal(result.build_report.has_libert, false);
  assert.equal(result.provenance.source_run_id, 35647932153);
  assert.equal(result.provenance.storage, 'git_repository_static_files');
  assert.equal(result.repeat_added_resources, 0);
  assert.ok(String(result.abort_error).includes('Abort'));
  assert.ok(String(result.overflow_error).includes('fan-out 28 exceeds runtime limit 25'));
  const liber = result.controls.filter(item => item.alias === 'liber');
  assert.equal(liber.length, 6);
  for (const control of liber) assert.deepEqual(control.family_ids, ['family:liber'], `liber failed for ${control.language}`);

  report.scenarios.push({
    viewport: name,
    width: viewport.width,
    height: viewport.height,
    ...result,
    latency: { samples: result.durations.length, p50_ms: percentile(result.durations, .5), p95_ms: percentile(result.durations, .95), p99_ms: percentile(result.durations, .99), max_ms: Math.max(...result.durations) }
  });
  await page.screenshot({ path: resolve(dirname(outputPath), `family-v5-production-${name}.png`), fullPage: true });
  await context.close();
}

async function runTransportChecks() {
  const page = await browser.newPage();
  await page.goto(`${productionUrl}/associativvordes/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  report.transport = await page.evaluate(async () => {
    const { FamilyIndexLoader } = await import('./js/family-index-loader.js');
    const result = {};
    for (const [name, errorFactory] of [
      ['offline', () => new TypeError('Failed to fetch')],
      ['timeout', () => new DOMException('Timed out', 'TimeoutError')],
      ['corrupt', () => new SyntaxError('Unexpected token')],
      ['not_found', () => new Error('Family index request failed: 404')]
    ]) {
      let calls = 0;
      const loader = new FamilyIndexLoader({ fetchJson: async () => { calls += 1; throw errorFactory(); } });
      let first = null, second = null;
      try { await loader.manifest(); } catch (error) { first = { name: error.name, message: error.message }; }
      try { await loader.manifest(); } catch (error) { second = { name: error.name, message: error.message }; }
      result[name] = { first, second, calls, cache_evicted: calls === 2 };
    }
    return result;
  });
  for (const [name, value] of Object.entries(report.transport)) {
    assert.ok(value.first && value.second, `${name} did not fail closed`);
    assert.equal(value.cache_evicted, true, `${name} poisoned loader cache`);
  }
  await page.close();
}

try {
  await mkdir(dirname(outputPath), { recursive: true });
  await runViewport('desktop', { width: 1440, height: 1000 });
  await runViewport('mobile', { width: 390, height: 844 });
  await runTransportChecks();
  assert.deepEqual(report.console_errors, []);
  assert.deepEqual(report.page_errors, []);
  report.verdict = 'pass';
} catch (error) {
  report.verdict = 'fail';
  report.failure = error.stack || error.message;
  process.exitCode = 1;
} finally {
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
  console.log(JSON.stringify({ verdict: report.verdict, scenarios: report.scenarios.length, transport: Object.keys(report.transport), failure: report.failure || null }, null, 2));
}
