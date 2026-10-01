import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {FamilyIndexLoader} from '../associativvordes/js/family-index-loader.js';
import {createCandidateIndexLoader} from '../associativvordes/js/candidate-index-loader.js';
const base='audit/associative-family-v5/',root='associativvordes/family-index-v5';
const read=async p=>JSON.parse((p.endsWith('.gz')?gunzipSync(await readFile(p)):await readFile(p)).toString());
const pairs=ms=>ms.map(m=>[m.lemma_id,m.word]).sort();
test('relation root queries expose every reviewed national record with original corpus measurements',async()=>{
 const l=await read(base+'relation-families-20261001.json'),source=await read(base+'relation-checkpoint-20261001/candidates.json.gz');
 const f=new FamilyIndexLoader({baseUrl:root,fetchJson:read}),loader=createCandidateIndexLoader({familyIndexLoader:f,fetch:async()=>{throw Error('Broad fallback requested')}});
 let count=0;
 for(const [language,accepted]of Object.entries(l.accepted.relat)){
  const ms=await f.members('family:relat',language);count+=ms.length;
  for(const query of ['relat','relaz','relac','relation','relazione','relacion'])assert.deepEqual(pairs(await loader.loadCandidateEntries(language,query)),pairs(accepted),query+'/'+language);
  for(const m of ms){const old=source[language].relat.find(x=>x.lemma_id===m.lemma_id);assert(old);for(const field of ['word','normalized','search_form','rank','frequency_score','sources','category_breakdown','corpus_quality'])assert.deepEqual(m[field],old[field],m.word+'/'+field);}
 }
 assert.equal(count,487);
 const positives={en:['relate','relationship','correlation','relativity','age-related'],de:['relation','korrelation','relativität'],fr:['relation','relater','corrélation'],es:['relación','relacionar','relato','correlación'],it:['relazione','relatore','correlazione'],ru:['реляция','релятивный','корреляция']};
 const negatives={en:['prelate','prelacy','aboutourrelationship'],de:['pierrelatte'],fr:['frelater','prélat','relâcher','entrelacer'],es:['entrelazar','abrelatas','prelación'],it:['integrazione','prelato','prelazione'],ru:['стрелять','прелат','перелазить']};
 for(const language of Object.keys(positives)){const words=new Set((await f.members('family:relat',language)).map(x=>x.word));for(const w of positives[language])assert(words.has(w),language+'/'+w);for(const w of negatives[language])assert(!words.has(w),language+'/'+w);}
 for(const id of l.retired_families)assert.equal(await f.family(id),null);
});
test('relation dispositions cover all saved candidates and keep unresolved records out of runtime',async()=>{
 const l=await read(base+'relation-families-20261001.json'),source=await read(base+'relation-checkpoint-20261001/candidates.json.gz'),d=await read(base+'relation-checkpoint-20261001/linguistic-decisions.json');
 const counts={accepted:0,excluded:0,uncertain:0};
 for(const [language,roots]of Object.entries(source)){
  const ds=d.decisions[language].relat;assert.deepEqual(pairs(ds),pairs(roots.relat));
  for(const x of ds){assert(x.status in counts);assert(x.reason.length>20);counts[x.status]++;}
  assert.deepEqual(pairs(ds.filter(x=>x.status==='accepted')),pairs(l.accepted.relat[language]));
 }
 assert.deepEqual(counts,{accepted:487,excluded:3458,uncertain:411});
});
