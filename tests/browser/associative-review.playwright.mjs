/** Real queue exercise. Run against a disposable review data directory only.
 * REVIEW_BASE_URL=http://127.0.0.1:8765 REVIEW_CREDENTIALS=/.../credentials.json
 * REVIEW_REPORT=/.../browser.json node tests/browser/associative-review.playwright.mjs
 */
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const base = process.env.REVIEW_BASE_URL || 'http://127.0.0.1:8765';
const credentials = JSON.parse(await readFile(process.env.REVIEW_CREDENTIALS, 'utf8'));
const actors = Object.fromEntries(Object.entries(credentials).map(([a,d]) => [d.role, {actor:a,...d}]));
let launch = {headless:true};
if (process.env.CHROMIUM_EXECUTABLE_PATH) launch.executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
if (process.env.REVIEW_SERVERLESS_CHROMIUM) { const {default:c} = await import('@sparticuz/chromium'); launch = {...launch, executablePath:await c.executablePath(),args:c.args}; }
const browser = await chromium.launch(launch);
const timings = {card_ms:[], save_ms:[], filter_ms:[]};
const errors=[]; let firstId, firstLexeme;
async function login(role) {
  const context = await browser.newContext(); const page = await context.newPage();
  page.on('pageerror', e=>errors.push(e.message)); page.on('console', m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base); await page.locator('#token').fill(actors[role].token); await page.locator('#login button').click();
  await page.locator('#workspace').waitFor({state:'visible'}); await page.locator('.queue-word').first().waitFor(); await idle(page);
  return {page, context};
}
async function idle(page) { await page.waitForFunction(()=>document.body.dataset.busy !== 'true'); }
async function chooseNative(page) { await idle(page); const value = await page.locator('#lexeme option').nth(1).getAttribute('value'); await page.locator('#lexeme').selectOption(value); return value; }
async function save(page, status, reason='Automated workflow exercise; identity remains unverified.') {
  await page.locator('#decision').selectOption(status); await page.locator('#reason').fill(reason);
  const start=performance.now(); const response=page.waitForResponse(r=>r.url().endsWith('/api/decide') || r.url().endsWith('/api/arbitrate'));
  await page.locator('#save').click(); assert.equal((await response).status(),200); timings.save_ms.push(performance.now()-start);
  await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('Решение сохранено')); await idle(page);
}
try {
  const {page:a,context:ca} = await login('reviewer');
  assert.match(await a.locator('#progress').innerText(), /1567/);
  for(let n=0;n<100;n++) {
    const button=a.locator('.queue-word').first(); const id=await button.getAttribute('data-qid');
    const start=performance.now(); await button.click(); await a.locator('#decision-form').waitFor();
    // Wait for the matching card, not a form left over from the previous request.
    await a.waitForFunction(id=>document.querySelector('#card').dataset.qid===id && !!document.querySelector('#save'),id);
    timings.card_ms.push(performance.now()-start);
    const lex=await chooseNative(a); if(n===0){firstId=id;firstLexeme=lex;}
    await save(a,n===0?'REJECT':'UNCERTAIN');
    // Queue refresh removes the processed question under OPEN filter.
    await a.waitForFunction(id=>document.querySelector('.queue-word')?.dataset.qid!==id,id);
  }
  await a.locator('#status').selectOption('REJECT'); await a.locator('#filter').click(); await idle(a);
  await a.locator('.queue-word').first().click(); await a.locator('#lexeme').waitFor(); await chooseNative(a);
  await save(a,'DEFER','Correcting an exercise decision.');
  await a.locator('#status').selectOption('DEFER'); await a.locator('#filter').click(); await idle(a);
  await a.locator('.queue-word').first().click(); await idle(a); await a.locator('#reason').fill('Undo erroneous correction.');
  const undo=a.waitForResponse(r=>r.url().endsWith('/api/undo')); await a.locator('#undo').click(); assert.equal((await undo).status(),200); await idle(a);
  await a.reload(); await a.locator('#workspace').waitFor({state:'visible'}); await idle(a);
  // Thousand-question filtering: all 1567 real questions, six language scopes.
  await a.locator('#status').selectOption('');
  for (const lang of ['', 'de','en','es','fr','it','ru']) {
    await a.locator('#language').selectOption(lang); const start=performance.now(); const r=a.waitForResponse(r=>r.url().includes('/api/questions?'));
    await a.locator('#filter').click(); await idle(a); assert.equal((await r).status(),200); timings.filter_ms.push(performance.now()-start);
  }
  // Assemble a homogeneous batch using actual queue groups and explicit native choices.
  await a.locator('#language').selectOption(''); await a.locator('#status').selectOption('OPEN');
  await a.locator('#filter').click(); await idle(a);
  const candidates = await a.evaluate(async ()=>(await (await fetch('/api/questions?limit=100&status=OPEN')).json()).items);
  const groups = new Map(); for(const q of candidates) { const ids=groups.get(q.group)||[];ids.push(q.id);groups.set(q.group,ids); }
  const ids=[...groups.values()].find(v=>v.length>=2); assert.ok(ids,'real homogeneous group required');
  await a.locator(`[data-qid="${ids[0]}"]`).locator('..').locator('button[title]').click(); await idle(a);
  for(const id of ids.slice(0,2)) {
    await a.locator(`[data-qid="${id}"]`).click(); await idle(a); await chooseNative(a);
    await a.locator('#reason').fill('Automated homogeneous batch exercise; proposals only.');
    await a.locator('#stage').click(); await idle(a);
  }
  await a.locator('#batch').click(); await idle(a); await a.locator('#preview').waitFor({state:'visible'});
  assert.equal(await a.locator('#preview-items > .claim').count(),2);
  const commit=a.waitForResponse(r=>r.url().endsWith('/api/commit-preview'));
  await a.locator('#confirm-batch').click(); assert.equal((await commit).status(),200); await idle(a);
  const {page:b,context:cb}=await login('blind');
  const blindPayload = await b.evaluate(async id=>(await fetch('/api/card?id='+encodeURIComponent(id))).json(),firstId);
  assert.equal(blindPayload.revision,0);assert.equal(blindPayload.history.length,0);
  for(const key of ['categories','priority','previous_decisions','existing_memberships','discovery_paths','conflicts']) assert.ok(!(key in blindPayload.question));
  const bb=b.locator(`[data-qid="${firstId}"]`); await bb.click(); await b.locator('#lexeme').waitFor(); await chooseNative(b);
  await save(b,'ACCEPT_PROPOSED','Opposing exercise opinion; not linguistic gold.');
  const {page:c,context:cc}=await login('arbiter');
  await c.locator('#status').selectOption(''); await c.locator('#disagreement').check(); await c.locator('#filter').click(); await idle(c);
  await c.locator(`[data-qid="${firstId}"]`).click(); await c.locator('#lexeme').waitFor(); await chooseNative(c);
  assert.match(await c.locator('#card').innerText(), /Независимые проверки/);
  await c.screenshot({path:process.env.REVIEW_SCREENSHOT || '/tmp/interal-review.png',fullPage:false});
  await save(c,'UNCERTAIN','Arbitration exercise: evidence insufficient to establish identity.');
  const download=c.waitForEvent('download'); await c.locator('#backup').click(); const backup=await download;
  if(process.env.REVIEW_BACKUP) await backup.saveAs(process.env.REVIEW_BACKUP);
  await ca.close();await cb.close();await cc.close();
  assert.deepEqual(errors,[]);
  function stats(x){let v=[...x].sort((a,b)=>a-b);return {n:v.length,min_ms:+v[0].toFixed(2),median_ms:+v[Math.floor(v.length/2)].toFixed(2),p95_ms:+v[Math.min(v.length-1,Math.ceil(v.length*.95)-1)].toFixed(2),max_ms:+v.at(-1).toFixed(2)}}
  const report={scope:'automated Chromium interactions; not human linguistic annotation',questions:1567,sequential_decisions:100,
    first_question:firstId,browser:browser.version(),card_open:stats(timings.card_ms),decision_save:stats(timings.save_ms),filter:stats(timings.filter_ms),
    scenarios:{reject:true,correct:true,undo:true,reload_resume:true,blind_payload_redaction:true,two_reviewer_conflict:true,arbitration_uncertain:true,backup_download:true,batch_preview_and_individual_save:true},console_errors:errors};
  await writeFile(process.env.REVIEW_REPORT || '/tmp/review-browser.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
} finally {await browser.close();}
