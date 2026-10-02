import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {familyBucket} from '../../associativvordes/js/family-index-loader.js';
import {auditActionExtension} from './associative-action-extension-audit.mjs';
const base='audit/associative-family-v5/',ledgerPath=base+'action-materialization-stage-20261002.json';
const read=async p=>JSON.parse((p.endsWith('.gz')?gunzipSync(await readFile(p)):await readFile(p)).toString()),sha=b=>createHash('sha256').update(b).digest('hex'),digest=v=>sha(JSON.stringify(v));
let ledgerPromise;
const ledger=()=>ledgerPromise||=read(ledgerPath);
// Historical shard fingerprints describe the pre-action state. Reconstruct it
// from the new, separately hashed ledger instead of rewriting old evidence.
export async function preActionShard(shard,part,bucket){
 const l=await ledger();
 if(part==='aliases'){for(const [alias,before]of Object.entries(l.alias_before))if(familyBucket(alias)===bucket){if(before.length)shard[alias]=structuredClone(before);else delete shard[alias];}}
 else delete shard['family:act'];
 return shard;
}
export async function auditActionStage(root){
 const ledgerBytes=await readFile(ledgerPath),l=await ledger(),cp=base+'action-continuation-20261002/',dBytes=await readFile(cp+'linguistic-decisions.json.gz'),d=JSON.parse(gunzipSync(dBytes)),inv=await read(cp+'inventory.json'),status=await read(cp+'materialization-status.json');
 assert.equal(sha(dBytes),l.decision_sha256);assert.equal(sha(dBytes),inv.decision_sha256);assert.equal(status.decision_sha256,l.decision_sha256);assert.equal(status.runtime_applied,true);assert.equal(status.full_family_certification,false);
 const provenance=await read(root+'/repository-provenance.json'),repair=provenance.repository_repairs.find(r=>r.repair===l.repair);assert.equal(repair.decision_ledger_sha256,sha(ledgerBytes));assert.equal(repair.added_memberships,l.expected_added_memberships);assert.equal(repair.removed_memberships,0);
 const extension=await auditActionExtension(root);
 const family=(await read(root+'/families/'+familyBucket('family:act')+'.json.gz'))['family:act'];assert.equal(family.support,l.expected_added_memberships+(extension?.added_memberships||0));assert.deepEqual(family.surface_forms,l.surface_forms);assert.deepEqual(family.aliases,l.aliases);assert(family.exact_component&&family.associative_component&&family.runtime_curated&&!family.verified);
 for(const [file,hash]of Object.entries(l.source_artifacts))assert.equal(sha(await readFile(base+'action-reflex-checkpoint-20261001/'+file)),hash);
 for(const [language,ds]of Object.entries(d.decisions)){
  const source=await read(base+'action-reflex-checkpoint-20261001/'+language+'-candidates.json.gz'),byId=new Map(source.act.map(m=>[m.lemma_id,m])),ms=(await read(root+'/members/'+language+'/'+familyBucket('family:act')+'.json.gz'))['family:act'];
  const extra=extension?.additions[language]||[],expected=[...l.accepted[language],...extra],extraIds=new Set(extra.map(m=>m.lemma_id));
  assert.deepEqual(ds.map(d=>[d.lemma_id,d.word]),source.act.map(m=>[m.lemma_id,m.word]));assert.deepEqual(ds.filter(d=>d.status==='accepted'),l.accepted[language]);assert.deepEqual(ms.map(m=>[m.lemma_id,m.word]),expected.map(d=>[d.lemma_id,d.word]));assert.equal(new Set(ms.map(m=>m.lemma_id)).size,ms.length);assert.equal(family.language_support[language],ms.length);
  for(const m of ms){const {source_family_ids,components,...original}=byId.get(m.lemma_id),{components:next,...measured}=m;assert.deepEqual(measured,original);assert.deepEqual(next.slice(0,-1),components||[]);assert.equal(next.at(-1).canonical_candidate,'act');assert.equal(next.at(-1).evidence[0].source,extraIds.has(m.lemma_id)?extension.ledger_path:ledgerPath);}
 }
 for(const p of l.preservation){const s=await read(`${root}/${p.part}/${p.bucket}.json.gz`),other=Object.fromEntries(Object.entries(s).filter(([k])=>p.part==='aliases'?!l.aliases.includes(k):k!=='family:act'));assert.equal(digest(other),p.unrelated_sha256);}
 for(const [alias,before]of Object.entries(l.alias_before)){const ids=(await read(root+'/aliases/'+familyBucket(alias)+'.json.gz'))[alias];assert.deepEqual(ids,[...new Set([...before,'family:act'])].sort());}
 const old=await read(base+'action-reflex-checkpoint-20261001/original-families.json.gz');for(const [id,f]of Object.entries(old.families)){assert.deepEqual((await read(root+'/families/'+familyBucket(id)+'.json.gz'))[id],f);for(const language of Object.keys(d.decisions))assert.deepEqual((await read(root+'/members/'+language+'/'+familyBucket(id)+'.json.gz'))[id]||[],old.members[language][id]||[]);}
 return {added_memberships:l.expected_added_memberships+(extension?.added_memberships||0),removed_memberships:0,full_family_certification:false,counts:extension?.counts||d.counts};
}
