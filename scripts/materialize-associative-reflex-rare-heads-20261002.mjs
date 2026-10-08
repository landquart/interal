import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { familyBucket } from '../associativvordes/js/family-index-loader.js';
import { matchesReviewedAssociativeForm } from '../associativvordes/js/associative-reflex-forms.js';
import { recountMaterializedMembers, refreshFamilySummaries, repositoryTreeMetadata } from './lib/associative-repository-materialization.mjs';
import { continuationRepair, continuationPath, continuationLedger, reviewPaths, readJson as read, sha, digest,
         appendedMember, resultingFamily, untouchedFilesDigest } from './lib/associative-reflex-rare-heads-extension-audit.mjs';

const root='associativvordes/family-index-v5',apply=process.argv.includes('--apply');
const provenance=await read(root+'/repository-provenance.json');
assert(!provenance.repository_repairs.some(r=>r.repair===continuationRepair),'Already applied');
const expectedHead=process.argv[process.argv.indexOf('--expected-head')+1];
assert(process.argv.includes('--expected-head')&&/^[a-f0-9]{40}$/.test(expectedHead),'Explicit expected HEAD is required');
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),expectedHead,'Baseline HEAD changed');
assert.equal(execFileSync('git',['diff','--name-only','HEAD','--',root],{encoding:'utf8'}).trim(),'','Runtime baseline is dirty');
const baselineTree=await repositoryTreeMetadata(root);
assert.equal(baselineTree.tree_content_sha256,provenance.tree_content_sha256,'Runtime tree does not match provenance');
const sourceHashes={},additions=[],proof=[];
for(const reviewPath of reviewPaths){
 const review=await read(reviewPath+'/decisions.json'),inventory=await read(reviewPath+'/inventory.json');
 additions.push(...review.decisions.filter(r=>r.status==='accepted'));
 for(const [name,hash]of Object.entries(inventory.artifact_sha256)){
  const p=reviewPath+'/'+name;assert.equal(sha(await readFile(p)),hash);sourceHashes[p]=hash;
 }
 const candidate='audit/associative-family-v5/reflex-checkpoint-20261001/candidates.json.gz';
 assert.equal(sha(await readFile(candidate)),inventory.source_candidate_sha256);sourceHashes[candidate]=inventory.source_candidate_sha256;
 const prior=inventory.previous_stage+'/pending-review.json';assert.equal(sha(await readFile(prior)),inventory.inputs.previous_pending_sha256);sourceHashes[prior]=inventory.inputs.previous_pending_sha256;
 sourceHashes[reviewPath+'/inventory.json']=sha(await readFile(reviewPath+'/inventory.json'));
 for(const p of [reviewPath+'/review-spec.json','scripts/lib/associative-reflex-finite-review.py','scripts/review-associative-reflex-rare-native-heads-20261002.py'])sourceHashes[p]=sha(await readFile(p));
 proof.push(...(await read(reviewPath+'/source-records.json.gz')).records);
}
assert.equal(additions.length,7);
const source=new Map(proof.map(r=>[r.language+'\0'+r.member.lemma_id,r.member]));
const families={},beforeFamilies={},beforeMembers={},shards=new Map(),preservation=[];
async function shard(part,bucket){const p=part+'/'+bucket+'.json.gz';if(!shards.has(p))shards.set(p,await read(root+'/'+p));return shards.get(p);}
for(const rt of ['observ','inform']){
 const id='family:'+rt,bucket=familyBucket(id),family=(await shard('families',bucket))[id];
 assert(family.runtime_curated&&family.associative_component&&family.canonical===rt);
 beforeFamilies[id]=structuredClone(family);beforeMembers[id]={};families[id]=family;
 for(const language of ['en','de','fr','es','it','ru']){
  const s=await shard('members/'+language,bucket),ms=s[id]||[];
  assert.equal(ms.length,family.language_support[language]);
  beforeMembers[id][language]={existed:Object.hasOwn(s,id),count:ms.length,ordered_sha256:digest(ms)};
 }
}
const seen=new Set(),sourceRoutes=[];
for(const row of additions){
 const id='family:'+row.canonical_root,original=source.get(row.language+'\0'+row.lemma_id);
 assert(original&&original.word===row.word);assert.deepEqual(original.source_family_ids,row.source_family_ids);
 assert.notEqual(original.corpus_quality?.status,'rejected');assert(matchesReviewedAssociativeForm(original,families[id],row.language));
 const key=id+'\0'+row.language+'\0'+row.lemma_id;assert(!seen.has(key));seen.add(key);
 const ms=(await shard('members/'+row.language,familyBucket(id)))[id]||[];
 assert(!ms.some(m=>m.lemma_id===row.lemma_id),'Duplicate membership');
 const {source_family_ids,components,...measured}=original;
 for(const sourceId of source_family_ids){
  const s=await shard('members/'+row.language,familyBucket(sourceId));
  const current=s[sourceId]?.find(m=>m.lemma_id===row.lemma_id);assert(current);
  const {components:routeComponents,...routeMeasured}=current;assert.deepEqual(routeMeasured,measured,`${row.word}/${sourceId}`);
  if(sourceId===source_family_ids[0])assert.deepEqual(routeComponents,components);
  sourceRoutes.push({language:row.language,family_id:sourceId,member:structuredClone(current)});
 }
}
const writes=new Set(['manifest.json','report.json','repository-provenance.json']);
for(const row of additions){writes.add('families/'+familyBucket('family:'+row.canonical_root)+'.json.gz');writes.add('members/'+row.language+'/'+familyBucket('family:'+row.canonical_root)+'.json.gz');}
for(const p of [...writes].filter(p=>p.endsWith('.gz'))){
 const part=p.slice(0,p.lastIndexOf('/')),bucket=p.slice(p.lastIndexOf('/')+1,-8);
 const ignore=Object.keys(families).filter(id=>familyBucket(id)===bucket);
 preservation.push({part,bucket,ignore,unrelated_sha256:digest(Object.fromEntries(Object.entries(shards.get(p)).filter(([id])=>!ignore.includes(id))))});
}
const metadata=Object.fromEntries(await Promise.all(['manifest.json','report.json','repository-provenance.json'].map(async p=>[p,sha(await readFile(root+'/'+p))])));
const untouched=await untouchedFilesDigest(root,[...writes].sort());
const ledger={schema_version:1,repair:continuationRepair,source_run_id:35647932153,baseline_commit:expectedHead,
 source_hashes:sourceHashes,source_routes:sourceRoutes,before_families:beforeFamilies,before_members:beforeMembers,additions,preservation,
 runtime_preflight_sha256:Object.fromEntries(await Promise.all([...writes].map(async p=>[p,sha(await readFile(root+'/'+p))]))),
 expected_written_files:[...writes].sort(),untouched_files_sha256:untouched,metadata_preflight:metadata,
 expected_added_memberships:7,expected_removed_memberships:0,alias_delta:0,net_family_delta:0,
 status:'ready_to_materialize',full_family_certification:false};
