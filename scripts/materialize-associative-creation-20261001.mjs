import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {familyBucket} from '../associativvordes/js/family-index-loader.js';
import {matchesReviewedAssociativeForm} from '../associativvordes/js/associative-reflex-forms.js';
import {recountMaterializedMembers,refreshFamilySummaries,repositoryTreeMetadata} from './lib/associative-repository-materialization.mjs';
const root='associativvordes/family-index-v5',audit='audit/associative-family-v5',checkpoint=audit+'/creation-checkpoint-20261001';
const ledgerPath=audit+'/creation-families-20261001.json',repair='materialize_reviewed_creation_associative_root_20261001';
const languages=['en','de','fr','es','it','ru'],keys=['creat'],retired=['ety:a3b640366c27','ety:ab1eaa1c14b6'],ids=keys.map(k=>'family:'+k),apply=process.argv.includes('--apply');
const read=async p=>JSON.parse((p.endsWith('.gz')?gunzipSync(await readFile(p)):await readFile(p)).toString());
const write=(p,v)=>writeFile(p,p.endsWith('.gz')?gzipSync(JSON.stringify(v),{level:6}):JSON.stringify(v,null,2)+'\n');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),digest=v=>sha(JSON.stringify(v)),path=(part,key)=>`${root}/${part}/${familyBucket(key)}.json.gz`;
const decisionBytes=await readFile(checkpoint+'/linguistic-decisions.json'),decisions=JSON.parse(decisionBytes),inventory=await read(checkpoint+'/inventory.json');
for(const [file,hash]of Object.entries(inventory.artifacts))assert.equal(sha(await readFile(checkpoint+'/'+file)),hash);
const candidates=await read(checkpoint+'/candidates.json.gz'),original=await read(checkpoint+'/original-families.json.gz');
const aliases={creat:['creat','crea','kreat','creation','creatio','creati','creazione','creacion','kreation']};
const clean=m=>{const {source_family_ids,...value}=m;return value};
const accepted={};for(const key of keys){accepted[key]={};for(const language of languages){const byId=new Map(candidates[language][key].map(m=>[m.lemma_id,m]));accepted[key][language]=decisions.decisions[language][key].filter(d=>d.status==='accepted').map(d=>{
 const m=byId.get(d.lemma_id);assert(m&&m.word===d.word);assert(matchesReviewedAssociativeForm(m,{canonical:key,surface_forms:decisions.surface_forms[key]},language));assert.notEqual(m.corpus_quality?.status,'rejected');return {...d,original_member:clean(m)};
 });}}
