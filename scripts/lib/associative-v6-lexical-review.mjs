import {createHash} from 'node:crypto';
import {applyHeadReview,normalizeHead} from '../../associativvordes/js/associative-family-v6.js';
import {recognizeFiniteHeadBindings,proposeMorphologicalHeads,validateLexicalFacts} from '../../associativvordes/js/associative-family-v6-head-recognition.js';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function loadLexicalReview({read,readBytes,catalog,inputs}) {
 const path='associativvordes/family-index-v6/lexical-head-review.json.gz',doc=await read(path);
 if(doc.schema_version!==6||doc.production_enabled!==false||doc.source_head!==catalog.source_head)throw Error('Invalid guarded lexical review frame');
 inputs[path]=hash(await readBytes(path));validateLexicalFacts(doc.lexical_facts,doc.evidence_cache);
 const loaded=new Map();
 function contains(x,p){if(!x||typeof x!=='object')return false;if(x.lemma_id===p.lemma_id&&x.word===p.word&&(!p.reason||x.reason===p.reason))return true;return Object.values(x).some(v=>contains(v,p));}
 for(const b of doc.finite_bindings)for(const p of b.identity_proof){
  if(!p.path||!p.sha256||p.lemma_id!==b.lemma_id||p.word!==b.word)throw Error('Incomplete source-bound identity proof');
  if(!loaded.has(p.path)){const bytes=await readBytes(p.path);if(hash(bytes)!==p.sha256)throw Error('Stale identity source '+p.path);inputs[p.path]=p.sha256;loaded.set(p.path,await read(p.path));}
  if(!contains(loaded.get(p.path),p))throw Error('Invented identity source record');
 }
 const facts=new Map(doc.lexical_facts.map(f=>[f.id,f])),representation=new Map();
 for(const b of doc.finite_bindings.filter(b=>b.decision_kind==='representation_change')){
  const k=b.language+'\0'+b.family_id+'\0'+b.lemma_id;if(representation.has(k))throw Error('Duplicate representation binding');
  representation.set(k,{...b,fact:facts.get(b.fact_id)});
 }
 return {doc,facts,representation};
}
export function materializeLexicalReviews({index,review,external,headId,prior,sourceQueue}) {
 const {doc,facts}=review,extra=doc.finite_bindings.filter(b=>b.decision_kind!=='representation_change');
 const records=[...prior,...extra.map(b=>{const x=external.get(b.language+'\0'+b.lemma_id);if(!x||x.m.word!==b.word)throw Error('Missing real source corpus record');return {language:b.language,family_id:b.family_id,lemma_id:b.lemma_id,word:b.word};})];
 const recognition=recognizeFiniteHeadBindings({records,facts:doc.lexical_facts,evidence:doc.evidence_cache,bindings:doc.finite_bindings});
 if(recognition.recognized.length!==doc.finite_bindings.length)throw Error('Unresolved approved binding or conflicting sense');
 const queue=new Map(sourceQueue.map(r=>[r.language+'\0family:'+r.canonical_root+'\0'+r.lemma_id,r]));
 for(const b of extra){
  const f=facts.get(b.fact_id),id=headId(f.language,f.normalized_head,f.sense),x=external.get(b.language+'\0'+b.lemma_id),r=queue.get(b.language+'\0'+b.family_id+'\0'+b.lemma_id);
  if(!r||r.word!==b.word||(['uncertain'].includes(r.status)?'uncertain':'pending')!==b.expected_membership_status)throw Error('Changed current lexical review selection');
  if(index.links.some(l=>l.language===b.language&&l.family_id===b.family_id&&l.lemma_id===b.lemma_id))throw Error('Addition must be separate from baseline representation');
  if(!index.heads.some(h=>h.id===id))index.heads.push({id,language:f.language,normalized_head:f.normalized_head,identity_kind:'lexical_head',sense:f.sense,version:1,evidence:[...doc.evidence_cache.filter(e=>f.evidence_ids.includes(e.id)),...b.identity_proof]});
  index.links.push({language:b.language,lemma_id:b.lemma_id,word:b.word,family_id:b.family_id,head_id:id,recognition:'reviewed_finite_identity',link_role:b.link_role,identity_fact_id:f.id,identity_proof:b.identity_proof,...(b.link_role==='reviewed_lexical_base_component'?{component_segmentation:b.component_segmentation,whole_compound_identity_established:false}:{}),evidence:[{source:x.proof,lemma_id:b.lemma_id}],source_references:doc.evidence_cache.filter(e=>f.evidence_ids.includes(e.id)).flatMap(e=>e.sources)});
  index.corpus.set(b.language+'\0'+b.lemma_id,x.m);
 }
 const ledger=[];
 for(const d of doc.head_reviews){
  const f=facts.get(d.fact_id);if(!f)throw Error('Unknown review fact');const id=headId(f.language,f.normalized_head,f.sense);
  index=applyHeadReview(index,{...d,head_id:id});ledger.push({...index.decision_ledger,language:f.language,identity_fact_id:f.id,decision_kind:d.status==='accepted'?'accepted_membership_addition':'linguistic_exclusion'});
 }
 return {index,ledger,recognition};
}
export function reviewBenchmarks({backlog,frames,review,ledger,headId}) {
 const resolved=new Map();for(const d of ledger)for(const id of d.affected_lemma_ids){const key=d.language+'\0'+d.family_id+'\0'+id;if(resolved.has(key))throw Error('Review ledger affects an ID twice');resolved.set(key,d);}
 const identity=new Map(review.doc.finite_bindings.map(b=>[b.language+'\0'+b.family_id+'\0'+b.lemma_id,b])),active=[],benchmarks=[];
 for(const r of backlog){const key=r.language+'\0family:'+r.canonical_root+'\0'+r.lemma_id;if(resolved.has(key))continue;const binding=identity.get(key),f=binding&&review.facts.get(binding.fact_id);active.push(f?{...r,review_unit:headId(f.language,f.normalized_head,f.sense),head_recognition:'evidenced_finite_lexical_identity'}:r);}
 for(const frame of frames){const records=backlog.filter(r=>r.queue===frame.name),keys=new Set(records.map(r=>r.language+'\0family:'+r.canonical_root+'\0'+r.lemma_id)),ds=ledger.filter(d=>d.affected_lemma_ids.some(id=>keys.has(d.language+'\0'+d.family_id+'\0'+id))),done=records.filter(r=>resolved.has(r.language+'\0family:'+r.canonical_root+'\0'+r.lemma_id)),recognized=records.filter(r=>identity.has(r.language+'\0family:'+r.canonical_root+'\0'+r.lemma_id));
  const proposals=proposeMorphologicalHeads(records.map(r=>({...r,family_id:'family:'+r.canonical_root})),review.doc.lexical_facts);
  benchmarks.push({frame:frame.name,source:frame.path,records_before:records.length,records_after:records.length-done.length,proposed_heads:[...new Set(proposals.map(p=>p.fact_id))].length,evidenced_heads:[...new Set(recognized.map(r=>identity.get(r.language+'\0family:'+r.canonical_root+'\0'+r.lemma_id).fact_id))].length,expensive_head_decisions:ds.length,records_resolved:done.length,new_review_reduction_factor:ds.length?done.length/ds.length:null,unresolved_exact_records:records.filter(r=>!identity.has(r.language+'\0family:'+r.canonical_root+'\0'+r.lemma_id)).length,decisions:ds,proposals,rejected_proposals:proposals.filter(p=>!identity.has(p.language+'\0'+p.family_id+'\0'+p.lemma_id)),pending:records.filter(r=>!resolved.has(r.language+'\0family:'+r.canonical_root+'\0'+r.lemma_id)),false_grouping_quality_certified:false});
 }
 const newlyPending=backlog.filter(r=>r.status!=='uncertain'&&resolved.has(r.language+'\0family:'+r.canonical_root+'\0'+r.lemma_id)),newlyUncertain=backlog.filter(r=>r.status==='uncertain'&&resolved.has(r.language+'\0family:'+r.canonical_root+'\0'+r.lemma_id));
 const pendingDecisionKeys=new Set(newlyPending.map(r=>{const d=resolved.get(r.language+'\0family:'+r.canonical_root+'\0'+r.lemma_id);return d.head_id+'\0'+d.family_id;}));
 const statusCounts={pending:active.filter(r=>r.status!=='uncertain').length,uncertain:active.filter(r=>r.status==='uncertain').length};
 const stages=[...new Set(ledger.map(d=>d.review_stage||'prior_observ_inform'))].map(stage=>{const ds=ledger.filter(d=>(d.review_stage||'prior_observ_inform')===stage),keys=new Set(ds.flatMap(d=>d.affected_lemma_ids.map(id=>d.language+'\0'+d.family_id+'\0'+id))),rs=backlog.filter(r=>keys.has(r.language+'\0family:'+r.canonical_root+'\0'+r.lemma_id));return {stage,head_decisions:ds.length,records_resolved:rs.length,previously_pending:rs.filter(r=>r.status!=='uncertain').length,previously_uncertain:rs.filter(r=>r.status==='uncertain').length,accepted:ds.filter(d=>d.status==='accepted').reduce((n,d)=>n+d.affected_lemma_ids.length,0),excluded:ds.filter(d=>d.status==='excluded').reduce((n,d)=>n+d.affected_lemma_ids.length,0),new_review_reduction_factor:rs.length/(ds.length||1)};});
 const units=new Map();for(const r of active){const k=r.review_unit+'\0'+r.canonical_root,u=units.get(k)||{review_unit:r.review_unit,root:r.canonical_root,language:r.language,recognition:r.head_recognition,lemma_ids:[],source_records:[]};u.lemma_ids.push(r.lemma_id);u.source_records.push(r);units.set(k,u);}
 const ranked=[...units.values()].sort((a,b)=>b.lemma_ids.length-a.lemma_ids.length||a.review_unit.localeCompare(b.review_unit,'en'));
 const represented=review.doc.finite_bindings.filter(b=>b.decision_kind==='representation_change'),heads=new Set(represented.map(b=>b.fact_id));
 return {active,ranked,benchmarks,metrics:{source_active_records:backlog.length,current_active_records:active.length,new_head_decisions:ledger.length,new_records_resolved:resolved.size,new_review_reduction_factor:ledger.length?resolved.size/ledger.length:null,newly_pending_records_resolved:newlyPending.length,investigated_uncertainties_resolved:newlyUncertain.length,pending_head_decisions:pendingDecisionKeys.size,pending_review_reduction_factor:pendingDecisionKeys.size?newlyPending.length/pendingDecisionKeys.size:null,current_status_counts:statusCounts,stages,strict_remaining_frame_reduction:active.length/(ranked.length||1),historical_component_bindings_represented:represented.length,historical_component_head_edges:heads.size,historical_representation_reuse_factor:represented.length/(heads.size||1),historical_boundary_reviews_are_not_newly_resolved_records:true}};
}
