#!/usr/bin/env node
import fs from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {evidenceClusterSimilarity} from '../associativvordes/js/associative-family-v6.js';
const read=async p=>JSON.parse(p.endsWith('.gz')?gunzipSync(await fs.readFile(p)):await fs.readFile(p));
const out=process.argv[2]||'audit/associative-family-v6',rows=[];
for(const name of (await fs.readdir('associativvordes/family-index-v5/families')).sort()){
 const p='associativvordes/family-index-v5/families/'+name,shard=await read(p);
 for(const[id,f]of Object.entries(shard)){
  if(!id.startsWith('ety:'))continue;
  const languages=Object.keys(f.language_support||{}).filter(l=>f.language_support[l]>0),risk=[];
  if(f.canonical.length<=3)risk.push('short_canonical_proposal');
  if(f.canonical_selection?.method==='quality_score_v1')risk.push('unreviewed_source_canonical');
  if(f.aliases.length>1)risk.push('alias_ambiguity');
  if((f.etymon_keys||[]).length>1)risk.push('multiple_etymologies');
  if((f.relation_evidence||[]).some(e=>/^\p{Lu}/u.test(e.word||'')))risk.push('proper_name_or_capitalized_entry');
  if(f.review_status==='blocked_from_runtime')risk.push('legacy_block');
  const crossLanguage=languages.length>=2;
  rows.push({evidence_cluster_id:id,possible_source_stems:[...new Set([f.canonical,...f.aliases])],canonical_status:'proposal_requires_review',associative_family_id:null,support:f.support,languages,borrowing_or_inheritance_evidence:(f.relation_types||[]).filter(t=>/borrow|inherit/.test(t)),risk_reasons:risk,promotion_priority:crossLanguage?(languages.length-1)*20+Math.log2(1+f.support)+risk.length*5:0,promotes_automatically:false,source_locator:{path:p,id}});
 }
}
rows.sort((a,b)=>b.promotion_priority-a.promotion_priority||a.evidence_cluster_id.localeCompare(b.evidence_cluster_id,'en'));
const val=await read('associativvordes/family-index-v6/generated/val-candidates.json'),sets=new Map();
for(const t of val.targets){const id=t.legacy_id;let h=0x811c9dc5;for(const c of id){h^=c.codePointAt(0);h=Math.imul(h,0x01000193);}const b=((h>>>0)%256).toString(16).padStart(2,'0'),keys=[];for(const l of ['en','de','fr','es','it','ru'])for(const m of (await read('associativvordes/family-index-v5/members/'+l+'/'+b+'.json.gz'))[id]||[])keys.push(l+'\0'+m.lemma_id);sets.set(id,keys);}
const comparisons=[];for(let i=0;i<val.targets.length;i++)for(let j=i+1;j<val.targets.length;j++){const left=val.targets[i].legacy_id,right=val.targets[j].legacy_id;comparisons.push({left,right,...evidenceClusterSimilarity(sets.get(left),sets.get(right))});}
await fs.mkdir(out,{recursive:true});await fs.writeFile(out+'/promotion-candidates.json.gz',gzipSync(Buffer.from(JSON.stringify(rows)+'\n'),{level:9,mtime:0}));await fs.writeFile(out+'/val-similarity.json',JSON.stringify({scope:'All 105 unordered pairs of the 15 retained val evidence/component targets',comparisons,identity_merge:false},null,2)+'\n');await fs.writeFile(out+'/risk-inventory.json',JSON.stringify({schema_version:6,evidence_clusters:rows.length,cross_language_proposals:rows.filter(r=>r.languages.length>=2).length,surface_candidates_excluded_from_family_review:2435769,canonical_decisions_created:0,risk_counts:Object.fromEntries([...new Set(rows.flatMap(r=>r.risk_reasons))].map(k=>[k,rows.filter(r=>r.risk_reasons.includes(k)).length])),duplicate_scope:'Global exact member-set candidates in generated/duplicate-candidates.json.gz; MinHash/LSH/Jaccard additionally computed for all val pairs.',full_linguistic_certification:false},null,2)+'\n');console.log(JSON.stringify({evidence_clusters:rows.length,val_pairs:comparisons.length}));
