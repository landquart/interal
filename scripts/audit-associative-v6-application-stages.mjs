#!/usr/bin/env node
// Inventory only. This never grants permission or modifies old research/proofs.
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const base='audit/associative-family-v6';
const review=JSON.parse(gunzipSync(await fs.readFile('associativvordes/family-index-v6/lexical-head-review.json.gz')));
const entries=[];
for(const name of (await fs.readdir(base)).sort()) {
 if(!name.endsWith('.json'))continue;
 const path=base+'/'+name,bytes=await fs.readFile(path),d=JSON.parse(bytes);
 if(!d.groups?.length)continue;
 const flags=Object.fromEntries(['binding_authorized','accepted_membership_authorized','excluded_membership_authorized','uncertain_membership_authorized'].map(k=>[k,Object.hasOwn(d,k)?d[k]:'missing']));
 const groups=d.groups.map((g,index)=>{
  const status=g.status||g.family_edge_status;
  const matching=review.head_reviews.filter(r=>r.review_stage===d.stage&&r.family_id==='family:'+g.root&&r.status===status&&JSON.stringify([...r.lemma_ids].sort())===JSON.stringify(g.records.map(r=>r.lemma_id).sort()));
  const required=status==='accepted'?'accepted_membership_authorized':status==='excluded'?'excluded_membership_authorized':'uncertain_membership_authorized';
  return {index,language:g.language,head:g.normalized_head,status,records:g.records.length,applied_review_matches:matching.length,missing_permissions:['binding_authorized',required].filter(k=>!Object.hasOwn(d,k)),explicit_denials:['binding_authorized',required].filter(k=>Object.hasOwn(d,k)&&d[k]!==true)};
 });
 entries.push({path,sha256:sha(bytes),stage:d.stage,flags,groups,promotion_status:d.promotion_status||null});
}
const result={schema_version:6,source_sha:'2d84b206c694b395620bef6ba83db1977cfced7c',production_enabled:false,verdict:'legacy_missing_permissions_require_separate_reviewed_decision',not_proof_of_historical_unauthorized_application:true,entries,review_document:{sha256:sha(await fs.readFile('associativvordes/family-index-v6/lexical-head-review.json.gz')),bindings:review.finite_bindings.length,reviews:review.head_reviews.length,bindings_without_binding_authorized:review.finite_bindings.filter(b=>b.binding_authorized!==true).length,reviews_without_explicit_mode_authorization:review.head_reviews.filter(d=>d[{accepted:'accepted_membership_authorized',excluded:'excluded_membership_authorized',uncertain:'uncertain_membership_authorized'}[d.status]]!==true).length}};
const out=process.argv[2]||base+'/application-permissions-20261003/research.json';
await fs.mkdir(out.slice(0,out.lastIndexOf('/')),{recursive:true});await fs.writeFile(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({stages:entries.length,applied_groups:entries.flatMap(e=>e.groups).filter(g=>g.applied_review_matches).length,explicit_applied_denials:entries.flatMap(e=>e.groups).filter(g=>g.applied_review_matches&&g.explicit_denials.length).length,...result.review_document}));
