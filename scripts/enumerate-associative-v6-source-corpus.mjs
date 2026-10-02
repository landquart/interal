#!/usr/bin/env node
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {streamFrequencyRecords} from './lib/frequency-record-stream.mjs';
import {stableLemmaId} from './lib/associative-family-graph.mjs';
const out=process.argv[2]||'audit/associative-family-v6/corpus-enumeration.json';
const manifest=JSON.parse(await fs.readFile('associativvordes/family-index-v5/manifest.json'));
const report={schema_version:6,source_head:'22e6293f72a22e80e364079d83031a1f8f2a36d6',identity_algorithm:'unchanged v5 stableLemmaId(language, normalized source lemma)',languages:{},source_identity_mismatches:[],total_source_ids:0,zero_membership_source_records:[],measurement_policy:'Original raw frequency measurements retained; missing aggregated candidate scores are not synthesized.',parser:'Production ranked-word-ipm-object format; explicit rank/word/IPM nesting preserves reserved lexical words.'};
for(const language of manifest.languages){
 const root='associativvordes/frequency lists/'+language,rows=new Map(),materialized=new Set();
 for(const name of (await fs.readdir('associativvordes/family-index-v5/members/'+language)).sort()){
  if(!name.endsWith('.json.gz'))continue;const shard=JSON.parse(gunzipSync(await fs.readFile('associativvordes/family-index-v5/members/'+language+'/'+name)));for(const ms of Object.values(shard))for(const m of ms)materialized.add(m.lemma_id);
 }
 for(const name of (await fs.readdir(root)).filter(n=>n.endsWith('.json')).sort()){
  const p=root+'/'+name;for await(const record of streamFrequencyRecords({filePath:p,sourceId:p,format:'ranked-word-ipm-object'})){
   const id=stableLemmaId(language,record.normalized);
   if(!rows.has(id))rows.set(id,record.normalized);
   if(!materialized.has(id)){let g=report.zero_membership_source_records.find(g=>g.language===language&&g.lemma_id===id);if(!g){g={language,lemma_id:id,word:record.original,normalized:record.normalized,search_form:record.search_form,associative_family_ids:[],frequency_source_records:[]};report.zero_membership_source_records.push(g);}g.frequency_source_records.push(record);}
  }
 }
 const missing=[...materialized].filter(id=>!rows.has(id));
 if(missing.length){report.source_identity_mismatches.push({language,missing_ids:missing});console.error(language+' unmatched original materialized IDs: '+missing.join(','));}
 const ids=[...rows.keys()].sort();report.languages[language]={source_ids:ids.length,materialized_ids:materialized.size,without_v5_membership:ids.length-materialized.size,ordered_ids_sha256:createHash('sha256').update(JSON.stringify(ids)).digest('hex')};report.total_source_ids+=ids.length;console.error('v6 corpus '+language+': '+ids.length+' IDs');
}
report.expected_source_ids=manifest.counts.lemmas;report.expected_without_membership=829;
report.verdict=report.total_source_ids===manifest.counts.lemmas&&report.zero_membership_source_records.length===829&&!report.source_identity_mismatches.length?'pass':'source_reconciliation_required';report.zero_membership_source_records.sort((a,b)=>(a.language+a.lemma_id).localeCompare(b.language+b.lemma_id,'en'));await fs.mkdir(out.slice(0,out.lastIndexOf('/')),{recursive:true});await fs.writeFile(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({verdict:report.verdict,source_ids:report.total_source_ids,zero_membership_records:report.zero_membership_source_records.length}));if(report.verdict!=='pass')process.exitCode=1;
