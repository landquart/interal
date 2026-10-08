#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gzipSync,gunzipSync} from 'node:zlib';
import {partitionReview,digest} from './lib/associative-v6-contamination.mjs';
const base='audit/associative-family-v6/prompt07-contamination-20261005/';
const out=process.argv[2]||base+'generated';
assert(!path.resolve(out).startsWith(path.resolve('associativvordes')),'Review output must not modify index');
const inputs={},read=async p=>{const bytes=await fs.readFile(p);inputs[p]=digest(bytes);return JSON.parse(p.endsWith('.gz')?gunzipSync(bytes):bytes);};
const research=await read(base+'research.json'),decision=await read(base+'decision.json');
assert.equal(decision.research_sha256,inputs[base+'research.json'],'Stale research decision');
assert.equal(decision.production_enabled,false);assert.equal(decision.binding_authorized,false);assert.equal(decision.accepted_membership_authorized,false);assert.equal(decision.merge_authorized,false);
for(const[p,hash]of Object.entries(research.source_sha256))assert.equal(digest(await fs.readFile(p)),hash,'Stale source '+p);
const sources=new Set(research.sources.map(x=>x.id));for(const b of research.branches)for(const id of b.evidence_ids)assert(sources.has(id),'Unknown evidence ID');
const incidences=[];
const add=(frame,route_id,p,index,row,language=row.language,rec=row.source_record||row)=>{const locator=p+'#/'+index,source_sha256=inputs[p];const data={frame,route_id,language,lemma_id:rec.lemma_id,word:rec.word,locator,source_sha256,source_record:row,source_record_sha256:digest(row)};data.incidence_id='incidence:'+digest([frame,route_id,language,rec.lemma_id,locator,source_sha256]);incidences.push(data);};
const root='audit/associative-family-v6/';
for(const[frame,p]of [['val',root+'val-route-review-20261003/records.json.gz'],['russian',root+'russian-short-review-20261003/records.json.gz']]){const rows=await read(p);rows.forEach((r,i)=>add(frame,r.route_id||r.candidate_id,p,i,r));}
const towerPath=root+'tower-promotion-source-frame-20261003.json.gz',tower=await read(towerPath);tower.forEach((r,i)=>r.records.forEach((rec,j)=>add('tower',r.route_id,towerPath,i+'/records/'+j,rec)));
// Permanent real corpus controls retain frozen dictionary verdicts independently of flags.
const system=await read(root+'system-promotion-research-20261003.json'),anis=await read(root+'anis-promotion-research-20261003.json');
add('controls','system.translation',root+'system-promotion-research-20261003.json','negative_alias_control/source_record',system.negative_alias_control.source_record,'ru');
const aniso=anis.negative_controls.find(x=>x.word==='anisotropy'&&x.language==='fr');assert(aniso);add('controls','anis.scientific',root+'anis-promotion-research-20261003.json','negative_controls/'+anis.negative_controls.indexOf(aniso)+'/source_record',aniso.source_record,aniso.language);
const controlBranch=(id,row,flag,reason)=>({id,frame:'controls',kind:'permanent_negative_control',head_scope:'negative_control_research',dictionary_supported_heads:[],candidate_canonical:null,canonical_approval:false,formal_history:reason,senses:'Saved negative control against unrelated candidate family',national_forms:[],evidence_ids:[row.locator],exact_records:[{frame:row.frame,language:row.language,lemma_id:row.lemma_id,word:row.word}],evidence_gaps:['No new exclusion is emitted; independent frozen negative evidence remains authoritative.'],flags:[flag],review_state:'permanent_negative_control',family_id:null,membership_authorized:false});
const controls=incidences.filter(r=>r.frame==='controls'),branches=[...research.branches,controlBranch('control.system.sostav',controls[0],'semantic_translation_gloss',system.negative_alias_control.finding),controlBranch('control.anis.scientific',controls[1],'unrelated_homonym',aniso.reason)];
const dossier=partitionReview({incidences,branches});
for(const[frame,m]of Object.entries(decision.source_counts)){assert.equal(dossier.metrics.frames[frame].incidences,m.incidences);assert.equal(dossier.metrics.frames[frame].unique_ids,m.unique_ids);}
await fs.mkdir(out,{recursive:true});
const write=async(n,data,gz=false)=>{const bytes=Buffer.from(JSON.stringify(data)+'\n');await fs.writeFile(path.join(out,n),gz?gzipSync(bytes,{level:9,mtime:0}):bytes);};
const {incidences:sourceIncidences,flags:sourceFlags,...summary}=dossier,storage={incidences:[],flags:[]};
for(const[kind,rows,size]of [['incidences',sourceIncidences,1500],['flags',sourceFlags,500]])for(let start=0;start<rows.length;start+=size){const name=kind+'-'+String(start/size).padStart(3,'0')+'.json.gz',chunk=rows.slice(start,start+size);await write(name,chunk,true);storage[kind].push({path:name,count:chunk.length,sha256:digest(await fs.readFile(path.join(out,name)))});}
await write('partition-dossier.json.gz',{...summary,storage},true);
await write('build-manifest.json',{schema_version:6,production_enabled:false,code_sha256:Object.fromEntries(await Promise.all(['scripts/build-associative-v6-contamination.mjs','scripts/lib/associative-v6-contamination.mjs','scripts/lib/associative-v6-contamination-io.mjs'].map(async p=>[p,digest(await fs.readFile(p))]))),source_conservation:dossier.source_conservation});
await write('input-lock.json',inputs);await write('metrics.json',dossier.metrics);await write('unresolved-partitions.json.gz',dossier.partitions.filter(p=>p.kind==='unresolved_partition'),true);
await write('alias-branch-index.json',{schema_version:6,production_enabled:false,navigation_only:true,alias:'val',results:research.branches.filter(b=>b.frame==='val'&&!['val.cheval','val.it.stivale'].includes(b.id)).map(b=>({branch_id:b.id,candidate_canonical:b.candidate_canonical,head_scope:b.head_scope,membership_authorized:false})),same_spelling_does_not_merge:true});
await write('controls.json',{synthetic_fixture:false,negative_controls:controls.map(r=>({frame:r.frame,language:r.language,lemma_id:r.lemma_id,word:r.word,locator:r.locator,independent_verdict:'excluded_from_unrelated_family_in_saved_dossier',accepted_membership_created:false})),positive_research_controls:['val.valid','val.value','val.valley','ru.um.mental','tower.en.tower'],positive_does_not_mean_membership:true});
const csv=['partition_id,frame,route_id,language,unique_ids,route_incidences,review_state',...dossier.partitions.map(p=>[p.id,p.frame,p.route_id||'',p.language||'',p.corpus_ids.length,p.incidence_ids.length,p.review_state].join(','))].join('\n')+'\n';await fs.writeFile(path.join(out,'unresolved-partitions.csv'),csv);
console.log(JSON.stringify({verdict:'pass',...dossier.metrics}));
