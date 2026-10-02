import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {familyBucket} from '../associativvordes/js/family-index-loader.js';
import {matchesReviewedAssociativeForm} from '../associativvordes/js/associative-reflex-forms.js';
import {recountMaterializedMembers,refreshFamilySummaries,repositoryTreeMetadata} from './lib/associative-repository-materialization.mjs';
const root='associativvordes/family-index-v5',audit='audit/associative-family-v5',checkpoint=audit+'/action-continuation-20261002',source=audit+'/action-reflex-checkpoint-20261001';
const ledgerPath=audit+'/action-materialization-stage-20261002.json',repair='materialize_reviewed_action_subset_20261002',id='family:act',apply=process.argv.includes('--apply');
const aliases=['act','akt','action','accion','azion','att','attric','akc'];
const languages=['en','de','fr','es','it','ru'];
const read=async p=>JSON.parse((p.endsWith('.gz')?gunzipSync(await readFile(p)):await readFile(p)).toString());
const write=(p,v)=>writeFile(p,p.endsWith('.gz')?gzipSync(JSON.stringify(v),{level:6}):JSON.stringify(v,null,2)+'\n');
const sha=b=>createHash('sha256').update(b).digest('hex'),digest=v=>sha(JSON.stringify(v)),path=(part,key)=>`${root}/${part}/${familyBucket(key)}.json.gz`;
const inventory=await read(checkpoint+'/inventory.json'),decisionBytes=await readFile(checkpoint+'/linguistic-decisions.json.gz');
assert.equal(sha(decisionBytes),inventory.decision_sha256);const decisions=JSON.parse(gunzipSync(decisionBytes));
for(const [file,hash]of Object.entries(inventory.source_artifacts))assert.equal(sha(await readFile(source+'/'+file)),hash);
const original=await read(source+'/original-families.json.gz'),accepted={};
for(const language of languages){const candidates=await read(source+'/'+language+'-candidates.json.gz'),byId=new Map(candidates.act.map(m=>[m.lemma_id,m]));
 accepted[language]=decisions.decisions[language].filter(d=>d.status==='accepted').map(d=>{const m=byId.get(d.lemma_id);assert(m&&m.word===d.word&&d.lexical_head&&d.national_realization&&d.source_references.length);assert(matchesReviewedAssociativeForm(m,{canonical:'act',surface_forms:decisions.surface_forms},language));assert.notEqual(m.corpus_quality?.status,'rejected');const {source_family_ids,...original_member}=m;return {...d,original_member};});
 assert.equal(accepted[language].length,decisions.counts[language].accepted);
}
const manifest=await read(root+'/manifest.json'),report=await read(root+'/report.json'),provenance=await read(root+'/repository-provenance.json');
assert.equal(provenance.source_run_id,35647932153);assert(!provenance.repository_repairs.some(r=>r.repair===repair),'Already applied');
const cache=new Map(),get=async p=>{if(!cache.has(p))cache.set(p,await read(p));return cache.get(p);};
assert(!(await get(path('families',id)))[id],'Family already exists');
// Verify both frozen legacy containers, but do not delete unadjudicated records.
for(const [oldId,family]of Object.entries(original.families)){assert.deepEqual((await read(path('families',oldId)))[oldId],family);for(const l of languages)assert.deepEqual((await read(path('members/'+l,oldId)))[oldId]||[],original.members[l][oldId]||[]);}
const stripped=(part,shard)=>Object.fromEntries(Object.entries(shard).filter(([key])=>part==='aliases'?!aliases.includes(key):key!==id));
if(!apply){
 const alias_before={};for(const alias of aliases)alias_before[alias]=(await get(path('aliases',alias)))[alias]||[];
 const preservation=[];for(const part of ['families',...languages.map(l=>'members/'+l),'aliases'])for(const bucket of new Set((part==='aliases'?aliases:[id]).map(familyBucket))){const p=`${root}/${part}/${bucket}.json.gz`;preservation.push({part,bucket,unrelated_sha256:digest(stripped(part,await get(p)))});}
 const ledger={schema_version:1,repair,canonical_root:'act',base_commit:'0382e80895e600fc2df027fe9da6e631508a86a3',source_run_id:35647932153,decision_sha256:sha(decisionBytes),source_artifacts:inventory.source_artifacts,aliases,surface_forms:decisions.surface_forms,counts:decisions.counts,accepted:Object.fromEntries(languages.map(l=>[l,accepted[l].map(({original_member,...d})=>d)])),alias_before,preservation,metadata_preflight:Object.fromEntries(['manifest.json','report.json','repository-provenance.json'].map(file=>[file,null])),legacy_containers_preserved:Object.keys(original.families),expected_added_memberships:Object.values(accepted).reduce((s,ms)=>s+ms.length,0),expected_removed_memberships:0,net_family_delta:1,status:'ready_to_materialize',full_family_certification:false};
 for(const file of Object.keys(ledger.metadata_preflight))ledger.metadata_preflight[file]=sha(await readFile(root+'/'+file));
 await write(ledgerPath,ledger);console.log(JSON.stringify({mode:'prepare',added:ledger.expected_added_memberships,removed:0}));
}else{
 const ledgerBytes=await readFile(ledgerPath),l=JSON.parse(ledgerBytes);assert.equal(l.decision_sha256,sha(decisionBytes));assert.deepEqual(l.aliases,aliases);assert.deepEqual(l.surface_forms,decisions.surface_forms);
 for(const [file,hash]of Object.entries(l.metadata_preflight))assert.equal(sha(await readFile(root+'/'+file)),hash,'Unexpected metadata state '+file);
 for(const p of l.preservation)assert.equal(digest(stripped(p.part,await get(`${root}/${p.part}/${p.bucket}.json.gz`))),p.unrelated_sha256,'Unexpected shard state');
 for(const [alias,before]of Object.entries(l.alias_before))assert.deepEqual((await get(path('aliases',alias)))[alias]||[],before);
 // Finish all preflight checks before writing any shard.
 for(const language of languages){assert.deepEqual(l.accepted[language],accepted[language].map(({original_member,...d})=>d));const groups=new Map();for(const d of accepted[language]){const p=path('members/'+language,d.source_family_ids[0]);if(!groups.has(p))groups.set(p,[]);groups.get(p).push(d);}for(const [p,ds]of groups){const s=await read(p);for(const d of ds)assert.deepEqual(s[d.source_family_ids[0]]?.find(m=>m.lemma_id===d.lemma_id),d.original_member,`Original corpus record changed ${language}/${d.word}`);}}
 const changed=new Set(),language_support={};
 for(const language of languages){const p=path('members/'+language,id),shard=await get(p);assert(!shard[id]);const ms=accepted[language].map(d=>{
  const m=structuredClone(d.original_member),components=Array.isArray(m.components)?m.components:[];
  // Add a reviewed component; preserve every original independent component.
  m.components=[...components,{surface:d.national_realization,canonical_candidate:'act',confidence:0.95,evidence:[{type:'manual_override',source:ledgerPath,relation_type:'compound_component',language_reflex:true,lexical_head:d.lexical_head,analysis:d.reason,source_references:d.source_references,...(d.sense_scope?{sense_scope:d.sense_scope}:{})}]}];return m;
 });shard[id]=ms;language_support[language]=ms.length;changed.add(p);}
 const family={id,canonical:'act',aliases,surface_forms:decisions.surface_forms,associative_component:true,exact_component:true,runtime_curated:true,verified:false,confidence:'B',review_status:'needs_review',source:'associative_reflex_review+manual_override',etymon_keys:['la:actus','la:actum','la:actio','la:actor'],relation_types:['compound_component'],relation_evidence:[{type:'manual_override',source:ledgerPath,whole_lemma_union:false,language_reflex:true,full_family_certification:false}],support:Object.values(language_support).reduce((s,n)=>s+n,0),language_support,suspicion_score:0,suspicion_reasons:[]};
 const fp=path('families',id);(await get(fp))[id]=family;changed.add(fp);
 let aliasDelta=0;for(const alias of aliases){const p=path('aliases',alias),s=await get(p),before=s[alias]||[],next=[...new Set([...before,id])].sort();assert(next.length<=25);aliasDelta+=Number(before.length===0);s[alias]=next;changed.add(p);}
 for(const p of l.preservation)assert.equal(digest(stripped(p.part,await get(`${root}/${p.part}/${p.bucket}.json.gz`))),p.unrelated_sha256,'Unrelated data changed');
 for(const p of changed)await write(p,cache.get(p));cache.clear();manifest.counts.families+=1;manifest.counts.aliases+=aliasDelta;
 await recountMaterializedMembers(root,manifest,report);await refreshFamilySummaries(root,report);report.aliases_in_lookup=manifest.counts.aliases;
 const delta={repair,source_run_id:35647932153,added_memberships:l.expected_added_memberships,removed_memberships:0,net_family_delta:1,alias_delta:aliasDelta,decision_ledger_sha256:sha(ledgerBytes),full_family_certification:false,legacy_containers_preserved:l.legacy_containers_preserved,component_preservation:'Original component arrays kept intact; reviewed act component appended.'};
 provenance.repository_repairs.push(delta);report.repository_materialization.associative_reflex_review=delta;await write(root+'/manifest.json',manifest);await write(root+'/report.json',report);Object.assign(provenance,await repositoryTreeMetadata(root));await write(root+'/repository-provenance.json',provenance);
 await write(checkpoint+'/materialization-status.json',{...delta,runtime_applied:true,counts:decisions.counts,ledger_path:ledgerPath,decision_sha256:sha(decisionBytes)});console.log(JSON.stringify({mode:'apply',...delta}));
}
