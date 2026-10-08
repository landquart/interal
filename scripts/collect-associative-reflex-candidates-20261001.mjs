import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {buildSearchForm} from '../associativvordes/js/search-normalizer.js';
const root='associativvordes/family-index-v5',out='audit/associative-family-v5/reflex-checkpoint-20261001';
await mkdir(out,{recursive:true});
const read=async p=>JSON.parse(gunzipSync(await readFile(p)));
const wanted=new Set(['la:observare','la:observatio','la:observati','la:observator','la:observatorium','la:informatio','la:informati','la:informare']);
const families={};for(const file of (await readdir(root+'/families')).sort())for(const [id,f]of Object.entries(await read(root+'/families/'+file)))if(f.etymon_keys?.some(k=>wanted.has(k)))families[id]=f;
const candidates={},originals={};
for(const language of ['en','de','fr','es','it','ru']){
 const maps={observ:new Map(),inform:new Map()};originals[language]={};
 for(const file of (await readdir(root+'/members/'+language)).sort())for(const [id,ms]of Object.entries(await read(root+'/members/'+language+'/'+file))){
  if(families[id])originals[language][id]=ms;
  for(const m of ms){const form=buildSearchForm(m.word);
   for(const key of ['observ','inform'])if(form.includes(key)||(key==='observ'&&form.includes('osserv'))||(families[id]?.etymon_keys?.some(k=>k.startsWith('la:'+key)))){
    const existing=maps[key].get(m.lemma_id);if(existing){if(!existing.source_family_ids.includes(id))existing.source_family_ids.push(id)}else maps[key].set(m.lemma_id,{...m,source_family_ids:[id]});
   }
  }
 }
 candidates[language]=Object.fromEntries(Object.entries(maps).map(([key,map])=>[key,[...map.values()].sort((a,b)=>a.word.localeCompare(b.word,'en')||a.lemma_id.localeCompare(b.lemma_id))]));
 console.log(language,Object.fromEntries(Object.entries(maps).map(([k,m])=>[k,m.size])));
}
for(const [file,value]of [['candidates.json.gz',candidates],['original-families.json.gz',{families,members:originals}]])await writeFile(out+'/'+file,gzipSync(JSON.stringify(value),{level:6}));
const artifacts={};for(const file of ['candidates.json.gz','original-families.json.gz'])artifacts[file]=createHash('sha256').update(await readFile(out+'/'+file)).digest('hex');
await writeFile(out+'/inventory.json',JSON.stringify({source_run_id:35647932153,method:'Every materialized member shard scanned; Unicode-normalized observ/osserv/inform retrieval plus exact Latin ancestry candidate nodes. Retrieval is not acceptance.',artifacts,families:Object.keys(families),counts:Object.fromEntries(Object.entries(candidates).map(([l,m])=>[l,Object.fromEntries(Object.entries(m).map(([k,a])=>[k,a.length]))]))},null,2)+'\n');
