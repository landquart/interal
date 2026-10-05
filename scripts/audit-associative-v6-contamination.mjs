#!/usr/bin/env node
// Independent source reconstruction/conservation, not just aggregate count checks.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {readPartitionDossier} from './lib/associative-v6-contamination-io.mjs';
import {digest,corpusKey,FLAGS} from './lib/associative-v6-contamination.mjs';
const p=process.argv[2]||'audit/associative-family-v6/prompt07-contamination-20261005/generated';
const read=async f=>{const b=await fs.readFile(f);return JSON.parse(f.endsWith('.gz')?gunzipSync(b):b);};
const d=readPartitionDossier(p),lock=await read(p+'/input-lock.json'),sources=new Map();
for(const[file,hash]of Object.entries(lock)){const b=await fs.readFile(file);assert.equal(digest(b),hash,'Stale input '+file);sources.set(file,JSON.parse(file.endsWith('.gz')?gunzipSync(b):b));}
const manifest=await read(p+'/build-manifest.json');for(const[file,hash]of Object.entries(manifest.code_sha256))assert.equal(digest(await fs.readFile(file)),hash,'Stale code '+file);assert.deepEqual(manifest.source_conservation,d.source_conservation);
const research=sources.get('audit/associative-family-v6/prompt07-contamination-20261005/research.json');for(const[file,hash]of Object.entries(research.source_sha256))assert.equal(digest(await fs.readFile(file)),hash,'Stale research source '+file);
const expected=[];
const root='audit/associative-family-v6/';
for(const[frame,file]of [['val',root+'val-route-review-20261003/records.json.gz'],['russian',root+'russian-short-review-20261003/records.json.gz']]){
 for(const[i,r]of sources.get(file).entries()){const rec=r.source_record||r;expected.push({frame,route_id:r.route_id||r.candidate_id,language:r.language,lemma_id:rec.lemma_id,word:rec.word,locator:file+'#/'+i,source_record:r});}
}
const file=root+'tower-promotion-source-frame-20261003.json.gz';for(const[i,route]of sources.get(file).entries())for(const[j,r]of route.records.entries())expected.push({frame:'tower',route_id:route.route_id,language:r.language,lemma_id:r.lemma_id,word:r.word,locator:file+'#/'+i+'/records/'+j,source_record:r});
const sys=root+'system-promotion-research-20261003.json',a=root+'anis-promotion-research-20261003.json';
const aniso=sources.get(a).negative_controls.findIndex(r=>r.language==='fr'&&r.word==='anisotropy');
expected.push({frame:'controls',route_id:'system.translation',language:'ru',lemma_id:sources.get(sys).negative_alias_control.source_record.lemma_id,word:'состав',locator:sys+'#/negative_alias_control/source_record',source_record:sources.get(sys).negative_alias_control.source_record});
expected.push({frame:'controls',route_id:'anis.scientific',language:'fr',lemma_id:sources.get(a).negative_controls[aniso].lemma_id,word:'anisotropy',locator:a+'#/negative_controls/'+aniso+'/source_record',source_record:sources.get(a).negative_controls[aniso].source_record});
const actual=new Map(d.incidences.map(r=>[r.locator,r]));assert.equal(actual.size,expected.length,'Lost or duplicated source locator');
for(const row of expected){const r=actual.get(row.locator);assert(r,'Missing source occurrence');for(const k of Object.keys(row))assert.deepEqual(r[k],row[k],'Changed source '+k);assert.equal(r.source_record_sha256,digest(row.source_record));assert.equal(r.source_sha256,lock[row.locator.split('#/')[0]]);}
const ids=d.incidences.map(r=>r.incidence_id).sort();assert.equal(new Set(ids).size,ids.length);assert.equal(d.source_conservation.incidence_set_sha256,digest(ids));
assert.equal(d.source_conservation.corpus_set_sha256,digest([...new Set(d.incidences.map(corpusKey))].sort()));
const incidenceMap=new Map(d.incidences.map(r=>[r.incidence_id,r])),frameMap=new Map();for(const r of d.incidences){const k=r.frame+'\0'+corpusKey(r);if(!frameMap.has(k))frameMap.set(k,[]);frameMap.get(k).push(r);}
const all=new Set(ids),covered=new Set(),branches=new Map(d.partitions.map(b=>[b.id,b]));
for(const part of d.partitions){assert.equal(part.accepted_membership_created,false);assert.equal(part.linguistic_adjudication_created,false);assert.equal(part.membership_authorized,false);assert.equal(part.canonical_approval,false);assert.equal(part.family_id,null);const rows=part.incidence_ids.map(id=>{assert(all.has(id),'Unknown partition incidence');covered.add(id);return incidenceMap.get(id);});assert.deepEqual([...new Set(rows.map(corpusKey))].sort(),part.corpus_ids);assert.deepEqual([...new Set(rows.map(r=>r.source_record_sha256))].sort(),part.source_payload_hashes);}
assert.deepEqual([...covered].sort(),ids,'Lost partition evidence');
const questions=new Map(d.records.map(r=>[r.frame+'\0'+corpusKey(r),r]));assert.equal(questions.size,d.records.length);
for(const r of d.records){assert(!r.accepted_membership_created&&!r.linguistic_exclusion_created&&!r.lexical_identity_proven);const rows=frameMap.get(r.frame+'\0'+corpusKey(r));assert.deepEqual(rows.map(x=>x.incidence_id).sort(),r.incidence_ids);for(const b of r.branch_ids)assert(branches.get(b).corpus_ids.includes(corpusKey(r)));}
for(const flag of d.flags){assert(FLAGS.includes(flag.kind));assert(!flag.creates_membership&&!flag.creates_exclusion);assert(flag.evidence.length&&flag.reason&&flag.certainty);assert(flag.incidence_ids.every(id=>all.has(id)));}
const get=id=>branches.get(id);assert(get('ru.um.mental').head_scope==='national_only_research');assert.equal(get('ru.um.mental').corpus_ids.length,2);assert.deepEqual(get('val.valence.chemical').corpus_ids,get('val.valence.linguistic').corpus_ids);assert.notEqual(get('val.valley').id,get('val.vallum').id);assert.equal(get('val.valley').candidate_canonical,get('val.vallum').candidate_canonical);
const vallo=d.records.find(r=>r.frame==='val'&&r.language==='it'&&r.word==='vallo');assert(vallo.branch_ids.includes('val.valley')&&vallo.branch_ids.includes('val.vallum'));
const controls=await read(p+'/controls.json');assert.deepEqual(controls.negative_controls.map(r=>r.word),['состав','anisotropy']);assert(controls.negative_controls.every(r=>!r.accepted_membership_created));
assert.equal(d.metrics.catalog_promotions,0);assert.equal(d.metrics.accepted_additions,0);assert.equal(d.metrics.accepted_removals,0);assert.equal(d.metrics.current_queue_resolutions,0);
assert.equal(d.metrics.frames.val.incidences,24896);assert.equal(d.metrics.frames.val.unique_ids,5516);assert.equal(d.metrics.frames.russian.incidences,2637);assert.equal(d.metrics.frames.russian.unique_ids,2633);assert.equal(d.metrics.frames.tower.incidences,2166);assert.equal(d.metrics.frames.tower.unique_ids,1083);
console.log(JSON.stringify({verdict:'pass',exact_source_occurrences:expected.length,all_payloads_reconstructed:true,independent_routes_conserved:true,other_family_memberships_untouched:true,flags_have_no_linguistic_verdict:true}));
