import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {digest} from './associative-v6-contamination.mjs';
export function readPartitionDossier(dir){
 const root=JSON.parse(gunzipSync(fs.readFileSync(path.join(dir,'partition-dossier.json.gz'))));
 const {storage,...d}=root;assert(storage,'Missing sharded storage');const files=new Set();
 for(const kind of ['incidences','flags']){
  d[kind]=[];for(const shard of storage[kind]){
   assert(new RegExp('^'+kind+'-\\d{3}\\.json\\.gz$').test(shard.path),'Unsafe shard path');assert(!files.has(shard.path),'Duplicate shard');files.add(shard.path);
   const bytes=fs.readFileSync(path.join(dir,shard.path));assert.equal(digest(bytes),shard.sha256,'Stale shard '+shard.path);const rows=JSON.parse(gunzipSync(bytes));assert.equal(rows.length,shard.count,'Partial shard');d[kind].push(...rows);
  }
 }
 assert.equal(d.incidences.length,d.metrics.incidences,'Lost incidence shard');assert.equal(d.flags.length,Object.values(d.metrics.flag_counts).reduce((a,b)=>a+b,0),'Lost flag shard');return d;
}
