import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml'
};

const server = createServer(async (request, response) => {
  const requestPath = new URL(request.url, 'http://127.0.0.1').pathname;
  const relativePath = requestPath === '/' ? 'index.html' : decodeURIComponent(requestPath).replace(/^\/+/, '');
  const filePath = resolve(repositoryRoot, relativePath.endsWith('/') ? `${relativePath}index.html` : relativePath);
  if (filePath !== repositoryRoot && !filePath.startsWith(`${repositoryRoot}${sep}`)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error('not a file');
    response.writeHead(200, {
      'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((resolveListen, rejectListen) => {
  server.once('error', rejectListen);
  server.listen(0, '127.0.0.1', resolveListen);
});

const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
const runtimeAdapter = `
import { runAssociativeCalculation } from './js/associative-calculation-runner.js';
import { createEmptyAssociativeState } from './js/associative-state.js';

const languages = [
  { code: 'en', group: 'Germanic' },
  { code: 'de', group: 'Germanic' },
  { code: 'fr', group: 'Romance' },
  { code: 'es', group: 'Romance' },
  { code: 'it', group: 'Romance' },
  { code: 'ru', group: 'Slavic' }
];
const button = document.getElementById('calculateBtn');
const controller = window.InteralButtonStatus.createButtonStatusController({
  selector: '#calculateBtn',
  getDefaultText: () => 'Рассчитать',
  getSuccessText: () => 'Готово',
  getErrorText: () => 'Ошибка расчёта',
  successDelayMs: 80
});

window.__associativeStages = [];
window.__associativeRunCount = 0;
window.__failTranslation = false;
let activeRunId = 0;

function candidate(language) {
  return {
    word: 'alter-' + language.code,
    model: 'alter-' + language.code,
    model_key: language.code + '|root||alter|',
    frequency_score: 80,
    selected: true,
    parser_version: '2.0.0',
    morpheme_analysis: {
      parser_version: '2.0.0',
      language: language.code,
      element_type: 'root',
      model_key: language.code + '|root||alter|'
    }
  };
}

async function calculate() {
  const runId = ++activeRunId;
  window.__associativeRunCount += 1;
  const events = [];
  window.__associativeStages = events;
  try {
    await runAssociativeCalculation({
      input: {
        root: document.getElementById('rootInput').value,
        meaning: document.getElementById('meaningInput').value,
        maxModels: 5
      },
      state: createEmptyAssociativeState({ languages }),
      runId,
      dependencies: {
        languages,
        eventLog: events,
        isCurrentRun: candidateRunId => candidateRunId === activeRunId,
        buttonStatusController: controller,
        buttonTexts: {
          start: 'Расчёт...',
          done: 'Готово',
          error: 'Ошибка расчёта'
        },
        targetTranslator: {
          async translate() {
            events.push('mock:translation-request');
            if (window.__failTranslation) throw new Error('mock translation failure');
            return Object.fromEntries(languages.map(language => [language.code, 'other']));
          }
        },
        candidateIndexLoader: {
          async load(language) {
            events.push('mock:index-request:' + language.code);
            return [candidate(language)];
          }
        },
        candidateAudit: {
          async audit({ candidatesByLanguage }) {
            events.push('mock:audit-request');
            return { candidatesByLanguage, warnings: [], diagnostics: { status: 'completed' } };
          }
        },
        candidateFinalizer: { finalize(_language, candidates) { return candidates; } },
        candidateAnalyzer: {
          async analyze(_language, item) {
            events.push('mock:primary-request');
            return {
              ...item,
              selected: true,
              final_score: 40,
              analysis: {
                final_score: 40,
                status: 'completed',
                association: { semantic_confirmed: true }
              }
            };
          }
        },
        candidatePostValidator: {
          async validate({ candidatesByLanguage }) {
            events.push('mock:final-validation-request');
            return { candidatesByLanguage, warnings: [], diagnostics: { status: 'completed' } };
          }
        },
        languageScore: {
          calculate() {
            return { sum: 40, normalized: 40, count: 1 };
          }
        },
        finalScore: {
          calculate() {
            return {
              finalAssociation: 42.5,
              totalAssociation: 240,
              representedLanguages: 6,
              representedGroups: 3
            };
          }
        },
        renderer: {
          async renderFinal(state) {
            events.push('mock:render');
            const result = state.finalAssociationResult;
            const resultSection = document.getElementById('resultSection');
            const languagesSection = document.getElementById('languagesSection');
            resultSection.hidden = false;
            languagesSection.hidden = false;
            document.getElementById('resultBox').innerHTML =
              '<span data-testid="fa">FA: ' + String(result.finalAssociation) + '%</span>' +
              '<span data-testid="ta">TA: ' + String(result.totalAssociation) + '</span>';
            document.getElementById('languagePanel').textContent = 'alter';
          }
        },
        stateStorage: {
          async save() {
            events.push('mock:saved');
          }
        }
      }
    });
  } catch (error) {
    window.__lastAssociativeError = error.message;
  }
}

button.addEventListener('click', calculate);
window.__associativeReady = true;
`;

async function configurePage(page) {
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 1;
  });
  await page.route('**/associativvordes/script.js*', route => route.fulfill({
    status: 200,
    contentType: 'text/javascript; charset=utf-8',
    body: runtimeAdapter
  }));
  await page.goto(`${baseUrl}/associativvordes/`);
  await page.waitForFunction(() => window.__associativeReady === true, undefined, { polling: 25 });
}

async function runSuccessfulCalculation(page) {
  const previousRunCount = await page.evaluate(() => window.__associativeRunCount);
  await page.locator('#rootInput').fill('alter');
  await page.locator('#meaningInput').fill('other');
  await page.locator('#calculateBtn').click();

  await page.waitForFunction(
    () => document.getElementById('calculateBtn').classList.contains('is-loading'),
    undefined,
    { polling: 25 }
  );
  assert.equal(await page.locator('#calculateBtn').getAttribute('aria-busy'), 'true');
  assert.equal(await page.locator('#calculateBtn .btn-loader').evaluate(element => getComputedStyle(element).display), 'block');

  try {
    await page.waitForFunction(expectedRunCount => (
      window.__lastAssociativeError
      || (
        window.__associativeRunCount === expectedRunCount
        && window.__associativeStages.at(-1) === 'run:end'
        && document.getElementById('calculateBtn').getAttribute('aria-busy') === 'false'
      )
    ), previousRunCount + 1, { timeout: 3000, polling: 25 });
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({
      events: window.__associativeStages,
      lastError: window.__lastAssociativeError,
      runCount: window.__associativeRunCount,
      visibility: document.visibilityState,
      ariaBusy: document.getElementById('calculateBtn').getAttribute('aria-busy'),
      loading: document.getElementById('calculateBtn').classList.contains('is-loading')
    }));
    throw new Error(`browser calculation stalled: ${JSON.stringify(diagnostics)}`, { cause: error });
  }
  const runtimeError = await page.evaluate(() => window.__lastAssociativeError);
  assert.equal(
    runtimeError,
    undefined,
    `browser calculation failed after stages: ${JSON.stringify(await page.evaluate(() => window.__associativeStages))}`
  );
  assert.equal(await page.locator('[data-testid="fa"]').textContent(), 'FA: 42.5%');
  assert.equal(await page.locator('[data-testid="ta"]').textContent(), 'TA: 240');
  assert.equal(await page.locator('#resultSection').isVisible(), true);
  assert.equal(await page.locator('#languagesSection').isVisible(), true);
  assert.equal(await page.locator('#calculateBtn').getAttribute('aria-busy'), 'false');
  assert.equal(await page.locator('#calculateBtn').isDisabled(), true, 'Done remains briefly visible');
  await page.waitForFunction(
    () => !document.getElementById('calculateBtn').disabled,
    undefined,
    { polling: 25 }
  );

  const stages = await page.evaluate(() => window.__associativeStages);
  assert.ok(stages.indexOf('button:paint') < stages.indexOf('translation:start'));
  assert.ok(stages.includes('mock:translation-request'));
  assert.equal(stages.filter(stage => stage.startsWith('mock:index-request:')).length, 6);
  assert.ok(stages.includes('mock:audit-request'));
  assert.ok(stages.includes('mock:primary-request'));
  assert.ok(stages.includes('mock:final-validation-request'));
  assert.ok(stages.includes('scores:calculated'));
  assert.ok(stages.includes('render:final'));
  assert.ok(stages.includes('draft:saved'));
  assert.ok(stages.includes('button:done'));
  assert.equal(stages.at(-1), 'run:end');
}

