import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {searchV6,loadParallelV6} from '../associativvordes/js/associative-family-v6.js';
const root='associativvordes/family-index-v6/generated';
const read=p=>JSON.parse(p.endsWith('.gz')?gunzipSync(fs.readFileSync(p)):fs.readFileSync(p));
test('full global inventory and generated artifacts retain exact manual counts and fingerprints',()=>{
 const m=read(root+'/manifest.json'),r=read(root+'/migration-report.json');assert.equal(r.classified_objects,2456540);assert.equal(r.true_associative_families,16);assert.equal(r.generated_lemma_memberships,19967);assert.equal(r.accepted_memberships_by_family['family:ped'],1556);assert.equal(r.accepted_memberships_by_family['family:creat'],574);assert.equal(r.accepted_memberships_by_family['family:observ'],315);assert.equal(r.accepted_memberships_by_family['family:inform'],1473);
 for(const[p,h]of Object.entries(m.artifacts))assert.equal(createHash('sha256').update(fs.readFileSync(root+'/'+p)).digest('hex'),h);
 const d=read(root+'/differential.json.gz');assert.equal(d.manual_memberships.length,19967);assert.deepEqual(d.unexpected_additions,[]);assert.deepEqual(d.unexpected_removals,[]);assert(r.legacy_exact_record_units>0);assert.equal(r.tenfold_review_reduction_demonstrated,false);
});
test('parallel runtime distinguishes user families, exact corpus proofs and val evidence targets',async()=>{
 const i=await loadParallelV6({readJson:async p=>read(p)});assert(i.search('ped','en').some(m=>m.word==='pedicure'));assert.deepEqual(i.search('pede','en'),i.search('ped','en'));assert(i.search('observ','it').some(m=>m.word==='osservazione'));assert(i.search('loc','ru').some(m=>m.word==='локальный'));assert.equal(i.search('cre').length,0);
 const v=await i.routeQuery('val');assert.equal(v.family_targets.length,0);assert.equal(v.evidence_targets.length,15);assert.equal(v.establishes_membership,false);
 for(const id of v.evidence_targets){if(id.startsWith('ety:'))assert.equal((await i.getEvidenceNode(id)).associative_family_id,null);else assert.equal((await i.getComponentCandidate(id)).associative_family_id,null);}
 const member=i.search('inform','en')[0],proof=member.source_proof[0];const corpus=await i.getCorpusRecord({...proof.source,lemma_id:member.lemma_id});assert.equal(corpus.word,member.word);assert(corpus.sources.length);assert(corpus.category_breakdown);
});
