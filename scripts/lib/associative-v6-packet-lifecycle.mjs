// Finite review overlay. Packet grouping and state never establish lexical identity.
export const packetStates=Object.freeze(['unreviewed','research_in_progress','split','rejected_with_scope','deferred_with_evidence_blocker','partially_promoted','promoted_finite_frame']);
const key=r=>r.language+'\0'+r.lemma_id,fail=s=>{throw Error(s);};
export function reviewPacketLifecycle({packets,routeScopes,events,proofs,acceptedMemberships,allowSynthetic=false}){
 if(!allowSynthetic&&packets.some(p=>p.synthetic_fixture))fail('Synthetic packet in real workflow');
 const known=new Map(packets.map(p=>[p.candidate_cluster_id,p])),scopes=new Map(routeScopes.map(s=>[s.packet_id,s])),seen=new Set(),states=new Map();
 if(known.size!==packets.length||scopes.size!==routeScopes.length)fail('Duplicate packet scope');
 const accepted=new Set(acceptedMemberships.map(r=>r.family_id+'\0'+key(r)));
 for(const e of events){
  if(!e.id||seen.has(e.id)||!known.has(e.packet_id)||!packetStates.includes(e.state))fail('Unknown or duplicate lifecycle event');seen.add(e.id);
  const p=known.get(e.packet_id),s=scopes.get(e.packet_id);if(!s)fail('Missing measured scope');
  const old=states.get(e.packet_id)||{version:0,branches:new Map(),history:[]};
  if(e.expected_version!==old.version||!e.branch_id||!e.reason||!e.evidence?.length||e.membership_authorized!==false)fail('Stale or unauthorized review');
  if(!e.corpus_keys?.length||new Set(e.corpus_keys).size!==e.corpus_keys.length||!e.route_ids?.length)fail('Missing finite subset');
  const routes=s.routes.filter(r=>e.route_ids.includes(r.route_id));if(routes.length!==e.route_ids.length||!routes.every(r=>p.evidence_cluster_ids.includes(r.route_id)))fail('Wrong source route');
  const scoped=new Set(routes.flatMap(r=>r.corpus_keys));if(e.corpus_keys.some(k=>!scoped.has(k)))fail('Invented source ID');
  if(e.state==='deferred_with_evidence_blocker'&&!e.evidence_blocker)fail('Missing evidence blocker');
  if(e.state==='rejected_with_scope'&&e.exclusion_created!==false)fail('Review cannot create exclusion');
  const prior=old.branches.get(e.branch_id);if(prior&&prior.corpus_keys.some(k=>!e.corpus_keys.includes(k)))fail('Dropped prior evidence');
  if(['partially_promoted','promoted_finite_frame'].includes(e.state)){
   const d=proofs.get(e.decision_path);if(!d||!d.traceability_verified||d.synthetic_fixture&&!allowSynthetic||d.canonical_status!=='accepted'||d.identity_status!=='accepted'||d.family_edge_status!=='accepted')fail('Missing independent approvals');
   if(d.family_id!==e.family_id)fail('Wrong family');const bindings=new Set(d.bindings.map(key));
   for(const k of e.corpus_keys)if(!bindings.has(k)||!accepted.has(e.family_id+'\0'+k))fail('Unmaterialized finite binding');
  }else if(e.family_id||e.decision_path)fail('Research cannot claim a family');
  old.branches.set(e.branch_id,{...e});old.history.push(e.id);old.version++;states.set(e.packet_id,old);
 }
 return packets.map(p=>{const s=scopes.get(p.candidate_cluster_id),x=states.get(p.candidate_cluster_id),branches=x?[...x.branches.values()].sort((a,b)=>a.branch_id.localeCompare(b.branch_id,'en')):[],all=new Set(s?.routes.flatMap(r=>r.corpus_keys)||[]),reviewed=new Set(branches.flatMap(b=>b.corpus_keys)),promoted=new Set(branches.filter(b=>['partially_promoted','promoted_finite_frame'].includes(b.state)).flatMap(b=>b.corpus_keys));return {packet_id:p.candidate_cluster_id,version:x?.version||0,state:promoted.size?(promoted.size===all.size?'promoted_finite_frame':'partially_promoted'):branches.length>1?'split':branches[0]?.state||'unreviewed',measured_scope:!!s,source_routes:p.evidence_cluster_ids,branches,history:x?.history||[],unique_source_ids:all.size,unassigned_corpus_keys:[...all].filter(k=>!reviewed.has(k)).sort(),promoted_finite_keys:[...promoted].sort(),source_ids_deleted:[],family_identity_from_packet:false,membership_authorized:false};});
}