const write=(p,v)=>writeFile(p,p.endsWith('.gz')?gzipSync(JSON.stringify(v),{level:6}):JSON.stringify(v,null,2)+'\n');
if(!apply){await mkdir(continuationPath,{recursive:true});await write(continuationLedger,ledger);console.log(JSON.stringify({mode:'prepare',added:7,removed:0}));}
else{
 const ledgerBytes=await readFile(continuationLedger),saved=JSON.parse(ledgerBytes);
 // Preflight is a separate commit, so its application HEAD differs. Every
 // guarded runtime byte, original prefix and source hash must still match.
 const comparable={...ledger,baseline_commit:saved.baseline_commit};assert.deepEqual(comparable,saved,'Stale preflight');
 for(const [id,before]of Object.entries(beforeFamilies)){
  const rows=additions.filter(r=>'family:'+r.canonical_root===id);
  (await shard('families',familyBucket(id)))[id]=resultingFamily(before,rows);
  for(const language of new Set(rows.map(r=>r.language))){
   const s=await shard('members/'+language,familyBucket(id));
   s[id]=[...(s[id]||[]),...rows.filter(r=>r.language===language).map(r=>appendedMember(source.get(language+'\0'+r.lemma_id),r))];
  }
 }
 // All guards have finished before the first runtime write.
 for(const p of [...writes].filter(p=>p.endsWith('.gz')))await write(root+'/'+p,shards.get(p));
 const manifest=await read(root+'/manifest.json'),report=await read(root+'/report.json');
 await recountMaterializedMembers(root,manifest,report);await refreshFamilySummaries(root,report);
 const delta={repair:continuationRepair,source_run_id:35647932153,added_memberships:7,removed_memberships:0,
  alias_delta:0,net_family_delta:0,decision_ledger_sha256:sha(ledgerBytes),full_family_certification:false};
 provenance.repository_repairs.push(delta);report.repository_materialization.reflex_rare_heads_extension=delta;
 await write(root+'/manifest.json',manifest);await write(root+'/report.json',report);
 Object.assign(provenance,await repositoryTreeMetadata(root));await write(root+'/repository-provenance.json',provenance);
 await write(continuationPath+'/materialization-status.json',{runtime_applied:true,full_family_certification:false,
  repair_delta:delta,runtime_support:{observ:311,inform:1460},continuation_counts:{accepted_applied:31,excluded:303,uncertain:119,pending_review:309}});
 console.log(JSON.stringify({mode:'apply',...delta}));
}
