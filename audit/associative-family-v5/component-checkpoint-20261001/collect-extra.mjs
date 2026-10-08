import {readFile,readdir,writeFile}from'node:fs/promises';import{gunzipSync}from'node:zlib';
const root='/workspace/scratch/510f41b5cadf/interal/associativvordes/family-index-v5',out='/workspace/scratch/dab7b6b0d8c3/review';
const read=async p=>JSON.parse(gunzipSync(await readFile(p)));
const groups={nat:new Map(),loc:new Map(),inter:new Map()},metadata={};
const nat=/^la:(?:natu(?:s|ra|ralis)|natio(?:n)?|nativus|natalis|nasci|nascor|innatus|cognatus|agnatus|connatus)$/;
const loc=/^la:(?:locus|locare|locatio|localis|locomotivus|collocare|collocatio)$/;
const records={};
for(const language of['en','de','fr','es','it','ru']){
const byGroup={};for(const g of ['nat','loc','inter'])byGroup[g]=new Map(JSON.parse(await readFile(`${out}/${g}-${language}.json`)).map(m=>[m.lemma_id,m]));
for(const f of(await readdir(root+'/members/'+language)).sort()){
const shard=await read(root+'/members/'+language+'/'+f);
for(const[group,ids]of Object.entries(groups))for(const id of ids.keys())if(shard[id])for(const m of shard[id]){
const old=byGroup[group].get(m.lemma_id);if(old)old.family_ids.push(id);else byGroup[group].set(m.lemma_id,{...m,family_ids:[id]});
}
// Retrieval candidates only. No substring rule approves membership.
for(const[id,ms]of Object.entries(shard))for(const m of ms){
for(const group of ['nat','loc','inter']){
 const patterns=language==='ru'?{nat:/нат|наци|наив|когнат|агнат/,loc:/лок|локац/,inter:/интер/}:{nat:/naiss|naît|naitre|nac[ei]|renai|^né(?:e|s|es)?$|^nee$|renaissance|^no[ëe]l|^puny|^puisn/,loc:/^lieu(?:x)?$|^lieut|^louer$|^louage|^allouer$|^allog|^logar$|^locare/,inter:/^entre/};
 if(patterns[group].test(m.word.toLowerCase())&&!byGroup[group].has(m.lemma_id))byGroup[group].set(m.lemma_id,{...m,family_ids:[id],retrieval_only:true});
}
}}
for(const[group,ms]of Object.entries(byGroup)){
const values=[...ms.values()].sort((a,b)=>a.word.localeCompare(b.word));
await writeFile(`${out}/${group}-${language}.json`,JSON.stringify(values));
await writeFile(`${out}/${group}-${language}.txt`,values.map(m=>m.word+'\t'+m.frequency_score+'\t'+(m.retrieval_only?'retrieval':'branch')).join('\n'));
console.log(group,language,values.length);
}}
