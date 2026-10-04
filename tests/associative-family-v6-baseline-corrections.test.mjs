import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {generateV6Memberships,searchV6} from '../associativvordes/js/associative-family-v6.js';
import {correctionHash,correctionKey,correctionPredecessor,replayBaselineCorrections,assertAuthorizedMemberships,loadBaselineCorrections} from '../scripts/lib/associative-v6-baseline-corrections.mjs';
const catalog=JSON.parse(fs.readFileSync('associativvordes/family-index-v6/catalog.json'));
function fixture(){
 const records=['alpha','beta'].map((word,i)=>({lemma_id:'synthetic:'+i,word,frequency_score:17+i,components:['unchanged']})),head={id:'synthetic:head',language:'en',normalized_head:'synthetic',sense:'fixture',version:1,evidence:[{source:'synthetic-proof'}]},corpus=new Map(records.map(r=>['en\0'+r.lemma_id,r]));
 const links=records.flatMap((r,i)=>(i?['family:nat']:['family:nat','family:loc']).map(family_id=>({language:'en',lemma_id:r.lemma_id,word:r.word,head_id:head.id,family_id,evidence:[{source:{path:'synthetic-source',family_id:'synthetic:source',record_sha256:correctionHash(r)},lemma_id:r.lemma_id}]})));
 const edges=['family:nat','family:loc'].map(family_id=>({head_id:head.id,family_id,status:'accepted',version:1,evidence:[{source:'synthetic-proof'}],lemma_ids:links.filter(l=>l.family_id===family_id).map(l=>l.lemma_id)}));
 const index={catalog,heads:[head],edges,links,corpus};index.memberships=generateV6Memberships(index);return index;
}
function dossier(index,status='excluded',ids=['synthetic:0'],version=1){
 const records=ids.map(id=>{const l=index.links.find(l=>l.family_id==='family:nat'&&l.lemma_id===id),row=index.corpus.get('en\0'+id);return {language:'en',family_id:'family:nat',lemma_id:id,word:row.word,source_record:row,source_locator:l.evidence[0].source,previous_status:index.correction_verdicts?.find(v=>v.lemma_id===id)?.status||'accepted',reason:'Independent synthetic wrong-component proof',evidence:[{source:'synthetic-new-proof'}]};});
 const keys=records.map(correctionKey).sort(),predecessor=correctionPredecessor(index,keys);
 return {schema_version:6,correction_schema_version:1,production_enabled:false,correction_authorized:true,synthetic_fixture:true,id:'synthetic:correction:'+version,version,status,records,affected_keys:keys,scope_sha256:correctionHash(keys),predecessor,previous_sha256:correctionHash(predecessor),reason:'Synthetic independent edge revision',evidence:[{source:'synthetic-proof'}]};
}
for(const status of ['excluded','uncertain'])test('synthetic accepted to '+status+' retains measured rows, sibling scope, other family and historical acceptance',()=>{
 const index=fixture(),before=structuredClone(index),d=dossier(index,status),r=replayBaselineCorrections({index,docs:[d],baseline:index.memberships});
 assert.deepEqual(index,before);assert.deepEqual(r.index.links,index.links);assert.deepEqual(r.index.heads,index.heads);assert.deepEqual(r.index.edges,index.edges);assert.deepEqual(r.index.corpus,index.corpus);
 assert.equal(r.index.memberships.length,2);assert.equal(r.metrics.baseline_corrections,1);assert.equal(r.index.correction_verdicts[0].historical_accepted,true);assert.deepEqual(r.index.correction_verdicts[0].original_membership,index.memberships.find(m=>m.family_id==='family:nat'&&m.lemma_id==='synthetic:0'));
 assert.deepEqual(searchV6(r.index,'nat').map(r=>r.lemma_id),['synthetic:1']);assert.deepEqual(searchV6(r.index,'loc').map(r=>r.lemma_id),['synthetic:0']);
 assert.deepEqual(replayBaselineCorrections({index,docs:[d],baseline:index.memberships}),r);assert.deepEqual(generateV6Memberships(r.index),r.index.memberships);
});
for(const[name,mutate,pattern]of [
 ['unknown correction',d=>{d.records[0].lemma_id='synthetic:unknown';d.affected_keys=d.records.map(correctionKey);d.scope_sha256=correctionHash(d.affected_keys)},/Unknown correction/],
 ['stale previous hash',d=>d.previous_sha256='0'.repeat(64),/Stale/],
 ['stale edge hash',d=>{d.predecessor[0].edge_sha256='0'.repeat(64);d.previous_sha256=correctionHash(d.predecessor)},/Stale/],
 ['partial wrong-ID scope',d=>{d.records[0].lemma_id='synthetic:1';d.affected_keys=d.records.map(correctionKey);d.scope_sha256=correctionHash(d.affected_keys)},/Stale/],
 ['omitted dossier ID',d=>d.affected_keys.push('en\0family:nat\0synthetic:1'),/scope/],
 ['changed measured row',d=>d.records[0].source_record={...d.records[0].source_record,frequency_score:999},/source proof/],
 ['missing authorization',d=>delete d.correction_authorized,/Unauthorized/],
 ['string authorization',d=>d.correction_authorized='true',/Unauthorized/],
 ['missing individual evidence',d=>d.records[0].evidence=[],/evidence/],
 ['invented acceptance',d=>d.status='accepted',/verdict/],
 ['wrong previous verdict',d=>d.records[0].previous_status='uncertain',/previous decision/],
 ['stale version',d=>d.version=2,/stale/],
])test('synthetic rejects '+name+' atomically',()=>{const index=fixture(),before=structuredClone(index),d=dossier(index);mutate(d);assert.throws(()=>replayBaselineCorrections({index,docs:[d],baseline:index.memberships}),pattern);assert.deepEqual(index,before);});
test('synthetic multi-ID dossier rejects partially edited scope',()=>{const i=fixture(),d=dossier(i,'excluded',['synthetic:0','synthetic:1']);d.records.pop();d.affected_keys=d.records.map(correctionKey);d.scope_sha256=correctionHash(d.affected_keys);assert.throws(()=>replayBaselineCorrections({index:i,docs:[d]}),/Stale/);});
test('synthetic versioned uncertain revision preserves previous excluded verdict and hash',()=>{const i=fixture(),a=dossier(i),r=replayBaselineCorrections({index:i,docs:[a]}),b=dossier(r.index,'uncertain',['synthetic:0'],2),final=replayBaselineCorrections({index:i,docs:[a,b]});assert.equal(final.ledger.length,2);assert.equal(final.ledger[1].predecessor[0].previous_status,'excluded');assert.equal(final.index.correction_verdicts[0].status,'uncertain');assert.equal(final.metrics.corrected_questions,1);assert.throws(()=>replayBaselineCorrections({index:i,docs:[a,{...b,previous_sha256:a.previous_sha256}]}),/Stale/);});
test('synthetic baseline loss without ledger, unexpected addition, and correction search leak reject',()=>{const i=fixture(),r=replayBaselineCorrections({index:i,docs:[dossier(i)]});assert.throws(()=>assertAuthorizedMemberships({historical:i.memberships,current:i.memberships.slice(1)}),/Unauthorized/);assert.throws(()=>assertAuthorizedMemberships({historical:i.memberships,current:[...i.memberships,i.memberships[0]]}),/Duplicate/);assert.throws(()=>assertAuthorizedMemberships({historical:i.memberships,current:i.memberships,verdicts:r.index.correction_verdicts}),/Unauthorized|leaked/);});
test('synthetic fixtures never enter the real registry',async()=>{const d=dossier(fixture()),b=Buffer.from(JSON.stringify(d)),registry={schema_version:6,correction_schema_version:1,production_enabled:false,decisions:[{path:'synthetic-dossier',sha256:(await import('node:crypto')).createHash('sha256').update(b).digest('hex')}]};await assert.rejects(loadBaselineCorrections({read:async p=>p.endsWith('baseline-corrections.json')?registry:d,readBytes:async p=>p.endsWith('baseline-corrections.json')?Buffer.from(JSON.stringify(registry)):b,inputs:{}}),/Synthetic/);});
test('real registry deliberately contains no invented corrections',()=>{const r=JSON.parse(fs.readFileSync('associativvordes/family-index-v6/baseline-corrections.json'));assert.deepEqual(r.decisions,[]);assert.equal(r.production_enabled,false);});
