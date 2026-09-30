#!/usr/bin/env node
// Bounded manual decisions recovered on 2026-09-30. No source-index regeneration.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {gunzipSync,gzipSync} from 'node:zlib';
import {familyBucket} from '../associativvordes/js/family-index-loader.js';
import {recountMaterializedMembers,refreshFamilySummaries,repositoryTreeMetadata} from './lib/associative-repository-materialization.mjs';
const root=process.argv[2]||'associativvordes/family-index-v5';
const mode=process.argv[3]||'plan';
assert(['plan','apply'].includes(mode),'Use plan or apply');
const ledgerPath='audit/associative-family-v5/val-and-ru-short-decisions-20260930.json';
const repair='bounded_val_routing_and_russian_short_batch_20260930';
const base='c196998ace4775aa81176cf716c823919500df6e';
const sourceRun=35647932153;
const languages=['en','de','fr','es','it','ru'];
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const read=async p=>JSON.parse((p.endsWith('.gz')?gunzipSync(await readFile(p)):await readFile(p)).toString('utf8'));
const write=(p,v)=>writeFile(p,p.endsWith('.gz')?gzipSync(JSON.stringify(v),{level:6}):JSON.stringify(v,null,2)+'\n');
const path=(part,id)=>join(root,part,familyBucket(id)+'.json.gz');
const cache=new Map();
const get=async p=>{if(!cache.has(p))cache.set(p,await read(p));return cache.get(p)};
const originalTargets=['ety:082a0688243f','ety:098d7c3092b9','ety:0bf5215b42f0','ety:218efc3dfbef','ety:3a3b8cab0f7b','ety:46fc4963bf51','ety:73c7c9efddc1','ety:74e7854bc739','ety:74ecf36ddee6','ety:8492f70055ca','ety:88d0d6fc2226','ety:90cc3df5865e','ety:961ca0038bb5','ety:acab8c629de8','ety:b268095acb5c','ety:c2b3307c349e','ety:d8d34e574c18','ety:ddf6d676859e','ety:e12cdb45881f','ety:e8bac130ca91','ety:f00bcab16c95','ety:f6fe7a68b637','ety:f7099c0e85b5','ety:f7c173d84c24','ety:fbc7f5391a80','surface:it:val','surface:ru:val'];
const removedReasons={
'ety:098d7c3092b9':'caballus horse line; val is a segmentation of cheval',
'ety:73c7c9efddc1':'caballus horse line; val is a segmentation of cheval',
'ety:c2b3307c349e':'caballus horse line; val is a segmentation of cheval',
'ety:0bf5215b42f0':'chavo line; val is a segmentation of chaval',
'ety:8492f70055ca':'chavo line; val is a segmentation of chaval',
'ety:218efc3dfbef':'coaevus line; val is a segmentation of coeval',
'ety:3a3b8cab0f7b':'valigia line; underspecified truncation, not evidence for value or valley',
'ety:46fc4963bf51':'valigia line; competing etymology remains unresolved under its specific alias',
'ety:74ecf36ddee6':'valigia line; competing etymology remains unresolved under its specific alias',
'ety:b268095acb5c':'valigia line; underspecified truncation',
'ety:fbc7f5391a80':'valigia line; underspecified truncation',
'ety:f7099c0e85b5':'valse waltz line; val is a truncation'};
const ruPlans=[
{alias:'na',count:594,words:['на'],reason:'Preposition/interjection на is unrelated to short feminine adjective endings, genitives, names or accidental fragments. на-на is a melodic reduplication, not a proved prepositional derivative.'},
{alias:'u',count:564,words:['у'],reason:'Preposition у is unrelated to inflections, possessives or encoding noise. у-у is a different interjection.'},
{alias:'da',count:483,words:['да'],reason:'Particle/conjunction да is unrelated to name endings and incidental fragments.'},
{alias:'ma',count:476,words:['ма','ма-ма'],reason:'Retain colloquial mother address ма and transparent reduplicated spelling ма-ма. плазма, призма, сумма and unrelated names do not share this lexical root.'},
{alias:'ga',count:445,words:['га'],reason:'Retain standalone га, including hectare abbreviation. нога, волга, фольга and names are incidental; га-га-га is sound imitation, not a unit derivative.'}];
const manifest=await read(join(root,'manifest.json')),report=await read(join(root,'report.json')),provenance=await read(join(root,'repository-provenance.json'));
assert.equal(manifest.repository_storage.immutable_source_run_id,sourceRun);
assert.equal(provenance.source_run_id,sourceRun);
assert(!provenance.repository_repairs.some(x=>x.repair===repair),'Already applied');
assert.deepEqual((await get(path('aliases','val'))).val,originalTargets);
if(mode==='plan'){
 const val=[],sets=new Map();
 for(const id of originalTargets){
  const f=(await get(path('families',id)))[id],members={},ids=new Set();
  for(const lang of languages){
   const ms=(await read(path('members/'+lang,id)))[id]||[];
   if(!ms.length)continue;
   const evidence={};
   for(const m of ms){ids.add(m.lemma_id);for(const c of m.components)for(const e of c.evidence){const k=e.type+':'+e.source;evidence[k]=(evidence[k]||0)+1}}
   members[lang]={count:ms.length,ordered_member_sha256:digest(ms),ordered_id_word_sha256:digest(ms.map(m=>[m.lemma_id,m.word])),evidence,contrasting_words:ms.slice(0,8).map(m=>m.word)};
  }
  sets.set(id,ids);
  val.push({family_id:id,family_sha256:digest(f),canonical:f.canonical,source:f.source,etymon_keys:f.etymon_keys,original_aliases:f.aliases,support:f.support,language_support:f.language_support,review_status:f.review_status,relation_evidence:f.relation_evidence||[],members,action:removedReasons[id]?'remove_reverse_alias_only':'retain_reverse_alias',reason:removedReasons[id]||'Retain distinct value/strength or valley line, historically related value forms or standalone surface route; not membership approval.',alternate_alias:f.aliases.find(a=>a!=='val')||null});
 }
 const russian=[];
 for(const plan of ruPlans){
  const id='surface:ru:'+plan.alias,f=(await get(path('families',id)))[id],ms=(await get(path('members/ru',id)))[id];
  assert.equal(ms.length,plan.count);assert.equal(f.source,'surface_singleton');assert.equal(f.support,ms.length);assert.deepEqual(f.aliases,[plan.alias]);assert.deepEqual(f.language_support,{ru:ms.length});
  const evidence={};for(const m of ms)for(const c of m.components)for(const e of c.evidence){const k=e.type+':'+e.source;evidence[k]=(evidence[k]||0)+1}
  const kept=ms.filter(m=>plan.words.includes(m.word)).map(m=>({lemma_id:m.lemma_id,word:m.word}));
  assert.equal(kept.length,plan.words.length);
  russian.push({family_id:id,alias:plan.alias,language:'ru',expected_members:ms.length,family_sha256:digest(f),ordered_member_sha256:digest(ms),ordered_id_word_sha256:digest(ms.map(m=>[m.lemma_id,m.word])),evidence,contrasting_examples:[...ms.slice(0,15),...ms.slice(-15)].map(m=>m.word),reason:plan.reason,retained:kept,expected_removed:ms.length-kept.length});
 }
 const overlaps=[];
 for(let i=0;i<val.length;i++)for(let j=i+1;j<val.length;j++){const a=val[i].family_id,b=val[j].family_id,sa=sets.get(a),sb=sets.get(b),intersection=[...sa].filter(id=>sb.has(id)).length;overlaps.push({a,b,intersection,jaccard:intersection/(sa.size+sb.size-intersection)})}
 const ledger={schema_version:1,source_run_id:sourceRun,base_commit:base,repair,review_method:'Complete ordered member arrays and evidence distributions examined; bounded family-level structural decisions, not individual dictionary annotations of every excluded record. Preserve source lemmas and all unrelated memberships.',val:{alias:'val',expected_original_targets:originalTargets,retained_targets:originalTargets.filter(id=>!removedReasons[id]),all_target_diagnostics:val,overlap_matrix:overlaps,memberships_removed:0},russian:{decisions:russian,expected_total_removed:russian.reduce((s,d)=>s+d.expected_removed,0)},sources:[{url:'https://ru.wiktionary.org/wiki/ма',accessed:'2026-09-30',use:'Russian colloquial shortening of мама'},{url:'https://gramota.ru/poisk?mode=slovari&query=гектар',accessed:'2026-09-30',use:'га is the unit abbreviation for гектар'}],backlog:['surface:ru:kh','surface:ru:nl','surface:ru:lo','surface:ru:ca','surface:ru:um','ety:497564008159 / ety:b34a3a0ff582 (la:informatio/informati suffix contamination)','remaining azion concept pairs','act/akt/att','retained val families: full membership and duplicate-key review'],deferral_reason:'Do not indiscriminately remove mental-root derivatives in ум or merge unrelated concepts through -azione. Val routing repair does not validate retained memberships.'};
 assert.equal(ledger.val.retained_targets.length,15);assert.equal(ledger.russian.expected_total_removed,2556);
 await write(ledgerPath,ledger);
 console.log(JSON.stringify({mode,ledger:ledgerPath,val_before:27,val_after:15,removed_memberships:2556,retained_russian:6}));
}else{
 const bytes=await readFile(ledgerPath),ledger=JSON.parse(bytes);
 assert.equal(ledger.source_run_id,sourceRun);assert.equal(ledger.base_commit,base);assert.deepEqual(ledger.val.expected_original_targets,originalTargets);assert.deepEqual(ledger.val.retained_targets,originalTargets.filter(id=>!removedReasons[id]));assert.equal(ledger.russian.expected_total_removed,2556);
 for(const d of ledger.val.all_target_diagnostics){
  const f=(await get(path('families',d.family_id)))[d.family_id];assert.equal(digest(f),d.family_sha256);
  for(const lang of languages){const ms=(await read(path('members/'+lang,d.family_id)))[d.family_id]||[],expected=d.members[lang];assert.equal(ms.length,expected?.count||0);if(expected)assert.equal(digest(ms),expected.ordered_member_sha256)}
  if(d.action==='remove_reverse_alias_only'){assert(removedReasons[d.family_id]&&d.alternate_alias&&f.aliases.length>1);assert((await get(path('aliases',d.alternate_alias)))[d.alternate_alias]?.includes(d.family_id))}
 }
 for(const d of ledger.russian.decisions){
  const f=(await get(path('families',d.family_id)))[d.family_id],ms=(await get(path('members/ru',d.family_id)))[d.family_id];
  assert.equal(digest(f),d.family_sha256);assert.equal(digest(ms),d.ordered_member_sha256);assert.equal(ms.length,d.expected_members);
  for(const m of d.retained)assert(ms.some(x=>x.lemma_id===m.lemma_id&&x.word===m.word));
 }
 const changed=new Set();
 for(const d of ledger.val.all_target_diagnostics.filter(x=>x.action==='remove_reverse_alias_only')){const p=path('families',d.family_id),f=(await get(p))[d.family_id];f.aliases=f.aliases.filter(a=>a!=='val');changed.add(p)}
 const ap=path('aliases','val');(await get(ap)).val=ledger.val.retained_targets.slice().sort();changed.add(ap);
 let removed=0;
 for(const d of ledger.russian.decisions){
  const fp=path('families',d.family_id),mp=path('members/ru',d.family_id),f=(await get(fp))[d.family_id],shard=await get(mp),ids=new Set(d.retained.map(m=>m.lemma_id)),keep=shard[d.family_id].filter(m=>ids.has(m.lemma_id));
  removed+=shard[d.family_id].length-keep.length;
  f.support=keep.length;f.language_support={ru:keep.length};f.runtime_curated=true;f.suspicion_score=40;f.suspicion_reasons=['very_short_root'];f.review_status='needs_review';f.review_status_reason='bounded_lexical_identities_only_no_substring_expansion';
  for(const m of keep)m.components=[{surface:m.search_form,canonical_candidate:f.canonical,confidence:1,evidence:[{type:'manual_override',source:'linguistic_review',path:['ru',m.word,f.id],confidence:1}]}];
  shard[d.family_id]=keep;changed.add(fp);changed.add(mp);
 }
 assert.equal(removed,ledger.russian.expected_total_removed);
 const sha=createHash('sha256').update(bytes).digest('hex');
 Object.assign(report.repository_materialization,{bounded_20260930_ledger_sha256:sha,val_reverse_alias_targets_quarantined:12,russian_short_batch_2_memberships_removed:removed});
 provenance.repository_repairs.push({repair,source_run_id:sourceRun,removed_memberships:removed,removed_reverse_alias_targets:12,retained_val_targets:ledger.val.retained_targets,decision_ledger_sha256:sha,deleted_families:[],not_individual_lexical_annotation:true});
 for(const p of changed)await write(p,cache.get(p));
 cache.clear();
 await recountMaterializedMembers(root,manifest,report);await refreshFamilySummaries(root,report);
 await write(join(root,'report.json'),report);Object.assign(provenance,await repositoryTreeMetadata(root));await write(join(root,'repository-provenance.json'),provenance);
 console.log(JSON.stringify({mode,removed_memberships:removed,val_targets:15,changed_shards:changed.size}));
}
