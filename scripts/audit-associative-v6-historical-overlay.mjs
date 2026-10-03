import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const out=process.argv[2]||'audit/associative-family-v6/historical-overlay-20261003';
const paths={catalog:'associativvordes/family-index-v6/catalog.json',historical:'audit/associative-family-v5/component-checkpoint-20261001/decisions.json',candidates:'audit/associative-family-v5/component-checkpoint-20261001/candidate-records.json.gz',loc:'audit/associative-family-v5/loc-reflex-decisions-20261001.json',memberships:'associativvordes/family-index-v6/generated/memberships.json.gz',ledger:'associativvordes/family-index-v6/generated/head-review-ledger.json',backlog:'associativvordes/family-index-v6/generated/review-backlog.json.gz'};
const hash=b=>createHash('sha256').update(b).digest('hex'),inputs={},data={};
for(const[k,p]of Object.entries(paths)){const bytes=await fs.readFile(p);inputs[p]=hash(bytes);data[k]=JSON.parse(p.endsWith('.gz')?gunzipSync(bytes):bytes);}
assert.equal(inputs[paths.candidates],data.historical.artifacts['candidate-records.json.gz']);
const key=(root,lang,id)=>root+'\0'+lang+'\0'+id;
const members=new Map(data.memberships.map(r=>[key(r.family_id.replace(/^family:/,''),r.language,r.lemma_id),r]));
const loc=new Map(data.loc.decisions.map(r=>[key('loc',r.language,r.lemma_id),r]));
const prior=new Map();for(const s of ['accepted','etymological_only_excluded'])for(const[root,langs]of Object.entries(data.historical[s]))for(const[lang,rs]of Object.entries(langs))for(const r of rs){const k=key(root,lang,r.lemma_id);assert(!prior.has(k));prior.set(k,{status:s,word:r.word});}
const reviews=new Map();for(const d of data.ledger)for(const id of d.affected_lemma_ids)reviews.set(key(d.family_id.replace(/^family:/,''),d.language,id),d);
const backlog=new Set(data.backlog.flatMap(u=>u.source_records.map(r=>key(r.canonical_root||r.root,r.language,r.lemma_id))));
const counts={},rows=[],seen=new Set();let preserved=0,overridden=0;
for(const[root,langs]of Object.entries(data.candidates))for(const[language,rs]of Object.entries(langs))for(const r of rs){
 const k=key(root,language,r.lemma_id);assert(!seen.has(k));seen.add(k);const old=prior.get(k),specific=loc.get(k),head=reviews.get(k),member=members.get(k);if(old)assert.equal(old.word,r.word);
 let disposition,proof;
 if(member){assert.equal(member.word,r.word);disposition='accepted_preserved_or_reviewed';proof=paths.memberships;
  if(old?.status==='accepted')preserved++;
  if(old?.status==='etymological_only_excluded'){assert.equal(root,'loc');assert(specific?.status==='accepted'||head?.status==='accepted',k+' '+r.word);overridden++;}
 }else if(head?.status==='excluded'){disposition='excluded_current_finite_head_review';proof=paths.ledger;
 }else if(specific){assert.notEqual(specific.status,'accepted');disposition=specific.status==='uncertain'?'investigated_uncertain_current_overlay':'excluded_current_loc_overlay';proof=paths.loc;if(specific.status==='uncertain')assert(backlog.has(k),k+" "+r.word);
 }else if(old?.status==='etymological_only_excluded'){disposition='excluded_saved_historical_decision';proof=paths.historical;
 }else{assert.notEqual(old?.status,'accepted');disposition='unresolved_historical_without_current_decision';proof=paths.candidates;}
 counts[root]??={};counts[root][disposition]=(counts[root][disposition]||0)+1;
 rows.push({root,language,lemma_id:r.lemma_id,word:r.word,historical_status:old?.status||'not_adjudicated',current_disposition:disposition,current_frame_contains_record:backlog.has(k),proof,...(specific?{loc_overlay_status:specific.status}:{}),...(head?{finite_head_review_status:head.status,head_id:head.head_id}:{})});
}
assert.equal(preserved,[...prior.values()].filter(r=>r.status==='accepted').length);assert.equal(overridden,498);
const unresolved=rows.filter(r=>r.current_disposition==='unresolved_historical_without_current_decision').length;assert.equal(unresolved,46390);
const report={schema_version:6,verdict:'pass',source_head:data.catalog.source_head,script_sha256:hash(await fs.readFile(new URL(import.meta.url))),unresolved_historical_records:unresolved,scope:'saved_nat_loc_inter_candidate_frame',input_sha256:inputs,source_records:rows.length,counts,historical_accepted_preserved:preserved,historical_exclusions_superseded_by_evidenced_loc_overlay:overridden,new_linguistic_decisions:0,new_pending_records_resolved:0,new_memberships:0,production_enabled:false,limitations:['Reconciliation preserves saved decisions and measurements; it performs no linguistic classification.','Unresolved historical records remain a separate frame, not silently merged into the six active queues.','Accepted current rows use preserved v5 or finite reviewed v6 membership proof; this does not certify every lexical head.']};
await fs.mkdir(out,{recursive:true});await fs.writeFile(out+'/records.json.gz',gzipSync(Buffer.from(JSON.stringify(rows)+'\n'),{level:9,mtime:0}));await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