let browser;
try {
  try {
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
  } catch (error) {
    if (!String(error?.message || error).includes("Chromium distribution 'chrome' is not found")) throw error;
    browser = await chromium.launch({ headless: true });
  }
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await configurePage(desktop);
  await runSuccessfulCalculation(desktop);
  await runSuccessfulCalculation(desktop);
  assert.equal(await desktop.evaluate(() => window.__associativeRunCount), 2, 'a second calculation starts normally');

  await desktop.evaluate(() => { window.__failTranslation = true; });
  await desktop.locator('#calculateBtn').click();
  await desktop.waitForFunction(
    () => window.__lastAssociativeError === 'mock translation failure',
    undefined,
    { polling: 25 }
  );
  assert.equal(await desktop.locator('#calculateBtn').getAttribute('aria-busy'), 'false');
  assert.equal(await desktop.locator('#calculateBtn').isDisabled(), false);
  assert.equal(await desktop.locator('#calculateBtn').evaluate(element => element.classList.contains('is-loading')), false);
  assert.equal(await desktop.locator('#calculateBtn .btn-loader').evaluate(element => getComputedStyle(element).display), 'none');

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await configurePage(mobile);
  await runSuccessfulCalculation(mobile);
  assert.equal(await mobile.locator('#calculateBtn .btn-loader').count(), 1);
  await mobile.close();
  await desktop.close();
  console.log('Associativ vordes Playwright browser regression passed.');
} finally {
  await browser?.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
