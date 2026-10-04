#!/usr/bin/env node
// A bounded planning view of saved frames; no membership writes or clustering.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gzipSync,gunzipSync} from 'node:zlib';
import {digest,corpusKey,identityGrade,organize,routeOccurrenceId} from './lib/associative-v6-queue-organization.mjs';
const root='audit/associative-family-v6/',gen='associativvordes/family-index-v6/generated/';
const planningPath='associativvordes/family-index-v6/queue-planning.json',planningBytes=await fs.readFile(planningPath),planning=JSON.parse(planningBytes);assert.equal(planning.schema_version,6);assert.equal(planning.production_enabled,false);
const out=process.argv.slice(2).find(a=>!a.startsWith('--'))||planning.output,measure=process.argv.includes('--measure-packet-links');
assert(!path.resolve(out).startsWith(path.resolve('associativvordes/family-index-v5')),'Immutable v5 output');
const writeAtomic=async(p,b)=>{await fs.writeFile(p+'.tmp',b);await fs.rename(p+'.tmp',p);};
const inputs={[planningPath]:digest(planningBytes)},read=async p=>{const b=await fs.readFile(p);inputs[p]=digest(b);return JSON.parse(p.endsWith('.gz')?gunzipSync(b):b);};
const occurrences=[],add=(frame,locator,r,root,status,head_ids=[],routes=[],version=null)=>occurrences.push({occurrence_id:routeOccurrenceId({frame,locator,language:r.language,lemma_id:r.lemma_id,root,head_ids,source:r.source,version}),frame,locator,language:r.language,lemma_id:r.lemma_id,word:r.word,root:root||null,status:status||'proposal_requires_review',head_ids,routes});
const backlog=await read(gen+'review-backlog.json.gz'),frames=await read(gen+'review-queue-frames.json'),benchmarks=await read(gen+'head-recognition-benchmarks.json.gz');
for(const[u,unit]of backlog.entries())for(const[i,r]of unit.source_records.entries())add('current',gen+'review-backlog.json.gz#/'+u+'/source_records/'+i,r,r.canonical_root||r.root,r.status,r.review_unit?.startsWith('head:')?[r.review_unit]:[],r.source_family_ids||r.family_ids||[]);
const historicalPath=root+'historical-overlay-20261003/records.json.gz',historical=await read(historicalPath);
const historicalCandidates=await read('audit/associative-family-v5/component-checkpoint-20261001/candidate-records.json.gz');
const historicalSource=new Map();for(const[root,langs]of Object.entries(historicalCandidates))for(const[language,rs]of Object.entries(langs))for(const r of rs)historicalSource.set(language+'\0'+r.lemma_id+'\0'+root,r);
for(const[i,r]of historical.entries())add('historical',historicalPath+'#/'+i,r,r.root,r.current_disposition,r.head_id?[r.head_id]:[],historicalSource.get(corpusKey(r)+'\0'+r.root)?.family_ids||[]);
for(const[name,p]of [['val',root+'val-route-review-20261003/records.json.gz'],['russian',root+'russian-short-review-20261003/records.json.gz']]){
 const rs=await read(p);for(const[i,r]of rs.entries()){const rec=r.source_record?{...r.source_record,language:r.language}:r;add(name,p+'#/'+i,rec,name==='val'?'val':r.candidate_id.split(':').at(-1),r.linguistic_membership_status||'proposal_requires_review',[],[r.route_id||r.candidate_id]);}
}
const packets=await read(root+'candidate-root-clusters-20261003/clusters.json.gz');
const heads=await read(gen+'heads.json.gz'),edges=await read(gen+'edges.json.gz'),links=await read(gen+'lemma-head-links.json.gz');
const edgeMap=new Map(edges.map(e=>[e.head_id+'\0'+e.family_id,e]));
const headMap=new Map(heads.map(h=>[h.id,h])),linkMap=new Map(links.map(l=>[l.head_id+'\0'+l.family_id+'\0'+l.lemma_id,l]));
const review=await read('associativvordes/family-index-v6/lexical-head-review.json.gz');
const cache=heads.filter(h=>h.identity_kind!=='legacy_exact_record').map(h=>({head_id:h.id,language:h.language,normalized_head:h.normalized_head,sense:h.sense,version:h.version,identity_kind:h.identity_kind,sources:h.evidence,evidence_type:h.identity_kind==='lexical_head'?'finite_identity_and_boundary_proofs':'historical_identity_requires_revalidation',finite_scope:[],family_decisions:[],versions:[{version:h.version,state_sha256:digest(h),snapshot:h}],family_membership_propagates:false}));
const cacheMap=new Map(cache.map(f=>[f.head_id,f]));
for(const[i,l]of links.entries()){
 const e=edgeMap.get(l.head_id+'\0'+l.family_id);assert(e);
 add('materialized',gen+'lemma-head-links.json.gz#/'+i,l,l.family_id.replace(/^family:/,''),e.status,[l.head_id],l.evidence.flatMap(e=>typeof e.source==='object'?[e.source.family_id]:[]));
}
for(const[eidx,e]of edges.entries()){
 const h=headMap.get(e.head_id),f=cacheMap.get(e.head_id);if(!f)continue;
 f.family_decisions.push({...e,proof_locator:gen+'edges.json.gz#/'+eidx});
 for(const[ididx,id]of e.lemma_ids.entries()){
  const l=linkMap.get(e.head_id+'\0'+e.family_id+'\0'+id),saved=h.evidence.find(r=>r.lemma_id===id&&r.word),rec=l||saved;
  assert(rec,'Unaddressable finite identity '+id);
  f.finite_scope.push({language:h.language,lemma_id:id,word:rec.word,family_id:e.family_id,identity_grade:identityGrade(h,l),proof_locator:l?gen+'lemma-head-links.json.gz#/'+links.indexOf(l):gen+'heads.json.gz#/'+heads.indexOf(h)+'/evidence/'+h.evidence.indexOf(saved),...(l?.component_segmentation?{component_segmentation:l.component_segmentation}:{})});
  if(!l)add('historical_identity',gen+'edges.json.gz#/'+eidx+'/lemma_ids/'+ididx,{...rec,language:h.language},e.family_id.replace(/^family:/,''),e.status,[h.id],rec.source_family_ids||[]);
 }
}
const ledgers=[];for(const p of ['head-review-ledger.json','family-promotion-ledger.json','head-lifecycle-ledger.json']){const doc=await read(gen+p),ds=Array.isArray(doc)?doc:doc.decisions;for(const[i,d]of ds.entries()){
 ledgers.push({...d,proof_locator:gen+p+'#/'+(Array.isArray(doc)?'':'decisions/')+i});
 const f=cacheMap.get(d.head_id);assert(f);if(d.predecessor?.head&&!f.versions.some(v=>v.version===d.predecessor.head.version))f.versions.push({version:d.predecessor.head.version,state_sha256:digest(d.predecessor.head),snapshot:d.predecessor.head});
 for(const[j,id]of d.affected_lemma_ids.entries()){const rec=f.finite_scope.find(l=>l.lemma_id===id);assert(rec);add(p.includes('promotion')?'promotion':p.includes('lifecycle')?'revision':'completed_review',gen+p+'#/'+i+'/affected_lemma_ids/'+j,rec,d.family_id.replace(/^family:/,''),d.status,[d.head_id],[],d.version);}
}}
for(const f of cache){f.versions.sort((a,b)=>a.version-b.version);f.identity_facts=review.lexical_facts.filter(x=>x.language===f.language&&x.normalized_head===f.normalized_head&&x.sense===f.sense).map(x=>({...x,evidence:review.evidence_cache.filter(e=>x.evidence_ids.includes(e.id))}));f.decision_history=ledgers.filter(d=>d.head_id===f.head_id);}
// Source pools already researched for promotion remain routes, not accepted groups.
const towerPath=root+'tower-promotion-source-frame-20261003.json.gz',tower=await read(towerPath);
for(const[i,group]of tower.entries())for(const[j,r]of group.records.entries())add('promotion_pool',towerPath+'#/'+i+'/records/'+j,r,'turr','proposal_requires_review',[],[r.source_locator.family_id]);
const wanted=[...new Set(occurrences.map(corpusKey))].sort(),scopeHash=digest(wanted),packetIds=new Set(packets.flatMap(p=>p.evidence_cluster_ids));
const lookupPath=root+'queue-organization-20261004/packet-finite-routes.json.gz';let lookup;
if(measure){
 const wantedSet=new Set(wanted),rows=[],sourceHashes={};
 const bucketIds=new Map();for(const p of packets)for(const c of p.evidence_clusters){const b=c.source.split('/').at(-1).replace('.json.gz',''),s=bucketIds.get(b)||new Set();s.add(c.id);bucketIds.set(b,s);}
 for(const[b,ids]of [...bucketIds].sort())for(const language of ['en','de','fr','es','it','ru']){
  const p='associativvordes/family-index-v5/members/'+language+'/'+b+'.json.gz',bytes=await fs.readFile(p);sourceHashes[p]=digest(bytes);const doc=JSON.parse(gunzipSync(bytes));
  for(const id of ids)for(const[i,r]of (doc[id]||[]).entries())if(wantedSet.has(corpusKey({...r,language})))rows.push({language,lemma_id:r.lemma_id,word:r.word,route_id:id,locator:p+'#/'+id+'/'+i,record_sha256:digest(r)});
 }
 const shards={};for(const language of ['en','de','fr','es','it','ru']){const p=root+'queue-organization-20261004/packet-finite-routes-'+language+'.json.gz',b=gzipSync(Buffer.from(JSON.stringify(rows.filter(r=>r.language===language))+'\n'),{level:9,mtime:0});await writeAtomic(p,b);shards[language]={path:p,sha256:digest(b)};}
 lookup={schema_version:6,scope_sha256:scopeHash,corpus_ids:wanted,input_sha256:sourceHashes,packet_index_sha256:inputs[root+'candidate-root-clusters-20261003/clusters.json.gz'],shards};await writeAtomic(lookupPath,gzipSync(Buffer.from(JSON.stringify(lookup)+'\n'),{level:9,mtime:0}));
}
lookup=await read(lookupPath);lookup.rows=[];for(const shard of Object.values(lookup.shards)){const rows=await read(shard.path);assert.equal(inputs[shard.path],shard.sha256,'Changed packet lookup shard');lookup.rows.push(...rows);}assert.equal(lookup.scope_sha256,scopeHash,'Stale packet scope');assert.deepEqual(lookup.corpus_ids,wanted);assert.equal(lookup.packet_index_sha256,inputs[root+'candidate-root-clusters-20261003/clusters.json.gz']);
const lock=await read(gen+'source-lock.json');for(const[p,h]of Object.entries(lookup.input_sha256))assert.equal(lock[p],h,'Changed packet source '+p);
const result=organize({occurrences,cache,packetRoutes:lookup.rows,packets});
assert.equal(result.metrics.current_membership_candidates,frames.distinct_current_records);
const routeCorpus=new Map();for(const r of lookup.rows){const s=routeCorpus.get(r.route_id)||new Set();s.add(corpusKey(r));routeCorpus.set(r.route_id,s);}
const packetReferences=packets.map(p=>({...p,index_locator:root+'candidate-root-clusters-20261003/clusters.json.gz#/'+packets.indexOf(p),finite_cross_frame_corpus_ids:[...new Set(p.evidence_cluster_ids.flatMap(id=>[...(routeCorpus.get(id)||[])]))].sort(),identity_grade:'morphology_proposal',accepted_membership_created:false}));
const proposalReferences=benchmarks.flatMap(b=>b.proposals.map((p,i)=>({...p,frame:b.frame,locator:gen+'head-recognition-benchmarks.json.gz#/'+benchmarks.indexOf(b)+'/proposals/'+i,identity_grade:'morphology_proposal',binding_authorized:false})));
const baselineMetrics=await read(gen+'head-review-metrics.json');
const report={schema_version:6,production_enabled:false,scope:'all_saved_frames_and_exact_packet_intersections_for_their_finite_corpus_ids',metrics:result.metrics,by_frame:Object.fromEntries([...new Set(occurrences.map(o=>o.frame))].sort().map(f=>[f,{occurrences:occurrences.filter(o=>o.frame===f).length,corpus_ids:new Set(occurrences.filter(o=>o.frame===f).map(corpusKey)).size}])),before_current_units:backlog.length,after_current_units:result.metrics.current_proven_units,new_proven_unit_reduction:backlog.length-result.metrics.current_proven_units,completed_boundary_work:{records_reviewed:baselineMetrics.records_reviewed,records_resolved:baselineMetrics.new_records_resolved,head_decisions:baselineMetrics.new_head_decisions,historical_component_bindings:baselineMetrics.historical_component_bindings_represented,historical_head_edges:baselineMetrics.historical_component_head_edges},new_verdicts:0,new_memberships:0,global_packet_unique_corpus_ids:null,limitations:['Packet overlap is exact for every indexed corpus ID, not a global count of packet-only corpus IDs.','Historical head identities require revalidation; conservative disputed grouping cannot claim reduction.','Morphology proposals, translation and distant ancestry never bind identity or family membership.','Promotion/revision/completed-review incidences are history, not newly resolved records.']};
const artifacts={};await fs.mkdir(out,{recursive:true});
const recordShards={};for(const language of ['en','de','fr','es','it','ru']){const name='cross-frame-'+language+'.json.gz',rs=result.records.filter(r=>r.language===language),b=gzipSync(Buffer.from(JSON.stringify(rs)+'\n'),{level:9,mtime:0});await writeAtomic(out+'/'+name,b);artifacts[name]=digest(b);recordShards[language]={path:name,sha256:digest(b),records:rs.length};}
for(const[name,data]of Object.entries({'cross-frame-reference-index.json.gz':{schema_version:6,shards:recordShards,corpus_ids:result.records.length},'membership-questions.json.gz':result.questions,'ranked-candidate-head-queue.json.gz':result.ranked,'lexical-fact-cache.json.gz':cache,'packet-reference-index.json.gz':packetReferences,'morphology-proposal-references.json.gz':proposalReferences,'overlap-report.json.gz':result.overlaps,'conservation.json.gz':{before:Object.fromEntries(Object.entries(result.conservation.before).map(([k,v])=>[k,{count:v.length,sha256:digest(v)}])),after:Object.fromEntries(Object.entries(result.conservation.after).map(([k,v])=>[k,{count:v.length,sha256:digest(v)}])),added:[],removed:[],exact_sets:{corpus_ids:{shards:Object.values(recordShards).map(s=>s.path),field:'corpus_id'},membership_candidates:{path:'membership-questions.json.gz',field:'candidate_id'},route_occurrences:{shards:Object.values(recordShards).map(s=>s.path),field:'occurrences[*].occurrence_id'},packet_route_occurrences:{shards:Object.values(recordShards).map(s=>s.path),field:'packet_routes[*].locator'},source_route_references:{shards:Object.values(recordShards).map(s=>s.path),field:'occurrences[*].routes'}},verdict:'pass'},'report.json':report})){
 const b=Buffer.from(JSON.stringify(data)+'\n'),bytes=name.endsWith('.gz')?gzipSync(b,{level:9,mtime:0}):b;await writeAtomic(out+'/'+name,bytes);artifacts[name]=digest(bytes);
}
inputs['scripts/build-associative-v6-queue-organization.mjs']=digest(await fs.readFile(new URL(import.meta.url)));inputs['scripts/lib/associative-v6-queue-organization.mjs']=digest(await fs.readFile('scripts/lib/associative-v6-queue-organization.mjs'));
await writeAtomic(out+'/manifest.json',JSON.stringify({schema_version:6,production_enabled:false,input_sha256:inputs,artifacts})+'\n');console.log(JSON.stringify(report));
