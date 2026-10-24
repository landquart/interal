// Independent Node byte/inventory checker for BLOCKED readiness packages only.
// No data materialization, signatures, network access or production mutation.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';

const [directory,repo]=process.argv.slice(2);
if(!directory||!repo)throw Error('usage: node verify.mjs PACKAGE REPO');
const start=performance.now(),cpu=process.cpuUsage();
const root=path.resolve(directory),checkout=path.resolve(repo);
const canonical=v=>JSON.stringify(Array.isArray(v)?v.map(normalize):normalize(v));
function normalize(v){
 if(Array.isArray(v))return v.map(normalize);
 if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalize(v[k])]));
 return v;
}
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
function safe(root,name){
 if(path.isAbsolute(name)||name.split('/').some(x=>x==='..'||x==='.'||!x))throw Error('unsafe path');
 let p=root;
 for(const part of name.split('/')){p=path.join(p,part);if(fs.lstatSync(p).isSymbolicLink())throw Error('symlink');}
 if(!fs.statSync(p).isFile())throw Error('missing file');
 return p;
}
async function fileHash(p){
 const h=crypto.createHash('sha256');
 for await(const chunk of fs.createReadStream(p))h.update(chunk);
 return h.digest('hex');
}
const read=(r,n)=>JSON.parse(fs.readFileSync(safe(r,n),'utf8'));
const require=(ok,msg)=>{if(!ok)throw Error(msg);};
const index=read(root,'PACKAGE-INDEX.json');
const {content_sha256,...body}=index;
require(hash(canonical(body))===content_sha256,'index checksum');
const expected=['RELEASE-MANIFEST.json','BEFORE-AFTER-SUMMARY.json','INTEGRITY-REPORT.json','QUALITY-REPORT.json','ROLLBACK-RECEIPT.json','GATES.json','UNRESOLVED-INDEX.json','SOURCE-LOCK.json','REMOTE-OBSERVATIONS.json','FINAL-CLEANUP-AUDIT.md'].sort();
require(JSON.stringify(index.files.map(x=>x.path).sort())===JSON.stringify(expected),'missing/duplicate/unexpected inventory');
require(JSON.stringify(fs.readdirSync(root).sort())===JSON.stringify([...expected,'PACKAGE-INDEX.json'].sort()),'extra files');
let checked=0,bytes=0;
for(const row of index.files){
 const p=safe(root,row.path);
 require(fs.statSync(p).size===row.bytes&&await fileHash(p)===row.sha256,'package bytes '+row.path);
 checked++;bytes+=row.bytes;
}
const release=read(root,'RELEASE-MANIFEST.json'),source=read(root,'SOURCE-LOCK.json'),gates=read(root,'GATES.json');
require(release.status==='BLOCKED_NO_RELEASE_CANDIDATE'&&release.publication_allowed===false&&release.approved_release_id===null,'not a supported blocked package');
require(release.source_lock_sha256===await fileHash(safe(root,'SOURCE-LOCK.json')),'source binding');
require(release.gates_sha256===await fileHash(safe(root,'GATES.json')),'gate binding');
require(JSON.stringify(release.blockers)===JSON.stringify(gates.filter(g=>g.status!=='PASS').map(g=>g.id)),'gate mismatch');
const seen=new Set();
const config=read(checkout,'associativvordes/v5_release_control/INPUTS.json');
require(canonical(source.inputs)===canonical(config.files),'incomplete or substituted required source inventory');
for(const row of source.inputs){
 require(!seen.has(row.path),'duplicate input');seen.add(row.path);
 const p=safe(checkout,row.path);
 require(fs.statSync(p).size===row.bytes&&await fileHash(p)===row.sha256,'input bytes '+row.path);
 checked++;bytes+=row.bytes;
}
for(const [name,field] of [
 ['associativvordes/v5_release_control/INPUTS.json','input_config_sha256'],
 ['associativvordes/v5_release_control/package.py','compiler_sha256'],
 ['associativvordes/release_control/control.py','release_controller_sha256'],
 ['associativvordes/full_v5_dry_run/completion.py','completion_validator_sha256']
])require(await fileHash(safe(checkout,name))===source[field],'current code/input configuration differs '+name);
for(const row of source.executed_dry_run_code_drift)require(await fileHash(safe(checkout,row.path))===row.current_sha256,'recorded code drift changed');
console.log(JSON.stringify({schema:'v5-independent-readiness-verification/1',status:'PASS_BLOCKED_PACKAGE_BYTE_INTEGRITY',publication_allowed:false,linguistic_certification:false,full_corpus_recount:false,checked_files:checked,checked_bytes:bytes,wall_seconds:(performance.now()-start)/1000,cpu_microseconds:process.cpuUsage(cpu),peak_rss_kib:process.resourceUsage().maxRSS}));
