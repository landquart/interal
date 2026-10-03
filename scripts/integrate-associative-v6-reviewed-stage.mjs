#!/usr/bin/env node
// Materialize an explicitly researched finite stage; this is not a classifier.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {normalizeHead} from '../associativvordes/js/associative-family-v6.js';
import {recognizeFiniteHeadBindings} from '../associativvordes/js/associative-family-v6-head-recognition.js';
const stagePath=process.argv[2];if(!stagePath)throw Error('Explicit reviewed stage path required');
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=async p=>{const b=await fs.readFile(p);return JSON.parse(p.endsWith('.gz')?gunzipSync(b):b);};
const stage=await read(stagePath),reviewPath='associativvordes/family-index-v6/lexical-head-review.json.gz',doc=await read(reviewPath);
if(stage.schema_version!==6||stage.production_enabled!==false||!stage.groups.length)throw Error('Invalid research stage');
if(sha(await fs.readFile(stage.source_queue))!==stage.source_queue_sha256)throw Error('Changed finite source queue');
const stageHash=sha(await fs.readFile(stagePath)),records=[];
for(const g of stage.groups){
 if(!['accepted','excluded'].includes(g.status)||!g.sources.length||!g.reason||!g.sense||!g.records.length)throw Error('Incomplete linguistic decision');
 const key=sha(Buffer.from(g.language+'\0'+normalizeHead(g.normalized_head)+'\0'+g.sense)).slice(0,24),factId='lexical-fact:'+key,evidenceId='evidence:'+key;
 if(doc.lexical_facts.some(f=>f.id===factId))throw Error('Existing fact requires explicit versioned extension, not replacement');
 doc.evidence_cache.push({id:evidenceId,language:g.language,head:g.normalized_head,sense:g.sense,status:'accepted',evidence_kind:'lexical_identity',finding:g.reason,sources:g.sources,establishes_family_membership:false,decision_version:1});
 doc.lexical_facts.push({id:factId,language:g.language,normalized_head:normalizeHead(g.normalized_head),sense:g.sense,forms:g.forms,component_stems:g.component_stems||[],evidence_ids:[evidenceId],version:1});
 for(const r of g.records){
  if(r.language!==g.language||!['pending_review','pending','uncertain'].includes(r.status))throw Error('Stage record is not unresolved');
  const b={language:r.language,lemma_id:r.lemma_id,word:r.word,family_id:'family:'+g.root,fact_id:factId,decision_kind:g.status==='accepted'?'accepted_membership_addition':'linguistic_exclusion',expected_membership_status:r.status==='uncertain'?'uncertain':'pending',link_role:r.component_segmentation?'reviewed_lexical_base_component':r.word===g.normalized_head?'whole_lexeme':'inflection',...(r.component_segmentation?{component_segmentation:r.component_segmentation,whole_compound_identity_established:false}:{}),identity_proof:[{path:stage.source_queue,sha256:stage.source_queue_sha256,lemma_id:r.lemma_id,word:r.word},{path:stagePath,sha256:stageHash,lemma_id:r.lemma_id,word:r.word}]};
  if(doc.finite_bindings.some(x=>x.language===b.language&&x.family_id===b.family_id&&x.lemma_id===b.lemma_id))throw Error('Already bound source record');
  doc.finite_bindings.push(b);records.push({...r,family_id:b.family_id});
 }
 doc.head_reviews.push({fact_id:factId,family_id:'family:'+g.root,status:g.status,expected_version:0,lemma_ids:g.records.map(r=>r.lemma_id),morphology_policy:'finite_explicit_lemma_ids',reason:g.reason,evidence:[{source:stagePath,sha256:stageHash},...g.sources.map(source=>({source}))],decision_version:1,review_stage:stage.stage});
}
const bindings=doc.finite_bindings.filter(b=>records.some(r=>r.language===b.language&&r.family_id===b.family_id&&r.lemma_id===b.lemma_id));
const recognized=recognizeFiniteHeadBindings({records,facts:doc.lexical_facts,evidence:doc.evidence_cache,bindings});
if(recognized.recognized.length!==records.length)throw Error('Unresolved finite lexical identity');
doc.version++;await fs.writeFile(reviewPath,gzipSync(Buffer.from(JSON.stringify(doc,null,2)+'\n'),{level:9,mtime:0}));
console.log(JSON.stringify({stage:stage.stage,heads:gCount(stage),records:records.length,production_enabled:false}));
function gCount(s){return s.groups.length;}
