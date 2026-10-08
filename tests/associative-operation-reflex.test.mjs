import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {FamilyIndexLoader} from '../associativvordes/js/family-index-loader.js';
import {createCandidateIndexLoader} from '../associativvordes/js/candidate-index-loader.js';
const base='audit/associative-family-v5/',root='associativvordes/family-index-v5';
const read=async p=>JSON.parse((p.endsWith('.gz')?gunzipSync(await readFile(p)):await readFile(p)).toString());
const pairs=ms=>ms.map(m=>[m.lemma_id,m.word]).sort();
test('operation queries expose all reviewed national forms and preserve corpus measurements',async()=>{
 const l=await read(base+'operation-families-20261001.json'),source=await read(base+'operation-checkpoint-20261001/candidates.json.gz');
 const f=new FamilyIndexLoader({baseUrl:root,fetchJson:read}),loader=createCandidateIndexLoader({familyIndexLoader:f,fetch:async()=>{throw Error('Broad fallback requested')}});
 let count=0;
 for(const [language,accepted]of Object.entries(l.accepted.oper)){
  const ms=await f.members('family:oper',language);count+=ms.length;
  for(const query of ['oper','operation','opera','kooper'])assert.deepEqual(pairs(await loader.loadCandidateEntries(language,query)),pairs(accepted),query+'/'+language);
  for(const m of ms){const old=source[language].oper.find(x=>x.lemma_id===m.lemma_id);assert(old);for(const field of ['word','normalized','search_form','rank','frequency_score','sources','category_breakdown','corpus_quality'])assert.deepEqual(m[field],old[field],m.word+'/'+field);}
 }
 assert.equal(count,1595);
 const positives={en:['operate','cooperate','opera','operon'],de:['operieren','operation','kooperation','opern'],fr:['opérer','opération','opéra','opéron'],es:['operar','operación','ópera','cooperar'],it:['operare','operazione','operaio','scioperare','adoperare'],ru:['операция','оперативный','оператор','кооперация','рок-опера']};
 const negatives={en:['cooper','proper','operculum'],de:['opera-browser','kopernikus','loopern'],fr:['frelater','opercule','écoper'],es:['opérculo','copérnico','developer'],it:['opercolo','coperta','improperio'],ru:['оперение','опереть','коперник','соперник']};
 for(const language of Object.keys(positives)){const words=new Set((await f.members('family:oper',language)).map(x=>x.word));for(const w of positives[language])assert(words.has(w),language+'/'+w);for(const w of negatives[language])assert(!words.has(w),language+'/'+w);}
 for(const id of l.retired_families)assert.equal(await f.family(id),null);
});
test('operation decisions cover the entire checkpoint and withhold unresolved candidates',async()=>{
 const l=await read(base+'operation-families-20261001.json'),source=await read(base+'operation-checkpoint-20261001/candidates.json.gz'),d=await read(base+'operation-checkpoint-20261001/linguistic-decisions.json');
 const counts={accepted:0,excluded:0,uncertain:0};
 for(const [language,roots]of Object.entries(source)){
  const ds=d.decisions[language].oper;assert.deepEqual(pairs(ds),pairs(roots.oper));
  for(const x of ds){assert(x.status in counts);assert(x.reason.length>20);counts[x.status]++;}
  assert.deepEqual(pairs(ds.filter(x=>x.status==='accepted')),pairs(l.accepted.oper[language]));
 }
 assert.deepEqual(counts,{accepted:1595,excluded:3881,uncertain:2111});
});
