import {createHash} from 'node:crypto';
import {generateV6Memberships} from '../../associativvordes/js/associative-family-v6.js';
export const correctionHash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export const correctionKey=r=>r.language+'\0'+r.family_id+'\0'+r.lemma_id;
const bytesHash=b=>createHash('sha256').update(b).digest('hex');
const fail=s=>{throw Error(s);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function correctionPredecessor(index,keys){
 const originals=new Map(generateV6Memberships({...index,correction_verdicts:[]}).map(r=>[correctionKey(r),r]));
 const verdicts=new Map((index.correction_verdicts||[]).map(r=>[correctionKey(r),r]));
 return [...keys].sort().map(key=>{
  const original=originals.get(key)||fail('Unknown correction membership '+key);
  const link=index.links.find(l=>correctionKey(l)===key)||fail('Unknown correction link');
  const head=index.heads.find(h=>h.id===link.head_id),edge=index.edges.find(e=>e.head_id===link.head_id&&e.family_id===link.family_id);
  const previous=verdicts.get(key)||null;
  return {key,previous_status:previous?.status||'accepted',original_membership:original,source_proof:original.source_proof,membership_sha256:correctionHash(original),link_sha256:correctionHash(link),head_sha256:correctionHash(head),edge_sha256:correctionHash(edge),previous_correction_sha256:correctionHash(previous)};
 });
}
export async function loadBaselineCorrections({read,readBytes,inputs}){
 const p='associativvordes/family-index-v6/baseline-corrections.json',registry=await read(p);
 if(registry.schema_version!==6||registry.production_enabled!==false||registry.correction_schema_version!==1||!Array.isArray(registry.decisions))fail('Invalid correction registry');
 inputs[p]=bytesHash(await readBytes(p));const docs=[],seen=new Set();
 for(const entry of registry.decisions){
  if(seen.has(entry.path))fail('Repeated correction dossier');seen.add(entry.path);
  if(bytesHash(await readBytes(entry.path))!==entry.sha256)fail('Changed correction dossier');inputs[entry.path]=entry.sha256;
  const d=await read(entry.path);if(d.synthetic_fixture!==false)fail('Synthetic or unclassified correction cannot enter real registry');
  for(const[p,h]of Object.entries(d.input_sha256||{})){if(bytesHash(await readBytes(p))!==h)fail('Changed correction evidence '+p);inputs[p]=h;}
  for(const r of d.records||[]){const p=r.source_locator;
   if(!p||!/^associativvordes\/family-index-v5\/members\/(en|de|fr|es|it|ru)\/[0-9a-f]{2}\.json\.gz$/.test(p.path)||p.path.split('/')[3]!==r.language||!d.input_sha256[p.path])fail('Missing immutable correction source');
   const actual=(await read(p.path))[p.family_id]?.find(x=>x.lemma_id===r.lemma_id);
   if(!actual||!same(actual,r.source_record)||actual.word!==r.word||correctionHash(actual)!==p.record_sha256)fail('Invented correction corpus record');
  }
  docs.push(d);
 }
 return docs;
}
// Atomic per-question overlay: head/edge/link/corpus history is never modified.
export function replayBaselineCorrections({index,docs,baseline=[]}){
 const raw=generateV6Memberships({...index,correction_verdicts:[]});
 assertBaselineReference({baseline,historical:raw});
 index={...index,correction_verdicts:structuredClone(index.correction_verdicts||[])};
 const ledger=[],seen=new Set();let version=0;
 for(const d of docs){
  if(d.schema_version!==6||d.correction_schema_version!==1||d.production_enabled!==false||d.correction_authorized!==true||!d.id||seen.has(d.id)||d.version!==version+1)fail('Unauthorized, repeated or stale correction version');
  if(!d.reason||!d.evidence?.length||!['excluded','uncertain'].includes(d.status)||!Array.isArray(d.records)||!d.records.length)fail('Missing independent correction verdict/evidence');
  const keys=d.records.map(correctionKey).sort();
  if(new Set(keys).size!==keys.length||!same(keys,[...(d.affected_keys||[])].sort())||correctionHash(keys)!==d.scope_sha256)fail('Wrong exact correction ID scope');
  const p=correctionPredecessor(index,keys);
  if(!same(p,d.predecessor)||correctionHash(p)!==d.previous_sha256)fail('Stale correction previous hash or partial wrong-ID scope');
  for(const r of d.records){
   const k=correctionKey(r),before=p.find(x=>x.key===k),original=before.original_membership;
   if(!same(original.source_proof[0].source,r.source_locator)||r.source_record?.lemma_id!==r.lemma_id||r.source_record.word!==r.word||correctionHash(r.source_record)!==r.source_locator.record_sha256||original.word!==r.word||!same(index.corpus.get(r.language+'\0'+r.lemma_id),r.source_record))fail('Changed correction source proof or measured row');
   if(!r.reason||!r.evidence?.length||r.previous_status!==before.previous_status)fail('Missing previous decision or individual new evidence');
  }
  const verdicts=d.records.map(r=>({language:r.language,family_id:r.family_id,lemma_id:r.lemma_id,word:r.word,status:d.status,version:d.version,dossier_id:d.id,reason:r.reason,evidence:r.evidence,historical_accepted:true,original_membership:p.find(x=>x.key===correctionKey(r)).original_membership}));
  const replace=new Set(keys);index.correction_verdicts=[...index.correction_verdicts.filter(r=>!replace.has(correctionKey(r))),...verdicts].sort((a,b)=>correctionKey(a).localeCompare(correctionKey(b),'en'));
  ledger.push({id:d.id,version:d.version,status:d.status,affected_keys:keys,scope_sha256:d.scope_sha256,previous_sha256:d.previous_sha256,predecessor:p,reason:d.reason,evidence:d.evidence});seen.add(d.id);version=d.version;
 }
 index.memberships=generateV6Memberships(index);
 const after=new Set(index.memberships.map(correctionKey)),removed=raw.filter(r=>!after.has(correctionKey(r))),baselineKeys=new Set(baseline.map(correctionKey));
 assertAuthorizedMemberships({historical:raw,current:index.memberships,verdicts:index.correction_verdicts});
 return {index,ledger,differential:{removals:removed,additions:[],baseline_removals:removed.filter(r=>baselineKeys.has(correctionKey(r)))},metrics:{dossiers:ledger.length,corrected_questions:index.correction_verdicts.length,baseline_corrections:removed.filter(r=>baselineKeys.has(correctionKey(r))).length,excluded:index.correction_verdicts.filter(r=>r.status==='excluded').length,uncertain:index.correction_verdicts.filter(r=>r.status==='uncertain').length,historical_acceptances_retained:removed.length}};
}
export function assertAuthorizedMemberships({historical,current,verdicts=[]}){
 const before=new Map(historical.map(r=>[correctionKey(r),r])),actual=new Map(current.map(r=>[correctionKey(r),r]));
 if(before.size!==historical.length||actual.size!==current.length)fail('Duplicate current/historical membership');
 const removed=new Set();for(const v of verdicts){const k=correctionKey(v);if(removed.has(k)||!before.has(k)||!['excluded','uncertain'].includes(v.status))fail('Unknown or duplicate authorized correction');removed.add(k);}
 if(actual.size!==before.size-removed.size)fail('Unauthorized baseline loss or unexpected addition');
 for(const[k,r]of before){if(removed.has(k)){if(actual.has(k))fail('Corrected verdict leaked into current search');}else if(!same(actual.get(k),r))fail('Unauthorized baseline loss/change '+k);}
 return true;
}

// A lifecycle operation cannot bypass the independent baseline correction ledger.
export function assertBaselineReference({baseline,historical}){
 const keys=new Set(historical.map(correctionKey)),original=new Set(baseline.map(correctionKey));
 if(keys.size!==historical.length||original.size!==baseline.length)fail('Duplicate baseline/reference identity');
 for(const k of original)if(!keys.has(k))fail('Unauthorized baseline loss before correction overlay '+k);
 return true;
}
