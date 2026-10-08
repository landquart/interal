import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync, gzipSync} from 'node:zlib';
import {familyBucket} from '../associativvordes/js/family-index-loader.js';
import {matchesReviewedAssociativeForm} from '../associativvordes/js/associative-reflex-forms.js';
import {auditActionStage} from './lib/associative-action-stage-audit.mjs';
import {recountMaterializedMembers, refreshFamilySummaries, repositoryTreeMetadata} from './lib/associative-repository-materialization.mjs';

const root='associativvordes/family-index-v5',cp='audit/associative-family-v5/action-positive-extension-20261002';
const ledgerPath=cp+'/materialization-ledger.json',repair='extend_reviewed_action_memberships_20261002',id='family:act',apply=process.argv.includes('--apply');
const read=async p=>JSON.parse((p.endsWith('.gz')?gunzipSync(await readFile(p)):await readFile(p)).toString());
const write=(p,v)=>writeFile(p,p.endsWith('.gz')?gzipSync(JSON.stringify(v),{level:6}):JSON.stringify(v,null,2)+'\n');
const sha=b=>createHash('sha256').update(b).digest('hex'),digest=v=>sha(JSON.stringify(v));
const path=part=>`${root}/${part}/${familyBucket(id)}.json.gz`;
const provenance=await read(root+'/repository-provenance.json');
assert(!provenance.repository_repairs.some(r=>r.repair===repair),'Already applied');
await auditActionStage(root);
const decisionBytes=await readFile(cp+'/decisions.json'),d=JSON.parse(decisionBytes),inventory=await read(cp+'/inventory.json');
for(const [name,hash]of Object.entries(inventory.artifact_sha256))assert.equal(sha(await readFile(cp+'/'+name)),hash);
const proof=(await read(cp+'/source-records.json.gz')).records,byId=new Map(proof.map(r=>[r.language+'\0'+r.member.lemma_id,r.member]));
assert.equal(byId.size,d.decisions.length);assert.equal(d.source_run_id,35647932153);
const familyShard=await read(path('families')),beforeFamily=familyShard[id],languages=[...new Set(d.decisions.map(m=>m.language))];
const members={},additions={};
const sourceGroups=new Map();
for(const language of languages){
 const shard=await read(path('members/'+language)),before=shard[id];
 members[language]={shard,before};additions[language]=d.decisions.filter(m=>m.language===language);
 const existing=new Set(before.map(m=>m.lemma_id));
 for(const row of additions[language]){
  const original=byId.get(language+'\0'+row.lemma_id);assert(original&&original.word===row.word);assert.equal(row.status,'accepted');assert(row.lexical_head&&row.national_realization&&row.source_references.length);assert(!existing.has(row.lemma_id));existing.add(row.lemma_id);
  assert(matchesReviewedAssociativeForm(original,beforeFamily,language));assert.notEqual(original.corpus_quality?.status,'rejected');assert.deepEqual(original.source_family_ids,row.source_family_ids);
  const sourcePath=`${root}/members/${language}/${familyBucket(row.source_family_ids[0])}.json.gz`;
  if(!sourceGroups.has(sourcePath))sourceGroups.set(sourcePath,[]);sourceGroups.get(sourcePath).push({row,original});
 }
}
// All source and shard checks complete before the first corpus write.
for(const [p,rows]of sourceGroups){const s=await read(p);for(const {row,original}of rows){const {source_family_ids,...clean}=original;assert.deepEqual(s[row.source_family_ids[0]]?.find(m=>m.lemma_id===row.lemma_id),clean,`Source record changed ${row.language}/${row.word}`);}}
const preservation=[{part:'families',unrelated_sha256:digest(Object.fromEntries(Object.entries(familyShard).filter(([k])=>k!==id)))}];
for(const l of languages)preservation.push({part:'members/'+l,unrelated_sha256:digest(Object.fromEntries(Object.entries(members[l].shard).filter(([k])=>k!==id)))});
const metadata=Object.fromEntries(await Promise.all(['manifest.json','report.json','repository-provenance.json'].map(async file=>[file,sha(await readFile(root+'/'+file))])));
if(!apply){
 const ledger={schema_version:1,repair,source_run_id:35647932153,decision_sha256:sha(decisionBytes),review_artifacts:inventory.artifact_sha256,before_family:beforeFamily,before_members:Object.fromEntries(languages.map(l=>[l,{count:members[l].before.length,ordered_sha256:digest(members[l].before)}])),additions,metadata_preflight:metadata,preservation,expected_added_memberships:d.decisions.length,expected_removed_memberships:0,net_family_delta:0,alias_delta:0,status:'ready_to_materialize',full_family_certification:false};
 await write(ledgerPath,ledger);console.log(JSON.stringify({mode:'prepare',added:ledger.expected_added_memberships,removed:0}));
}else{
 const ledgerBytes=await readFile(ledgerPath),ledger=JSON.parse(ledgerBytes);
 assert.equal(ledger.decision_sha256,sha(decisionBytes));assert.deepEqual(ledger.review_artifacts,inventory.artifact_sha256);assert.deepEqual(ledger.before_family,beforeFamily);assert.deepEqual(ledger.metadata_preflight,metadata);assert.deepEqual(ledger.preservation,preservation);assert.deepEqual(ledger.additions,additions);
 for(const l of languages){assert.equal(ledger.before_members[l].count,members[l].before.length);assert.equal(ledger.before_members[l].ordered_sha256,digest(members[l].before));}
 const family=structuredClone(beforeFamily);
 for(const language of languages){
  const extra=additions[language].map(row=>{const {source_family_ids,...original}=byId.get(language+'\0'+row.lemma_id);const m=structuredClone(original);m.components=[...(m.components||[]),{surface:row.national_realization,canonical_candidate:'act',confidence:0.95,evidence:[{type:'manual_override',source:ledgerPath,relation_type:'compound_component',language_reflex:true,lexical_head:row.lexical_head,analysis:row.reason,source_references:row.source_references}]}];return m;});
  members[language].shard[id]=[...members[language].before,...extra];family.language_support[language]+=extra.length;
 }
 family.support+=ledger.expected_added_memberships;family.relation_evidence.push({type:'manual_override',source:ledgerPath,whole_lemma_union:false,language_reflex:true,full_family_certification:false});familyShard[id]=family;
 for(const language of languages)await write(path('members/'+language),members[language].shard);
 await write(path('families'),familyShard);
 const manifest=await read(root+'/manifest.json'),report=await read(root+'/report.json');
 await recountMaterializedMembers(root,manifest,report);await refreshFamilySummaries(root,report);
 const delta={repair,source_run_id:35647932153,added_memberships:ledger.expected_added_memberships,removed_memberships:0,net_family_delta:0,alias_delta:0,decision_ledger_sha256:sha(ledgerBytes),full_family_certification:false};
 provenance.repository_repairs.push(delta);report.repository_materialization.action_extension=delta;
 await write(root+'/manifest.json',manifest);await write(root+'/report.json',report);Object.assign(provenance,await repositoryTreeMetadata(root));await write(root+'/repository-provenance.json',provenance);
 await write(cp+'/materialization-status.json',{...delta,runtime_applied:true,review_decision_sha256:sha(decisionBytes),runtime_support:family.support,counts:d.counts});
 console.log(JSON.stringify({mode:'apply',...delta,runtime_support:family.support}));
}
