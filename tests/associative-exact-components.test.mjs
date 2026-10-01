import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {FamilyIndexLoader,familyBucket} from '../associativvordes/js/family-index-loader.js';
import {buildSearchForm} from '../associativvordes/js/search-normalizer.js';
const root='associativvordes/family-index-v5',checkpoint='audit/associative-family-v5/component-checkpoint-20261001';
const read=async p=>JSON.parse((p.endsWith('.gz')?gunzipSync(await readFile(p)):await readFile(p)).toString());
const loader=()=>new FamilyIndexLoader({baseUrl:root,fetchJson:read});
test('all frozen source-supported decisions reach runtime without a twenty-word cap or etymology-only substitutions',async()=>{
 const decisions=await read('audit/associative-family-v5/exact-components-20261001.json'),sources=await read(checkpoint+'/candidate-records.json.gz'),l=loader();
 for(const key of ['nat','loc','inter'])for(const language of ['en','de','fr','es','it','ru']){
  const expected=decisions.accepted[key][language],actual=await l.candidateEntries(key,language);
  assert.deepEqual(actual.map(m=>[m.lemma_id,m.word]),expected.map(m=>[m.lemma_id,m.word]),`${key}/${language}`);
  const originals=new Map(sources[key][language].map(m=>[m.lemma_id,m]));
  for(const value of actual){assert(buildSearchForm(value.word).includes(key));const source=originals.get(value.lemma_id);
   for(const field of ['lemma_id','word','normalized','search_form','rank','frequency_score','sources','category_breakdown','corpus_quality'])assert.deepEqual(value[field],source[field],`source evidence changed ${value.word}/${field}`);
  }
 }
 const nat=await l.candidateEntries('nat','en'),loc=await l.candidateEntries('loc','en'),inter=await l.candidateEntries('inter','en');
 assert(nat.length>20&&loc.length>20&&inter.length>20);
 for(const word of ['nation','natural','native','innate','cognate'])assert(nat.some(m=>m.word===word),word);
 for(const word of ['location','local','locomotive','allocation','collocation'])assert(loc.some(m=>m.word===word),word);
 for(const word of ['international','interval','internet','interest','interpret'])assert(inter.some(m=>m.word===word),word);
 assert(!nat.some(m=>['naive','naïve','nato','nascent'].includes(m.word)));
 assert(!loc.some(m=>['lieutenant','locution','locust'].includes(m.word)));
 assert(!inter.some(m=>['interment','interminable','midwinter','teleprinter','splinter'].includes(m.word)));
 assert.deepEqual(await l.candidateEntries('loc','ru'),[],'an empty reviewed language must not fall back to incidental legacy routes');
 const both=nat.find(m=>m.word==='international');assert(both&&inter.some(m=>m.lemma_id===both.lemma_id),'independent component memberships remain');
});
test('checkpoint artifacts and unrelated contents of changed shards are preserved',async()=>{
 const decisions=await read(checkpoint+'/decisions.json');
 for(const [file,sha]of Object.entries(decisions.artifacts))assert.equal(createHash('sha256').update(await readFile(checkpoint+'/'+file)).digest('hex'),sha);
 const ledger=await read('audit/associative-family-v5/exact-components-20261001.json');
 for(const p of ledger.preservation){const shard=await read(`${root}/${p.part}/${p.bucket}.json.gz`);const other=Object.fromEntries(Object.entries(shard).filter(([id])=>p.part==='aliases'?!['nat','loc','inter'].includes(id):!['family:nat','family:loc','family:inter'].includes(id)));assert.equal(createHash('sha256').update(JSON.stringify(other)).digest('hex'),p.unrelated_sha256);}
});
test('exact runtime guard rejects a stale manually linked etymological allomorph',async()=>{
 for(const [key,word,valid]of [['nat','naive','natural'],['loc','lieutenant','local']]){
  const id='family:'+key,member=w=>({lemma_id:'lemma:'+w,word:w,components:[{evidence:[{type:'manual_override'}]}]});
  const l=new FamilyIndexLoader({fetchJson:async path=>path.endsWith('manifest.json')?{version:'5',languages:['en'],sharding:{alias_template:'aliases/{bucket}',family_template:'families/{bucket}',member_template:'members/{language}/{bucket}'}}:path.includes('/aliases/')?{[key]:[id]}:path.includes('/families/')?{[id]:{id,canonical:key,aliases:[key],exact_component:true,runtime_curated:true}}:{[id]:[member(word),member(valid)]}});
  assert.deepEqual((await l.candidateEntries(key,'en')).map(m=>m.word),[valid]);
 }
});
