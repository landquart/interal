import {readBeforeNativeExtensionFile,preNativeExtensionShard} from './associative-reflex-native-compounds-extension-audit.mjs';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import { familyBucket } from '../../associativvordes/js/family-index-loader.js';

export const continuationRepair='extend_reviewed_observ_inform_rare_heads_20261002';
export const continuationPath='audit/associative-family-v5/reflex-rare-heads-materialization-20261002';
export const continuationLedger=continuationPath+'/materialization-ledger.json';
export const reviewPaths=['audit/associative-family-v5/reflex-rare-native-heads-review-20261002-1915'];
export const readJson=async p=>{const match=p.match(/^(.*)\/(families\/[^/]+|members\/[^/]+\/[^/]+)$/);const raw=match?await readBeforeNativeExtensionFile(match[1],match[2]):await readFile(p);return JSON.parse((p.endsWith('.gz')?gunzipSync(raw):raw).toString());};
export const sha=b=>createHash('sha256').update(b).digest('hex');
export const digest=v=>sha(JSON.stringify(v));
export const evidence=()=>({type:'manual_override',source:continuationLedger,whole_lemma_union:false,language_reflex:true,full_family_certification:false});
export function appendedMember(original,row){
 const {source_family_ids,...clean}=original;
 const member=structuredClone(clean);
 member.components=[...(member.components||[]),{surface:row.language==='ru'?(row.canonical_root==='observ'?'обсерв':'информ'):(row.canonical_root==='observ'&&row.language==='it'?'osserv':row.canonical_root),
   canonical_candidate:row.canonical_root,confidence:0.95,evidence:[{type:'manual_override',source:continuationLedger,
   relation_type:'compound_component',language_reflex:true,lexical_head:row.lexical_head||row.segmentation_or_lexical_identity,analysis:row.reason,source_references:row.source_references}]}];
 return member;
}
export function resultingFamily(before,rows){
 const family=structuredClone(before);
 family.support+=rows.length;
 for(const row of rows) family.language_support[row.language]++;
 family.relation_evidence.push(evidence());
 return family;
}
export async function untouchedFilesDigest(root,excluded){
 const entries=[];
 async function walk(dir){
  for(const e of (await readdir(root+'/'+dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
   const rel=(dir?dir+'/':'')+e.name;
   if(e.isDirectory()) await walk(rel);
   else if(!excluded.includes(rel)) entries.push([rel,sha(await readBeforeNativeExtensionFile(root,rel))]);
  }
 }
 await walk('');return digest(entries);
}
// Reconstruct the before-extension shard for historical preservation proofs.
// Current extension integrity is independently checked by auditContinuation.
export async function preReflexContinuationShard(shard,part,bucket,root='associativvordes/family-index-v5'){
 const provenance=await readJson(root+'/repository-provenance.json');
 if(!provenance.repository_repairs.some(r=>r.repair===continuationRepair))return shard;
 const ledger=await readJson(continuationLedger);
 for(const [id,before] of Object.entries(ledger.before_families)){
  if(familyBucket(id)!==bucket)continue;
  if(part==='families')shard[id]=structuredClone(before);
  else if(part.startsWith('members/')){
   const language=part.slice(8),prefix=ledger.before_members[id][language];
   assert.equal(digest((shard[id]||[]).slice(0,prefix.count)),prefix.ordered_sha256);
   if(prefix.existed)shard[id]=shard[id].slice(0,prefix.count);else delete shard[id];
  }
 }
 return shard;
}
export async function auditContinuation(root){
 const provenance=await readJson(root+'/repository-provenance.json');
 const repair=provenance.repository_repairs.find(r=>r.repair===continuationRepair);
 if(!repair)return null;
 const bytes=await readFile(continuationLedger),ledger=JSON.parse(bytes);
 assert.equal(repair.decision_ledger_sha256,sha(bytes));
 assert.equal(repair.added_memberships,7);assert.equal(repair.removed_memberships,0);
 const status=await readJson(continuationPath+'/materialization-status.json');
 assert.equal(status.runtime_applied,true);assert.equal(status.full_family_certification,false);
 assert.deepEqual(status.repair_delta,repair);
 for(const [p,hash]of Object.entries(ledger.source_hashes))assert.equal(sha(await readFile(p)),hash,p);
 const reviews=await Promise.all(reviewPaths.map(p=>readJson(p+'/decisions.json')));
 assert.deepEqual(ledger.additions,reviews.flatMap(r=>r.decisions.filter(d=>d.status==='accepted')));
 const proof=(await Promise.all(reviewPaths.map(p=>readJson(p+'/source-records.json.gz')))).flatMap(p=>p.records);
 const source=new Map(proof.map(r=>[r.language+'\0'+r.member.lemma_id,r.member]));
 const languages=['en','de','fr','es','it','ru'];
 for(const [id,before]of Object.entries(ledger.before_families)){
  const rows=ledger.additions.filter(r=>'family:'+r.canonical_root===id);
  const family=(await readJson(root+'/families/'+familyBucket(id)+'.json.gz'))[id];
  assert.deepEqual(family,resultingFamily(before,rows));
  assert.equal(family.support,Object.values(family.language_support).reduce((a,b)=>a+b,0));
  for(const language of languages){
   const ms=(await readJson(root+'/members/'+language+'/'+familyBucket(id)+'.json.gz'))[id]||[];
   const prefix=ledger.before_members[id][language];
   assert.equal(digest(ms.slice(0,prefix.count)),prefix.ordered_sha256);
   const extra=rows.filter(r=>r.language===language);
   assert.deepEqual(ms.slice(prefix.count),extra.map(r=>appendedMember(source.get(language+'\0'+r.lemma_id),r)));
   assert.equal(ms.length,family.language_support[language]);assert.equal(new Set(ms.map(m=>m.lemma_id)).size,ms.length);
  }
 }
 for(const p of ledger.preservation){
  const shard=await readJson(root+'/'+p.part+'/'+p.bucket+'.json.gz');
  assert.equal(digest(Object.fromEntries(Object.entries(shard).filter(([id])=>!p.ignore.includes(id)))),p.unrelated_sha256);
 }
 // Every independently saved source route is still present with its original
 // measured fields and ordered components, including routes other than first.
 for(const {language,family_id,member} of ledger.source_routes){
  const shard=await readJson(root+'/members/'+language+'/'+familyBucket(family_id)+'.json.gz');
  assert.deepEqual(shard[family_id]?.find(m=>m.lemma_id===member.lemma_id),member,`${member.word}/${family_id}`);
 }
 assert.equal(await untouchedFilesDigest(root,ledger.expected_written_files),ledger.untouched_files_sha256);
 return ledger;
}

const appliedViews=new Map();
async function rareState(root){
 if(!appliedViews.has(root)){
  const provenance=await readJson(root+'/repository-provenance.json');
  appliedViews.set(root,provenance.repository_repairs.some(r=>r.repair===continuationRepair)?await readJson(continuationLedger):null);
 }
 return appliedViews.get(root);
}
export async function preRareExtensionShard(shard,part,bucket,root='associativvordes/family-index-v5'){
 return undoRareExtensionShard(await preNativeExtensionShard(shard,part,bucket,root),part,bucket,root);
}
async function undoRareExtensionShard(shard,part,bucket,root){
 const ledger=await rareState(root);if(!ledger)return shard;
 for(const [id,before]of Object.entries(ledger.before_families)){
  if(familyBucket(id)!==bucket)continue;
  if(part==='families')shard[id]=structuredClone(before);
  else if(part.startsWith('members/')){
   const language=part.slice(8),prefix=ledger.before_members[id][language];
   assert.equal(digest((shard[id]||[]).slice(0,prefix.count)),prefix.ordered_sha256);
   if(prefix.existed)shard[id]=shard[id].slice(0,prefix.count);else delete shard[id];
  }
 }
 return shard;
}
export async function readBeforeRareExtensionFile(root,relative){
 const raw=await readBeforeNativeExtensionFile(root,relative),ledger=await rareState(root);
 if(!ledger||!relative.endsWith('.json.gz')||!ledger.expected_written_files.includes(relative))return raw;
 const part=relative.slice(0,relative.lastIndexOf('/')),bucket=relative.slice(relative.lastIndexOf('/')+1,-8);
 const shard=await undoRareExtensionShard(JSON.parse(gunzipSync(raw)),part,bucket,root);
 const prior=gzipSync(JSON.stringify(shard),{level:6});
 assert.equal(sha(prior),ledger.runtime_preflight_sha256[relative],'Exact historical shard reconstruction failed: '+relative);
 return prior;
}
