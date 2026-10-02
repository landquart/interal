import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {FamilyIndexLoader} from '../associativvordes/js/family-index-loader.js';
import {createCandidateIndexLoader} from '../associativvordes/js/candidate-index-loader.js';
const base='audit/associative-family-v5/',root='associativvordes/family-index-v5';
const read=async p=>JSON.parse((p.endsWith('.gz')?gunzipSync(await readFile(p)):await readFile(p)).toString());
const pairs=ms=>ms.map(m=>[m.lemma_id,m.word]).sort();
test('creation queries expose all reviewed national forms and preserve corpus measurements',async()=>{
 const l=await read(base+'creation-families-20261001.json'),source=await read(base+'creation-checkpoint-20261001/candidates.json.gz');
 const f=new FamilyIndexLoader({baseUrl:root,fetchJson:read}),loader=createCandidateIndexLoader({familyIndexLoader:f,fetch:async()=>{throw Error('Broad fallback requested')}});
 let count=0;
 for(const [language,accepted]of Object.entries(l.accepted.creat)){
  const ms=await f.members('family:creat',language);count+=ms.length;
  for(const query of ['creat','crea','kreat','creation'])assert.deepEqual(pairs(await loader.loadCandidateEntries(language,query)),pairs(accepted),query+'/'+language);
  for(const m of ms){const old=source[language].creat.find(x=>x.lemma_id===m.lemma_id);assert(old);for(const field of ['word','normalized','search_form','rank','frequency_score','sources','category_breakdown','corpus_quality'])assert.deepEqual(m[field],old[field],m.word+'/'+field);}
 }
 assert.equal(count,574);
 const positives={en:['create','creating','creation','creatrix'],de:['kreieren','kreativ','kreation'],fr:['créer','création'],es:['crear','creación'],it:['creare','creazione'],ru:['креативный','креационизм']};
 const negatives={en:['creatine','cream','increase'],de:['pankreas'],fr:['créance','créancier'],es:['creer','creencia'],it:['creatina','integrazione'],ru:['соцреализм']};
 for(const language of Object.keys(positives)){const words=new Set((await f.members('family:creat',language)).map(x=>x.word));for(const w of positives[language])assert(words.has(w),language+'/'+w);for(const w of negatives[language])assert(!words.has(w),language+'/'+w);}
 assert(!(l.aliases.creat.includes('creer')));
});
test('creation decisions cover the entire checkpoint and withhold unresolved candidates',async()=>{
 const l=await read(base+'creation-families-20261001.json'),source=await read(base+'creation-checkpoint-20261001/candidates.json.gz'),d=await read(base+'creation-checkpoint-20261001/linguistic-decisions.json');
 const counts={accepted:0,excluded:0,uncertain:0};
 for(const [language,roots]of Object.entries(source)){
  const ds=d.decisions[language].creat;assert.deepEqual(pairs(ds),pairs(roots.creat));
  for(const x of ds){assert(x.status in counts);assert(x.reason.length>20);counts[x.status]++;}
  assert.deepEqual(pairs(ds.filter(x=>x.status==='accepted')),pairs(l.accepted.creat[language]));
 }
 assert.deepEqual(counts,{accepted:574,excluded:4429,uncertain:2389});
});
