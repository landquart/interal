import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {familyBucket} from '../associativvordes/js/family-index-loader.js';
import {matchesReviewedAssociativeForm} from '../associativvordes/js/associative-reflex-forms.js';
import {recountMaterializedMembers,refreshFamilySummaries,repositoryTreeMetadata} from './lib/associative-repository-materialization.mjs';
const root='associativvordes/family-index-v5',audit='audit/associative-family-v5',id='family:loc',repair='add_reviewed_german_russian_loc_reflex_members_20261001',ledgerPath=audit+'/loc-reflex-materialization-20261001.json',archivePath=audit+'/loc-reflex-original-20261001.json.gz',apply=process.argv.includes('--apply');
const languages=['en','de','fr','es','it','ru'],aliases=['loc','lok'],forms={en:['loc'],de:['loc','lok'],fr:['loc'],es:['loc'],it:['loc'],ru:['лок']};
const read=async p=>JSON.parse((p.endsWith('.gz')?gunzipSync(await readFile(p)):await readFile(p)).toString());
const write=(p,v)=>writeFile(p,p.endsWith('.gz')?gzipSync(JSON.stringify(v),{level:6}):JSON.stringify(v,null,2)+'\n');
const sha=b=>createHash('sha256').update(b).digest('hex'),digest=v=>sha(JSON.stringify(v)),path=(part,key)=>`${root}/${part}/${familyBucket(key)}.json.gz`;
const bytes=await readFile(audit+'/loc-reflex-decisions-20261001.json'),decisions=JSON.parse(bytes),sourceBytes=await readFile(audit+'/component-checkpoint-20261001/candidate-records.json.gz'),sources=JSON.parse(gunzipSync(sourceBytes)).loc;
assert.equal(decisions.source_sha256,sha(sourceBytes));
const cache=new Map(),get=async p=>{if(!cache.has(p))cache.set(p,await read(p));return cache.get(p)},changed=new Set();
const family=(await get(path('families',id)))[id],original={family,members:{}};
for(const language of languages)original.members[language]=(await get(path('members/'+language,id)))[id]||[];
const additions={de:[],ru:[]};
for(const language of ['de','ru'])for(const d of decisions.decisions.filter(d=>d.language===language&&d.status==='accepted')){
 assert(d.reason&&matchesReviewedAssociativeForm(d,{canonical:'loc',surface_forms:forms},language));const member=sources[language].find(m=>m.lemma_id===d.lemma_id&&m.word===d.word);assert(member);assert(member.corpus_quality?.status!=='rejected');if(original.members[language].some(m=>m.lemma_id===d.lemma_id))continue;additions[language].push({...d,source_family_ids:member.family_ids});
}
const stripped=(part,shard)=>Object.fromEntries(Object.entries(shard).filter(([key])=>part==='aliases'?!aliases.includes(key):key!==id));
const provenance=await read(root+'/repository-provenance.json');assert(!provenance.repository_repairs.some(r=>r.repair===repair),'Already applied');
if(!apply){
 await write(archivePath,original);const preservation=[];
 for(const part of ['families',...languages.map(l=>'members/'+l),'aliases'])for(const bucket of new Set((part==='aliases'?aliases:[id]).map(familyBucket))){const p=`${root}/${part}/${bucket}.json.gz`;preservation.push({part,bucket,unrelated_sha256:digest(stripped(part,await get(p)))});}
 const alias_before={};for(const alias of aliases)alias_before[alias]=(await get(path('aliases',alias)))[alias]||[];
 const ledger={schema_version:1,repair,source_run_id:35647932153,base_commit:'d1e9a1d8e17ef8188594af18a55912f29dad2698',decision_sha256:sha(bytes),source_sha256:sha(sourceBytes),archive_path:archivePath,archive_sha256:sha(await readFile(archivePath)),family_id:id,aliases,surface_forms:forms,additions,alias_before,preservation,expected_added_memberships:Object.values(additions).reduce((s,ms)=>s+ms.length,0),expected_removed_memberships:0,full_family_certification:false};await write(ledgerPath,ledger);console.log(JSON.stringify({mode:'prepare',added:ledger.expected_added_memberships}));
}else{
 const ledgerBytes=await readFile(ledgerPath),l=JSON.parse(ledgerBytes);assert.equal(l.decision_sha256,sha(bytes));assert.equal(l.archive_sha256,sha(await readFile(archivePath)));assert.deepEqual(await read(archivePath),original);assert.deepEqual(l.additions,additions);assert.deepEqual(l.surface_forms,forms);assert.deepEqual(l.aliases,aliases);
 for(const p of l.preservation)assert.equal(digest(stripped(p.part,await get(`${root}/${p.part}/${p.bucket}.json.gz`))),p.unrelated_sha256);
 for(const [alias,before]of Object.entries(l.alias_before))assert.deepEqual((await get(path('aliases',alias)))[alias]||[],before);
 // Check source membership in bounded transient buckets before the first write.
 for(const language of ['de','ru']){const groups=new Map();for(const d of additions[language]){const source=sources[language].find(m=>m.lemma_id===d.lemma_id);assert(source.family_ids?.length);const p=path('members/'+language,source.family_ids[0]);if(!groups.has(p))groups.set(p,[]);groups.get(p).push(source);}for(const [p,records]of groups){const shard=await read(p);for(const source of records){const actual=shard[source.family_ids[0]]?.find(m=>m.lemma_id===source.lemma_id);assert(actual,`Source missing ${language}/${source.word}`);for(const field of ['word','normalized','search_form','rank','frequency_score','sources','category_breakdown','corpus_quality'])assert.deepEqual(actual[field],source[field],`Source changed ${source.word}/${field}`);}}}
 for(const language of ['de','ru']){const p=path('members/'+language,id),shard=await get(p);shard[id]=[...original.members[language],...additions[language].map(d=>{const {family_ids,retrieval_only,...m}=structuredClone(sources[language].find(m=>m.lemma_id===d.lemma_id));m.components=[{surface:language==='ru'?'лок':'lok',canonical_candidate:'loc',confidence:0.95,evidence:[{type:'manual_override',source:ledgerPath,relation_type:'compound_component',language_reflex:true,analysis:d.reason}]}];return m})];changed.add(p);family.language_support[language]=shard[id].length;}
 Object.assign(family,{aliases,surface_forms:forms,associative_component:true});family.support=Object.values(family.language_support).reduce((s,n)=>s+n,0);changed.add(path('families',id));
 let aliasDelta=0;for(const alias of aliases){const p=path('aliases',alias),s=await get(p),before=s[alias]||[];s[alias]=[...new Set([...before,id])].sort();assert(s[alias].length<=25);aliasDelta+=Number(!before.length);changed.add(p);}
 for(const p of l.preservation)assert.equal(digest(stripped(p.part,await get(`${root}/${p.part}/${p.bucket}.json.gz`))),p.unrelated_sha256);
 for(const p of changed)await write(p,cache.get(p));cache.clear();
 const manifest=await read(root+'/manifest.json'),report=await read(root+'/report.json');manifest.counts.aliases+=aliasDelta;await recountMaterializedMembers(root,manifest,report);await refreshFamilySummaries(root,report);report.aliases_in_lookup=manifest.counts.aliases;
 const delta={repair,source_run_id:35647932153,added_memberships:l.expected_added_memberships,removed_memberships:0,alias_delta:aliasDelta,decision_ledger_sha256:sha(ledgerBytes),full_family_certification:false};provenance.repository_repairs.push(delta);report.repository_materialization.loc_reflex_review=delta;await write(root+'/manifest.json',manifest);await write(root+'/report.json',report);Object.assign(provenance,await repositoryTreeMetadata(root));await write(root+'/repository-provenance.json',provenance);console.log(JSON.stringify({mode:'apply',...delta}));
}
