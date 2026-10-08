import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {gunzipSync,gzipSync} from 'node:zlib';
import {familyBucket} from '../associativvordes/js/family-index-loader.js';
import {buildSearchForm} from '../associativvordes/js/search-normalizer.js';
import {recountMaterializedMembers,refreshFamilySummaries,repositoryTreeMetadata} from './lib/associative-repository-materialization.mjs';
const root=process.argv[2]||'associativvordes/family-index-v5',apply=process.argv.includes('--apply');
const checkpoint='audit/associative-family-v5/component-checkpoint-20261001';
const ledgerPath='audit/associative-family-v5/exact-components-20261001.json';
const originalPath='audit/associative-family-v5/exact-components-original-inter-20261001.json.gz';
const repair='materialize_reviewed_exact_component_memberships_20261001';
const read=async p=>JSON.parse((p.endsWith('.gz')?gunzipSync(await readFile(p)):await readFile(p)).toString());
const write=(p,v)=>writeFile(p,p.endsWith('.gz')?gzipSync(JSON.stringify(v),{level:6}):JSON.stringify(v,null,2)+'\n');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),digest=v=>sha(JSON.stringify(v));
const path=(part,key)=>join(root,part,familyBucket(key)+'.json.gz');
const languages=['en','de','fr','es','it','ru'],keys=['nat','loc','inter'],ids=keys.map(k=>'family:'+k);
const bytes=await readFile(checkpoint+'/decisions.json'),decisions=JSON.parse(bytes);
assert.equal(decisions.source_run_id,35647932153);
for(const [file,hash]of Object.entries(decisions.artifacts))assert.equal(sha(await readFile(checkpoint+'/'+file)),hash,`checkpoint changed: ${file}`);
const records=await read(checkpoint+'/candidate-records.json.gz');
const supplementPath='audit/associative-family-v5/component-completion-supplement-20261001.json';
const supplementBytes=await readFile(supplementPath),supplement=JSON.parse(supplementBytes);
assert.equal(supplement.source_run_id,decisions.source_run_id);
const approved=structuredClone(decisions.accepted);
for(const [key,byLanguage]of Object.entries(supplement.additional_words))for(const [language,words]of Object.entries(byLanguage))for(const word of words){
 const m=records[key][language].find(m=>m.word===word);assert(m,`supplement lacks source ${key}/${language}/${word}`);
 if(!approved[key][language].some(d=>d.lemma_id===m.lemma_id))approved[key][language].push({lemma_id:m.lemma_id,word:m.word,source_family_ids:m.family_ids});
}
const clean=m=>{const {family_ids,retrieval_only,...original}=m;return original;};
const selected={};
for(const key of keys){selected[key]={};for(const lang of languages){
 const byId=new Map(records[key][lang].map(m=>[m.lemma_id,m]));
 selected[key][lang]=approved[key][lang].map(d=>{
  const m=byId.get(d.lemma_id);assert(m&&m.word===d.word);assert(buildSearchForm(m.word).includes(key),`absent whole fragment ${key}/${m.word}`);
  assert(m.corpus_quality?.status!=='rejected');return {source_family_id:m.family_ids[0],member:clean(m)};
 });
 assert.equal(new Set(selected[key][lang].map(m=>m.member.lemma_id)).size,selected[key][lang].length);
}}
const manifest=await read(join(root,'manifest.json')),report=await read(join(root,'report.json')),provenance=await read(join(root,'repository-provenance.json'));
assert.equal(manifest.repository_storage.immutable_source_run_id,decisions.source_run_id);
assert(!provenance.repository_repairs.some(r=>r.repair===repair),'Already applied');
const cache=new Map(),get=async p=>{if(!cache.has(p))cache.set(p,await read(p));return cache.get(p);};
const stripped=(part,obj)=>Object.fromEntries(Object.entries(obj).filter(([id])=>part==='aliases'?!keys.includes(id):!ids.includes(id)));
if(!apply){
 const original={family:(await get(path('families','family:inter')))['family:inter'],members:{}};
 for(const lang of languages)original.members[lang]=(await get(path('members/'+lang,'family:inter')))['family:inter'];
 for(const id of ['family:nat','family:loc'])assert(!(await get(path('families',id)))[id],`already present ${id}`);
 const alias_before={};for(const key of ['nat','loc'])alias_before[key]=(await get(path('aliases',key)))[key];
 const preservation=[];
 for(const part of ['families',...languages.map(l=>'members/'+l),'aliases']){
  const relevant=part==='aliases'?['nat','loc']:ids;
  for(const bucket of new Set(relevant.map(familyBucket))){const p=join(root,part,bucket+'.json.gz');preservation.push({part,bucket,unrelated_sha256:digest(stripped(part,await get(p)))});}
 }
 const expected_removed=Object.values(original.members).reduce((s,ms)=>s+ms.length,0);
 const expected_added=keys.reduce((s,k)=>s+languages.reduce((t,l)=>t+selected[k][l].length,0),0);
 await write(originalPath,original);
 const ledger={schema_version:1,repair,source_run_id:decisions.source_run_id,base_commit:decisions.base_commit,checkpoint_sha256:sha(bytes),checkpoint_source_records_sha256:decisions.artifacts['source-records.json.gz'],original_inter_sha256:sha(await readFile(originalPath)),accepted:approved,supplement_sha256:sha(supplementBytes),checkpoint_candidate_records_sha256:decisions.artifacts['candidate-records.json.gz'],alias_before,preservation,expected_removed_memberships:expected_removed,expected_added_memberships:expected_added,added_families:2,exact_component_policy:decisions.user_rule,normalization:decisions.normalization,review_method:decisions.review_method,sources:decisions.sources,limitations:decisions.limitations,status:'ready_to_materialize'};
 await write(ledgerPath,ledger);console.log(JSON.stringify({mode:'prepare',removed:expected_removed,added:expected_added,counts:Object.fromEntries(keys.map(k=>[k,Object.fromEntries(languages.map(l=>[l,selected[k][l].length]))]))}));
}else{
 const ledgerBytes=await readFile(ledgerPath),l=JSON.parse(ledgerBytes),original=await read(originalPath);
 assert.equal(l.checkpoint_sha256,sha(bytes));assert.equal(l.original_inter_sha256,sha(await readFile(originalPath)));
 assert.deepEqual(l.accepted,approved);assert.equal(l.supplement_sha256,sha(supplementBytes));assert.deepEqual((await get(path('families','family:inter')))['family:inter'],original.family);
 for(const lang of languages)assert.deepEqual((await get(path('members/'+lang,'family:inter')))['family:inter'],original.members[lang]);
 for(const [key,values]of Object.entries(l.alias_before))assert.deepEqual((await get(path('aliases',key)))[key],values);
 for(const p of l.preservation)assert.equal(digest(stripped(p.part,await get(join(root,p.part,p.bucket+'.json.gz')))),p.unrelated_sha256);
 for(const id of ['family:nat','family:loc'])assert(!(await get(path('families',id)))[id]);
 // Read every source shard needed by the frozen decisions, without accumulating
 // the entire source corpus in RAM. Do not create corpus records or frequencies.
 for(const lang of languages){
  const groups=new Map();for(const key of keys)for(const d of selected[key][lang]){const b=familyBucket(d.source_family_id);if(!groups.has(b))groups.set(b,[]);groups.get(b).push(d);}
  for(const [b,values]of groups){const shard=await read(join(root,'members',lang,b+'.json.gz'));for(const d of values){const actual=shard[d.source_family_id]?.find(m=>m.lemma_id===d.member.lemma_id);assert.deepEqual(actual,d.member,`source changed ${lang}/${d.member.word}`);}}
 }
 // All preflight assertions complete before the first data write.
 const changed=new Set();let added=0;
 for(const key of keys){
  const id='family:'+key,language_support={};
  for(const lang of languages){
   const p=path('members/'+lang,id),shard=await get(p),values=selected[key][lang].map(d=>{
    const member=structuredClone(d.member);
    member.components=[{surface:key,canonical_candidate:key,confidence:0.95,evidence:[{type:'manual_override',source:ledgerPath,relation_type:key==='inter'?'affix_component':'compound_component',path:[member.word,key],confidence:0.95,exact_fragment:true,etymology_basis:checkpoint+'/decisions.json#sources/'+key}]}];return member;
   });
   language_support[lang]=values.length;added+=values.length;
   if(values.length)shard[id]=values;else delete shard[id];changed.add(p);
  }
  const family={id,canonical:key,aliases:[key],verified:false,confidence:'B',source:'etymological_component_review+manual_override',runtime_curated:true,exact_component:true,etymon_keys:key==='nat'?['la:natus','la:nasci']:key==='loc'?['la:locus']:['la:inter'],relation_types:[key==='inter'?'affix_component':'compound_component'],relation_evidence:[{type:'manual_override',source:ledgerPath,relation_type:key==='inter'?'affix_component':'compound_component',whole_lemma_union:false}],canonical_selection:{method:'requested_exact_component'},language_support,support:Object.values(language_support).reduce((s,n)=>s+n,0),suspicion_score:0,suspicion_reasons:[],review_status:'needs_review'};
  const fp=path('families',id);(await get(fp))[id]=family;changed.add(fp);
  if(key!=='inter'){const ap=path('aliases',key),as=await get(ap);as[key]=[...new Set([...as[key],id])].sort();assert(as[key].length<=25);changed.add(ap);}
 }
 assert.equal(added,l.expected_added_memberships);
 for(const p of l.preservation)assert.equal(digest(stripped(p.part,await get(join(root,p.part,p.bucket+'.json.gz')))),p.unrelated_sha256,'unrelated data changed');
 for(const p of changed)await write(p,cache.get(p));
 manifest.counts.families+=l.added_families;await write(join(root,'manifest.json'),manifest);
 await recountMaterializedMembers(root,manifest,report);await refreshFamilySummaries(root,report);
 const delta={repair,source_run_id:l.source_run_id,removed_memberships:l.expected_removed_memberships,added_memberships:added,added_families:2,decision_ledger_sha256:sha(ledgerBytes),checkpoint_sha256:sha(bytes),full_family_certification:false,exact_fragment_required:true};
 provenance.repository_repairs.push(delta);report.repository_materialization.exact_component_review=delta;
 await write(join(root,'report.json'),report);Object.assign(provenance,await repositoryTreeMetadata(root));await write(join(root,'repository-provenance.json'),provenance);
 console.log(JSON.stringify({mode:'apply',...delta,memberships:report.repository_materialization.memberships,unassigned:report.repository_materialization.lemmas_without_materialized_family}));
}
