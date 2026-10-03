import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {loadFamilyPromotions,validatePromotionDecision,materializeFamilyPromotions} from '../scripts/lib/associative-v6-family-promotion.mjs';
import {searchV6,resolveV6Alias} from '../associativvordes/js/associative-family-v6.js';
const read=async p=>{const b=await fs.readFile(p);return JSON.parse(p.endsWith('.gz')?gunzipSync(b):b);};
const catalog=await read('associativvordes/family-index-v6/catalog.json'),inputs={};
const promotions=await loadFamilyPromotions({read,readBytes:p=>fs.readFile(p),catalog,inputs});
const doc=promotions[0].doc;
const headId=(l,h,s)=>'head:'+l+':'+createHash('sha256').update(l+'\0'+h.normalize('NFC').toLowerCase()+'\0'+s).digest('hex').slice(0,24);
const fixture=()=>({catalog,heads:[],edges:[],links:[],corpus:new Map(),memberships:[]});
test('promotion has twelve real IDs, six national rows and a separate derivational head',()=>{
 const result=materializeFamilyPromotions({index:fixture(),promotions,headId});
 assert.equal(result.additions.length,12);assert.equal(result.ledger.length,7);assert.equal(new Set(result.additions.map(r=>r.language)).size,6);
 assert.equal(result.metrics.known_queue_resolutions,0);assert.equal(doc.family.legacy_ids.length,0);
 const it=result.index.links.find(r=>r.language==='it');assert.equal(it.link_role,'reviewed_lexical_base_component');assert.equal(it.corpus_pos_status,'ambiguous_noun_or_sistemare_form_preserved');assert.equal(it.whole_compound_identity_established,false);
 assert.equal(doc.family.reflexes[0].realization_type,'derivational_stem');assert.equal(doc.family.reflexes[0].general_family_realization,false);
 assert.equal(result.index.memberships.filter(r=>r.word==='состав').length,0);
 assert.equal(searchV6(result.index,'система').length,12);assert.deepEqual(resolveV6Alias(catalog,'sostav'),[]);
 assert.throws(()=>materializeFamilyPromotions({index:result.index,promotions,headId}),/replace existing/);
});
test('research-only, unapproved heads and container imports fail before materialization',()=>{
 for(const change of [d=>d.promotion_status='pending',d=>d.binding_authorized=false,d=>d.accepted_membership_authorized=false,d=>d.family.canonical_decision.status='pending',d=>d.groups[0].identity_status='pending',d=>d.groups[0].family_edge_status='uncertain',d=>d.family.legacy_ids.push('ety:e5b5bac756da')]){
  const d=structuredClone(doc);change(d);assert.throws(()=>validatePromotionDecision(d));
 }
});
test('translation, invented IDs, duplicate IDs and accidental boundaries cannot acquire memberships',()=>{
 for(const change of [d=>d.groups[0].records[0].relation_kind='semantic_translation',d=>d.groups[0].records[0].formal_continuity_status='pending',d=>d.groups[0].records[0].lemma_id='lemma:invented',d=>d.groups[0].records.push(d.groups[0].records[0]),d=>d.negative_controls.push({language:'en',word:'system'}),d=>d.positive_controls.pop()]){
  const d=structuredClone(doc);change(d);assert.throws(()=>validatePromotionDecision(d));
 }
 const d=structuredClone(doc);d.groups.find(g=>g.language==='it').records[0].component_segmentation.after='wrong';
 assert.throws(()=>materializeFamilyPromotions({index:fixture(),promotions:[{...promotions[0],doc:d}],headId}),/boundary/);
});
test('changed source evidence and corpus snapshots are rejected',async()=>{
 const corrupt=structuredClone(doc);corrupt.groups[0].records[0].source_record.rank++;
 await assert.rejects(loadFamilyPromotions({catalog,inputs:{},read:p=>p===promotions[0].path?Promise.resolve(corrupt):read(p),readBytes:p=>fs.readFile(p)}),/corpus record/);
 await assert.rejects(loadFamilyPromotions({catalog,inputs:{},read,readBytes:p=>p===Object.keys(doc.input_sha256)[0]?Promise.resolve(Buffer.from('changed')):fs.readFile(p)}),/Changed promotion evidence/);
});
test('all pre-promotion memberships and known resolution statistics remain unchanged',async()=>{
 const root='associativvordes/family-index-v6/generated',m=await read(root+'/memberships.json.gz'),d=await read(root+'/differential.json.gz'),metrics=await read(root+'/head-review-metrics.json');
 assert.equal(m.length,21021);assert.equal(d.manual_memberships.length,19967);assert.equal(d.accepted_membership_additions.length,1042);assert.equal(d.family_promotion_additions.length,12);
 assert.equal(metrics.current_active_records,24037);assert.equal(metrics.new_records_resolved,1165);assert.equal(metrics.new_head_decisions,22);
});
