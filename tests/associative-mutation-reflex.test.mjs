import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {FamilyIndexLoader} from '../associativvordes/js/family-index-loader.js';
import {createCandidateIndexLoader} from '../associativvordes/js/candidate-index-loader.js';
const base='audit/associative-family-v5/',root='associativvordes/family-index-v5';
const read=async p=>JSON.parse((p.endsWith('.gz')?gunzipSync(await readFile(p)):await readFile(p)).toString());
const pairs=ms=>ms.map(m=>[m.lemma_id,m.word]).sort();
test('mutation queries expose all reviewed national forms and preserve corpus measurements',async()=>{
 const l=await read(base+'mutation-families-20261001.json'),source=await read(base+'mutation-checkpoint-20261001/candidates.json.gz');
 const f=new FamilyIndexLoader({baseUrl:root,fetchJson:read}),loader=createCandidateIndexLoader({familyIndexLoader:f,fetch:async()=>{throw Error('Broad fallback requested')}});
 let count=0;
 for(const [language,accepted]of Object.entries(l.accepted.mut)){
  const ms=await f.members('family:mut',language);count+=ms.length;
  for(const query of ['mut','mutation','mutual','permutation'])assert.deepEqual(pairs(await loader.loadCandidateEntries(language,query)),pairs(accepted),query+'/'+language);
  for(const m of ms){const old=source[language].mut.find(x=>x.lemma_id===m.lemma_id);assert(old);for(const field of ['word','normalized','search_form','rank','frequency_score','sources','category_breakdown','corpus_quality'])assert.deepEqual(m[field],old[field],m.word+'/'+field);}
 }
 assert.equal(count,569);
 const positives={en:['mutate','mutation','mutual','commute'],de:['mutieren','mutation','mutant'],fr:['muter','mutation','mutuel'],es:['mutar','mutación','mutuo'],it:['mutare','mutazione','mutuo'],ru:['мутация','мутировать','трансмутация']};
 const negatives={en:['mute','mutiny','mutilate','azimuth','bismuth'],de:['mut','mutter','schmutz','wismut'],fr:['mutin','mutisme'],es:['azimut'],it:['mutande','mutilare','muto'],ru:['мутный','хомут','смутный','висмут']};
 for(const language of Object.keys(positives)){const words=new Set((await f.members('family:mut',language)).map(x=>x.word));for(const w of positives[language])assert(words.has(w),language+'/'+w);for(const w of negatives[language])assert(!words.has(w),language+'/'+w);}
 for(const id of l.retired_families)assert.equal(await f.family(id),null);
});
test('mutation decisions cover the entire checkpoint and withhold unresolved candidates',async()=>{
 const l=await read(base+'mutation-families-20261001.json'),source=await read(base+'mutation-checkpoint-20261001/candidates.json.gz'),d=await read(base+'mutation-checkpoint-20261001/linguistic-decisions.json');
 const counts={accepted:0,excluded:0,uncertain:0};
 for(const [language,roots]of Object.entries(source)){
  const ds=d.decisions[language].mut;assert.deepEqual(pairs(ds),pairs(roots.mut));
  for(const x of ds){assert(x.status in counts);assert(x.reason.length>20);counts[x.status]++;}
  assert.deepEqual(pairs(ds.filter(x=>x.status==='accepted')),pairs(l.accepted.mut[language]));
 }
 assert.deepEqual(counts,{accepted:569,excluded:5124,uncertain:2833});
});
