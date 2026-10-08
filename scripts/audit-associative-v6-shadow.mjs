#!/usr/bin/env node
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {loadV6ShadowRuntime,deduplicateV6CorpusRows} from '../associativvordes/js/associative-family-v6-shadow.js';
import {resolveV6Alias,v6QueryKey,v5EvidenceQueryKey,V6_LANGUAGES} from '../associativvordes/js/associative-family-v6.js';
import {FamilyIndexLoader,familyBucket} from '../associativvordes/js/family-index-loader.js';
const output=process.argv[2]||'audit/associative-family-v6/regul-20261008/shadow';
const sha=b=>createHash('sha256').update(b).digest('hex'),artifacts={};
const cache=new Map();
const read=async p=>{if(!cache.has(p)){const bytes=await fs.readFile(p);cache.set(p,JSON.parse(p.endsWith('.gz')?gunzipSync(bytes):bytes));if(cache.size>16)cache.delete(cache.keys().next().value);}return cache.get(p);};
const write=async(name,value)=>{const bytes=Buffer.from(JSON.stringify(value)+'\n'),b=name.endsWith('.gz')?gzipSync(bytes,{level:9,mtime:0}):bytes;await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,name),b);artifacts[name]=sha(b);};
const index=await loadV6ShadowRuntime({readJson:read}),catalog=index.catalog;
const base='associativvordes/family-index-v6/generated';
const baseline=await read('audit/associative-family-v6/prompt09-shadow-20261007/research.json.gz');
const diff=await read(base+'/differential.json.gz');
const membershipKey=m=>m.language+'\0'+m.family_id+'\0'+m.lemma_id;
const corpusKey=m=>m.language+'\0'+m.lemma_id;
const approved=new Set([...diff.accepted_membership_additions,...diff.family_promotion_additions,...diff.lifecycle_differential.additions,...diff.correction_differential.additions].map(membershipKey));
const historical=new Set(diff.manual_memberships.map(membershipKey));
const corrections=new Set(diff.correction_differential.removals.map(membershipKey));
const currentKeys=new Set(index.memberships.map(membershipKey));
const priorMemberships=JSON.parse(gunzipSync(execFileSync('git',['show','f70c217d08329f7f93fd56945cb7366562e579e9:'+base+'/memberships.json.gz'],{maxBuffer:20*1024*1024})));
const priorMap=new Map(priorMemberships.map(m=>[membershipKey(m),m]));
const regulReviews=await read('audit/associative-family-v6/regul-20261008/decisions/review.json');
const expectedKeys=new Set(priorMemberships.filter(m=>m.family_id!=='family:regul').map(membershipKey));
for(const r of regulReviews)if(r.decision==='accepted')expectedKeys.add(membershipKey(r));
assert.deepEqual([...currentKeys].sort(),[...expectedKeys].sort(),'Exact finite correction/addition scopes must explain the entire accepted set');
const correctionVerdicts=new Map((await read(base+'/correction-verdicts.json.gz')).map(r=>[membershipKey(r),r]));
assert.deepEqual([...corrections].sort(),regulReviews.filter(r=>r.prior_state==='legacy_accepted'&&r.decision!=='accepted').map(membershipKey).sort());
const expectedCorpusKeys=new Set([...expectedKeys].map(k=>{const [l,f,id]=k.split('\0');return l+'\0'+id;}));
const queryForms=[...new Set(catalog.families.flatMap(f=>[f.canonical,...f.aliases]))];
const queries=[...new Set([...queryForms,...queryForms.map(v6QueryKey),'val','информ','création','состав','aniso','naive','lieu','lieutenant','printer','splinter','tennis-profi','ёлка','объект','straße','co‐op','l’homme'])];
const oldTargets=new Map(),wanted=new Map();
for(const query of queries){const q=v5EvidenceQueryKey(query),aliases=await read('associativvordes/family-index-v5/aliases/'+familyBucket(q)+'.json.gz'),ids=aliases[q]||[];oldTargets.set(query,ids);for(const id of ids)wanted.set(id,[]);}
// Each immutable member shard is visited once for all exact target sets.
const buckets=[...new Set([...wanted.keys()].map(familyBucket))].sort();
for(const language of V6_LANGUAGES)for(const bucket of buckets){
 const shard=await read('associativvordes/family-index-v5/members/'+language+'/'+bucket+'.json.gz');
 for(const[id,rows]of Object.entries(shard))if(wanted.has(id))for(const r of rows)wanted.get(id).push({language,lemma_id:r.lemma_id,word:r.word});
}
console.error('exact v5 routes indexed: '+wanted.size);
const reports=[],aliasRepairs=[],productionReports=[];
for(const query of queries){
 const targets=oldTargets.get(query),old=new Map();for(const id of targets)for(const m of wanted.get(id)){const key=corpusKey(m),row=old.get(key)||{...m,source_routes:[]};row.source_routes.push(id);old.set(key,row);}
 const now=index.search(query),current=new Map(now.map(m=>[corpusKey(m),m])),route=await index.routeQuery(query);
 const additions=[],removals=[],unexpected=[];
 for(const [key,m]of current)if(!old.has(key)){
  const mk=membershipKey(m);const category=approved.has(mk)?'approved_membership_addition':historical.has(mk)?'alias_only_routing':'unexpected_addition';if(category.startsWith('unexpected'))unexpected.push(mk);
  additions.push({corpus_id:key,membership_id:mk,category,source_proof:m.source_proof});
 }
 for(const[key,m]of old)if(!current.has(key)){
  const questions=route.family_targets.map(f=>m.language+'\0'+f+'\0'+m.lemma_id);
  const category=questions.some(k=>currentKeys.has(k))?'unexpected_accepted_route_loss':questions.some(k=>corrections.has(k))?'approved_membership_correction':'intentional_technical_demotion';
  if(category.startsWith('unexpected'))unexpected.push(key);
  removals.push({...m,corpus_id:key,category,linguistic_exclusion_claim:category==='approved_membership_correction'&&questions.some(k=>correctionVerdicts.get(k)?.status==='excluded'),correction_statuses:questions.flatMap(k=>correctionVerdicts.has(k)?[correctionVerdicts.get(k).status]:[])});
 }
 assert.deepEqual(unexpected,[],'Unexplained differential '+query);
 const languageOutputs=[];
 for(const language of V6_LANGUAGES){
  const actual=index.search(query,language),scoped=await index.routeQuery(query,language);
  assert.deepEqual(actual,now.filter(m=>m.language===language));
  assert.deepEqual(scoped.evidence_targets,route.evidence_targets.filter(id=>(!id.startsWith('surface:')||id.split(':')[1]===language)&&wanted.get(id)?.some(m=>m.language===language)));
  languageOutputs.push({language,route:scoped,exact_membership_ids:actual.map(membershipKey)});
  // Production controls are reported separately from uncapped persisted source arrays.
  const loader=new FamilyIndexLoader({baseUrl:'associativvordes/family-index-v5',fetchJson:read});
  try{const rows=await loader.candidateEntries(query,language);productionReports.push({query,language,status:'retrieved',exact_ids:rows.map(r=>language+'\0'+r.lemma_id),v6_only:[...current.keys()].filter(k=>k.startsWith(language+'\0')&&!rows.some(r=>k===language+'\0'+r.lemma_id)),v5_only:rows.filter(r=>!current.has(language+'\0'+r.lemma_id)).map(r=>language+'\0'+r.lemma_id)});}
  catch(error){if(!/fan-out .* exceeds runtime limit/.test(error.message))throw error;productionReports.push({query,language,status:'blocked_by_existing_v5_fanout_guard',reason:error.message,v6_exact_ids:actual.map(corpusKey)});}
 }
 assert.deepEqual(index.search(query),index.search(v6QueryKey(query)));
 reports.push({query,query_key:v6QueryKey(query),v5_source_key:v5EvidenceQueryKey(query),v5_source_targets:targets,v6_route:route,v5_unique_ids:old.size,v6_unique_ids:current.size,exact_membership_ids:now.map(membershipKey),preserved_exact_ids:[...current.keys()].filter(k=>old.has(k)),additions,removals,unexpected,language_outputs:languageOutputs});
 const before=baseline.aliases.filter(a=>a.alias===query);
 if(before.length){const previous=new Set(before[0].exact_shadow_ids.map(([l,f,id])=>l+'\0'+f+'\0'+id)),after=new Set(now.map(membershipKey));const lost=[...previous].filter(k=>!after.has(k)),added=[...after].filter(k=>!previous.has(k));assert.deepEqual(lost.filter(k=>!corrections.has(k)),[]);if(added.length||lost.length)aliasRepairs.push({query,added_exact_membership_ids:added,removed_exact_membership_ids:lost});}
}
assert.deepEqual(aliasRepairs.filter(r=>r.removed_exact_membership_ids.length===0).map(r=>r.query).sort(),['мутация','операция']);
await write('queries.json.gz',reports);await write('production-v5-differential.json.gz',productionReports);
await write('alias-repairs.json.gz',aliasRepairs);
const hydrated=[];
for(const f of catalog.families){
 const rows=await index.searchCorpusRows(f.canonical);assert.equal(rows.length,index.search(f.canonical).length);
 for(const r of rows)for(const m of r.accepted_memberships){const p=m.source_proof[0].source,original=(await read(p.path))[p.family_id].find(x=>x.lemma_id===r.lemma_id);assert(original);for(const[k,v]of Object.entries(original))assert.deepEqual(r[k],v);if(p.record_sha256)assert.equal(sha(Buffer.from(JSON.stringify(original))),p.record_sha256);}
 hydrated.push(...rows);
}
const unique=deduplicateV6CorpusRows(hydrated);
assert.equal(unique.length,expectedCorpusKeys.size);assert.equal(hydrated.length,expectedKeys.size);assert.deepEqual(unique.map(corpusKey).sort(),[...expectedCorpusKeys].sort());
await write('hydrated-accepted-corpus-rows.json.gz',unique);
const enumeration=await read('audit/associative-family-v6/corpus-enumeration.json'),zero=[];
for(const r of enumeration.zero_membership_source_records){assert.deepEqual(await index.getZeroMembershipCorpusRecord(r.language,r.lemma_id),r);const found=await index.searchZeroMembershipCorpusRecords(r.word,r.language);assert(found.some(x=>x.lemma_id===r.lemma_id));assert(!index.memberships.some(m=>corpusKey(m)===corpusKey(r)));zero.push({language:r.language,lemma_id:r.lemma_id,word:r.word,query_key:v6QueryKey(r.word),exact_query_ids:found.map(corpusKey),original:r});}
assert.equal(zero.length,829);await write('zero-membership-retrieval.json.gz',zero);
const normalizedAliases=new Map();for(const f of catalog.families)for(const alias of [f.canonical,...f.aliases]){const key=v6QueryKey(alias),set=normalizedAliases.get(key)||new Set();set.add(f.id);normalizedAliases.set(key,set);}
const summary={schema_version:6,baseline_sha:baseline.baseline_sha,production_enabled:false,verdict:'pass',catalog_families:catalog.families.length,catalog_forms:baseline.aliases.length,queries:reports.length,scoped_queries:reports.length*6,alias_repairs:aliasRepairs.map(r=>({query:r.query,added_routes:r.added_exact_membership_ids.length})),catalog_key_collisions:[...normalizedAliases].filter(([,s])=>s.size>1).map(([key,s])=>({key,family_targets:[...s]})),accepted_memberships:expectedKeys.size,hydrated_unique_corpus_ids:expectedCorpusKeys.size,multiple_accepted_components:unique.filter(r=>r.accepted_memberships.length>1).length,zero_membership_retrieved:zero.length,membership_differential:{added:index.memberships.filter(m=>!priorMap.has(membershipKey(m))).length,removed:priorMemberships.filter(m=>!currentKeys.has(membershipKey(m))).length,changed:index.memberships.filter(m=>priorMap.has(membershipKey(m))&&JSON.stringify(priorMap.get(membershipKey(m)))!==JSON.stringify(m)).length},unexpected_differentials:0,correction_cases:diff.correction_differential.removals.length,limitations:['Raw v5 source routes are uncapped proposals; production retrieval and its guards are separately saved.','Real finite regul corrections retain distinct excluded and uncertain states; uncertainty never asserts a linguistic exclusion.','Frequency remains aggregate corpus measurement; no sense allocation is inferred.','Evidence-only query lookup here exposes source containers and raw zero-v5 measurements, not an exhaustive new full-word corpus index.']};
await write('report.json',summary);
const inputs={};for(const p of ['associativvordes/js/associative-family-v6.js','associativvordes/js/associative-family-v6-shadow.js','associativvordes/js/search-normalizer.js','scripts/audit-associative-v6-shadow.mjs',base+'/source-lock.json',base+'/memberships.json.gz',base+'/differential.json.gz','associativvordes/family-index-v6/catalog.json','audit/associative-family-v6/corpus-enumeration.json','audit/associative-family-v6/query-differential.json.gz'])inputs[p]=sha(await fs.readFile(p));
await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({schema_version:6,inputs,artifacts},null,2)+'\n');console.log(JSON.stringify(summary));
