#!/usr/bin/env node
// Applies only an already reviewed finite dossier; it never chooses a root or a linguistic verdict.
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {validateCatalog} from '../associativvordes/js/associative-family-v6.js';
import {validatePromotionDecision,loadFamilyPromotions} from './lib/associative-v6-family-promotion.mjs';
const stage=process.argv[2];if(!stage)throw Error('Explicit reviewed promotion dossier required');
const read=async p=>{const b=await fs.readFile(p);return JSON.parse(p.endsWith('.gz')?gunzipSync(b):b);};
const config='associativvordes/family-index-v6/catalog.json',registryPath='associativvordes/family-index-v6/family-promotions.json',catalog=await read(config),doc=validatePromotionDecision(await read(stage));
let registry;try{registry=await read(registryPath);}catch(e){if(e.code!=='ENOENT')throw e;registry={schema_version:6,production_enabled:false,decisions:[]};}
if(catalog.families.some(f=>f.id===doc.family.id)||registry.decisions.includes(stage))throw Error('Promotion already exists');
catalog.families.push(doc.family);catalog.golden_controls[doc.family.canonical]={positive:[...new Set(doc.positive_controls.map(r=>r.word))],negative:[...new Set(doc.negative_controls.map(r=>r.word))]};registry.decisions.push(stage);validateCatalog(catalog);
// Validate hashes, source records and complete registry before any file mutation.
await loadFamilyPromotions({catalog,inputs:{},read:p=>p===registryPath?Promise.resolve(registry):read(p),readBytes:p=>p===registryPath?Promise.resolve(Buffer.from(JSON.stringify(registry))):fs.readFile(p)});
await fs.writeFile(config,JSON.stringify(catalog,null,2)+'\n');await fs.writeFile(registryPath,JSON.stringify(registry,null,2)+'\n');
console.log(JSON.stringify({family:doc.family.id,heads:doc.groups.length,finite_records:doc.positive_controls.length,production_enabled:false}));
