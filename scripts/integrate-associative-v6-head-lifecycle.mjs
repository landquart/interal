#!/usr/bin/env node
import fs from 'node:fs/promises';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {loadHeadLifecycle,replayHeadLifecycle} from './lib/associative-v6-head-lifecycle.mjs';
const [dossier,mode='--dry-run',output]=process.argv.slice(2);
if(!dossier||!['--dry-run','--apply'].includes(mode))throw Error('Usage: dossier.json [--dry-run|--apply] [report.json]');
const read=async p=>{const b=await fs.readFile(p);return JSON.parse(p.endsWith('.gz')?gunzipSync(b):b);},sha=b=>createHash('sha256').update(b).digest('hex');
const registryPath='associativvordes/family-index-v6/head-lifecycle.json',registry=await read(registryPath),doc=await read(dossier);
if(registry.decisions.some(e=>e.path===dossier))throw Error('Repeated lifecycle application');
const entry={path:dossier,sha256:sha(await fs.readFile(dossier))};
const validated=await loadHeadLifecycle({read:p=>p===registryPath?Promise.resolve({...registry,decisions:[entry]}):read(p),readBytes:p=>fs.readFile(p),inputs:{}});
const base='associativvordes/family-index-v6/generated/',manifest=await read(base+'manifest.json');
for(const p of ['heads.json.gz','edges.json.gz','lemma-head-links.json.gz','memberships.json.gz'])if(sha(await fs.readFile(base+p))!==manifest.artifacts[p])throw Error('Changed generated predecessor '+p);
const index={catalog:await read('associativvordes/family-index-v6/catalog.json'),heads:await read(base+'heads.json.gz'),edges:await read(base+'edges.json.gz'),links:await read(base+'lemma-head-links.json.gz'),memberships:await read(base+'memberships.json.gz'),corpus:new Map()};
const cache=new Map();for(const l of index.links){const p=l.evidence[0].source;if(!cache.has(p.path)){const shard=await read(p.path),selected=new Map();for(const wanted of index.links.filter(x=>x.evidence[0].source.path===p.path)){const r=shard[wanted.evidence[0].source.family_id]?.find(x=>x.lemma_id===wanted.lemma_id);if(r)selected.set(wanted.language+'\0'+wanted.lemma_id,r);}cache.set(p.path,selected);}const r=cache.get(p.path).get(l.language+'\0'+l.lemma_id);if(!r||sha(Buffer.from(JSON.stringify(r)))!==p.record_sha256)throw Error('Stale original link');index.corpus.set(l.language+'\0'+l.lemma_id,r);}
const initialLedger=[...await read(base+'head-review-ledger.json'),...(await read(base+'family-promotion-ledger.json')).decisions];
const result=replayHeadLifecycle({index,docs:validated,initialLedger});
const report={mode,registry_applied:mode==='--apply',dossier,sha256:entry.sha256,metrics:result.metrics,differential:result.differential,history:result.ledger};
if(output)await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
if(mode==='--apply')await fs.writeFile(registryPath,JSON.stringify({...registry,decisions:[...registry.decisions,entry]},null,2)+'\n');
console.log(JSON.stringify({mode,new_memberships:result.differential.additions.length,removed:result.differential.removals.length,version_changes:result.differential.version_changes.length,metrics:result.metrics}));
