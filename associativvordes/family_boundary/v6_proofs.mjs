// Historical v6 uses JSON.stringify order, not canonical key sorting.
import {readFileSync,writeFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';import {resolve,join} from 'node:path';import assert from 'node:assert/strict';
const [repo,v6]=process.argv.slice(2).map(p=>resolve(p)),sha=x=>createHash('sha256').update(x).digest('hex'),read=p=>JSON.parse(readFileSync(p));
const baseline=join(repo,'audit/associative-v5-structural-cleanup/BEFORE-MANIFEST.json'),pins=new Map(read(baseline).files.filter(x=>x.path.startsWith('current/')).map(x=>[x.path.slice(8),x]));
const input=join(v6,'generated/memberships.json.gz'),members=JSON.parse(gunzipSync(readFileSync(input))),requests=new Map(),rows=[];
for(let i=0;i<members.length;i++){const m=members[i],proofs=m.source_proof?.length?m.source_proof:[{}];for(let j=0;j<proofs.length;j++){
 const p=proofs[j],s=p.source||{},r={key:`${i}:${j}`,language:m.language,lemma_id:p.lemma_id??m.lemma_id,source_family_id:s.family_id??null,head_id:m.head_id,target_family_id:m.family_id,source_path:s.path??null,expected_hash:s.record_sha256??null,current_js_record_hash:null,status:'SOURCE_PROOF_MISSING'};rows.push(r);
 if(!s.path||!pins.has(s.path)||!/^associativvordes\/family-index-v5\/members\/(en|de|fr|es|it|ru)\/[0-9a-f]{2}\.json\.gz$/.test(s.path))continue;
 r.status='SOURCE_RECORD_ABSENT';if(!requests.has(s.path))requests.set(s.path,[]);requests.get(s.path).push({r,m,s});
}}
const inputs=[];
for(const path of [...requests.keys()].sort()){
 const bytes=readFileSync(join(repo,path)),pin=pins.get(path);assert.equal(bytes.length,pin.bytes);assert.equal(sha(bytes),pin.sha256);const data=JSON.parse(gunzipSync(bytes)),cache=new Map();
 for(const {r,m,s} of requests.get(path)){
  if(!cache.has(s.family_id))cache.set(s.family_id,new Map((data[s.family_id]||[]).map(x=>[x.lemma_id,x])));const original=cache.get(s.family_id).get(r.lemma_id);if(!original)continue;
  r.current_js_record_hash=sha(Buffer.from(JSON.stringify(original)));r.status=m.language!==path.split('/')[3]?'SOURCE_LANGUAGE_MISMATCH':r.lemma_id!==m.lemma_id?'SOURCE_LEMMA_MISMATCH':original.word!==m.word?'SOURCE_FORM_MISMATCH':r.current_js_record_hash!==r.expected_hash?'SOURCE_JS_HASH_MISMATCH':'EXACT_FINITE_SOURCE_PROOF';
 }
 inputs.push({path,sha256:pin.sha256,bytes:pin.bytes});
}
for(const p of inputs)assert.equal(sha(readFileSync(join(repo,p.path))),p.sha256);
const bytes=rows.map(r=>JSON.stringify(r)+'\n').join(''),counts={};for(const r of rows)counts[r.status]=(counts[r.status]||0)+1;
writeFileSync(join(v6,'SOURCE-PROOF-CHECKS.ndjson'),bytes);writeFileSync(join(v6,'PROOF-CHECKS-MANIFEST.json'),JSON.stringify({schema:'boundary-v6-proofs/2',baseline_sha256:sha(readFileSync(baseline)),v6_memberships_sha256:sha(readFileSync(input)),checks_sha256:sha(bytes),counts,inputs,hash_contract:'SHA256(UTF8(JSON.stringify(original_record)))',productive_head_authority:false,production_writes:0})+'\n');console.log(JSON.stringify(counts));
