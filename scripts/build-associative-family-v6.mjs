#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {validateCatalog,classifyV5Object,finiteHeadPolicies,normalizeHead,generateV6Memberships} from '../associativvordes/js/associative-family-v6.js';
import {loadLexicalReview,materializeLexicalReviews,reviewBenchmarks} from './lib/associative-v6-lexical-review.mjs';
import {loadBaselineCorrections,replayBaselineCorrections} from './lib/associative-v6-baseline-corrections.mjs';
import {loadHeadLifecycle,replayHeadLifecycle} from './lib/associative-v6-head-lifecycle.mjs';
import {loadFamilyPromotions,materializeFamilyPromotions} from './lib/associative-v6-family-promotion.mjs';
import {regroupCurrentReviewQueues} from './lib/associative-v6-review-queues.mjs';
const source='associativvordes/family-index-v5', config='associativvordes/family-index-v6/catalog.json';
const out=process.argv[2]||'associativvordes/family-index-v6/generated';
if(path.resolve(out)===path.resolve(source)||path.resolve(out).startsWith(path.resolve(source)+path.sep))throw Error('Cannot overwrite immutable v5');
const sha=b=>createHash('sha256').update(b).digest('hex');
const json=b=>JSON.parse(b), read=async p=>{const b=await fs.readFile(p);return json(p.endsWith('.gz')?gunzipSync(b):b);};
const inputs={}, artifacts={}, counts={}, heads=new Map(), edges=new Map(), links=[], corpus=new Map(), prior=[];
const catalog=validateCatalog(await read(config));inputs[config]=sha(await fs.readFile(config));
const corrections=await loadBaselineCorrections({read,readBytes:p=>fs.readFile(p),inputs});
const lifecycle=await loadHeadLifecycle({read,readBytes:p=>fs.readFile(p),inputs});
const promotions=await loadFamilyPromotions({read,readBytes:p=>fs.readFile(p),catalog,inputs});
const review=await loadLexicalReview({read,readBytes:p=>fs.readFile(p),catalog,inputs}),external=new Map(),wanted=new Set(review.doc.finite_bindings.filter(b=>b.decision_kind!=='representation_change').map(b=>b.language+'\0'+b.lemma_id));
const manifest=await read(source+'/manifest.json'), legacy=new Map(catalog.families.flatMap(f=>f.legacy_ids.map(id=>[id,f])));
async function write(p,x){const b=Buffer.from(JSON.stringify(x)+'\n'),v=p.endsWith('.gz')?gzipSync(b,{level:9,mtime:0}):b;await fs.mkdir(path.dirname(out+'/'+p),{recursive:true});await fs.writeFile(out+'/'+p,v);artifacts[p]=sha(v);}
async function files(root){const result=[];for(const e of (await fs.readdir(root,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))){if(e.name.startsWith('.'))continue;const p=root+'/'+e.name;if(e.isDirectory())result.push(...await files(p));else result.push(p);}return result;}
function headId(language,head,sense=''){return 'head:'+language+':'+sha(Buffer.from(language+'\0'+normalizeHead(head)+'\0'+sense)).slice(0,24);}
function bind(m,language,family,p,proof){
 const rb=review.representation.get(language+'\0'+family.id+'\0'+m.lemma_id);
 if(rb){if(rb.word!==m.word)throw Error('Representation word mismatch');p={head:rb.fact.normalized_head,sense:rb.fact.sense,morphology_policy:'finite_reviewed_component_links',source_references:review.doc.evidence_cache.filter(e=>rb.fact.evidence_ids.includes(e.id)).flatMap(e=>e.sources)};}
 const lexical=Boolean(p),id=lexical?headId(language,p.head,p.sense):'head:legacy:'+language+':'+m.lemma_id.slice(6);
 const h=heads.get(id)||{id,language,normalized_head:lexical?normalizeHead(p.head):normalizeHead(m.word),identity_kind:lexical?'lexical_head':'legacy_exact_record',sense:lexical?p.sense:'unresolved_lexical_identity',version:1,evidence:rb?[...review.doc.evidence_cache.filter(e=>rb.fact.evidence_ids.includes(e.id)),...rb.identity_proof]:[]};
 const ev={source:proof,lemma_id:m.lemma_id};h.evidence.push(ev);heads.set(id,h);
 const k=id+'\0'+family.id,e=edges.get(k)||{head_id:id,family_id:family.id,status:'accepted',scope:lexical?'finite_evidenced_links':'exact_lemma_only',morphology_policy:lexical?p.morphology_policy:'no_propagation',version:1,evidence:[],lemma_ids:[]};
 e.evidence.push(ev);e.lemma_ids.push(m.lemma_id);edges.set(k,e);
 links.push({language,lemma_id:m.lemma_id,word:m.word,head_id:id,family_id:family.id,recognition:rb?'reviewed_component_head':lexical?'explicit_finite_policy':'inherited_exact_record_proof',...(rb?{link_role:rb.link_role,identity_fact_id:rb.fact_id,identity_proof:rb.identity_proof,component_segmentation:rb.component_segmentation,whole_compound_identity_established:false}:{}),evidence:[ev],source_references:p?.source_references||[]});
 corpus.set(language+'\0'+m.lemma_id,m);prior.push({language,family_id:family.id,legacy_family_id:family.legacy_ids[0],lemma_id:m.lemma_id,word:m.word});
}
let totalObjects=0,totalMemberships=0,sourceComponentsReferenced=0;const unique=Object.fromEntries(manifest.languages.map(l=>[l,new Set()]));
const dupHashes=new Map(),duplicates=[],valMembers=new Map(),valLedger=await read('audit/associative-family-v5/val-and-ru-short-decisions-20260930.json'),valIds=new Set(valLedger.val.retained_targets.map(v=>typeof v==='string'?v:v.family_id));
for(const b of manifest.buckets.families){
 const p=source+'/families/'+b+'.json.gz',bytes=await fs.readFile(p);inputs[p]=sha(bytes);const families=json(gunzipSync(bytes));const inventory=[],sets=new Map(),ordered=new Map();
 for(const language of manifest.languages){
  const mp=source+'/members/'+language+'/'+b+'.json.gz';const mb=await fs.readFile(mp);inputs[mp]=sha(mb);const rows=json(gunzipSync(mb));
  for(const [id,ms]of Object.entries(rows)){
   if(!families[id])throw Error('Dangling v5 source family '+id);totalMemberships+=ms.length;
   const keys=sets.get(id)||[],hash=ordered.get(id)||createHash('sha256');
   for(const m of ms){const k=language+'\0'+m.lemma_id;unique[language].add(m.lemma_id);keys.push(k);hash.update(JSON.stringify([language,m])+'\n');sourceComponentsReferenced+=m.components.length;
    if(wanted.has(k)&&!external.has(k))external.set(k,{m,language,proof:{path:mp,family_id:id,record_sha256:sha(Buffer.from(JSON.stringify(m)))}});
    if(legacy.has(id)){const f=legacy.get(id),policies=finiteHeadPolicies(catalog,language,f.id,m.word);bind(m,language,f,policies.length===1?policies[0]:null,{path:mp,family_id:id,record_sha256:sha(Buffer.from(JSON.stringify(m)))});}
   }
   sets.set(id,keys);ordered.set(id,hash);
  }
 }
 for(const [id,f]of Object.entries(families).sort(([a],[b])=>a.localeCompare(b,'en'))){
  const c=classifyV5Object(f,catalog);counts[c.kind]=(counts[c.kind]||0)+1;totalObjects++;inventory.push([id,c.kind,c.family_id]);
  const keys=sets.get(id)||[],setHash=sha(Buffer.from(JSON.stringify([...new Set(keys)].sort()))),orderedHash=ordered.get(id)?.digest('hex')||sha(Buffer.alloc(0));
  if(keys.length){const priorId=dupHashes.get(setHash);if(priorId)duplicates.push({left:priorId,right:id,exact_member_set_sha256:setHash,ordered_member_records_sha256:orderedHash,action:'review_only_no_merge'});else dupHashes.set(setHash,id);}
  if(valIds.has(id))valMembers.set(id,{family:f,keys:new Set(keys),ordered_member_records_sha256:orderedHash,member_set_sha256:setHash});
 }
 await write('inventory/'+b+'.json.gz',inventory);
 if(parseInt(b,16)%32===0)console.error('v6 migration bucket '+b+'; '+totalObjects+' objects');
}
for(const name of ['manifest.json','report.json','repository-provenance.json'])inputs[source+'/'+name]=sha(await fs.readFile(source+'/'+name));
for(const p of await files(source+'/aliases'))inputs[p]=sha(await fs.readFile(p));
// All historical decisions and source arrays remain available through frozen references.
for(const root of ['audit/associative-family-v5','associativvordes/frequency lists'])for(const p of await files(root))inputs[p]=sha(await fs.readFile(p));
const uniqueCounts=Object.fromEntries(Object.entries(unique).map(([l,s])=>[l,s.size]));
const integrity=await read('audit/associative-family-v5/repository-static-integrity.json');
if(totalObjects!==manifest.counts.families||totalMemberships!==integrity.counts.memberships||Object.values(uniqueCounts).reduce((a,b)=>a+b,0)!==integrity.counts.materialized_unique_lemmas)throw Error('Incomplete migration scan');
// Reusable historical lexical-head edges, including finite negative propagation.
const imported=[];
for(const p of Object.keys(inputs).filter(p=>p.startsWith('audit/associative-family-v5/')&&/decisions\.json(?:\.gz)?$/.test(p))){
 const doc=await read(p);const visit=(x,context={})=>{if(Array.isArray(x)){for(const y of x)visit(y,context);return;}if(!x||typeof x!=='object')return;
  if(x.lexical_head&&x.lemma_id){const language=x.language||context.language,root=x.canonical_root||x.root||context.root;if(language&&root&&legacy.has('family:'+root)&&['accepted','excluded','uncertain','pending_review'].includes(x.status))imported.push({language,root,head:x.lexical_head,status:x.status==='pending_review'?'pending':x.status,lemma_id:x.lemma_id,word:x.word,reason:x.reason,source_references:x.source_references||[],source:p});}
  for(const[k,v]of Object.entries(x))if(v&&typeof v==='object')visit(v,{...context,...(manifest.languages.includes(k)?{language:k}:{}),...(catalog.families.some(f=>f.canonical===k)?{root:k}:{})});};visit(doc);
}
const importedGroups=new Map();for(const r of imported){const id=headId(r.language,r.head,'historical_review'),key=id+'\0family:'+r.root,g=importedGroups.get(key)||{id,records:[]};if(!g.records.some(x=>x.lemma_id===r.lemma_id&&x.status===r.status&&x.source===r.source))g.records.push(r);importedGroups.set(key,g);}
for(const g of importedGroups.values()){const r=g.records[0],statuses=new Set(g.records.map(x=>x.status)),status=statuses.size===1?r.status:'uncertain';heads.set(g.id,{id:g.id,language:r.language,normalized_head:normalizeHead(r.head),identity_kind:'historically_reviewed_lexical_head',sense:'historical_review',version:1,evidence:g.records});edges.set(g.id+'\0family:'+r.root,{head_id:g.id,family_id:'family:'+r.root,status,scope:'historical_review_finite_records',version:1,evidence:g.records,lemma_ids:[...new Set(g.records.map(x=>x.lemma_id))],morphology_policy:'finite_explicit_lemma_ids',conflicting_historical_verdicts:statuses.size>1});}
const baselineMemberships=generateV6Memberships({catalog,heads:[...heads.values()],edges:[...edges.values()],links,corpus});
if(baselineMemberships.length!==prior.length)throw Error('Lost manually accepted membership');
const {backlog,frames,unregrouped_frames}=await regroupCurrentReviewQueues({read,imported,headId});
const materialized=materializeLexicalReviews({index:{catalog,heads:[...heads.values()],edges:[...edges.values()],links,corpus,memberships:baselineMemberships},review,external,headId,prior,sourceQueue:backlog});
const promoted=materializeFamilyPromotions({index:materialized.index,promotions,headId});
const evolved=replayHeadLifecycle({index:promoted.index,docs:lifecycle,initialLedger:[...materialized.ledger,...promoted.ledger]});
const corrected=replayBaselineCorrections({index:evolved.index,docs:corrections,baseline:baselineMemberships});
const memberships=corrected.index.memberships;
heads.clear();for(const h of evolved.index.heads)heads.set(h.id,h);edges.clear();for(const e of evolved.index.edges)edges.set(e.head_id+'\0'+e.family_id,e);
const queueKeys=new Set(backlog.map(r=>r.language+'\0family:'+r.canonical_root+'\0'+r.lemma_id));
const queueLedger=[...materialized.ledger,...evolved.ledger.filter(d=>d.affected_lemma_ids.some(id=>queueKeys.has(d.language+'\0'+d.family_id+'\0'+id)))];
const regrouped=reviewBenchmarks({backlog,frames,review,ledger:queueLedger,headId}),ranked=regrouped.ranked;
const priorKeys=new Set(prior.map(r=>r.language+'\0'+r.family_id+'\0'+r.lemma_id));
const promotionKeys=new Set(promoted.additions.map(r=>r.language+'\0'+r.family_id+'\0'+r.lemma_id));
const additions=promoted.index.memberships.filter(r=>!priorKeys.has(r.language+'\0'+r.family_id+'\0'+r.lemma_id)&&!promotionKeys.has(r.language+'\0'+r.family_id+'\0'+r.lemma_id));
const allowed=new Set(materialized.ledger.filter(d=>d.status==='accepted').flatMap(d=>d.affected_lemma_ids.map(id=>d.language+'\0'+d.family_id+'\0'+id)));
if(additions.length!==allowed.size||additions.some(r=>!allowed.has(r.language+'\0'+r.family_id+'\0'+r.lemma_id))||promoted.index.memberships.filter(r=>priorKeys.has(r.language+'\0'+r.family_id+'\0'+r.lemma_id)).length!==prior.length)throw Error('Unexpected lexical-review differential');
const correctionKeys=new Set(corrected.index.correction_verdicts.map(r=>r.language+'\0'+r.family_id+'\0'+r.lemma_id));
const diff=prior.map(r=>({...r,status:correctionKeys.has(r.language+'\0'+r.family_id+'\0'+r.lemma_id)?'historical_acceptance_currently_corrected':'preserved',reason:r.legacy_family_id===r.family_id?'exact_manual_membership_preserved':'documented_canonical_pede_to_ped_migration'}));
const acceptedCounts={};for(const m of memberships)acceptedCounts[m.family_id]=(acceptedCounts[m.family_id]||0)+1;
const valTargets=[...valMembers].map(([id,v])=>({legacy_id:id,kind:id.startsWith('surface:')?'surface_component_candidate':'etymological_evidence_cluster',family_id:null,canonical_proposal:v.family.canonical,status:'proposal_requires_review',etymon_keys:v.family.etymon_keys||[],members:v.keys.size,member_set_sha256:v.member_set_sha256,ordered_member_records_sha256:v.ordered_member_records_sha256,reason:'Alias val preserves a candidate route, not family identity.'}));
if(valTargets.length!==15)throw Error('Incomplete val quarantine');
const valOverlap=[];for(let i=0;i<valTargets.length;i++)for(let j=i+1;j<valTargets.length;j++){const a=valMembers.get(valTargets[i].legacy_id).keys,b=valMembers.get(valTargets[j].legacy_id).keys,intersection=[...a].filter(k=>b.has(k)).length;valOverlap.push({left:valTargets[i].legacy_id,right:valTargets[j].legacy_id,intersection,jaccard:intersection/(a.size+b.size-intersection||1),action:'review_only'});}
for(const p of ['scripts/build-associative-family-v6.mjs','scripts/lib/associative-v6-review-queues.mjs','associativvordes/js/associative-family-v6.js','associativvordes/family-index-v6/schema.json','scripts/lib/associative-v6-lexical-review.mjs','scripts/lib/associative-v6-family-promotion.mjs','scripts/lib/associative-v6-head-lifecycle.mjs','scripts/lib/associative-v6-baseline-corrections.mjs','associativvordes/js/associative-family-v6-head-recognition.js'])inputs[p]=sha(await fs.readFile(p));
await write('review-queue-frames.json',{frames,unregrouped_frames,source_distinct_records:backlog.length,distinct_current_records:regrouped.active.length,active_records_by_frame:regrouped.benchmarks.map(b=>({frame:b.frame,records:b.records_after}))});
await write('baseline-memberships.json.gz',baselineMemberships);
await write('baseline-correction-ledger.json',{decisions:corrected.ledger,metrics:corrected.metrics,differential:corrected.differential});
await write('correction-verdicts.json.gz',corrected.index.correction_verdicts);
await write('head-lifecycle-ledger.json',{decisions:evolved.ledger,metrics:evolved.metrics,differential:evolved.differential});
await write('family-promotion-ledger.json',{decisions:promoted.ledger,metrics:promoted.metrics});await write('head-review-ledger.json',materialized.ledger);await write('head-recognition-benchmarks.json.gz',regrouped.benchmarks);await write('head-review-metrics.json',regrouped.metrics);
await write('reflexes.json',catalog.families.flatMap(f=>f.reflexes));
await write('heads.json.gz',[...heads.values()].sort((a,b)=>a.id.localeCompare(b.id,'en')));await write('edges.json.gz',[...edges.values()].sort((a,b)=>(a.head_id+a.family_id).localeCompare(b.head_id+b.family_id,'en')));await write('lemma-head-links.json.gz',evolved.index.links);await write('memberships.json.gz',memberships);await write('differential.json.gz',{correction_differential:corrected.differential,lifecycle_differential:evolved.differential,manual_memberships:diff,family_promotion_additions:promoted.additions,accepted_membership_additions:additions.map(r=>({...r,reason:'accepted_membership_addition',decision:materialized.ledger.find(d=>d.language===r.language&&d.family_id===r.family_id&&d.affected_lemma_ids.includes(r.lemma_id))})),head_grouping_representation_changes:review.doc.finite_bindings.filter(b=>b.decision_kind==='representation_change'),linguistic_exclusions:materialized.ledger.filter(d=>d.status==='excluded'),unexpected_additions:[],unexpected_removals:[],technical_demotion_is_not_lexical_exclusion:true});await write('review-backlog.json.gz',ranked);await write('duplicate-candidates.json.gz',duplicates);await write('val-candidates.json',{targets:valTargets,overlap:valOverlap});await write('source-lock.json',inputs);
const lexical=heads.size-[...heads.values()].filter(h=>h.identity_kind==='legacy_exact_record').length,lexicalLinks=links.filter(l=>l.recognition==='explicit_finite_policy').length;
await write('migration-report.json',{schema_version:6,source_head:catalog.source_head,source_run_id:35647932153,production_enabled:false,classification_counts:counts,classified_objects:totalObjects,corpus_lemmas_declared:manifest.counts.lemmas,materialized_corpus_ids_enumerated:uniqueCounts,corpus_records_without_v5_membership:integrity.counts.lemmas_without_materialized_family,zero_membership_corpus_policy:'retained_frequency_sources_not_reconstructed_measurements',source_component_count_declared:manifest.counts.components,component_records_referenced:sourceComponentsReferenced,evidence_preserved_by_source_lock:true,true_associative_families:catalog.families.length,baseline_correction_metrics:corrected.metrics,historical_baseline_memberships:baselineMemberships.length,head_lifecycle_metrics:evolved.metrics,family_promotion_metrics:promoted.metrics,lexical_heads:lexical,legacy_exact_record_units:heads.size-lexical,head_family_edges:edges.size,generated_lemma_memberships:memberships.length,accepted_memberships_by_family:acceptedCounts,finite_policy_lemma_links:lexicalLinks,finite_policy_head_edges:[...edges.values()].filter(e=>e.scope==='finite_evidenced_links').length,review_unit_count:ranked.length,pending_or_uncertain_source_records:regrouped.active.length,source_pending_or_uncertain_records:backlog.length,manual_review_reduction_factor:regrouped.metrics.strict_remaining_frame_reduction,new_review_reduction_factor:regrouped.metrics.new_review_reduction_factor,head_review_metrics:regrouped.metrics,tenfold_review_reduction_demonstrated:false,duplicate_candidates:duplicates.length,duplicate_policy:'no_automatic_merge',unexpected_differences:0,source_files_locked:Object.keys(inputs).length,full_linguistic_certification:false,remaining_work:['Establish lexical heads for unresolved exact-record units; do not infer them from morphology guesses.','Source corpus enumeration is complete; preserve its independently proven 4,924,980 IDs and 829 zero-v5-membership records.','Complete loc/nat/inter historical queue reconciliation, RU short-root edge reviews and promotion beyond the explicit catalog.','Review canonical promotions and val branches; no automatic name promotion.','Measure reduction after additional evidenced head grouping; no tenfold claim yet.']});
await fs.writeFile(out+'/manifest.json',JSON.stringify({schema_version:6,catalog:config,catalog_sha256:inputs[config],source_head:catalog.source_head,production_enabled:false,artifacts},null,2)+'\n');
console.log(JSON.stringify({generated_memberships:memberships.length,objects:totalObjects,heads:heads.size,lexical_heads:lexical,output:out}));
