import {createHash} from 'node:crypto';
import {validateCatalog,normalizeHead,applyHeadReview,generateV6Memberships} from '../../associativvordes/js/associative-family-v6.js';
import {recognizeFiniteHeadBindings} from '../../associativvordes/js/associative-family-v6-head-recognition.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
const registryPath='associativvordes/family-index-v6/family-promotions.json';
export function validatePromotionDecision(doc) {
 if(doc.schema_version!==6||doc.production_enabled!==false||doc.promotion_status!=='accepted'||doc.binding_authorized!==true||doc.accepted_membership_authorized!==true||!doc.stage||!doc.groups?.length||!doc.input_sha256)throw Error('Promotion requires explicit reviewed authorization');
 const f=doc.family;
 if(!f||f.id!=='family:'+f.canonical||f.canonical_decision?.status!=='accepted'||!f.canonical_decision.reason||!f.canonical_decision.evidence?.length||f.promotion_status!=='accepted_finite_promotion'||f.legacy_ids?.length!==0)throw Error('Promotion cannot import legacy containers');
 if(!doc.candidate_packets?.length||!doc.positive_controls?.length||!doc.negative_controls?.length)throw Error('Promotion requires evidence packets and controls');
 const seen=new Set(),identities=new Set();
 for(const g of doc.groups){
  if(g.identity_status!=='accepted'||g.family_edge_status!=='accepted'||!g.language||!g.normalized_head||!g.sense||!g.head_scope||!g.reason||!g.sources?.length||!g.records?.length)throw Error('Unapproved head identity or family relation');
  const identity=g.language+'\0'+normalizeHead(g.normalized_head)+'\0'+g.sense;if(identities.has(identity))throw Error('Duplicate promotion head');identities.add(identity);
  for(const r of g.records){
   const key=r.language+'\0'+r.lemma_id;
   if(seen.has(key)||r.language!==g.language||!r.lemma_id||!r.word||r.formal_continuity_status!=='accepted'||r.relation_kind!=='lexical_continuity'||!r.source_record||r.source_record.lemma_id!==r.lemma_id||r.source_record.word!==r.word||!r.source_locator?.record_sha256||!doc.input_sha256[r.source_locator.path])throw Error('Duplicate, translated or unproved finite source identity');
   if(!new RegExp('^associativvordes/family-index-v5/members/'+g.language+'/[0-9a-f]{2}\\.json\\.gz$').test(r.source_locator.path)||!r.source_locator.family_id)throw Error('Promotion requires immutable v5 corpus source paths');
   seen.add(key);
   if(doc.negative_controls.some(n=>n.language===r.language&&(n.lemma_id===r.lemma_id||n.word===r.word)))throw Error('Negative promotion control admitted');
  }
 }
 const positives=new Set(doc.positive_controls.map(r=>r.language+'\0'+r.lemma_id));
 if(positives.size!==doc.positive_controls.length||positives.size!==seen.size||[...seen].some(k=>!positives.has(k)))throw Error('Positive controls must enumerate the finite promotion frame');
 return doc;
}
export async function loadFamilyPromotions({read,readBytes,catalog,inputs}) {
 let registry;
 try{registry=await read(registryPath);}catch(e){if(e.code==='ENOENT'){if(catalog.families.some(f=>f.promotion_status==='accepted_finite_promotion'))throw Error('Missing promotion registry');return [];}throw e;}
 if(registry.schema_version!==6||registry.production_enabled!==false||!Array.isArray(registry.decisions)||new Set(registry.decisions).size!==registry.decisions.length)throw Error('Invalid promotion registry');
 inputs[registryPath]=sha(await readBytes(registryPath));const results=[],familyIds=new Set();
 for(const path of registry.decisions){
  const bytes=await readBytes(path),doc=validatePromotionDecision(await read(path)),f=catalog.families.find(f=>f.id===doc.family.id);
  if(familyIds.has(doc.family.id)||!f||JSON.stringify(f)!==JSON.stringify(doc.family))throw Error('Promotion catalog decision mismatch');familyIds.add(f.id);inputs[path]=sha(bytes);
  const cache=new Map();
  for(const[p,h]of Object.entries(doc.input_sha256)){const b=await readBytes(p);if(sha(b)!==h)throw Error('Changed promotion evidence '+p);inputs[p]=h;cache.set(p,await read(p));}
  for(const g of doc.groups)for(const r of g.records){const p=r.source_locator,m=cache.get(p.path)?.[p.family_id]?.find(x=>x.lemma_id===r.lemma_id);if(!m||JSON.stringify(m)!==JSON.stringify(r.source_record)||sha(Buffer.from(JSON.stringify(m)))!==p.record_sha256)throw Error('Changed or invented promotion corpus record');}
  results.push({path,sha256:sha(bytes),doc});
 }
 if(catalog.families.filter(f=>f.promotion_status==='accepted_finite_promotion').length!==familyIds.size)throw Error('Unregistered catalog promotion');
 return results;
}
export function materializeFamilyPromotions({index,promotions,headId}) {
 const ledger=[],prior=new Set(index.memberships.map(r=>r.language+'\0'+r.family_id+'\0'+r.lemma_id));
 for(const stage of promotions){
  const doc=validatePromotionDecision(stage.doc),familyId=doc.family.id;
  if(index.edges.some(e=>e.family_id===familyId)||index.links.some(l=>l.family_id===familyId))throw Error('Promotion must not replace existing family edges');
  const facts=[],evidence=[],bindings=[],records=[];
  for(const g of doc.groups){
   const id=headId(g.language,g.normalized_head,g.sense),factId='lexical-fact:'+id.slice(5),evId='evidence:'+id.slice(5),ev={id:evId,language:g.language,head:g.normalized_head,sense:g.sense,status:'accepted',sources:g.sources,finding:g.reason};
   facts.push({id:factId,language:g.language,normalized_head:normalizeHead(g.normalized_head),sense:g.sense,forms:g.forms,component_stems:g.component_stems||[],evidence_ids:[evId]});evidence.push(ev);
   if(index.heads.some(h=>h.id===id))throw Error('Existing head requires explicit versioned reuse');
   index.heads.push({id,language:g.language,normalized_head:normalizeHead(g.normalized_head),identity_kind:'lexical_head',sense:g.sense,head_scope:g.head_scope,version:1,evidence:[ev,{source:stage.path,sha256:stage.sha256}]});
   for(const r of g.records){
    const identity_proof=[{path:stage.path,sha256:stage.sha256,lemma_id:r.lemma_id,word:r.word}],binding={language:r.language,family_id:familyId,lemma_id:r.lemma_id,word:r.word,fact_id:factId,link_role:r.link_role,identity_proof,...(r.component_segmentation?{component_segmentation:r.component_segmentation}: {})};
    bindings.push(binding);records.push({language:r.language,family_id:familyId,lemma_id:r.lemma_id,word:r.word});
    const key=r.language+'\0'+r.lemma_id,old=index.corpus.get(key);if(old&&JSON.stringify(old)!==JSON.stringify(r.source_record))throw Error('Promotion source conflicts with existing corpus identity');index.corpus.set(key,r.source_record);
    index.links.push({...binding,head_id:id,recognition:'reviewed_family_promotion',evidence:[{source:r.source_locator,lemma_id:r.lemma_id}],source_references:g.sources,...(r.component_segmentation?{whole_compound_identity_established:false}:{}),...(r.corpus_pos_status?{corpus_pos_status:r.corpus_pos_status}:{})});
   }
  }
  const recognition=recognizeFiniteHeadBindings({records,facts,evidence,bindings});if(recognition.recognized.length!==records.length)throw Error('Ambiguous or unproved promotion identity');
  for(const g of doc.groups){const id=headId(g.language,g.normalized_head,g.sense);index=applyHeadReview(index,{head_id:id,family_id:familyId,status:'accepted',expected_version:0,lemma_ids:g.records.map(r=>r.lemma_id),morphology_policy:'finite_explicit_lemma_ids',reason:g.reason,evidence:[{source:stage.path,sha256:stage.sha256},...g.sources.map(source=>({source}))],review_stage:doc.stage});ledger.push({...index.decision_ledger,language:g.language,decision_kind:'new_family_promotion',head_scope:g.head_scope});}
 }
 index.memberships=generateV6Memberships(index);
 const additions=index.memberships.filter(r=>!prior.has(r.language+'\0'+r.family_id+'\0'+r.lemma_id));
 if(index.memberships.length!==prior.size+additions.length)throw Error('Promotion changed existing memberships');
 return {index,ledger,additions,metrics:{promoted_families:promotions.length,head_decisions:ledger.length,finite_memberships:additions.length,known_queue_resolutions:0,full_linguistic_certification:false}};
}
