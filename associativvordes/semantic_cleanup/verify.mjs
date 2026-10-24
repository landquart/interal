// Independent complete v5/scope verification; no semantic gold and no writes.
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
const [repo,scan,release]=process.argv.slice(2).map(p=>resolve(p));
const read=p=>JSON.parse(readFileSync(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');
const norm=x=>Array.isArray(x)?x.map(norm):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,norm(x[k])])):x;
const canonical=x=>JSON.stringify(norm(x));
const base=read(join(repo,'audit/associative-v5-structural-cleanup/BEFORE-MANIFEST.json'));
let files=0;
for(const f of base.files.filter(f=>f.path.startsWith('current/'))){const bytes=readFileSync(join(repo,f.path.slice(8)));assert.equal(bytes.length,f.bytes);assert.equal(sha(bytes),f.sha256);files++;}
const m=read(join(scan,'MANIFEST.json')),r=read(join(release,'MANIFEST.json'));
for(const [name,hash] of Object.entries(r.outputs))assert.equal(sha(readFileSync(join(release,name))),hash);
const cases=readFileSync(join(release,'SEMANTIC-CASES.ndjson'),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const triage=gunzipSync(readFileSync(join(release,'MEMBERSHIP-TRIAGE.ndjson.gz'))).toString().trim().split('\n').filter(Boolean).map(JSON.parse);
const key=x=>canonical([x.family_id,x.language,x.lemma_id]);
const caseKeys=new Map(cases.map(c=>[c.id,c]));assert.equal(caseKeys.size,cases.length);
const membershipCounts={};let allFamilies=0,allMembers=0,selected=0;const observed=new Set();
const wanted=new Set(Object.keys(m.families));
for(let b=0;b<256;b++){
 const bucket=b.toString(16).padStart(2,'0');
 const families=JSON.parse(gunzipSync(readFileSync(join(repo,'associativvordes/family-index-v5/families',bucket+'.json.gz'))));allFamilies+=Object.keys(families).length;
 const p=m.parts[b];assert.equal(p.bucket,bucket);const bytes=readFileSync(join(scan,bucket+'.ndjson.gz'));assert.equal(sha(bytes),p.sha256);
 const scope=new Map(gunzipSync(bytes).toString().split('\n').filter(Boolean).map(l=>{const x=JSON.parse(l);return [key(x),x]}));assert.equal(scope.size,p.selected_memberships);
 for(const language of ['en','de','fr','es','it','ru']){
  const members=JSON.parse(gunzipSync(readFileSync(join(repo,'associativvordes/family-index-v5/members',language,bucket+'.json.gz'))));
  for(const [family_id,rows] of Object.entries(members)){
   allMembers+=rows.length;if(!wanted.has(family_id))continue;
   membershipCounts[family_id]=(membershipCounts[family_id]??0)+rows.length;
   rows.forEach((row,ordinal)=>{const k=key({family_id,language,lemma_id:row.lemma_id}),saved=scope.get(k);assert.ok(saved);assert.deepEqual(saved.original_record,row);assert.equal(saved.ordinal,ordinal);assert.equal(saved.pos,null);assert.equal(saved.sense_id,null);assert.ok(!observed.has(k));observed.add(k);selected++;});
  }
 }
}
assert.equal(allFamilies,m.full_families);assert.equal(allMembers,m.full_memberships);assert.equal(selected,m.selected_memberships);assert.deepEqual(membershipCounts,m.family_counts);
assert.equal(triage.length,selected);const seen=new Set();let split=0;
for(const row of triage){assert.ok(observed.has(key(row)));assert.ok(!seen.has(key(row)));seen.add(key(row));if(row.status==='SENSE_SPLIT_REQUIRED')split++;for(const id of row.semantic_question_ids){const c=caseKeys.get(id);assert.ok(c);assert.equal(key(c.scope),key(row));assert.equal(c.scope.word,c.dictionary_sense.lemma);assert.equal(c.corpus_binding,null);assert.equal(c.production_application_authorized,false);}}
for(const c of cases)assert.ok(observed.has(key(c.scope)));
assert.equal(split,r.counts.by_membership_status.SENSE_SPLIT_REQUIRED);
console.log(JSON.stringify({schema:'interal-semantic-independent-verification/1',status:'PASS',implementation:'JavaScript, independent full source/scope traversal',production_files:files,all_buckets:256,families:allFamilies,memberships:allMembers,priority_memberships:selected,semantic_questions:cases.length,split_required_memberships:split,linguistic_human_review:false,production_writes:0}));
