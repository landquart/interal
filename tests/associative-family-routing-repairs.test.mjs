import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {FamilyIndexLoader} from '../associativvordes/js/family-index-loader.js';
import {createCandidateIndexLoader} from '../associativvordes/js/candidate-index-loader.js';
const root=process.env.FAMILY_INDEX_TEST_ROOT?pathToFileURL(process.env.FAMILY_INDEX_TEST_ROOT.replace(/\/$/,'')+'/'):new URL('../associativvordes/family-index-v5/',import.meta.url);
const treeLoader=()=>new FamilyIndexLoader({baseUrl:'/family-index',fetchJson:async url=>{const n=url.replace('/family-index/',''),b=await readFile(new URL(n,root));return JSON.parse(n.endsWith('.gz')?gunzipSync(b).toString():b.toString())}});
const ledger=()=>readFile(new URL('../audit/associative-family-v5/val-and-ru-short-decisions-20260930.json',import.meta.url),'utf8').then(JSON.parse);
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const pairs=ms=>ms.map(m=>[m.lemma_id,m.word]).sort();
const blocked=new Set(['blocked_from_runtime','rejected','split_required']);
test('val routing retains member arrays, alternate roots, exact full results and no fallback',async()=>{
 const l=await ledger(),family=treeLoader(),loader=createCandidateIndexLoader({familyIndexLoader:family,fetch:async()=>{throw Error('Broad fallback requested')}});
 assert.equal(l.val.expected_original_targets.length,27);
 assert.equal(l.val.retained_targets.length,15);
 assert.deepEqual(await family.resolveAlias('val'),l.val.retained_targets);
 for(const language of ['en','de','fr','es','it','ru']){
  const expected=new Map();
  for(const d of l.val.all_target_diagnostics){
   const ms=await family.members(d.family_id,language),e=d.members[language];assert.equal(ms.length,e?.count||0);if(e)assert.equal(digest(ms),e.ordered_member_sha256);
   if(d.action==='retain_reverse_alias'&&!blocked.has(d.review_status))for(const m of ms)if(m.corpus_quality?.status!=='rejected')expected.set(m.lemma_id,m.word);
  }
  assert.deepEqual(pairs(await loader.loadCandidateEntries(language,'val')),[...expected].sort(),language);
  assert.equal(loader.getCandidateIndexDiagnostics().familyIndexStatus,'loaded');family.cache.clear();
 }
 for(const d of l.val.all_target_diagnostics.filter(d=>d.action==='remove_reverse_alias_only')){
  const f=await family.family(d.family_id);assert.deepEqual(f.aliases,d.original_aliases.filter(a=>a!=='val'));assert((await family.resolveAlias(d.alternate_alias)).includes(f.id));
 }
 for(const [alias,id]of [['value','ety:88d0d6fc2226'],['valor','ety:88d0d6fc2226'],['vale','ety:88d0d6fc2226'],['vaux','ety:082a0688243f']])assert((await family.resolveAlias(alias)).includes(id));
});
test('Russian short batch has only reviewed members, without cross-language suppression or fallback',async()=>{
 const l=await ledger(),family=treeLoader(),loader=createCandidateIndexLoader({familyIndexLoader:family,fetch:async()=>{throw Error('Broad fallback requested')}});
 for(const d of l.russian.decisions){
  const expected=pairs(d.retained);assert.deepEqual(pairs(await loader.loadCandidateEntries('ru',d.alias)),expected);
  for(const m of d.retained.filter(m=>!m.word.includes('-')))assert.deepEqual(pairs(await loader.loadCandidateEntries('ru',m.word)),expected);
  assert.equal(loader.getCandidateIndexDiagnostics().familyIndexStatus,'loaded');
  for(const language of ['en','de','fr','es','it']){
   family.cache.clear();const normal=new Map();
   for(const id of await family.resolveAlias(d.alias)){
    const f=await family.family(id);if(blocked.has(f.review_status))continue;const ms=await family.members(id,language);
    if(f.runtime_curated||String(f.source).includes('manual_override')){assert.equal(ms.length,0);continue}
    for(const m of ms)if(m.corpus_quality?.status!=='rejected')normal.set(m.lemma_id,m.word);
   }
   assert.deepEqual(pairs(await family.candidateEntries(d.alias,language)),[...normal].sort(),d.alias+'/'+language);
  }
  family.cache.clear();
 }
});
