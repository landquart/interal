// Retrieval only. Never grants membership; preserves original payloads and IDs.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {streamFrequencyRecords} from './lib/frequency-record-stream.mjs';
import {stableLemmaId} from './lib/associative-family-graph.mjs';
const out=process.argv[2]||'audit/associative-family-v6/regul-20261008/research';
const hash=b=>createHash('sha256').update(b).digest('hex');
const languages=['en','de','fr','es','it','ru'], inputs={}, prior=[], candidates=new Map();
const patterns={en:/regul|regol|régul|\brul(?:e|ed|es|ing|er|ers)\b/i,de:/regul|regol|régul|regel/i,fr:/regul|regol|régul|règl|régl/i,es:/regul|regol|régul|regl/i,it:/regul|regol|régul/i,ru:/regul|regol|régul|регул|регол/i};
for(const language of languages){
 const path=`associativvordes/family-index-v5/members/${language}/40.json.gz`, bytes=await fs.readFile(path);inputs[path]=hash(bytes);
 const rows=JSON.parse(gunzipSync(bytes))['family:regul'];
 for(const record of rows)prior.push({language,family_id:'family:regul',lemma_id:record.lemma_id,word:record.word,source_record:record,source_locator:{path,family_id:'family:regul',record_sha256:hash(JSON.stringify(record))}});
 const root='associativvordes/frequency lists/'+language;
 let occurrences=0;
 for(const name of (await fs.readdir(root)).filter(n=>n.endsWith('.json')).sort()){
  const path=root+'/'+name;inputs[path]=hash(await fs.readFile(path));
  for await(const r of streamFrequencyRecords({filePath:path,sourceId:path,format:'ranked-word-ipm-object'})){
   occurrences++;if(!patterns[language].test(r.normalized)&&!patterns[language].test(r.search_form))continue;
   const id=stableLemmaId(language,r.normalized),key=language+'\0'+id;
   if(!candidates.has(key))candidates.set(key,{language,lemma_id:id,word:r.original,normalized:r.normalized,search_form:r.search_form,frequency_source_records:[],v5_locators:[]});
   candidates.get(key).frequency_source_records.push({path,record_sha256:hash(JSON.stringify(r)),record:r});
  }
 }
 // Retrieve every matching immutable materialized row, all routes retained.
 for(const name of (await fs.readdir('associativvordes/family-index-v5/members/'+language)).filter(n=>n.endsWith('.json.gz')).sort()){
  const path='associativvordes/family-index-v5/members/'+language+'/'+name,bytes=await fs.readFile(path),shard=JSON.parse(gunzipSync(bytes));let used=false;
  for(const[family_id,rows]of Object.entries(shard))for(const record of rows){const c=candidates.get(language+'\0'+record.lemma_id);if(!c)continue;used=true;c.v5_locators.push({path,family_id,record_sha256:hash(JSON.stringify(record))});if(!c.source_record)c.source_record=record;else {const {components:a,...x}=c.source_record,{components:b,...y}=record;if(JSON.stringify(x)!==JSON.stringify(y))throw Error('Conflicting measured source '+record.lemma_id);}}
  if(used)inputs[path]=hash(bytes);
 }
 console.error(language,occurrences,[...candidates.values()].filter(c=>c.language===language).length);
}
const priors=new Set(prior.map(r=>r.language+'\0'+r.lemma_id));
for(const r of prior)if(!candidates.has(r.language+'\0'+r.lemma_id))throw Error('Retrieval missed prior '+r.word);
const rows=[...candidates.values()].sort((a,b)=>(a.language+'\0'+a.lemma_id).localeCompare(b.language+'\0'+b.lemma_id,'en'));
for(const c of rows)c.prior_regul=priors.has(c.language+'\0'+c.lemma_id);
await fs.mkdir(out,{recursive:true});
await fs.writeFile(out+'/prior.json',JSON.stringify(prior,null,2)+'\n');
await fs.writeFile(out+'/candidates.json',JSON.stringify(rows,null,2)+'\n');
const manifest={schema_version:6,source_sha:'f70c217d08329f7f93fd56945cb7366562e579e9',family_id:'family:regul',production_enabled:false,patterns:Object.fromEntries(Object.entries(patterns).map(([k,v])=>[k,v.source])),input_sha256:inputs,prior:prior.length,candidates:rows.length,additional:rows.length-prior.length,duplicate_source_occurrences_retained:rows.reduce((s,r)=>s+r.frequency_source_records.length,0)-rows.length,zero_v5:rows.filter(r=>!r.source_record).map(r=>({language:r.language,lemma_id:r.lemma_id,word:r.word})),per_language:Object.fromEntries(languages.map(l=>[l,{prior:prior.filter(r=>r.language===l).length,candidates:rows.filter(r=>r.language===l).length}])),scope:'All original memberships and complete matching source rows under the six explicit retrieval patterns; not the entire natural-language lexicon.',retrieval_is_not_acceptance:true};
await fs.writeFile(out+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({...manifest,input_sha256:undefined}));
