import {createHash} from 'node:crypto';
import {applyHeadReview,generateV6Memberships,normalizeHead} from '../../associativvordes/js/associative-family-v6.js';
import {decideLexicalRow} from './associative-v6-senses-policy.mjs';
export const stateHash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export const recordKey=r=>r.language+'\0'+r.family_id+'\0'+r.lemma_id;
const edgeKey=e=>e.head_id+'\0'+e.family_id;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fail=s=>{throw Error(s);};
export function lifecyclePredecessor(index,head_id,family_id){
 const head=index.heads.find(h=>h.id===head_id)||fail('Unknown lifecycle head');
 const edge=index.edges.find(e=>e.head_id===head_id&&e.family_id===family_id)||null;
 const links=index.links.filter(l=>l.head_id===head_id&&l.family_id===family_id);
 return {head,head_version:head.version,head_sha256:stateHash(head),edge,edge_version:edge?.version||0,edge_sha256:stateHash(edge),scope_sha256:stateHash(links)};
}
export async function loadHeadLifecycle({read,readBytes,inputs}){
 const path='associativvordes/family-index-v6/head-lifecycle.json',registry=await read(path);
 if(registry.schema_version!==6||registry.production_enabled!==false||!Array.isArray(registry.decisions))fail('Invalid lifecycle registry');
 inputs[path]=stateHashBytes(await readBytes(path));const docs=[],seen=new Set();
 for(const entry of registry.decisions){
  if(seen.has(entry.path))fail('Repeated lifecycle dossier');seen.add(entry.path);
  const bytes=await readBytes(entry.path);if(stateHashBytes(bytes)!==entry.sha256)fail('Changed lifecycle dossier');inputs[entry.path]=entry.sha256;
  const doc=await read(entry.path);if(doc.synthetic_fixture===true)fail('Synthetic dossier cannot enter real registry');
  for(const [p,h] of Object.entries(doc.input_sha256||{})){if(stateHashBytes(await readBytes(p))!==h)fail('Changed lifecycle evidence '+p);inputs[p]=h;}
  for(const r of doc.records||[]){
   const p=r.source_locator;if(!p||!/^associativvordes\/family-index-v5\/members\/(en|de|fr|es|it|ru)\/[0-9a-f]{2}\.json\.gz$/.test(p.path)||p.path.split('/')[3]!==r.language||!doc.input_sha256[p.path])fail('Missing immutable lifecycle locator');
   const actual=(await read(p.path))[p.family_id]?.find(x=>x.lemma_id===r.lemma_id);
   if(!actual||!same(actual,r.source_record)||actual.word!==r.word||stateHash(actual)!==p.record_sha256)fail('Invented lifecycle corpus record');
  }
  docs.push(doc);
 }
 return docs;
}
const stateHashBytes=b=>createHash('sha256').update(b).digest('hex');
// Atomic on a private copy. A new link never observes its predecessor's verdict.
export function replayHeadLifecycle({index,docs,initialLedger=[]}){
 index={...index,heads:structuredClone(index.heads),edges:structuredClone(index.edges),links:structuredClone(index.links),corpus:new Map(index.corpus)};
 const initial=index.memberships||generateV6Memberships(index),ledger=[],ids=new Set(),reviewed=new Map(),seenRecords=new Set(initialLedger.flatMap(d=>(d.affected_lemma_ids||[]).map(id=>d.language+'\0'+d.family_id+'\0'+id)));
 const latestResolved=new Map(initialLedger.flatMap(d=>(d.affected_lemma_ids||[]).map(id=>[d.language+'\0'+d.family_id+'\0'+id,d.status])));
 const corpusKey=k=>{const [language,,id]=k.split('\0');return language+'\0'+id;};
 const seenCorpus=new Set([...seenRecords].map(corpusKey));
 let newHeads=0,newEdges=0,repeated=0,revisions=0,newLinks=0;
 for(const doc of docs){
  if(doc.schema_version!==6||doc.production_enabled!==false||doc.binding_authorized!==true||doc.review_authorized!==true||!doc.id||ids.has(doc.id))fail('Unauthorized or repeated lifecycle application');ids.add(doc.id);
  if(!['extend_links','extend_forms','new_family_edge','revise_verdict','clarify_sense'].includes(doc.operation))fail('Unknown lifecycle operation');
  const p=lifecyclePredecessor(index,doc.head_id,doc.family_id),given=doc.predecessor;
  if(!given||!same(p,given))fail('Stale or unknown lifecycle predecessor');
  const h=p.head;if(h.identity_kind==='legacy_exact_record')fail('Legacy exact identity cannot propagate');
  if(!same(doc.identity,{language:h.language,normalized_head:h.normalized_head,sense:h.sense}))fail('Lifecycle identity mutation; sense migration requires separate adjudication');
  if(!index.catalog.families.some(f=>f.id===doc.family_id))fail('Unknown lifecycle family');
  if(!Array.isArray(doc.evidence)||!doc.evidence.length||!doc.reason)fail('Missing lifecycle evidence');
  const decision=doc.decision;
  if(!decision||!['accepted','excluded','uncertain'].includes(decision.status)||!decision.reason||!decision.evidence?.length||decision.expected_version!==p.edge_version)fail('Missing independent edge decision');
  if(decision.status==='accepted'&&decision.relation_kind&&decision.relation_kind!=='lexical_continuity')fail('Non-lexical relation cannot authorize lifecycle membership');
  if(decision.status==='accepted'&&doc.accepted_membership_authorized!==true)fail('Unauthorized accepted lifecycle scope');
  if(doc.operation==='new_family_edge'&&p.edge||doc.operation!=='new_family_edge'&&!p.edge)fail('Wrong lifecycle operation for existing edge');
  if(doc.operation==='revise_verdict'&&decision.status===p.edge.status)fail('Verdict revision must change verdict');
  const old=index.links.filter(l=>l.head_id===h.id&&l.family_id===doc.family_id),records=doc.records||[],keys=new Set();
  const exact=records.map(r=>r.lemma_id).sort();
  if(!same(exact,[...(decision.lemma_ids||[])].sort())||new Set(exact).size!==exact.length||!exact.length)fail('Unconfirmed finite lifecycle decision scope');
  for(const l of old)if(!exact.includes(l.lemma_id))fail('Scope omission requires explicit separate migration');
  let appended=0;
  for(const r of records){
   if(r.language!==h.language||!r.lemma_id||keys.has(r.lemma_id)||r.source_record?.lemma_id!==r.lemma_id||r.source_record.word!==r.word||stateHash(r.source_record)!==r.source_locator?.record_sha256)fail('Invalid lifecycle real identity');keys.add(r.lemma_id);
   if((r.relation_kind&&r.relation_kind!=='lexical_continuity')||(r.formal_continuity_status&&r.formal_continuity_status!=='accepted'))fail('Non-lexical or unproved formal lifecycle continuity');
   if(r.identity_decision?.status!=='accepted'||!r.identity_decision.reason||!r.identity_decision.evidence?.length||r.boundary_proof?.status!=='accepted'||!r.boundary_proof.reason||!r.boundary_proof.evidence?.length)fail('Unproved new link identity or boundary');
   if(doc.family_id==='family:regul'&&(!r.senses_decision||r.senses_decision.language!==r.language||r.senses_decision.lemma_id!==r.lemma_id||r.senses_decision.word!==r.word||r.senses_decision.family_id!==doc.family_id||decideLexicalRow(r.senses_decision).decision!=='accepted'))fail('Missing accepted finite regul senses policy');
   const existing=old.find(l=>l.lemma_id===r.lemma_id);
   if(existing){if(existing.word!==r.word||!same(existing.evidence[0].source,r.source_locator))fail('Changed old source proof');continue;}
   if(!['extend_links','extend_forms','new_family_edge'].includes(doc.operation))fail('Revision/clarification cannot add links');
   if(index.links.some(l=>recordKey(l)===recordKey({...r,family_id:doc.family_id})))fail('Duplicate lifecycle membership identity');
   if(r.link_role==='reviewed_lexical_base_component'){
    const s=r.component_segmentation,exact=s&&normalizeHead(s.component)===h.normalized_head;
    const stem=s&&s.head===h.normalized_head&&h.finite_component_stems?.includes(s.component)&&doc.component_stems?.includes(s.component);
    if(!s||s.before+s.component+s.after!==r.word||(!exact&&!stem))fail('Unproved component segmentation');
   }else if(!['whole_lexeme','inflection'].includes(r.link_role)||!doc.finite_forms?.includes(r.word))fail('Unproved finite form');
   index.links.push({language:r.language,lemma_id:r.lemma_id,word:r.word,family_id:doc.family_id,head_id:h.id,recognition:'versioned_finite_identity',link_role:r.link_role,...(r.component_segmentation?{component_segmentation:r.component_segmentation,whole_compound_identity_established:false}:{}),identity_proof:r.identity_decision.evidence,boundary_proof:r.boundary_proof,evidence:[{source:r.source_locator,lemma_id:r.lemma_id}],source_references:doc.sources||[],membership_object:'lexical_row_or_component',token_senses_established:false,frequency_status:'aggregate_only_not_sense_frequency',lifecycle_origin:doc.id});
   index.corpus.set(r.language+'\0'+r.lemma_id,r.source_record);appended++;
  }
  if(['extend_forms','extend_links'].includes(doc.operation)&&!appended)fail('Empty lifecycle extension');
  if(doc.operation==='clarify_sense'&&(!doc.sense_clarification||decision.status!==p.edge.status))fail('Sense clarification must preserve identity and verdict');
  // Only identity evidence is reused; the edge always gets a fresh finite decision.
  const revisedHead={...h,version:h.version+1,evidence:[...h.evidence,...doc.evidence],...(doc.sense_clarification?{sense_clarifications:[...(h.sense_clarifications||[]),doc.sense_clarification]}:{}),finite_forms:[...new Set([...(h.finite_forms||[]),...(doc.finite_forms||[])])],predecessor_sha256:p.head_sha256};
  index.heads[index.heads.findIndex(x=>x.id===h.id)]=revisedHead;
  index=applyHeadReview(index,{...decision,head_id:h.id,family_id:doc.family_id,review_stage:doc.id,morphology_policy:'finite_explicit_lemma_ids'});
  const entry={...index.decision_ledger,language:h.language,lifecycle_id:doc.id,operation:doc.operation,predecessor:given,result:lifecyclePredecessor(index,h.id,doc.family_id),new_links:appended,decision_kind:p.edge?'versioned_edge_revision':'new_head_family_decision'};
  ledger.push(entry);newLinks+=appended;if(p.edge)revisions++;else newEdges++;
  for(const id of exact){const k=h.language+'\0'+doc.family_id+'\0'+id;const ck=corpusKey(k);if(seenCorpus.has(ck))repeated++;seenCorpus.add(ck);seenRecords.add(k);reviewed.set(k,entry);latestResolved.set(k,entry.status);}
 }
 index.memberships=generateV6Memberships(index);
 const before=new Map(initial.map(r=>[recordKey(r),r])),after=new Map(index.memberships.map(r=>[recordKey(r),r]));
 const differential={additions:index.memberships.filter(r=>!before.has(recordKey(r))),removals:initial.filter(r=>!after.has(recordKey(r))),version_changes:index.memberships.filter(r=>before.has(recordKey(r))&&!same(r,before.get(recordKey(r)))).map(r=>({before:before.get(recordKey(r)),after:r}))};
 return {index,ledger,differential,metrics:{operations:ledger.length,new_heads:newHeads,new_head_family_decisions:newEdges,revisions,new_finite_links:newLinks,review_incidences:ledger.reduce((n,d)=>n+d.affected_lemma_ids.length,0),repeated_record_reviews:repeated,unique_reviewed_records:seenCorpus.size,unique_head_family_record_reviews:seenRecords.size,lifecycle_unique_records:reviewed.size,lifecycle_unique_resolved_records:[...reviewed.values()].filter(d=>['accepted','excluded'].includes(d.status)).length,unique_resolved_head_family_records:[...latestResolved.values()].filter(status=>['accepted','excluded'].includes(status)).length,unique_resolved_records:new Set([...latestResolved].filter(([,status])=>['accepted','excluded'].includes(status)).map(([k])=>corpusKey(k))).size}};
}
// Restore the original finite heads/edges before independently replaying initial reviews/promotions.
export function restoreLifecycleBase({heads,edges,links,docs}){
 heads=structuredClone(heads);edges=structuredClone(edges);links=structuredClone(links);
 const seenHeads=new Set(),seenEdges=new Set();
 for(const d of docs){if(!seenHeads.has(d.head_id)){heads[heads.findIndex(h=>h.id===d.head_id)]=structuredClone(d.predecessor.head);seenHeads.add(d.head_id);}
  const k=d.head_id+'\0'+d.family_id;if(!seenEdges.has(k)){edges=edges.filter(e=>edgeKey(e)!==k);if(d.predecessor.edge)edges.push(structuredClone(d.predecessor.edge));seenEdges.add(k);}}
 links=links.filter(l=>!docs.some(d=>l.lifecycle_origin===d.id));return {heads,edges,links};
}
