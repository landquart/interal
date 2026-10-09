import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createCandidateIndexLoader } from '../associativvordes/js/candidate-index-loader.js';
import { createFamilyIndexFetch } from '../associativvordes/js/family-index-loader.js';

// AC-001/AC-012: exercise the page wrapper, not only the standalone family loader.
const calls=[];
const fetchLocal=async (url,options={})=>{
  calls.push(String(url));
  assert.ok(String(url).startsWith('/associativvordes/family-index-v5/'), 'regul must not fall back to the static index');
  return new Response(await readFile(new URL('..'+url,import.meta.url)), {headers:{'Content-Type':url.endsWith('.gz')?'application/gzip':'application/json'}});
};
const loader=createCandidateIndexLoader({fetch:fetchLocal});
for (const lang of ['en','de','fr','es','it','ru']) {
  const entries=await loader.loadCandidateEntries(lang,'regul');
  assert.equal(entries.length,2,`fixed v5 regul ${lang} snapshot`);
  assert.ok(entries.every(x=>x.family_id==='family:regul'&&x.family_indexed));
  assert.equal(loader.getCandidateIndexDiagnostics().familyIndexStatus,'loaded');
  assert.deepEqual(loader.getCandidateIndexDiagnostics().validationErrors,[]);
}
assert.ok(calls.some(x=>x.endsWith('.json.gz')));
for(const bytes of [gzipSync(JSON.stringify({ok:1})),new TextEncoder().encode(JSON.stringify({ok:1}))]){
  const fetchJson=createFamilyIndexFetch(async()=>new Response(bytes));
  assert.deepEqual(await fetchJson('/shard.json.gz'),{ok:1},'raw gzip and HTTP-decoded bodies share a contract');
}
const bad=createFamilyIndexFetch(async()=>new Response('bad',{status:503}));
await assert.rejects(()=>bad('/manifest.json'),/503/);
const abort=new AbortController();abort.abort();
const cancellation=createFamilyIndexFetch(async(_url,options)=>{assert.equal(options.signal,abort.signal);throw new DOMException('aborted','AbortError');});
await assert.rejects(()=>cancellation('/manifest.json',{signal:abort.signal}),e=>e.name==='AbortError');
console.log('AC-001/AC-012 page transport regressions passed');
