// Independent raw v5 traversal, not a replay of legacy linguistic judgments.
import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
const [repo,out]=process.argv.slice(2).map(p=>resolve(p));assert.ok(repo&&out&&!out.startsWith(repo+'/'));mkdirSync(out,{recursive:true});
const read=p=>JSON.parse(readFileSync(p)),sha=x=>createHash('sha256').update(x).digest('hex');
const norm=x=>Array.isArray(x)?x.map(norm):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,norm(x[k])])):x;
const canonical=x=>JSON.stringify(norm(x));
const cmp=(a,b)=>{const aa=Array.from(a),bb=Array.from(b);for(let i=0;i<Math.min(aa.length,bb.length);i++){const d=aa[i].codePointAt(0)-bb[i].codePointAt(0);if(d)return d;}return aa.length-bb.length;};
const base=read(join(repo,'audit/associative-v5-structural-cleanup/BEFORE-MANIFEST.json')),files=base.files.filter(f=>f.path.startsWith('current/'));
function hashes(){for(const f of files){const b=readFileSync(join(repo,f.path.slice(8)));assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);}}
hashes();let families=0,memberships=0,aliases=0;const buckets=[],start=performance.now();
for(let b=0;b<256;b++){
 const bucket=b.toString(16).padStart(2,'0'),root=join(repo,'associativvordes/family-index-v5'),fs=JSON.parse(gunzipSync(readFileSync(join(root,'families',bucket+'.json.gz'))));
 const sets=new Map(Object.keys(fs).map(fid=>[fid,{tokens:[],langs:{}}]));
 for(const lang of ['en','de','fr','es','it','ru'])for(const [fid,rows] of Object.entries(JSON.parse(gunzipSync(readFileSync(join(root,'members',lang,bucket+'.json.gz')))))){
  assert.ok(sets.has(fid));const f=sets.get(fid);if(rows.length)f.langs[lang]=rows.length;for(const r of rows){f.tokens.push([lang,r.lemma_id]);memberships++;}
 }
 const results=[];
 for(const fid of Object.keys(fs).sort(cmp)){
  const f=sets.get(fid);f.tokens.sort((a,b)=>cmp(a[0],b[0])||cmp(a[1],b[1]));assert.equal(new Set(f.tokens.map(canonical)).size,f.tokens.length);
  const h=createHash('sha256');for(const t of f.tokens)h.update(canonical(t)+'\n');
  results.push({family_id:fid,n:f.tokens.length,language_counts:f.langs,member_ids_sha256:h.digest('hex'),etymon_keys:fs[fid].etymon_keys||[],formation_source:fs[fid].source??null});families++;
 }
 const bytes=gzipSync(results.map(x=>canonical(x)+'\n').join(''),{level:6});writeFileSync(join(out,bucket+'.ndjson.gz.partial'),bytes);renameSync(join(out,bucket+'.ndjson.gz.partial'),join(out,bucket+'.ndjson.gz'));
 const af=JSON.parse(gunzipSync(readFileSync(join(root,'aliases',bucket+'.json.gz')))),ah=createHash('sha256');let edges=0;
 for(const alias of Object.keys(af).sort(cmp)){aliases++;for(const fid of af[alias].sort(cmp)){ah.update(canonical([alias,fid])+'\n');edges++;}}
 buckets.push({bucket,families:results.length,fingerprints_sha256:sha(bytes),alias_edges:edges,alias_edges_sha256:ah.digest('hex')});if(b%32===31)process.stderr.write(`independent buckets ${b+1}\n`);
}
hashes();assert.deepEqual([families,memberships,aliases],[2456543,10078319,1934050]);
writeFileSync(join(out,'MANIFEST.json'),canonical({schema:'boundary-independent-source/2',status:'PASS',families,memberships,aliases,production_files:files.length,buckets,linguistic_gold:false,production_writes:0})+'\n');
writeFileSync(join(out,'RESOURCE.json'),canonical({elapsed_seconds:(performance.now()-start)/1000,peak_rss_bytes:process.resourceUsage().maxRSS*1024})+'\n');console.log(JSON.stringify({families,memberships,aliases}));
