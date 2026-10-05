// Review-only finite partitions. No route deduplication, lemma rewriting or membership API.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const FLAGS=Object.freeze(['semantic_translation_gloss','alias_pool_reuse','unrelated_homonym','suffix_ending','accidental_fragment','proper_name_identity','damaged_spelling','duplicate_routing']);
export const digest=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
export const corpusKey=r=>r.language+'\0'+r.lemma_id;
const sorted=xs=>[...xs].sort();
const unique=xs=>sorted(new Set(xs));
export function partitionReview({incidences,branches,syntheticFixture=false}){
 assert(Array.isArray(incidences)&&Array.isArray(branches));
 incidences=[...incidences].sort((a,b)=>a.incidence_id<b.incidence_id?-1:1);branches=[...branches].sort((a,b)=>a.id<b.id?-1:1);
 const byId=new Map(),byCorpus=new Map(),frameCorpus=new Map();
 for(const row of incidences){
  assert(row.incidence_id&&row.frame&&row.route_id&&row.locator&&row.source_sha256,'Incomplete incidence');
  assert(!byId.has(row.incidence_id),'Duplicate incidence ID');
  assert(row.language&&row.lemma_id&&row.word,'Incomplete corpus identity');
  if(!syntheticFixture)assert(!row.lemma_id.startsWith('synthetic:'),'Synthetic real input');
  assert.equal(row.source_record_sha256,digest(row.source_record),'Stale source record');
  const rec=row.source_record.source_record||row.source_record;
  assert.equal(rec.lemma_id,row.lemma_id,'Wrong source ID');assert.equal(rec.word,row.word,'Wrong source word');
  for(const source of [row.source_record,rec])if(source.language)assert.equal(source.language,row.language,'Wrong source language');
  const savedRoute=row.source_record.route_id||row.source_record.candidate_id;if(savedRoute)assert.equal(savedRoute,row.route_id,'Wrong source route');
  assert.equal(row.incidence_id,'incidence:'+digest([row.frame,row.route_id,row.language,row.lemma_id,row.locator,row.source_sha256]),'Stale incidence ID');
  byId.set(row.incidence_id,row);
  const k=corpusKey(row),prior=byCorpus.get(k)||[];
  assert(prior.every(x=>x.word===row.word),'Conflicting corpus word');
  prior.push(row);byCorpus.set(k,prior);
  const fkey=row.frame+'\0'+k;if(!frameCorpus.has(fkey))frameCorpus.set(fkey,[]);frameCorpus.get(fkey).push(row);
 }
 const branchMap=new Map(),assigned=new Map(),partitions=[];
 for(const b of branches){
  assert(b.id&&b.frame&&!branchMap.has(b.id),'Duplicate or incomplete branch');
  assert.equal(b.membership_authorized,false,'Review cannot authorize membership');assert.equal(b.canonical_approval,false,'Review cannot approve canonical');assert.equal(b.family_id,null,'Research family link forbidden');
  assert(Array.isArray(b.exact_records)&&Array.isArray(b.evidence_ids)&&Array.isArray(b.evidence_gaps),'Incomplete branch proof/scope');
  assert(b.head_scope&&b.review_state&&Array.isArray(b.dictionary_supported_heads));
  assert(b.dictionary_supported_heads.length===0||b.evidence_ids.length>0,'Dictionary head without proof');
  if(b.head_scope==='national_only_research')assert(b.national_forms.every(f=>!f.general_realization_authorized),'National-only general realization');
  for(const flag of b.flags||[])assert(FLAGS.includes(flag),'Unknown flag');
  const keys=[];
  for(const r of b.exact_records){
   assert.equal(r.frame,b.frame,'Wrong branch frame');const k=b.frame+'\0'+corpusKey(r),rows=frameCorpus.get(k);
   assert(rows&&rows.every(x=>x.word===r.word),'Unknown or wrong-ID branch scope');assert(!keys.includes(k),'Repeated branch corpus ID');keys.push(k);
   if(!assigned.has(k))assigned.set(k,[]);assigned.get(k).push(b.id);
  }
  const sourceRows=keys.flatMap(k=>frameCorpus.get(k));
  partitions.push({...b,corpus_ids:unique(sourceRows.map(corpusKey)),incidence_ids:sorted(sourceRows.map(r=>r.incidence_id)),source_payload_hashes:unique(sourceRows.map(r=>r.source_record_sha256)),linguistic_adjudication_created:false,accepted_membership_created:false});branchMap.set(b.id,b);
 }
 // Residual queues remain separate by frame and source route. Equal arrays never merge them.
 const routes=new Map();
 for(const row of incidences){const k=row.frame+'\0'+row.route_id+'\0'+row.language;if(!routes.has(k))routes.set(k,[]);routes.get(k).push(row);}
 for(const[k,rows]of [...routes].sort(([a],[b])=>a<b?-1:1)){
  const residual=rows.filter(r=>!assigned.has(r.frame+'\0'+corpusKey(r)));
  if(residual.length)partitions.push({id:'unresolved:'+digest(k),frame:rows[0].frame,route_id:rows[0].route_id,language:rows[0].language,kind:'unresolved_partition',head_scope:'triage_only',candidate_canonical:null,canonical_approval:false,family_id:null,membership_authorized:false,corpus_ids:unique(residual.map(corpusKey)),incidence_ids:sorted(residual.map(r=>r.incidence_id)),source_payload_hashes:unique(residual.map(r=>r.source_record_sha256)),evidence_gaps:['Individual lexical head, formal history and branch boundary not reviewed.'],review_state:'unreviewed',linguistic_adjudication_created:false,accepted_membership_created:false});
 }
 const flags=[],flagIds=new Set();
 const addFlag=(kind,rows,reason,evidence,certainty='observed_route_property')=>{
  assert(FLAGS.includes(kind)&&reason&&evidence.length,'Incomplete flag evidence');
  const ids=sorted(rows.map(r=>r.incidence_id));
  const f={id:'flag:'+digest([kind,ids,reason]),kind,incidence_ids:ids,corpus_ids:unique(rows.map(corpusKey)),reason,evidence,certainty,effect:'review_priority_and_state_only',creates_exclusion:false,creates_membership:false};
  if(!flagIds.has(f.id)){flags.push(f);flagIds.add(f.id);}
 };
 const groups=new Map();
 for(const[k,rows]of routes){const signature=rows[0].frame+'\0'+rows[0].language+'\0'+digest(unique(rows.map(corpusKey)));if(!groups.has(signature))groups.set(signature,[]);groups.get(signature).push([k,rows]);}
 for(const g of groups.values())if(g.length>1)addFlag('alias_pool_reuse',g.flatMap(x=>x[1]),'Independent route-language pools repeat the same exact corpus set; equality is a warning, not lexical identity.',g.map(x=>({route_id:x[1][0].route_id,source_sha256:x[1][0].source_sha256,corpus_set_sha256:digest(unique(x[1].map(corpusKey)))})));
 for(const rows of frameCorpus.values())if(new Set(rows.map(r=>r.route_id)).size>1)addFlag('duplicate_routing',rows,'One corpus identity has several independent route occurrences; retain every source evidence payload.',rows.map(r=>({locator:r.locator,source_record_sha256:r.source_record_sha256})));
 for(const b of branches){const rows=b.exact_records.flatMap(r=>frameCorpus.get(b.frame+'\0'+corpusKey(r)));
  if(!rows.length)continue;
  for(const kind of b.flags||[])addFlag(kind,rows,'Finite branch '+b.id+': '+b.formal_history,b.evidence_ids.length?b.evidence_ids.map(id=>({evidence_id:id})):b.evidence_gaps.map(reason=>({unresolved_evidence_gap:reason})),b.head_scope==='triage_only'?'suspected_requires_individual_review':'finite_branch_research_not_token_verdict');
 }
 const flagMap=new Map(),flagKinds=new Map(flags.map(f=>[f.id,f.kind]));for(const flag of flags)for(const id of flag.incidence_ids){if(!flagMap.has(id))flagMap.set(id,[]);flagMap.get(id).push(flag.id);}
 const records=[...frameCorpus].sort(([a],[b])=>a<b?-1:1).map(([k,rows])=>{
  const branch_ids=sorted(assigned.get(k)||[]),flag_ids=unique(rows.flatMap(r=>flagMap.get(r.incidence_id)||[]));
  return {frame:rows[0].frame,language:rows[0].language,lemma_id:rows[0].lemma_id,word:rows[0].word,branch_ids,incidence_ids:sorted(rows.map(r=>r.incidence_id)),flag_ids,review_state:flag_ids.length?'contamination_review_required':branch_ids.length?'finite_branch_review_required':'unreviewed',review_priority:100+10*new Set(flag_ids.map(id=>flagKinds.get(id))).size,lexical_identity_proven:false,accepted_membership_created:false,linguistic_exclusion_created:false};
 });
 const covered=new Set(partitions.flatMap(p=>p.incidence_ids));assert.deepEqual(sorted(covered),sorted(byId.keys()),'Partition lost evidence occurrence');
 const metrics={incidences:incidences.length,unique_corpus_ids:byCorpus.size,frame_questions:frameCorpus.size,finite_branches:branches.length,unresolved_partitions:partitions.filter(p=>p.kind==='unresolved_partition').length,branch_annotated_questions:assigned.size,unassigned_questions:frameCorpus.size-assigned.size,overlapping_branch_questions:[...assigned.values()].filter(x=>x.length>1).length,flag_counts:Object.fromEntries(FLAGS.map(k=>[k,flags.filter(f=>f.kind===k).length])),frames:Object.fromEntries(unique(incidences.map(r=>r.frame)).map(frame=>{const rows=incidences.filter(r=>r.frame===frame);return[frame,{incidences:rows.length,unique_ids:new Set(rows.map(corpusKey)).size,unassigned_questions:records.filter(r=>r.frame===frame&&!r.branch_ids.length).length}];})),catalog_promotions:0,accepted_additions:0,accepted_removals:0,linguistic_exclusions_created:0,current_queue_resolutions:0};
 return {schema_version:6,production_enabled:false,synthetic_fixture:syntheticFixture,metrics,source_conservation:{incidence_set_sha256:digest(sorted(byId.keys())),payload_set_sha256:digest(incidences.map(r=>[r.incidence_id,r.source_record_sha256]).sort(([a],[b])=>a<b?-1:1)),corpus_set_sha256:digest(sorted(byCorpus.keys()))},records,partitions:partitions.sort((a,b)=>a.id<b.id?-1:1),flags:flags.sort((a,b)=>a.id<b.id?-1:1),incidences:[...incidences].sort((a,b)=>a.incidence_id<b.incidence_id?-1:1)};
}
