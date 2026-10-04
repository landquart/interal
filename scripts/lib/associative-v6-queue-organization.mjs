// Planning only. Identity proofs never settle another family question.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const digest=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
export const corpusKey=r=>r.language+'\0'+r.lemma_id;
export const candidateKey=r=>corpusKey(r)+'\0'+r.root;
const sorted=xs=>[...new Set(xs)].sort();
export function identityGrade(head,link) {
 if(head.identity_kind==='legacy_exact_record')return 'morphology_proposal';
 if(head.identity_kind==='historically_reviewed_lexical_head')return 'disputed_identity';
 if(link?.recognition==='explicit_finite_policy'||link?.identity_proof?.length||link?.recognition==='reviewed_component_head')return 'proven_identity';
 return 'morphology_proposal';
}
export function organize({occurrences,cache,packetRoutes=[],packets=[]}) {
 const facts=new Map(cache.map(f=>[f.head_id,f]));assert.equal(facts.size,cache.length,'Duplicate cache identity');
 const records=new Map(),questions=new Map(),ids=new Set();
 for(const o of occurrences){
  assert(o.language&&o.lemma_id&&o.word&&o.locator&&o.frame,'Incomplete source occurrence');
  assert(!ids.has(o.occurrence_id),'Repeated occurrence identity');ids.add(o.occurrence_id);
  const k=corpusKey(o),r=records.get(k)||{corpus_id:k,language:o.language,lemma_id:o.lemma_id,word:o.word,occurrences:[],family_questions:[],identity_references:[]};
  assert.equal(r.word,o.word,'Corpus ID word conflict');r.occurrences.push(o);records.set(k,r);
  if(o.root){const qk=candidateKey(o),q=questions.get(qk)||{candidate_id:qk,corpus_id:k,root:o.root,occurrence_ids:[],head_ids:[],current_statuses:[],open_frames:[]};q.occurrence_ids.push(o.occurrence_id);q.head_ids.push(...(o.head_ids||[]));if(o.frame==='current')q.current_statuses.push(o.status);
   const open=(o.frame==='current'&&['pending','pending_review','uncertain'].includes(o.status))||(o.frame==='historical'&&['unresolved_historical_without_current_decision','investigated_uncertain_current_overlay'].includes(o.status))||['val','russian','promotion_pool'].includes(o.frame)||(o.frame==='historical_identity'&&o.status==='uncertain');
   if(open)q.open_frames.push(o.frame);questions.set(qk,q);r.family_questions.push(qk);}
 }
 const packetIndex=new Map(packets.flatMap(p=>p.evidence_cluster_ids.map(id=>[id,p.candidate_cluster_id])));
 for(const p of packetRoutes){const r=records.get(corpusKey(p));assert(r,'Out-of-scope packet ID');if(p.word)assert.equal(p.word,r.word,'Packet corpus word conflict');assert(packetIndex.has(p.route_id),'Unknown packet predecessor');(r.packet_routes??=[]).push({...p,packet_id:packetIndex.get(p.route_id)});}
 const bindings=new Map();
 for(const f of cache)for(const l of f.finite_scope){const k=corpusKey(l);if(!records.has(k))continue;const arr=bindings.get(k)||[];arr.push({head_id:f.head_id,grade:l.identity_grade,root:l.family_id?.replace(/^family:/,''),boundary:l.component_segmentation||null,proof_locator:l.proof_locator});bindings.set(k,arr);}
 const groups=new Map();
 for(const q of questions.values()){
  const refs=(bindings.get(q.corpus_id)||[]).filter(b=>b.root===q.root);q.head_ids=sorted([...q.head_ids,...refs.map(b=>b.head_id)]);q.current_statuses=sorted(q.current_statuses);q.open_frames=sorted(q.open_frames);
  const proven=refs.filter(b=>b.grade==='proven_identity');
  // Multiple components are independent finite tasks, never overwritten by a single winner.
  const knownHeads=q.head_ids.filter(id=>facts.has(id));
  const choices=proven.length?sorted(proven.map(b=>b.head_id)):knownHeads.length?knownHeads:[null];
  for(const head of choices){const grade=proven.some(b=>b.head_id===head)?'proven_identity':head?'disputed_identity':'morphology_proposal',key=head?head+'\0'+q.root:'proposal:'+q.candidate_id;
   const g=groups.get(key)||{group_id:key,head_id:head,root:q.root,identity_grade:grade,candidate_ids:[],corpus_ids:[],open_candidate_ids:[],current_open_candidate_ids:[],open_frames:[],boundary_review_cost:0,edge_decisions:[],accepted_membership_created:false};
   g.candidate_ids.push(q.candidate_id);g.corpus_ids.push(q.corpus_id);if(q.current_statuses.some(s=>['pending','pending_review','uncertain'].includes(s)))g.current_open_candidate_ids.push(q.candidate_id);if(q.open_frames.length){g.open_candidate_ids.push(q.candidate_id);g.open_frames.push(...q.open_frames);}groups.set(key,g);
  }
 }
 const ranked=[...groups.values()].map(g=>{g.candidate_ids=sorted(g.candidate_ids);g.corpus_ids=sorted(g.corpus_ids);g.open_candidate_ids=sorted(g.open_candidate_ids);g.current_open_candidate_ids=sorted(g.current_open_candidate_ids);g.open_frames=sorted(g.open_frames);const f=facts.get(g.head_id);g.edge_decisions=f?.family_decisions.filter(e=>e.family_id==='family:'+g.root)||[];
  g.finite_fanout=g.candidate_ids.length;g.evidence_confidence=g.identity_grade==='proven_identity'?1:g.identity_grade==='disputed_identity'?0.25:0;
  g.boundary_review_cost=g.identity_grade==='proven_identity'?1:g.finite_fanout;g.priority=g.open_candidate_ids.length*g.evidence_confidence/g.boundary_review_cost;
  g.research_reuse_references=f?{head_id:f.head_id,version:f.version,independent_family_questions:sorted((bindings.get(g.corpus_ids[0])||[]).map(b=>b.root))}:null;return g;
 }).sort((a,b)=>b.priority-a.priority||b.open_candidate_ids.length-a.open_candidate_ids.length||a.group_id.localeCompare(b.group_id,'en'));
 for(const r of records.values()){r.family_questions=sorted(r.family_questions);r.identity_references=bindings.get(r.corpus_id)||[];}
 const before={corpus_ids:sorted(occurrences.map(corpusKey)),membership_candidates:sorted(occurrences.filter(o=>o.root).map(candidateKey)),route_occurrences:sorted(occurrences.map(o=>o.occurrence_id)),source_route_references:sorted(occurrences.flatMap(o=>(o.routes||[]).map(route=>o.occurrence_id+'\0'+route))),packet_route_occurrences:sorted(packetRoutes.map(r=>r.locator||corpusKey(r)+'\0'+r.route_id))};
 const after={corpus_ids:sorted(records.keys()),membership_candidates:sorted(ranked.flatMap(g=>g.candidate_ids)),route_occurrences:sorted([...records.values()].flatMap(r=>r.occurrences.map(o=>o.occurrence_id))),source_route_references:sorted([...records.values()].flatMap(r=>r.occurrences.flatMap(o=>(o.routes||[]).map(route=>o.occurrence_id+'\0'+route)))),packet_route_occurrences:sorted([...records.values()].flatMap(r=>(r.packet_routes||[]).map(p=>p.locator||corpusKey(p)+'\0'+p.route_id)))};
 assert.deepEqual(after,before,'Lost IDs during regroup');
 const current=occurrences.filter(o=>o.frame==='current'),currentKeys=sorted(current.map(candidateKey)),provenCurrent=ranked.filter(g=>g.identity_grade==='proven_identity'&&g.current_open_candidate_ids.length);
 const covered=new Set(provenCurrent.flatMap(g=>g.current_open_candidate_ids)),units=provenCurrent.length+currentKeys.filter(k=>!covered.has(k)).length;
 const frames=sorted(occurrences.map(o=>o.frame)),sets=Object.fromEntries(frames.map(f=>[f,new Set(occurrences.filter(o=>o.frame===f).map(corpusKey))]));
 sets.historical_unresolved=new Set(occurrences.filter(o=>o.frame==='historical'&&o.status==='unresolved_historical_without_current_decision').map(corpusKey));
 sets.packet_referenced=new Set(packetRoutes.map(corpusKey));
 const overlaps=[];for(const[a,sa]of Object.entries(sets))for(const[b,sb]of Object.entries(sets))if(a<b){const exact=sorted([...sa].filter(k=>sb.has(k)));overlaps.push({a,b,corpus_ids:exact,count:exact.length,exact_set_sha256:digest(exact)});}
 const metrics={corpus_ids:records.size,membership_candidates:questions.size,route_incidences:occurrences.length,packet_route_incidences:packetRoutes.length,proven_groups:ranked.filter(g=>g.identity_grade==='proven_identity').length,disputed_groups:ranked.filter(g=>g.identity_grade==='disputed_identity').length,proposal_groups:ranked.filter(g=>g.identity_grade==='morphology_proposal').length,current_membership_candidates:currentKeys.length,current_proven_units:units,current_proven_reduction:currentKeys.length-units,new_memberships:0,new_verdicts:0,packet_count:packets.length,open_membership_questions:questions.size?[...questions.values()].filter(q=>q.open_frames.length).length:0};
 return {records:[...records.values()].sort((a,b)=>a.corpus_id.localeCompare(b.corpus_id,'en')),questions:[...questions.values()].sort((a,b)=>a.candidate_id.localeCompare(b.candidate_id,'en')),ranked,overlaps,metrics,conservation:{before,after,added:[],removed:[],verdict:'pass'}};
}
