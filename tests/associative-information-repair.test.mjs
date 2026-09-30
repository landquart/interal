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
const ledger=()=>readFile(new URL('../audit/associative-family-v5/information-decisions-20260930.json',import.meta.url),'utf8').then(JSON.parse);
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const pairs=ms=>ms.map(m=>[m.lemma_id,m.word]).sort();
test('information lookup returns complete curated lists in six languages without suffix peers or fallback',async()=>{
 const l=await ledger(),f=treeLoader(),loader=createCandidateIndexLoader({familyIndexLoader:f,fetch:async()=>{throw Error('Broad fallback requested')}});
 assert.equal(await f.family(l.deleted_duplicate_family_id),null);
 const family=await f.family(l.canonical_family_id);
 assert.equal(family.support,185);assert.equal(family.canonical,'informatio');assert.equal(family.verified,false);assert.equal(family.review_status,'needs_review');assert.equal(family.language_support.de,154);
 assert.deepEqual(family.manual_size_exception,l.size_exception);
 assert.deepEqual(family.relation_evidence,l.original_families[0].relation_evidence);
 assert(!(await f.resolveAlias('azion')).includes(family.id));
 for(const d of l.decisions){
  const expected=pairs([...d.retained,...l.added.filter(a=>a.language===d.language).map(a=>a.member)]);
  const ms=await f.members(family.id,d.language);assert.deepEqual(pairs(ms),expected);
  for(const a of l.aliases){
   assert((await f.resolveAlias(a)).includes(family.id));
   assert.deepEqual(pairs(await loader.loadCandidateEntries(d.language,a)),expected,`${d.language}/${a}`);
   assert.equal(loader.getCandidateIndexDiagnostics().familyIndexStatus,'loaded');
  }
  for(const x of d.excluded)assert(!ms.some(m=>m.lemma_id===x.lemma_id),`${d.language}/${x.word}`);
  for(const m of ms)assert(m.components.every(c=>c.canonical_candidate==='informatio'&&c.evidence.every(e=>e.type==='manual_override'&&e.relation_type&&e.analysis)));
  f.cache.clear();
 }
 assert.deepEqual(pairs(await loader.loadCandidateEntries('ru','информация')),pairs(l.added.filter(a=>a.language==='ru').map(a=>a.member)));
});
test('other azion concepts and pre-existing surface routes retain all metadata and full membership arrays',async()=>{
 const l=await ledger(),f=treeLoader();
 for(const d of l.preserved_families){
  assert.equal(digest(await f.family(d.family_id)),d.family_sha256,d.family_id);
  for(const lang of ['en','de','fr','es','it','ru']){
   const ms=await f.members(d.family_id,lang);assert.equal(ms.length,d.members[lang].count);assert.equal(digest(ms),d.members[lang].ordered_member_sha256,`${d.family_id}/${lang}`);
  }
  f.cache.clear();
 }
 for(const[a,before]of Object.entries(l.alias_before)){
  const expected=before.filter(id=>id!==l.canonical_family_id&&id!==l.deleted_duplicate_family_id);
  if(l.aliases.includes(a))expected.push(l.canonical_family_id);
  assert.deepEqual(await f.resolveAlias(a),[...new Set(expected)].sort(),a);
 }
 // Source record and its existing Russian surface membership are unchanged.
 for(const a of l.added){const original=(await f.members(a.source_family_id,a.language)).find(m=>m.lemma_id===a.member.lemma_id);assert.deepEqual(original,a.member)}
});
