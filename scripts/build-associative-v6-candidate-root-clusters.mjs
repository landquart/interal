#!/usr/bin/env node
// Triage evidence packets; this never creates canonical roots or memberships.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const out=process.argv[2]||'audit/associative-family-v6/candidate-root-clusters-20261003';
const sha=b=>createHash('sha256').update(b).digest('hex'),inputs={},read=async p=>{const b=await fs.readFile(p);inputs[p]=sha(b);return JSON.parse(p.endsWith('.gz')?gunzipSync(b):b);};
const norm=s=>String(s).normalize('NFC').toLowerCase(),nodes=new Map(),stemIndex=new Map();
const familiesPath='associativvordes/family-index-v5/families';
for(const file of (await fs.readdir(familiesPath)).sort()){
 const path=familiesPath+'/'+file,doc=await read(path);
 for(const[id,f]of Object.entries(doc)){
  if(!id.startsWith('ety:'))continue;
  assert(!nodes.has(id));
  const stems=[...new Set([f.canonical,...f.aliases].map(norm))].sort();
  // Full declared source terms keep inflections/diacritics; no stemmer or ending removal.
  const anchors=[...new Set((f.relation_evidence||[]).filter(e=>e.sourceLang&&e.term).map(e=>e.sourceLang+':'+norm(e.term)))].sort();
  const lexicalSources=[...new Set((f.relation_evidence||[]).filter(e=>e.language&&e.word).map(e=>e.language+':'+norm(e.word)))].sort();
  nodes.set(id,{id,source:path,proposed_bases:stems,source_etymon_keys:f.etymon_keys||[],declared_source_terms:anchors,source_lexical_word_candidates:lexicalSources,languages:Object.keys(f.language_support||{}).filter(l=>f.language_support[l]>0).sort(),source_member_support:f.support||0,source_canonical_is_not_approved:true});
  for(const s of stems){const ids=stemIndex.get(s)||[];ids.push(id);stemIndex.set(s,ids);}
 }
}
assert.equal(nodes.size,20755);
const parents=new Map([...nodes.keys()].map(k=>[k,k]));
const find=k=>{let r=k;while(parents.get(r)!==r)r=parents.get(r);while(k!==r){const next=parents.get(k);parents.set(k,r);k=next;}return r;};
const join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parents.set(a<b?b:a,a<b?a:b);};
const pairKey=(a,b)=>[a,b].sort().join('\0'),pairs=new Map();
for(const[stem,ids]of [...stemIndex].sort(([a],[b])=>a.localeCompare(b,'en'))){
 ids.sort();for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
  const a=nodes.get(ids[i]),b=nodes.get(ids[j]),key=pairKey(a.id,b.id),p=pairs.get(key)||{left:a.id,right:b.id,shared_proposed_bases:[],shared_declared_source_terms:a.declared_source_terms.filter(x=>b.declared_source_terms.includes(x)),source_terms_are_unverified_linguistic_evidence:true};p.shared_proposed_bases.push(stem);pairs.set(key,p);
 }
}
const duplicates=await read('associativvordes/family-index-v6/generated/duplicate-candidates.json.gz');assert.equal(duplicates.length,6624);
let duplicateEvidencePairs=0;
for(const d of duplicates){
 if(!nodes.has(d.left)||!nodes.has(d.right))continue;duplicateEvidencePairs++;
 const key=pairKey(d.left,d.right),ids=[d.left,d.right].sort(),p=pairs.get(key)||{left:ids[0],right:ids[1],shared_proposed_bases:[],shared_declared_source_terms:[],source_terms_are_unverified_linguistic_evidence:true};
 p.exact_duplicate_member_set_sha256=d.exact_member_set_sha256;p.duplicate_action='review_only_no_merge';pairs.set(key,p);
}
for(const p of pairs.values()){
 p.candidate_grouping_authorized=p.shared_proposed_bases.length>0&&p.shared_declared_source_terms.length>0;
 p.linguistic_identity_established=false;p.family_merge_authorized=false;
 if(p.candidate_grouping_authorized)join(p.left,p.right);
}
const headDoc=await read('associativvordes/family-index-v6/generated/heads.json.gz');const headCandidates=new Map();
for(const h of headDoc.filter(h=>h.identity_kind==='lexical_head')){const k=h.language+':'+norm(h.normalized_head),ids=headCandidates.get(k)||[];ids.push({head_id:h.id,sense:h.sense});headCandidates.set(k,ids);}
const groups=new Map();for(const n of nodes.values()){const root=find(n.id),g=groups.get(root)||[];g.push(n);groups.set(root,g);}
const relationRows=[...pairs.values()].sort((a,b)=>pairKey(a.left,a.right).localeCompare(pairKey(b.left,b.right),'en'));
const clusters=[];
for(const group of groups.values()){
 group.sort((a,b)=>a.id.localeCompare(b.id,'en'));const ids=group.map(n=>n.id),idSet=new Set(ids),edges=relationRows.filter(p=>idSet.has(p.left)&&idSet.has(p.right)),languages=[...new Set(group.flatMap(n=>n.languages))].sort(),proposals=[...new Set(group.flatMap(n=>n.proposed_bases))].sort(),words=[...new Set(group.flatMap(n=>n.source_lexical_word_candidates))].sort();
 const matched=words.flatMap(word=>(headCandidates.get(word)||[]).map(h=>({source_word_candidate:word,...h,identity_binding_authorized:false}))),duplicatePairs=edges.filter(e=>e.exact_duplicate_member_set_sha256).length,support=group.reduce((n,r)=>n+r.source_member_support,0);
 const risk=['canonical_boundary_requires_review','source_terms_and_heads_require_independent_verification'];if(proposals.some(s=>s.length<=3))risk.push('short_base_or_alias');if(proposals.length>1)risk.push('competing_proposed_bases');if(duplicatePairs)risk.push('duplicate_arrays_can_hide_alias_pool_contamination');
 clusters.push({candidate_cluster_id:'candidate-root:'+sha(Buffer.from(ids.join('\n'))).slice(0,24),status:'candidate_packet_requires_linguistic_review',canonical_decision:null,associative_family_id:null,proposed_bases:proposals,evidence_cluster_ids:ids,evidence_clusters:group,languages,existing_evidenced_head_candidates:matched,source_member_incidence_upper_bound:support,unique_corpus_members_not_yet_measured:true,grouping_signal_edges:edges,exact_duplicate_pair_count:duplicatePairs,risk_reasons:risk,promotion_priority:(languages.length-1)*20+Math.log2(1+support)+duplicatePairs*2+matched.length,priority_is_not_a_verdict:true,promotes_automatically:false,family_merge_authorized:false});
}
clusters.sort((a,b)=>b.promotion_priority-a.promotion_priority||a.candidate_cluster_id.localeCompare(b.candidate_cluster_id,'en'));
assert.equal(clusters.reduce((n,c)=>n+c.evidence_cluster_ids.length,0),20755);assert.equal(new Set(clusters.flatMap(c=>c.evidence_cluster_ids)).size,20755);assert(clusters.every(c=>c.canonical_decision===null&&c.associative_family_id===null&&!c.promotes_automatically));
const summary={schema_version:6,verdict:'pass',script_sha256:sha(await fs.readFile(new URL(import.meta.url))),input_sha256:inputs,evidence_clusters_covered:20755,candidate_packets:clusters.length,multi_cluster_packets:clusters.filter(c=>c.evidence_cluster_ids.length>1).length,largest_packet_evidence_clusters:Math.max(...clusters.map(c=>c.evidence_cluster_ids.length)),cross_language_packets:clusters.filter(c=>c.languages.length>=2).length,candidate_grouping_signal_edges:relationRows.filter(r=>r.candidate_grouping_authorized).length,weak_spelling_or_duplicate_links_retained_for_review:relationRows.filter(r=>!r.candidate_grouping_authorized).length,duplicate_evidence_pairs:duplicateEvidencePairs,catalog_promotions:0,canonical_decisions_created:0,new_memberships:0,production_enabled:false,limitations:['Packets use shared declared source terms plus shared proposed bases; these source signals do not prove a coherent associative root.','Spelling-only and duplicate-only links are retained as review signals but cannot join packets.','Connected evidence may contain homonyms or distant ancestry; packet transitivity never authorizes family identity.','Head spelling matches are candidate pointers only, with no finite identity binding or membership propagation.','Support is an incidence upper bound, not a unique corpus-member count.','All source etymological clusters are covered; surface pools are not converted into millions of family-review tasks.','Val contamination demonstrates why exact member-set equality is not linguistic identity.']};
await fs.mkdir(out,{recursive:true});for(const[name,data]of [['clusters.json.gz',clusters],['candidate-links.json.gz',relationRows]])await fs.writeFile(out+'/'+name,gzipSync(Buffer.from(JSON.stringify(data)+'\n'),{level:9,mtime:0}));await fs.writeFile(out+'/report.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({...summary,input_sha256:undefined,limitations:undefined}));