const manifest=await read(root+'/manifest.json'),report=await read(root+'/report.json'),provenance=await read(root+'/repository-provenance.json');
assert.equal(provenance.source_run_id,35647932153);assert(!provenance.repository_repairs.some(r=>r.repair===repair),'Already applied');
const cache=new Map(),get=async p=>{if(!cache.has(p))cache.set(p,await read(p));return cache.get(p)};
for(const id of retired){assert.deepEqual((await get(path('families',id)))[id],original.families[id]);for(const language of languages)assert.deepEqual((await get(path('members/'+language,id)))[id]||[],original.members[language][id]||[]);}
for(const id of ids)assert(!(await get(path('families',id)))[id],'Family already exists');
const allAliases=[...new Set([...retired.flatMap(id=>original.families[id].aliases),...Object.values(aliases).flat()])].sort();
const stripped=(part,shard)=>Object.fromEntries(Object.entries(shard).filter(([id])=>part==='aliases'?!allAliases.includes(id):![...retired,...ids].includes(id)));
if(!apply){
 const alias_before={};for(const alias of allAliases)alias_before[alias]=(await get(path('aliases',alias)))[alias]||[];
 const preservation=[];for(const part of ['families',...languages.map(l=>'members/'+l),'aliases'])for(const bucket of new Set((part==='aliases'?allAliases:[...retired,...ids]).map(familyBucket))){const p=`${root}/${part}/${bucket}.json.gz`;preservation.push({part,bucket,unrelated_sha256:digest(stripped(part,await get(p)))});}
 const original_memberships=retired.reduce((s,id)=>s+languages.reduce((t,l)=>t+(original.members[l][id]||[]).length,0),0),added=Object.values(accepted).reduce((s,v)=>s+Object.values(v).reduce((t,ms)=>t+ms.length,0),0);
 const ledger={schema_version:1,repair,source_run_id:35647932153,base_commit:'3e539a5e9e624dbe242309cd8887caf0c6285f81',decision_sha256:sha(decisionBytes),checkpoint_artifacts:inventory.artifacts,retired_families:retired,new_families:ids,aliases,surface_forms:decisions.surface_forms,accepted:Object.fromEntries(keys.map(k=>[k,Object.fromEntries(languages.map(l=>[l,accepted[k][l].map(({original_member,...d})=>d)]))])),alias_before,preservation,expected_removed_memberships:original_memberships,expected_added_memberships:added,net_family_delta:ids.length-retired.length,counts:decisions.counts,supersedes_information_preservation_for:retired.filter(id=>id!=='ety:497564008159'),original_information_subset_preserved:true,status:'ready_to_materialize'};
 await write(ledgerPath,ledger);console.log(JSON.stringify({mode:'prepare',removed:original_memberships,added,counts:decisions.counts}));
}else{
 const ledgerBytes=await readFile(ledgerPath),l=JSON.parse(ledgerBytes);assert.equal(l.decision_sha256,sha(decisionBytes));assert.deepEqual(l.retired_families,retired);assert.deepEqual(l.aliases,aliases);assert.deepEqual(l.surface_forms,decisions.surface_forms);
 for(const p of l.preservation)assert.equal(digest(stripped(p.part,await get(`${root}/${p.part}/${p.bucket}.json.gz`))),p.unrelated_sha256);
 for(const [alias,before]of Object.entries(l.alias_before))assert.deepEqual((await get(path('aliases',alias)))[alias]||[],before);
 for(const language of languages){
  const groups=new Map();
  for(const key of keys){assert.deepEqual(l.accepted[key][language],accepted[key][language].map(({original_member,...d})=>d));for(const d of accepted[key][language]){const p=path('members/'+language,d.source_family_ids[0]);if(!groups.has(p))groups.set(p,[]);groups.get(p).push(d);}}
  // Source shards are read once per language/bucket and released immediately;
  // retaining the full corpus in the mutation cache can exhaust the heap.
  for(const [p,values]of groups){const shard=await read(p);for(const d of values)assert.deepEqual(shard[d.source_family_ids[0]]?.find(m=>m.lemma_id===d.lemma_id),d.original_member,`source mismatch ${language}/${d.word}`);}
 }

 const changed=new Set();
 for(const id of retired){const fp=path('families',id);delete(await get(fp))[id];changed.add(fp);for(const language of languages){const mp=path('members/'+language,id),s=await get(mp);if(s[id]){delete s[id];changed.add(mp);}}}
 for(const key of keys){const id='family:'+key,language_support={};
  for(const language of languages){const p=path('members/'+language,id),s=await get(p),ms=accepted[key][language].map(d=>{const m=structuredClone(d.original_member);m.components=[{surface:decisions.surface_forms[key][language][0],canonical_candidate:key,confidence:0.95,evidence:[{type:'manual_override',source:ledgerPath,relation_type:'compound_component',language_reflex:true,analysis:d.reason}]}];return m});language_support[language]=ms.length;if(ms.length)s[id]=ms;changed.add(p);}
  const family={id,canonical:key,aliases:aliases[key],surface_forms:decisions.surface_forms[key],associative_component:true,exact_component:true,runtime_curated:true,verified:false,confidence:'B',review_status:'needs_review',source:'associative_reflex_review+manual_override',etymon_keys:['la:creare','la:creatio'],relation_types:['compound_component'],relation_evidence:[{type:'manual_override',source:ledgerPath,whole_lemma_union:false,language_reflex:true}],support:Object.values(language_support).reduce((s,n)=>s+n,0),language_support,suspicion_score:0,suspicion_reasons:[]};
  const fp=path('families',id);(await get(fp))[id]=family;changed.add(fp);
 }
 let aliasDelta=0;for(const alias of allAliases){const p=path('aliases',alias),s=await get(p),before=s[alias]||[],after=before.filter(id=>!retired.includes(id));for(const key of keys)if(aliases[key].includes(alias))after.push('family:'+key);const next=[...new Set(after)].sort();assert(next.length<=25);aliasDelta+=Number(next.length>0)-Number(before.length>0);if(next.length)s[alias]=next;else delete s[alias];changed.add(p);}
 for(const p of l.preservation)assert.equal(digest(stripped(p.part,await get(`${root}/${p.part}/${p.bucket}.json.gz`))),p.unrelated_sha256,'Unrelated data changed');
 for(const p of changed)await write(p,cache.get(p));cache.clear();manifest.counts.families+=l.net_family_delta;manifest.counts.aliases+=aliasDelta;
 await recountMaterializedMembers(root,manifest,report);await refreshFamilySummaries(root,report);report.aliases_in_lookup=manifest.counts.aliases;
 const delta={repair,source_run_id:35647932153,removed_memberships:l.expected_removed_memberships,added_memberships:l.expected_added_memberships,net_family_delta:l.net_family_delta,alias_delta:aliasDelta,decision_ledger_sha256:sha(ledgerBytes),full_family_certification:false};
 provenance.repository_repairs.push(delta);report.repository_materialization.associative_reflex_review=delta;await write(root+'/manifest.json',manifest);await write(root+'/report.json',report);Object.assign(provenance,await repositoryTreeMetadata(root));await write(root+'/repository-provenance.json',provenance);console.log(JSON.stringify({mode:'apply',...delta}));
}
