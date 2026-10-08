import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {loadFamilyPromotions,validatePromotionDecision,materializeFamilyPromotions} from '../scripts/lib/associative-v6-family-promotion.mjs';
import {searchV6,resolveV6Alias} from '../associativvordes/js/associative-family-v6.js';
const read=async p=>{const b=await fs.readFile(p);return JSON.parse(p.endsWith('.gz')?gunzipSync(b):b);};
const catalog=await read('associativvordes/family-index-v6/catalog.json'),inputs={};
const allPromotions=await loadFamilyPromotions({read,readBytes:p=>fs.readFile(p),catalog,inputs});
const promotions=allPromotions.filter(p=>p.doc.family.id==='family:system');
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
 for(const change of [d=>d.groups[0].records[0].relation_kind='semantic_translation',d=>d.groups[0].records[0].formal_continuity_status='pending',d=>d.groups[0].records[0].lemma_id='lemma:invented',d=>d.groups[0].records.push(d.groups[0].records[0]),d=>d.negative_controls.push({language:'en',word:'system'}),d=>d.positive_controls.pop(),d=>{const r=d.groups[0].records[0],p=r.source_locator.path;r.source_locator.path='audit/fabricated-corpus.json';d.input_sha256[r.source_locator.path]=d.input_sha256[p];}]){
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
test('promotion history and queue statistics survive finite baseline corrections',async()=>{
 const root='associativvordes/family-index-v6/generated',m=await read(root+'/memberships.json.gz'),d=await read(root+'/differential.json.gz'),metrics=await read(root+'/head-review-metrics.json');
 assert.equal(m.length,21359);assert.equal(d.manual_memberships.length,19967);assert.equal(d.accepted_membership_additions.length,1575);assert.equal(d.family_promotion_additions.length,22);
 assert.equal(metrics.current_active_records,23234);assert.equal(metrics.new_records_resolved,1968);assert.equal(metrics.new_head_decisions,39);
});
test('Prompt 02 admits six anis rows while all seven tower aggregates remain individually withheld',()=>{
 const result=materializeFamilyPromotions({index:fixture(),promotions:allPromotions.filter(p=>['family:system','family:anis'].includes(p.doc.family.id)),headId});
 assert.equal(result.additions.length,18);assert.equal(result.ledger.length,13);
 assert.equal(result.index.memberships.filter(r=>r.family_id==='family:anis').length,6);
 assert.deepEqual(result.index.memberships.filter(r=>r.family_id==='family:turr').map(r=>[r.language,r.word]).sort(),[]);
 for(const word of ['tour','тура','tower','turm','turret','naive','anisotropy','aniso','americanise','состав'])assert.equal(result.index.memberships.filter(r=>r.word===word).length,0);
 const anis=catalog.families.find(f=>f.canonical==='anis'),turr=catalog.families.find(f=>f.canonical==='turr');
 assert.equal(turr,undefined);
 for(const f of [anis]){assert.equal(f.legacy_ids.length,0);assert(f.reflexes.every(r=>r.realization_type==='lexical_branch_realization'&&r.general_family_realization===false&&r.establishes_membership===false));}
 assert.equal(anis.reflexes.find(r=>r.language==='it').realization,'anice');assert.equal(anis.reflexes.some(r=>r.realization==='anic'),false);
});
test('finite senses policy rejects promotion of unresolved lexical histories and lost frequency limitations',()=>{
 for(const change of [d=>delete d.groups[0].records[0].senses_decision,d=>d.groups[0].records[0].senses_decision.analyses.push({history:'unrelated',verdict:'excluded',evidence:['synthetic-adversarial-proof']}),d=>d.groups[0].records[0].frequency_status='botanical_token_frequency',d=>d.groups[0].records[0].senses_decision.lemma_id='lemma:invented']){
  const d=structuredClone(allPromotions.find(p=>p.doc.family.id==='family:anis').doc);change(d);assert.throws(()=>validatePromotionDecision(d),/senses decision/);
 }
 const result=materializeFamilyPromotions({index:fixture(),promotions:allPromotions.filter(p=>['family:system','family:anis'].includes(p.doc.family.id)),headId});assert(result.index.links.filter(l=>['family:anis','family:turr'].includes(l.family_id)).every(l=>l.frequency_status==='aggregate_only_not_sense_frequency'&&l.membership_object==='lexical_row_or_component'&&l.token_senses_established===false));
});
test('documented torre homonyms require withholding regardless of rarity or unknown POS',()=>{
 return read('audit/associative-family-v6/turr-finite-lexical-row-promotion-20261004.json').then(d=>{assert.equal(d.groups.length,0);assert.equal(d.binding_authorized,false);assert.throws(()=>validatePromotionDecision(d),/authorization/);});
});
