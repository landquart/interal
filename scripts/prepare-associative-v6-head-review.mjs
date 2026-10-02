#!/usr/bin/env node
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {applyHeadReview} from '../associativvordes/js/associative-family-v6.js';
const input=process.argv[2],output=process.argv[3];if(!input||!output)throw Error('Usage: prepare-associative-v6-head-review.mjs decision.json output-ledger.json');
const root='associativvordes/family-index-v6/generated',sha=b=>createHash('sha256').update(b).digest('hex'),read=async p=>{const b=await fs.readFile(p);return JSON.parse(p.endsWith('.gz')?gunzipSync(b):b);};
const hashes={},load=async p=>{hashes[p]=sha(await fs.readFile(p));return read(p);};
const index={catalog:await load('associativvordes/family-index-v6/catalog.json'),heads:await load(root+'/heads.json.gz'),edges:await load(root+'/edges.json.gz'),links:await load(root+'/lemma-head-links.json.gz'),corpus:new Map()},cache=new Map();
for(const l of index.links){const p=l.evidence[0].source;if(!cache.has(p.path))cache.set(p.path,await load(p.path));const m=cache.get(p.path)[p.family_id].find(m=>m.lemma_id===l.lemma_id);if(sha(Buffer.from(JSON.stringify(m)))!==p.record_sha256)throw Error('Changed exact corpus proof');index.corpus.set(l.language+'\0'+l.lemma_id,m);}
const decision=await load(input),result=applyHeadReview(index,decision);await fs.writeFile(output,JSON.stringify({schema_version:6,status:'prepared_not_applied',decision:result.decision_ledger,input_sha256:hashes,generated_membership_sha256:sha(Buffer.from(JSON.stringify(result.memberships))),generated_membership_count:result.memberships.length,production_enabled:false},null,2)+'\n');console.log(JSON.stringify({status:'prepared_not_applied',affected:result.decision_ledger.affected_lemma_ids.length,output}));
