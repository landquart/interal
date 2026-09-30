#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {recountMaterializedMembers,refreshFamilySummaries,repositoryTreeMetadata} from './lib/associative-repository-materialization.mjs';
const root=process.argv[2]||'associativvordes/family-index-v5';
const read=async name=>JSON.parse(await readFile(join(root,name),'utf8'));
const manifest=await read('manifest.json'),report=await read('report.json'),provenance=await read('repository-provenance.json');
if(manifest.repository_storage.immutable_source_run_id!==35647932153||provenance.source_run_id!==35647932153)throw Error('Unexpected immutable source');
const counts=await recountMaterializedMembers(root,manifest,report);
await refreshFamilySummaries(root,report);
if(manifest.counts.families!==report.total_families)throw Error('Manifest family count mismatch');
await writeFile(join(root,'report.json'),JSON.stringify(report,null,2)+'\n');
Object.assign(provenance,await repositoryTreeMetadata(root));
await writeFile(join(root,'repository-provenance.json'),JSON.stringify(provenance,null,2)+'\n');
console.log(JSON.stringify(counts));
