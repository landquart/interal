#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {gunzipSync,gzipSync} from 'node:zlib';
import {familyBucket} from '../associativvordes/js/family-index-loader.js';
import {recountMaterializedMembers,refreshFamilySummaries,repositoryTreeMetadata} from './lib/associative-repository-materialization.mjs';
const root=process.argv[2]||'associativvordes/family-index-v5',mode=process.argv[3]||'plan';
assert(['plan','apply'].includes(mode));
const ledgerPath='audit/associative-family-v5/observation-decisions-20261001.json';
const repair='consolidate_and_prune_latin_observatio_20261001',base='7ddc5b5aaccaea159c811983dbbb7c79b0ff9a5e',sourceRun=35647932153;
const id='ety:c28863eb7595',duplicate='ety:c80365cdd174',languages=['en','de','fr','es','it','ru'];
const aliases=['observatio','observation','osservazione'];
const analyses={en:{observation:'learned Latin observatio ancestry',observationist:'observation + -ist; attested in Rundell 1986, token sense unresolved',observations:'observation + plural -s'},fr:{observation:'borrowed Latin observatio ancestry',observationnel:'observation + -nel',observations:'observation + plural -s'},it:{osservazione:'Latin observatio ancestry; Treccani records the headword',osservazionale:'osservazione + -ale; Treccani derivative'},de:{},es:{},ru:{}};
const exclusions={en:{observationsprotokoll:'German compound assigned to English; no language-ID reassignment',thatobservation:'fused phrase: that observation',underobservation:'fused phrase: under observation'},fr:{observational:'unresolved language assignment or spelling; English adjective is not sufficient evidence for a French lexical entry'},it:{'osservazìone':'unverified internal accent on the wrong syllable',quesflosservazione:'fused or corrupted phrase',tmosservazione:'unresolved prefix artifact',unosservazione:'fused phrase: un osservazione'},de:{},es:{},ru:{}};
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const read=async p=>JSON.parse((p.endsWith('.gz')?gunzipSync(await readFile(p)):await readFile(p)).toString());
const write=(p,v)=>writeFile(p,p.endsWith('.gz')?gzipSync(JSON.stringify(v),{level:6}):JSON.stringify(v,null,2)+'\n');
const path=(part,key)=>join(root,part,familyBucket(key)+'.json.gz');
const cache=new Map(),get=async p=>{if(!cache.has(p))cache.set(p,await read(p));return cache.get(p)};
const manifest=await read(join(root,'manifest.json')),report=await read(join(root,'report.json')),provenance=await read(join(root,'repository-provenance.json'));
assert.equal(manifest.repository_storage.immutable_source_run_id,sourceRun);assert.equal(provenance.source_run_id,sourceRun);
assert(!provenance.repository_repairs.some(r=>r.repair===repair),'Already applied');
const family=(await get(path('families',id)))[id],other=(await get(path('families',duplicate)))[duplicate];
assert.deepEqual(family.etymon_keys,['la:observatio']);assert.deepEqual(other.etymon_keys,['la:observati']);
assert.deepEqual(family.relation_evidence,other.relation_evidence);assert.equal(family.support,3376);assert.equal(other.support,3376);
if(mode==='plan'){
 const decisions=[];
 for(const language of languages){
  const ms=(await read(path('members/'+language,id)))[id]||[],dm=(await read(path('members/'+language,duplicate)))[duplicate]||[];
  assert.deepEqual(ms,dm);
  const retained=ms.filter(m=>Object.hasOwn(analyses[language],m.word)).map(m=>({lemma_id:m.lemma_id,word:m.word,relation:'lexical_ancestry_derivative_or_inflection',analysis:analyses[language][m.word]}));
  assert.equal(retained.length,Object.keys(analyses[language]).length);
  const excluded=ms.filter(m=>!Object.hasOwn(analyses[language],m.word)).map(m=>({lemma_id:m.lemma_id,word:m.word,reason:exclusions[language][m.word]||(language==='it'&&!/osserv|observ/.test(m.word)?'suffix_only_unrelated_lexeme':null)}));
  assert(excluded.every(m=>m.reason),'Unreviewed root-related candidate');
  decisions.push({language,original_count:ms.length,ordered_member_sha256:digest(ms),retained,excluded});
 }
 const aliasBefore={};for(const a of new Set([...family.aliases,...other.aliases,...aliases]))aliasBefore[a]=(await get(path('aliases',a)))[a]||[];
 const preservedFamilies=[];
 for(const fid of [...new Set(Object.values(aliasBefore).flat())].filter(fid=>fid!==id&&fid!==duplicate).sort()){
  const f=(await get(path('families',fid)))[fid],members={};
  for(const language of languages){const ms=(await read(path('members/'+language,fid)))[fid]||[];members[language]={count:ms.length,ordered_member_sha256:digest(ms)}}
  preservedFamilies.push({family_id:fid,family_sha256:digest(f),members});
 }
 const previous=await read('audit/associative-family-v5/information-decisions-20260930.json');
 for(const fid of[id,duplicate])assert.equal(previous.preserved_families.find(f=>f.family_id===fid).family_sha256,digest(fid===id?family:other));
 const ledger={schema_version:1,source_run_id:sourceRun,base_commit:base,repair,canonical_family_id:id,deleted_duplicate_family_id:duplicate,canonical:'observatio',aliases,family_sha256:digest(family),duplicate_family_sha256:digest(other),original_families:[family,other],alias_before:aliasBefore,preserved_families:preservedFamilies,decisions,added:[],expected_removed_memberships:6752-decisions.reduce((s,d)=>s+d.retained.length,0),expected_added_memberships:0,supersedes_information_preservation_for:[id,duplicate],review_method:'Complete arrays inspected; eight explicit lexical members. Other Italian suffix peers are structurally excluded without claiming individual dictionary review. Full source corpus records and unrelated memberships are preserved.',limitations:['Rare observationist is attested, but the corpus token sense is unresolved.','French observational is excluded pending independent language evidence, not declared nonexistent.','German and Spanish surface routes remain separate and unchanged; zero curated members in those languages preserve their runtime results.','Italian osservazione surface route contains two malformed tokens and is not merged.','Original der extraction does not certify inheritance.'],sources:[{url:'https://www.treccani.it/vocabolario/osservazione/',use:'Italian headword and Latin ancestry'},{url:'https://www.treccani.it/vocabolario/osservazionale/',use:'Explicit derivative and French observationnel model'},{url:'https://www.dictionnaire-academie.fr/article/A9O0080',use:'French observation headword'},{url:'https://www.larousse.fr/dictionnaires/anglais-francais/observational/598445',use:'English observational versus French observationnel'},{url:'https://euralex.org/wp-content/themes/euralex/proceedings/Euralex%201986/021_Michael%20Rundell%20%28London%29%20-Changing%20the%20rules_%20Why%20the%20monolingual%20learners%20dictionary%20should.pdf',use:'Primary authored attestation of observationist, p127'}].map(s=>({...s,accessed:'2026-10-01'}))};
 await write(ledgerPath,ledger);console.log(JSON.stringify({mode,retained:decisions.map(d=>[d.language,d.retained.length]),removed:ledger.expected_removed_memberships}));
}else{
 const bytes=await readFile(ledgerPath),l=JSON.parse(bytes),sha=createHash('sha256').update(bytes).digest('hex');
 assert.equal(l.source_run_id,sourceRun);assert.equal(l.base_commit,base);assert.equal(l.canonical_family_id,id);assert.equal(l.deleted_duplicate_family_id,duplicate);assert.deepEqual(l.aliases,aliases);assert.deepEqual(l.added,[]);
 assert.equal(digest(family),l.family_sha256);assert.equal(digest(other),l.duplicate_family_sha256);
 for(const d of l.preserved_families){
  assert.equal(digest((await get(path('families',d.family_id)))[d.family_id]),d.family_sha256);
  for(const language of languages)assert.equal(digest((await read(path('members/'+language,d.family_id)))[d.family_id]||[]),d.members[language].ordered_member_sha256);
 }
 for(const[a,targets]of Object.entries(l.alias_before))assert.deepEqual((await get(path('aliases',a)))[a]||[],targets);
 const changed=new Set();let removed=0;
 for(const d of l.decisions){
  assert.deepEqual(d.retained.map(m=>m.word).sort(),Object.keys(analyses[d.language]).sort());
  const mp=path('members/'+d.language,id),dp=path('members/'+d.language,duplicate),ms=(await get(mp))[id]||[],dm=(await get(dp))[duplicate]||[];
  assert.equal(digest(ms),d.ordered_member_sha256);assert.deepEqual(ms,dm);assert.equal(ms.length,d.original_count);
  const ids=new Set(d.retained.map(m=>m.lemma_id)),keep=ms.filter(m=>ids.has(m.lemma_id));assert.equal(keep.length,d.retained.length);
  assert.deepEqual(l.decisions.find(x=>x.language===d.language).excluded.map(x=>[x.lemma_id,x.word]),ms.filter(m=>!ids.has(m.lemma_id)).map(m=>[m.lemma_id,m.word]));
  removed+=ms.length+dm.length-keep.length;
  for(const m of keep){const decision=d.retained.find(x=>x.lemma_id===m.lemma_id);assert.equal(m.word,decision.word);assert.equal(decision.analysis,analyses[d.language][m.word]);m.components=[{surface:m.search_form,canonical_candidate:'observatio',confidence:1,evidence:[{type:'manual_override',source:'linguistic_review',path:[d.language,m.word,id],confidence:1,relation_type:decision.relation,analysis:decision.analysis}]}]}
  if(keep.length){(await get(mp))[id]=keep;changed.add(mp)}else if(ms.length){delete(await get(mp))[id];changed.add(mp)}
  if(dm.length){delete(await get(dp))[duplicate];changed.add(dp)}
 }
 assert.equal(removed,l.expected_removed_memberships);assert.equal(removed,6744);
 const fp=path('families',id),dfp=path('families',duplicate);delete(await get(dfp))[duplicate];changed.add(dfp);
 Object.assign(family,{canonical:'observatio',aliases,runtime_curated:true,verified:false,review_status:'needs_review',review_status_reason:'bounded_lexical_morphology_review',suspicion_score:0,suspicion_reasons:[],canonical_selection:{method:'manual_lexical_etymon_review'},relation_types:['borrowed_form'],reviewed_relation_note:'Recorded Latin ancestry. Original extraction evidence is preserved; der alone does not certify inheritance.',language_support:Object.fromEntries(l.decisions.map(d=>[d.language,d.retained.length]).filter(([,n])=>n)),support:l.decisions.reduce((s,d)=>s+d.retained.length,0)});changed.add(fp);
 assert.equal(family.support,Object.values(family.language_support).reduce((s,n)=>s+n,0));
 let aliasesAdded=0;
 for(const a of Object.keys(l.alias_before)){
  const p=path('aliases',a),s=await get(p),old=s[a]||[],targets=old.filter(x=>x!==id&&x!==duplicate);if(aliases.includes(a))targets.push(id);
  if(!old.length&&targets.length)aliasesAdded++;
  const next=[...new Set(targets)].sort();if(!next.length)delete s[a];else s[a]=next;
  if(JSON.stringify(old)!==JSON.stringify(next))changed.add(p);
 }
 manifest.counts.families--;manifest.counts.aliases+=aliasesAdded;
 Object.assign(report.repository_materialization,{observation_ledger_sha256:sha,observation_memberships_removed:removed,observation_memberships_added:0});
 provenance.repository_repairs.push({repair,source_run_id:sourceRun,removed_memberships:removed,added_memberships:0,deleted_families:[duplicate],retained_family:id,added_aliases:aliasesAdded,decision_ledger_sha256:sha,not_individual_lexical_annotation:true});
 for(const p of changed)await write(p,cache.get(p));cache.clear();
 await recountMaterializedMembers(root,manifest,report);await refreshFamilySummaries(root,report);report.aliases_in_lookup=manifest.counts.aliases;
 await write(join(root,'manifest.json'),manifest);await write(join(root,'report.json'),report);Object.assign(provenance,await repositoryTreeMetadata(root));await write(join(root,'repository-provenance.json'),provenance);
 console.log(JSON.stringify({mode,removed,retained:family.support,aliasesAdded,counts:report.repository_materialization}));
}
