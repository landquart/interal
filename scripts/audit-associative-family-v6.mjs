#!/usr/bin/env node
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {validateCatalog,classifyV5Object,generateV6Memberships,searchV6,loadParallelV6} from '../associativvordes/js/associative-family-v6.js';
const base=process.argv[2]||'associativvordes/family-index-v6/generated',out=process.argv[3]||'audit/associative-family-v6/integrity.json';
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=async p=>{const b=await fs.readFile(p);return JSON.parse(p.endsWith('.gz')?gunzipSync(b):b);};
const assert=(v,s)=>{if(!v)throw Error(s);};
const manifest=await read(base+'/manifest.json'),catalog=validateCatalog(await read(manifest.catalog)),lock=await read(base+'/source-lock.json');
assert(sha(await fs.readFile(manifest.catalog))===manifest.catalog_sha256,'catalog hash changed');
for(const[p,h]of Object.entries(manifest.artifacts))assert(sha(await fs.readFile(base+'/'+p))===h,'changed output '+p);
for(const[p,h]of Object.entries(lock)){const hash=createHash('sha256');for await(const chunk of createReadStream(p))hash.update(chunk);assert(hash.digest('hex')===h,'changed immutable input '+p);}
const diff=execFileSync('git',['diff','--name-only',catalog.source_head,'--','associativvordes/family-index-v5','associativvordes/frequency lists','audit/associative-family-v5'],{encoding:'utf8'});assert(!diff.trim(),'v5 evidence base modified');
const report=await read(base+'/migration-report.json'),classification={},ids=new Set();
for(const b of Array.from({length:256},(_,i)=>i.toString(16).padStart(2,'0'))){
 const inventory=await read(base+'/inventory/'+b+'.json.gz'),old=await read('associativvordes/family-index-v5/families/'+b+'.json.gz');assert(inventory.length===Object.keys(old).length,'inventory shard cardinality');
 for(const[id,kind,family]of inventory){assert(!ids.has(id),'duplicate inventory identity');ids.add(id);const expected=classifyV5Object(old[id],catalog);assert(expected.kind===kind&&expected.family_id===family,'invented promotion '+id);classification[kind]=(classification[kind]||0)+1;}
}
assert(ids.size===2456540,'incomplete global inventory');for(const k of new Set([...Object.keys(classification),...Object.keys(report.classification_counts)]))assert(classification[k]===report.classification_counts[k],'classification mismatch '+k);
const heads=await read(base+'/heads.json.gz'),edges=await read(base+'/edges.json.gz'),links=await read(base+'/lemma-head-links.json.gz'),memberships=await read(base+'/memberships.json.gz'),corpus=new Map(),cache=new Map();
for(const l of links){const p=l.evidence[0].source;let shard=cache.get(p.path);if(!shard){shard=await read(p.path);cache.set(p.path,shard);}const m=shard[p.family_id]?.find(m=>m.lemma_id===l.lemma_id);assert(m&&m.word===l.word&&sha(Buffer.from(JSON.stringify(m)))===p.record_sha256,'lost/modified original measured record');corpus.set(l.language+'\0'+l.lemma_id,m);}
const generated=generateV6Memberships({catalog,heads,edges,links,corpus});assert(JSON.stringify(generated)===JSON.stringify(memberships),'nonreproducible head-to-family output');
const expected=[];for(const f of catalog.families)for(const old of f.legacy_ids)for(const language of ['en','de','fr','es','it','ru']){
 let h=0x811c9dc5;for(const c of old){h^=c.codePointAt(0);h=Math.imul(h,0x01000193);}const b=((h>>>0)%256).toString(16).padStart(2,'0');const shard=await read('associativvordes/family-index-v5/members/'+language+'/'+b+'.json.gz');for(const m of shard[old]||[])expected.push(language+'\0'+f.id+'\0'+m.lemma_id);
}
assert(JSON.stringify(expected.sort())===JSON.stringify(memberships.map(m=>m.language+'\0'+m.family_id+'\0'+m.lemma_id).sort()),'unexpected differential change');
const controls=[];for(const[root,c]of Object.entries(catalog.golden_controls)){
 for(const word of c.positive){const matches=searchV6({catalog,memberships},root).filter(m=>m.word===word);assert(matches.length,'missing golden positive '+root+'/'+word);controls.push({root,word,expected:'accepted',lemma_ids:matches.map(m=>m.lemma_id)});}
 for(const word of c.negative){const language=word==='creer'?'es':undefined;const matches=searchV6({catalog,memberships},root,language).filter(m=>m.word.toLowerCase()===word);assert(!matches.length,'golden negative admitted '+root+'/'+word);controls.push({root,word,language,expected:'excluded_from_accepted_memberships'});}
}
const parallel=await loadParallelV6({readJson:read}),val=await parallel.routeQuery('val');assert(val.family_targets.length===0&&val.evidence_targets.length===15&&!val.establishes_membership,'val alias merged targets');
const result={schema_version:6,verdict:'pass',source_head:catalog.source_head,locked_source_files:Object.keys(lock).length,classified_objects:ids.size,classification_counts:classification,preserved_manual_memberships:memberships.length,unexpected_differences:0,golden_controls:controls,val_retained_candidate_targets:15,production_enabled:false,v5_bytes_unchanged:true,full_linguistic_certification:false};await fs.mkdir(out.slice(0,out.lastIndexOf('/')),{recursive:true});await fs.writeFile(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
