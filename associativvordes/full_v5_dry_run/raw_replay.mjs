// Independent full gzip decode and exact file accounting, without the Python parser.
import fs from 'node:fs';import path from 'node:path';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
const work=process.argv[2];if(!work)throw Error('work required');
const read=p=>JSON.parse(fs.readFileSync(p));const hash=b=>createHash('sha256').update(b).digest('hex');
const before=path.join(work,'before'),after=path.join(work,read(path.join(work,'SHADOW-PATH.json')).relative),lock=read(path.join(before,'SNAPSHOT.json'));
const started=performance.now(),cpu=process.cpuUsage();
for(const r of lock.files){const a=fs.readFileSync(path.join(before,r.path)),b=fs.readFileSync(path.join(after,r.path));if(a.length!==r.bytes||hash(a)!==r.sha256||!a.equals(b))throw Error('unapproved exact byte change '+r.path);}
const prefix='associativvordes/family-index-v5';const langs=['en','de','fr','es','it','ru'];
const decode=(p)=>JSON.parse(gunzipSync(fs.readFileSync(p)));
let families=0,memberships=0,aliases=0,aliasPairs=0,sourceRows=0;const byLanguage=Object.fromEntries(langs.map(l=>[l,0])),buckets=[];
for(let i=0;i<256;i++){
 const b=i.toString(16).padStart(2,'0');const f=decode(path.join(after,'current',prefix,'families',b+'.json.gz'));const support=new Map();let n=0,original=0;
 for(const [fid,v] of Object.entries(f)){if(v.id!==fid)throw Error('family identity');support.set(fid,0);families++;}
 for(const l of langs){
  const data=decode(path.join(after,'current',prefix,'members',l,b+'.json.gz'));
  for(const [fid,rows] of Object.entries(data)){
   if(!support.has(fid)||!Array.isArray(rows)||!rows.length)throw Error('orphan/empty members');const ids=new Set();
   for(const r of rows){if(typeof r.lemma_id!=='string'||typeof r.word!=='string'||ids.has(r.lemma_id))throw Error('invalid/duplicate current membership');ids.add(r.lemma_id);}
   support.set(fid,support.get(fid)+rows.length);n+=rows.length;byLanguage[l]+=rows.length;
  }
  const src=decode(path.join(after,'original',prefix,'members',l,b+'.json.gz'));
  for(const rows of Object.values(src)){if(!Array.isArray(rows))throw Error('source rows');original+=rows.length;}
 }
 for(const [fid,n] of support)if(f[fid].support!==n)throw Error('family support mismatch');
 const a=decode(path.join(after,'current',prefix,'aliases',b+'.json.gz'));
 for(const targets of Object.values(a)){if(!Array.isArray(targets)||!targets.length||new Set(targets).size!==targets.length)throw Error('alias target shape');aliasPairs+=targets.length;}
 aliases+=Object.keys(a).length;memberships+=n;sourceRows+=original;buckets.push({bucket:b,families:Object.keys(f).length,memberships:n,aliases:Object.keys(a).length,original_carrier_rows:original});
 if(i%16===15)process.stdout.write(JSON.stringify({phase:'independent_decode',bucket:b})+'\n');global.gc?.();
}
const counts={families,memberships,aliases,alias_target_pairs:aliasPairs,original_carrier_membership_rows:sourceRows};
if(families!==2456543||memberships!==10078319||aliases!==1934050)throw Error('full census counts differ');
const result={schema:'full-v5-independent-raw-replay/1',status:'PASS_FULL_BYTE_AND_DECODE_REPLAY',counts,memberships_by_language:byLanguage,buckets,files_compared:lock.files.length,unapproved_changed_files:0,implementation:'Node gzip/JSON decoder versus pinned Python census with strict bucket decoder',source_unique_ids_checked_by:'Separate complete before/after SQLite censuses; original carrier rows are not original assignments',wall_seconds:(performance.now()-started)/1000,cpu_microseconds:process.cpuUsage(cpu),peak_rss_kib:process.resourceUsage().maxRSS,production_writes:0};
const out=path.join(work,'RAW-INDEPENDENT-REPLAY.json');fs.writeFileSync(out+'.partial',JSON.stringify(result));fs.renameSync(out+'.partial',out);
