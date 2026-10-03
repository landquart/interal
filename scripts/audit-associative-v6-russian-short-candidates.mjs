#!/usr/bin/env node
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const out=process.argv[2]||'audit/associative-family-v6/russian-short-review-20261003';
const sha=b=>createHash('sha256').update(b).digest('hex');
const bucket=id=>{let h=0x811c9dc5;for(const c of id){h^=c.codePointAt(0);h=Math.imul(h,0x01000193);}return ((h>>>0)%256).toString(16).padStart(2,'0');};
const findings={
 kh:{expected:601,finding:'The container joins encoding-like strings and unrelated named tokens such as балкхед, банкхед and анкх. No coherent international lexical identity is established for kh; do not promote this spelling pool.',examples:['анкх','балкхед','банкхед']},
 nl:{expected:553,finding:'The source is a one-language surface pool with no etymon keys. Examples are encoding-like strings, not independently evidenced lexical heads. Leave lexical partition and identity research pending; do not promote nl.',examples:['ъгшйнл','ачярнл','асккхрнл']},
 lo:{expected:506,finding:'The pool mixes unrelated lexical material, names and damaged forms. авиакрыло/антикрыло have a wing component, whereas аплоад and апостло do not establish the same lexical base. No lo family promotion.',examples:['авиакрыло','антикрыло','аплоад','апостло']},
 ca:{expected:497,finding:'The pool joins inflected person nouns, names and unrelated borrowing-like spellings. альфа-самца, американца, близнеца and бармицца do not establish one ca associative element. Inflectional endings cannot be promoted as roots.',examples:['альфа-самца','американца','близнеца','бармицца']},
 um:{expected:480,finding:'Inspect beyond exact ум: умно belongs to the mental lexical row supported by dictionary умный. However this Russian row has no established international associative-base continuity here. Latin-looking -иум nouns, хоум loans, умлаут and умыть are separate lexical research targets. Preserve all records; do not promote the entire um spelling pool.',examples:['ум','умно','атриум','хоум','умлаут','умыть']}
};
const input={},rows=[],reviews=[];
for(const[root,decision]of Object.entries(findings)){
 const id='surface:ru:'+root,b=bucket(id),paths=['associativvordes/family-index-v5/families/'+b+'.json.gz','associativvordes/family-index-v5/members/ru/'+b+'.json.gz'];const values=[];
 for(const p of paths){const bytes=await fs.readFile(p);input[p]=sha(bytes);values.push(JSON.parse(gunzipSync(bytes))[id]);}
 const[f,members]=values;assert.equal(f.id,id);assert.equal(members.length,decision.expected);assert.equal(f.source,'surface_singleton');assert.deepEqual(f.etymon_keys,[]);assert.equal(new Set(members.map(r=>r.lemma_id)).size,members.length);
 const byWord=new Map(members.map(r=>[r.word,r]));for(const w of decision.examples)assert(byWord.has(w));
 reviews.push({candidate_id:id,source_records:members.length,promotion_status:'not_promoted',lexical_partition_status:root==='um'?'mental_row_identified_international_relation_investigated_uncertain':'pending_finer_lexical_identity_review',canonical_decision:null,associative_family_id:null,finding:decision.finding,examples:decision.examples.map(w=>({lemma_id:byWord.get(w).lemma_id,word:w})),...(root==='um'?{dictionary_row:['ум','умный','умно'],finite_present_mental_row:['ум','умно'].map(w=>({lemma_id:byWord.get(w).lemma_id,word:w})),candidate_route_gap:['умный'],candidate_route_gap_is_not_a_global_corpus_gap:true,reference_sources:['https://gramota.ru/meta/umnyy','https://gramota.ru/poisk?mode=all&query=%D1%83%D0%BC&simple=0'],dictionary_access:'Indexed official dictionary text available; direct metadata pages returned 403.'}:{}),limitations:['Container rejection does not adjudicate every source record or erase lexical evidence.','No automatic linguistic exclusion or corpus deletion; remaining lexical research stays pending.']});
 for(const r of members)rows.push({candidate_id:id,language:'ru',source_record:r});
}
assert.equal(rows.length,2637);const report={schema_version:6,verdict:'pass',scope:'five_saved_russian_short_component_promotion_candidates',script_sha256:sha(await fs.readFile(new URL(import.meta.url))),input_sha256:input,source_records_preserved:rows.length,candidate_reviews:reviews,canonical_decisions_created:0,catalog_promotions:0,new_memberships:0,new_current_queue_records_resolved:0,production_enabled:false,full_linguistic_certification:false};
await fs.mkdir(out,{recursive:true});await fs.writeFile(out+'/records.json.gz',gzipSync(Buffer.from(JSON.stringify(rows)+'\n'),{level:9,mtime:0}));await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({verdict:'pass',source_records:rows.length,promotions:0,mental_row_not_exact_token_only:true}));
