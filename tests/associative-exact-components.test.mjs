import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {FamilyIndexLoader,familyBucket} from '../associativvordes/js/family-index-loader.js';
import {buildSearchForm} from '../associativvordes/js/search-normalizer.js';
import {createCandidateIndexLoader} from '../associativvordes/js/candidate-index-loader.js';
const root='associativvordes/family-index-v5',checkpoint='audit/associative-family-v5/component-checkpoint-20261001';
const read=async p=>JSON.parse((p.endsWith('.gz')?gunzipSync(await readFile(p)):await readFile(p)).toString());
const loader=()=>new FamilyIndexLoader({baseUrl:root,fetchJson:read});
test('all frozen source-supported decisions reach runtime without a twenty-word cap or etymology-only substitutions',async()=>{
 const decisions=await read('audit/associative-family-v5/component-continuation-decisions-20261001.json'),sources=await read(checkpoint+'/candidate-records.json.gz'),l=loader();
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
 assert(!(await l.candidateEntries('loc','fr')).some(m=>['lieu','lieutenant'].includes(m.word)));
 assert(!inter.some(m=>['interment','interminable','midwinter','teleprinter','splinter'].includes(m.word)));
 assert.deepEqual(await l.candidateEntries('loc','ru'),[],'an empty reviewed language must not fall back to incidental legacy routes');
 const both=nat.find(m=>m.word==='international');assert(both&&inter.some(m=>m.lemma_id===both.lemma_id),'independent component memberships remain');
});
test('checkpoint artifacts and unrelated contents of changed shards are preserved',async()=>{
 const decisions=await read(checkpoint+'/decisions.json');
 for(const [file,sha]of Object.entries(decisions.artifacts))assert.equal(createHash('sha256').update(await readFile(checkpoint+'/'+file)).digest('hex'),sha);
 const ledger=await read('audit/associative-family-v5/exact-components-20261001.json');
 const reflex=await read('audit/associative-family-v5/reflex-families-20261001.json');
 for(const p of ledger.preservation){const shard=await read(`${root}/${p.part}/${p.bucket}.json.gz`);if(p.part==='aliases')for(const [alias,before]of Object.entries(reflex.alias_before))if(familyBucket(alias)===p.bucket){if(before.length)shard[alias]=before;else delete shard[alias];}const other=Object.fromEntries(Object.entries(shard).filter(([id])=>p.part==='aliases'?!['nat','loc','inter'].includes(id):!['family:nat','family:loc','family:inter'].includes(id)));assert.equal(createHash('sha256').update(JSON.stringify(other)).digest('hex'),p.unrelated_sha256);}
});
test('exact runtime guard rejects a stale manually linked etymological allomorph',async()=>{
 for(const [key,word,valid]of [['nat','naive','natural'],['loc','lieutenant','local'],['loc','lieu','local']]){
  const id='family:'+key,member=w=>({lemma_id:'lemma:'+w,word:w,components:[{evidence:[{type:'manual_override'}]}]});
  const l=new FamilyIndexLoader({fetchJson:async path=>path.endsWith('manifest.json')?{version:'5',languages:['en'],sharding:{alias_template:'aliases/{bucket}',family_template:'families/{bucket}',member_template:'members/{language}/{bucket}'}}:path.includes('/aliases/')?{[key]:[id]}:path.includes('/families/')?{[id]:{id,canonical:key,aliases:[key],exact_component:true,runtime_curated:true}}:{[id]:[member(word),member(valid)]}});
  assert.deepEqual((await l.candidateEntries(key,'en')).map(m=>m.word),[valid]);
 }
});
test('continuation preserves frozen decisions and assigns a traceable disposition to every retrieved candidate',async()=>{
 const priorBytes=await readFile('audit/associative-family-v5/exact-components-20261001.json'),prior=JSON.parse(priorBytes),next=await read('audit/associative-family-v5/component-continuation-decisions-20261001.json');
 assert.equal(createHash('sha256').update(priorBytes).digest('hex'),next.previous_ledger_sha256);
 const bytes=await readFile(next.coverage_path);assert.equal(createHash('sha256').update(bytes).digest('hex'),next.coverage_sha256);
 const coverage=JSON.parse(gunzipSync(bytes)),candidates=await read(checkpoint+'/candidate-records.json.gz');
 let additions=0;
 for(const [key,langs]of Object.entries(prior.accepted))for(const [language,members]of Object.entries(langs)){
  assert.deepEqual(next.accepted[key][language].slice(0,members.length),members);
  const added=next.additions.filter(a=>a.key===key&&a.language===language);additions+=added.length;
  assert.deepEqual(next.accepted[key][language].slice(members.length),added.map(a=>({lemma_id:a.lemma_id,word:a.word,source_family_ids:a.source_family_ids})));
  const ids=new Set(next.accepted[key][language].map(m=>m.lemma_id));
  assert.deepEqual(coverage.dispositions[key][language].map(d=>[d.lemma_id,d.word]),candidates[key][language].map(m=>[m.lemma_id,m.word]));
  for(const d of coverage.dispositions[key][language])assert.equal(d.status,ids.has(d.lemma_id)?'accepted':!buildSearchForm(d.word).includes(key)?'excluded_absent_exact_fragment':'pending_etymology_or_token_review');
 }
 assert.equal(additions,next.expected_added_memberships);assert.equal(next.expected_removed_memberships,0);
 const lieu=coverage.dispositions.loc.fr.find(d=>d.word==='lieu');assert.equal(lieu.status,'excluded_absent_exact_fragment');
});
test('preposition mode uses the complete reviewed inter family in all languages without broad fallback',async()=>{
 const family=loader(),index=createCandidateIndexLoader({familyIndexLoader:family,fetch:async()=>{throw Error('broad fallback requested')}});
 const decisions=await read('audit/associative-family-v5/component-continuation-decisions-20261001.json');
 for(const language of ['en','de','fr','es','it','ru']){
  const actual=await index.loadCandidateEntries(language,'inter',{elementType:'preposition'});
  assert.deepEqual(actual.map(m=>[m.lemma_id,m.word]),decisions.accepted.inter[language].map(m=>[m.lemma_id,m.word]));
 }
 assert.deepEqual(await family.resolveAlias('nat',{elementType:'preposition'}),[],'a lexical root is not promoted to a preposition');
 assert.deepEqual(await family.resolveAlias('loc',{elementType:'preposition'}),[]);
});
