// Real v5 loader and current calculator, local immutable snapshots only.
import fs from 'node:fs';import path from 'node:path';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {FamilyIndexLoader} from '../js/family-index-loader.js';
import {replay} from '../release_control/calculator.mjs';
const started=performance.now(),cpuStarted=process.cpuUsage();
const work=process.argv[2];if(!work)throw Error('work required');const read=p=>JSON.parse(fs.readFileSync(p));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const roots={before:path.join(work,'before','current','associativvordes/family-index-v5'),after:path.join(work,read(path.join(work,'SHADOW-PATH.json')).relative,'current','associativvordes/family-index-v5')};
const langs=['en','de','fr','es','it','ru'];const queries=['manu','regul','creat','ocul','ped','inter','liber','mut','net','nitidus','sonus','genea','act','actu','mani','regl','nonexistentqzx'];
const make=root=>new FamilyIndexLoader({baseUrl:'/research-v5',fetchJson:async url=>{const relative=url.slice('/research-v5/'.length);const p=path.resolve(root,relative);if(!p.startsWith(path.resolve(root)+path.sep))throw Error('snapshot fetch escape');const b=fs.readFileSync(p);return JSON.parse(p.endsWith('.gz')?gunzipSync(b):b);}});
const result=[];let runtimeDifferences=0,calculatorDifferences=0;
for(const query of queries){
 const recordings={};const runtimes={};
 for(const [side,root] of Object.entries(roots)){
  const loader=make(root),languages={};const summaries={};
  for(const l of langs){
   try{
    const raw=await loader.candidateEntries(query,l);summaries[l]={count:raw.length,ordered_source_rows_sha256:hash(raw),error:null,first_five_observed_rows:raw.slice(0,5).map(r=>({word:r.word,lemma_id:r.lemma_id,family_id:r.family_id,sources:r.sources}))};
    languages[l]=raw.map(r=>({...r,final_score:null,association_score:null,analysis:{status:'missing',review_required:true,reason:'No verified lexical/sense-specific A/P available; source frequency is retained unchanged'}}));
   }catch(e){if(!/^Family alias fan-out \d+ exceeds runtime limit 25$/.test(e.message))throw e;summaries[l]={count:null,ordered_source_rows_sha256:null,error:{name:e.name,message:e.message},first_five_observed_rows:[]};languages[l]=[];}
   loader.cache.clear();
  }
  runtimes[side]=summaries;
  const recording={schema:'release07-calculator-recording/1',input:{root:query,meaning:'',maxModels:5},languages,semantic_analysis:'MISSING_NOT_SYNTHESIZED'};
  const calculation=await replay(recording);
  recordings[side]={input_sha256:hash(recording),state_sha256:hash(calculation.state),top_five:calculation.topFive,final_result:calculation.state.finalAssociationResult??null,FAv:calculation.state.finalAssociationResult?.FAv??null,demographic_coverage_status:'UNKNOWN_WITHOUT_SCORED_REPRESENTED_LANGUAGES',semantic_top_five_status:'UNKNOWN_WITHOUT_VERIFIED_A_P',competing_model_status:'UNKNOWN_NATIVE_MODEL_BINDINGS_NOT_ASSERTED'};
 }
 const runtimeEqual=hash(runtimes.before)===hash(runtimes.after),calculatorEqual=hash(recordings.before)===hash(recordings.after);runtimeDifferences+=!runtimeEqual;calculatorDifferences+=!calculatorEqual;
 result.push({query,runtime:runtimes,calculator:recordings,runtime_equal:runtimeEqual,calculator_equal:calculatorEqual});process.stdout.write(JSON.stringify({query,runtimeEqual,calculatorEqual})+'\n');global.gc?.();
}
const r={schema:'full-v5-runtime-calculator-comparison/1',scope:'Actual v5 byte-identical shadow, not v6 recordings or a changed materializer',queries:queries.length,language_queries:queries.length*6,rows:result,runtime_differences:runtimeDifferences,calculator_state_differences:calculatorDifferences,semantic_impact_certified:false,semantic_gate:'BLOCKED',unknown_reason:'No independently verified target sense, A/P or sense-specific frequency binding; no scores synthesized',paid_api_calls:0,production_writes:0,performance:{wall_seconds:(performance.now()-started)/1000,cpu_microseconds:process.cpuUsage(cpuStarted),peak_rss_kib:process.resourceUsage().maxRSS}};
const out=path.join(work,'CALCULATOR-COMPARISON.json');fs.writeFileSync(out+'.partial',JSON.stringify(r));fs.renameSync(out+'.partial',out);if(runtimeDifferences||calculatorDifferences)throw Error('runtime replay differs');
