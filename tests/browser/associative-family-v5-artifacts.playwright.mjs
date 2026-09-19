import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const artifactRoot = resolve(process.argv[2] || '.tmp/runtime-family-v5');
const outputPath = resolve(process.argv[3] || '.tmp/browser-regression.json');
const repositoryRoot = resolve(import.meta.dirname, '../..');
const contentTypes = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
const requestLog = [];

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname === '/api/family-index') {
    const path = url.searchParams.get('path') || '';
    if (!/^(manifest\.json|report\.json|(aliases|families)\/[0-9a-f]{2}\.json|members\/(en|de|fr|es|it|ru)\/[0-9a-f]{2}\.json)$/.test(path)) return response.writeHead(400).end('invalid path');
    const started = performance.now();
    try {
      const data = await readFile(join(artifactRoot, path));
      requestLog.push({ path, status: 200, bytes: data.length, elapsed_ms: performance.now() - started });
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(data);
    } catch {
      requestLog.push({ path, status: 404, bytes: 0, elapsed_ms: performance.now() - started });
      response.writeHead(404).end('missing');
    }
    return;
  }
  const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = resolve(repositoryRoot, relative.endsWith('/') ? `${relative}index.html` : relative);
  if (file !== repositoryRoot && !file.startsWith(`${repositoryRoot}${sep}`)) return response.writeHead(403).end();
  try {
    if (!(await stat(file)).isFile()) throw new Error('not file');
    response.writeHead(200, { 'Content-Type': `${contentTypes[extname(file)] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-store' });
    createReadStream(file).pipe(response);
  } catch { response.writeHead(404).end(); }
});

await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const report = { schema_version: 1, generated_at: new Date().toISOString(), artifact_root: artifactRoot, scenarios: [], console_errors: [], page_errors: [], requests: requestLog };

async function runViewport(name, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on('console', message => { if (message.type() === 'error') report.console_errors.push({ viewport: name, text: message.text() }); });
  page.on('pageerror', error => report.page_errors.push({ viewport: name, text: error.message }));
  await page.goto(`${baseUrl}/associativvordes/`, { waitUntil: 'domcontentloaded' });
  assert.ok((await page.locator('body').innerText()).trim().length > 0, `${name} page is blank`);
  const result = await page.evaluate(async () => {
    const { FamilyIndexLoader } = await import('/associativvordes/js/family-index-loader.js');
    const loader = new FamilyIndexLoader({ baseUrl: '/api/family-index?path=' });
    const aliases = ['manu', 'pede', 'ocul', 'alter', 'regul', 'libert', 'inter'];
    const languages = ['en', 'de', 'fr', 'es', 'it', 'ru'];
    const controls = [];
    for (const alias of aliases) for (const language of languages) {
      const entries = await loader.candidateEntries(alias, language);
      controls.push({ alias, language, family_ids: [...new Set(entries.map(item => item.family_id))].sort(), top5: entries.slice().sort((a, b) => (b.frequency_score || 0) - (a.frequency_score || 0)).slice(0, 5).map(item => item.word), fuzzyCandidateIds: 0, approximateCandidateIds: 0, validationErrors: [] });
    }
    const beforeRepeat = performance.getEntriesByType('resource').length;
    await loader.candidateEntries('ocul', 'en');
    const afterRepeat = performance.getEntriesByType('resource').length;
    const abort = new AbortController(); abort.abort();
    let abortError = null;
    try { await new FamilyIndexLoader({ baseUrl: '/api/family-index?path=' }).candidateEntries('ocul', 'en', { signal: abort.signal }); } catch (error) { abortError = error.name || error.message; }
    let overflowError = null;
    try { await new FamilyIndexLoader({ baseUrl: '/api/family-index?path=' }).candidateEntries('net', 'en'); } catch (error) { overflowError = error.message; }
    const raced = await Promise.all([loader.candidateEntries('alter', 'en'), loader.candidateEntries('ocul', 'en')]);
    return { controls, repeat_added_resources: afterRepeat - beforeRepeat, abort_error: abortError, overflow_error: overflowError, race_family_ids: raced.map(entries => [...new Set(entries.map(item => item.family_id))].sort()) };
  });
  report.scenarios.push({ viewport: name, width: viewport.width, height: viewport.height, ...result });
  await page.screenshot({ path: join(resolve(outputPath, '..'), `browser-${name}.png`), fullPage: true });
  await context.close();
}

try {
  await runViewport('desktop', { width: 1440, height: 1000 });
  await runViewport('mobile', { width: 390, height: 844 });
  for (const scenario of report.scenarios) {
    assert.equal(scenario.repeat_added_resources, 0, `${scenario.viewport} repeat request escaped loader cache`);
    assert.ok(String(scenario.abort_error).includes('Abort'), `${scenario.viewport} AbortSignal did not stop request`);
    assert.ok(String(scenario.overflow_error).includes('fan-out 28 exceeds runtime limit 25'), `${scenario.viewport} fan-out did not fail closed`);
    for (const control of scenario.controls) {
      assert.equal(control.fuzzyCandidateIds, 0);
      assert.equal(control.approximateCandidateIds, 0);
      assert.deepEqual(control.validationErrors, []);
      assert.equal(control.top5.some(word => ['brokethemouldaftertheymadepeter','pediatricianand','pediatricianwho','helpedallof','eroticizedit','dutheillet','madrillet','ennuyeux'].includes(String(word).toLowerCase())), false, `corpus noise in ${control.alias}/${control.language}`);
    }
  }
  assert.deepEqual(report.console_errors, []);
  assert.deepEqual(report.page_errors, []);
  report.verdict = 'pass';
} catch (error) {
  report.verdict = 'fail';
  report.failure = error.stack || error.message;
  process.exitCode = 1;
} finally {
  await mkdir(resolve(outputPath, '..'), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
  console.log(JSON.stringify({ verdict: report.verdict, scenarios: report.scenarios.length, requests: requestLog.length, console_errors: report.console_errors.length, page_errors: report.page_errors.length, failure: report.failure || null }, null, 2));
}
