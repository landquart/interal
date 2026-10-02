import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {familyBucket} from '../../associativvordes/js/family-index-loader.js';
import {preReflexContinuationShard} from './associative-reflex-continuation-audit.mjs';
const cp='audit/associative-family-v5/action-positive-extension-20261002',ledgerPath=cp+'/materialization-ledger.json';
const read=async p=>JSON.parse((p.endsWith('.gz')?gunzipSync(await readFile(p)):await readFile(p)).toString()),sha=b=>createHash('sha256').update(b).digest('hex'),digest=v=>sha(JSON.stringify(v));
export async function auditActionExtension(root){
 const provenance=await read(root+'/repository-provenance.json'),repair=provenance.repository_repairs.find(r=>r.repair==='extend_reviewed_action_memberships_20261002');
 if(!repair)return null;
 const bytes=await readFile(ledgerPath),l=JSON.parse(bytes),dBytes=await readFile(cp+'/decisions.json'),d=JSON.parse(dBytes),status=await read(cp+'/materialization-status.json');
 assert.equal(repair.decision_ledger_sha256,sha(bytes));assert.equal(sha(dBytes),l.decision_sha256);assert.equal(status.review_decision_sha256,sha(dBytes));assert(status.runtime_applied&&!status.full_family_certification);assert.equal(repair.added_memberships,l.expected_added_memberships);assert.equal(repair.removed_memberships,0);
 for(const [name,hash]of Object.entries(l.review_artifacts))assert.equal(sha(await readFile(cp+'/'+name)),hash);
 const family=(await read(root+'/families/'+familyBucket('family:act')+'.json.gz'))['family:act'];
 const expected=structuredClone(l.before_family);expected.support+=l.expected_added_memberships;expected.relation_evidence.push({type:'manual_override',source:ledgerPath,whole_lemma_union:false,language_reflex:true,full_family_certification:false});
 for(const [language,rows]of Object.entries(l.additions)){
  assert.deepEqual(rows,d.decisions.filter(m=>m.language===language));expected.language_support[language]+=rows.length;
  const ms=(await read(root+'/members/'+language+'/'+familyBucket('family:act')+'.json.gz'))['family:act'];assert.equal(digest(ms.slice(0,l.before_members[language].count)),l.before_members[language].ordered_sha256);
  assert.deepEqual(ms.slice(l.before_members[language].count).map(m=>m.lemma_id),rows.map(m=>m.lemma_id));
 }
 assert.deepEqual(family,expected);assert.equal(status.runtime_support,family.support);
 for(const p of l.preservation){const s=await preReflexContinuationShard(await read(root+'/'+p.part+'/'+familyBucket('family:act')+'.json.gz'),p.part,familyBucket('family:act'),root);assert.equal(digest(Object.fromEntries(Object.entries(s).filter(([k])=>k!=='family:act'))),p.unrelated_sha256);}
 const proof=(await read(cp+'/source-records.json.gz')).records,groups=new Map();
 for(const {language,member}of proof){const path=root+'/members/'+language+'/'+familyBucket(member.source_family_ids[0])+'.json.gz';if(!groups.has(path))groups.set(path,[]);groups.get(path).push(member);}
 for(const [path,members]of groups){const s=await read(path);for(const member of members){const {source_family_ids,...original}=member;assert.deepEqual(s[source_family_ids[0]].find(m=>m.lemma_id===member.lemma_id),original);}}
 return {ledger_path:ledgerPath,added_memberships:l.expected_added_memberships,additions:l.additions,counts:d.counts};
}
