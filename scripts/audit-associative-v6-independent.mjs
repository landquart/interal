#!/usr/bin/env node
// This oracle deliberately does not import any membership generator/materializer.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {recognizeFiniteHeadBindings,proposeMorphologicalHeads} from '../associativvordes/js/associative-family-v6-head-recognition.js';
import {loadLexicalReview} from './lib/associative-v6-lexical-review.mjs';
import {loadV6ShadowRuntime} from '../associativvordes/js/associative-family-v6-shadow.js';
import {replayHeadLifecycle} from './lib/associative-v6-head-lifecycle.mjs';
import {loadFamilyPromotions} from './lib/associative-v6-family-promotion.mjs';
import {decideLexicalRow} from './lib/associative-v6-senses-policy.mjs';
const out=process.argv.find(x=>x.endsWith('.json'))||'audit/associative-family-v6/prompt10-independent-20261007/validation/independent.json';
const read=p=>JSON.parse(p.endsWith('.gz')?gunzipSync(fs.readFileSync(p)):fs.readFileSync(p));
const hash=b=>createHash('sha256').update(b).digest('hex'),objectHash=o=>hash(Buffer.from(JSON.stringify(o))),key=r=>[r.language,r.family_id,r.lemma_id].join('\0');
const base='associativvordes/family-index-v6/generated/',results=[];
function check(name,fn){try{const details=fn();results.push({name,status:'pass',details});}catch(e){results.push({name,status:'fail',reason:e.message});}}
function require(v,s){if(!v)throw Error(s);}
const members=read(base+'memberships.json.gz'),links=read(base+'lemma-head-links.json.gz'),heads=read(base+'heads.json.gz'),edges=read(base+'edges.json.gz'),catalog=read('associativvordes/family-index-v6/catalog.json');
const H=new Map(heads.map(h=>[h.id,h])),E=new Map(edges.map(e=>[e.head_id+'\0'+e.family_id,e])),M=new Map(members.map(m=>[key(m),m])),corrections=read(base+'correction-verdicts.json.gz');
check('independent finite edge/link membership oracle',()=>{
 require(H.size===heads.length&&E.size===edges.length&&M.size===members.length,'duplicate identity');const expected=new Map();
 const withheld=new Set(corrections.filter(c=>['excluded','uncertain'].includes(c.status)).map(key));
 for(const l of links){const h=H.get(l.head_id),e=E.get(l.head_id+'\0'+l.family_id);require(h&&e&&h.language===l.language,'wrong head/edge language identity');require(e.lemma_ids.includes(l.lemma_id),'link outside finite edge scope');
  if(e.status==='accepted'&&!withheld.has(key(l))){require(!expected.has(key(l)),'duplicate accepted question');expected.set(key(l),{language:l.language,family_id:l.family_id,lemma_id:l.lemma_id,word:l.word,head_id:l.head_id,edge_version:e.version,source_proof:l.evidence});}
 }
 require(expected.size===M.size,'different cardinality');for(const[k,m]of M)require(JSON.stringify(m)===JSON.stringify(expected.get(k)),'independent membership mismatch '+k);
 return {links:links.length,accepted:expected.size,oracle:'explicit edge status + exact finite scope + immutable links; no production generator'};
});
check('exact real source locators and source measurements',()=>{
 const byPath=new Map();for(const l of links){const s=l.evidence[0]?.source;require(s&&new RegExp('^associativvordes/family-index-v5/members/'+l.language+'/[0-9a-f]{2}\\.json\\.gz$').test(s.path),'forged or wrong-language locator');const a=byPath.get(s.path)||[];a.push(l);byPath.set(s.path,a);}
 let n=0;for(const[p,ls]of byPath){const shard=read(p),families=new Map();for(const l of ls){const s=l.evidence[0].source;if(!families.has(s.family_id))families.set(s.family_id,new Map((shard[s.family_id]||[]).map(r=>[r.lemma_id,r])));const original=families.get(s.family_id).get(l.lemma_id);require(original&&original.word===l.word&&objectHash(original)===s.record_sha256,'changed source identity/measurement '+key(l));n++;}}
 return {links:n,source_shards:byPath.size,loss_source_word_is_not_loss_edge:true};
});
check('frozen explicit compatibility grants independently cover every saved binding and decision',()=>{
 const review=read('associativvordes/family-index-v6/lexical-head-review.json.gz'),grants=read('associativvordes/family-index-v6/review-application-authorizations.json');
 const B=new Map(grants.bindings.map(g=>[g.binding_sha256,g])),R=new Map(grants.reviews.map(g=>[g.decision_sha256,g]));
 require(B.size===grants.bindings.length&&R.size===grants.reviews.length,'duplicate grant');
 for(const b of review.finite_bindings){const g=B.get(objectHash(b));require(b.binding_authorized===true||g?.binding_authorized===true,'unapproved binding');}
 for(const d of review.head_reviews){const flag={accepted:'accepted_membership_authorized',excluded:'excluded_membership_authorized',uncertain:'uncertain_membership_authorized'}[d.status],g=R.get(objectHash(d));require(flag&&(d.binding_authorized===true&&d[flag]===true||g?.binding_authorized===true&&g?.[flag]===true),'unapproved decision');}
 return {bindings:review.finite_bindings.length,decisions:review.head_reviews.length,note:'grant coverage does not prove the runtime consumes grants'};
});
const script=resolve('scripts/integrate-associative-v6-reviewed-stage.mjs');
const scenarios=[
 ['authorized positive control',()=>{},false],
 ['missing binding',s=>delete s.binding_authorized,true],['explicit denied binding',s=>s.binding_authorized=false,true],['string binding',s=>s.binding_authorized='true',true],
 ['missing accepted',s=>delete s.accepted_membership_authorized,true],['explicit denied accepted',s=>s.accepted_membership_authorized=false,true],
 ['missing exclusion',s=>{s.groups[0].status='excluded';delete s.excluded_membership_authorized;},true],
 ['explicit denied exclusion',s=>{s.groups[0].status='excluded';s.excluded_membership_authorized=false;},true],
 ['missing uncertainty',s=>{s.groups[0].status='uncertain';delete s.uncertain_membership_authorized;},true],
 ['explicit denied uncertainty',s=>{s.groups[0].status='uncertain';s.uncertain_membership_authorized=false;},true],
 ['nonexistent ID',s=>s.groups[0].records[0].lemma_id='synthetic:missing',true],
 ['wrong language',s=>{s.groups[0].language='de';s.groups[0].records[0].language='de';},true],
 ['wrong root',s=>s.groups[0].root='ped',true],['widened record scope',s=>s.groups[0].records.push({...s.groups[0].records[0],lemma_id:'synthetic:extra'}),true],
 ['stale review version',s=>s.predecessor_review_version=99,true],['stale review hash',s=>s.predecessor_review_sha256='0'.repeat(64),true],
 ['malformed record',s=>s.groups[0].records[0].word='beta',true],['synthetic registration',s=>s.synthetic_fixture=true,true],
 ['duplicate application',()=>{},true,true],
];
for(const[name,mutate,deny,twice]of scenarios){
 const dir=fs.mkdtempSync(join(tmpdir(),'v6-independent-synthetic-'));try{
 const registry=join(dir,'associativvordes/family-index-v6/lexical-head-review.json.gz');fs.mkdirSync(join(dir,'associativvordes/family-index-v6'),{recursive:true});
 const empty={schema_version:6,production_enabled:false,version:1,lexical_facts:[],evidence_cache:[],finite_bindings:[],head_reviews:[]};fs.writeFileSync(registry,gzipSync(JSON.stringify(empty)));
 const r={language:'en',root:'act',canonical_root:'act',lemma_id:'synthetic:known',word:'alpha',status:'pending_review'};const source=JSON.stringify([r]);fs.writeFileSync(join(dir,'queue.json'),source);
 const stage={schema_version:6,production_enabled:false,stage:'synthetic-disposable-only',binding_authorized:true,accepted_membership_authorized:true,excluded_membership_authorized:true,uncertain_membership_authorized:true,source_queue:'queue.json',source_queue_sha256:hash(Buffer.from(source)),groups:[{language:'en',root:'act',normalized_head:'alpha',sense:'synthetic',status:'accepted',reason:'synthetic only',sources:['synthetic dictionary'],forms:['alpha'],records:[structuredClone(r)]}]};mutate(stage);fs.writeFileSync(join(dir,'decision.json'),JSON.stringify(stage));
 const run=()=>spawnSync(process.execPath,[script,'decision.json'],{cwd:dir,encoding:'utf8'});if(twice){const first=run();require(first.status===0,'duplicate control could not apply first');}
 const before=fs.readFileSync(registry),actual=run(),after=fs.readFileSync(registry),rejected=actual.status!==0,unchanged=before.equals(after);
 results.push({name:'stage CLI: '+name,status:deny?(rejected&&unchanged?'pass':'fail'):(!rejected&&!unchanged?'pass':'fail'),synthetic_fixture:true,expected:deny?'reject_without_write':'successful_positive_control',exit_code:actual.status,registry_unchanged:unchanged,before_sha256:hash(before),after_sha256:hash(after),diagnostic:(actual.stderr||actual.stdout||'').slice(-1500)});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
// Revoking a persisted grant must be noticed by the actual loader, not by this oracle alone.
{
 const registry='associativvordes/family-index-v6/review-application-authorizations.json',grants=structuredClone(read(registry));grants.bindings[0].binding_authorized=false;
 let rejected=false,error;try{await loadLexicalReview({catalog,read:async p=>p===registry?grants:read(p),readBytes:async p=>p===registry?Buffer.from(JSON.stringify(grants)):fs.readFileSync(p),inputs:{}});}catch(e){rejected=true;error=e.message;}
 results.push({name:'actual lexical loader rejects explicitly revoked frozen grant',status:rejected?'pass':'fail',registry_write:false,diagnostic:error||'Loader accepted despite revoked grant; frozen grant file was not consumed.'});
}
// Real saved dossiers are the test inputs, not synthetic corpus claims.
{
 const registryPath='associativvordes/family-index-v6/family-promotions.json',registry=read(registryPath),atomPath=registry.decisions.find(p=>p.includes('atom')),atom=read(atomPath);
 for(const[name,mutate]of [['denied promotion',d=>d.binding_authorized=false],['forged promotion locator',d=>d.groups[0].records[0].source_locator.path='forged.json'],['nonexistent promotion ID',d=>d.groups[0].records[0].lemma_id='synthetic:missing'],['stale promotion evidence',d=>d.input_sha256[Object.keys(d.input_sha256)[0]]='0'.repeat(64)],['competing senses with policy',d=>d.groups[0].records[0].senses_decision.analyses.push({history:'unrelated',verdict:'excluded',evidence:['independent-negative-fixture']})],['competing senses with omitted policy',d=>{delete d.senses_policy;d.groups[0].records[0].senses_decision.analyses.push({history:'unrelated',verdict:'excluded',evidence:['independent-negative-fixture']});}]]){
  const bad=structuredClone(atom);mutate(bad);let rejected=false,error;
  try{await loadFamilyPromotions({catalog,inputs:{},read:async p=>p===atomPath?bad:read(p),readBytes:async p=>fs.readFileSync(p)});}catch(e){rejected=true;error=e.message;}
  results.push({name:'real promotion loader: '+name,status:rejected?'pass':'fail',registry_write:false,diagnostic:error});
 }
}
{
 const reg=read('associativvordes/family-index-v6/head-lifecycle.json'),p=reg.decisions.find(e=>e.path.includes('system-de-extension')),doc=read(p.path),h=doc.predecessor.head,e=doc.predecessor.edge;
 const oldLinks=links.filter(l=>l.head_id===h.id&&l.family_id===doc.family_id&&!l.lifecycle_origin),corpus=new Map(doc.records.map(r=>[r.language+'\0'+r.lemma_id,r.source_record]));
 const index={catalog,heads:[h],edges:[e],links:oldLinks,corpus,memberships:oldLinks.map(l=>({language:l.language,family_id:l.family_id,lemma_id:l.lemma_id,word:l.word,head_id:l.head_id,edge_version:e.version,source_proof:l.evidence}))};
 for(const[name,mutate]of [['literal finite extension positive',()=>{}],['stale version',d=>d.predecessor.edge_version++],['stale predecessor hash',d=>d.predecessor.scope_sha256='0'.repeat(64)],['changed sense',d=>d.identity.sense='forged'],['widened scope',d=>d.decision.lemma_ids.push('synthetic:missing')],['wrong family transition',d=>d.operation='new_family_edge'],['translated relation',d=>d.decision.relation_kind='semantic_translation'],['denied accepted',d=>d.accepted_membership_authorized=false],['unproved boundary',d=>d.records[2].boundary_proof.status='uncertain']]){
  check('real lifecycle: '+name,()=>{const d=structuredClone(doc);mutate(d);const before=JSON.stringify(index),isPositive=name.includes('positive');let rejected=false,r,error;try{r=replayHeadLifecycle({index,docs:[d]});}catch(ex){rejected=true;error=ex.message;}
   require(JSON.stringify(index)===before,'mutated caller state');require(isPositive?!rejected&&r.index.memberships.length===3&&index.memberships.length===2:rejected,'wrong independent finite transition outcome');return {registry_write:false,source_path:p.path,expected:isPositive?'exactly three memberships; old input unchanged':'rejection without mutation',diagnostic:error};});
 }
}
const fixture=()=>({records:[{language:'en',family_id:'family:creat',lemma_id:'synthetic:a',word:'create'}],facts:[{id:'lexical-fact:a',language:'en',normalized_head:'create',sense:'make',forms:['create'],evidence_ids:['e']}],evidence:[{id:'e',language:'en',head:'create',sense:'make',status:'accepted',sources:['synthetic']}],bindings:[{language:'en',family_id:'family:creat',lemma_id:'synthetic:a',word:'create',fact_id:'lexical-fact:a',link_role:'whole_lexeme',identity_proof:['synthetic']}]});
for(const[name,mutate]of [
 ['substring collision',x=>x.records[0].word='recreate'],['generic ending strip',x=>{x.records[0].word='creates';x.bindings=[];}],
 ['translated gloss',x=>x.evidence[0].head='make'],['wrong evidence language',x=>x.evidence[0].language='de'],
 ['competing senses/homonym',x=>{x.facts.push({...x.facts[0],id:'lexical-fact:b',sense:'other',evidence_ids:['f']});x.evidence.push({...x.evidence[0],id:'f',sense:'other'});x.bindings.push({...x.bindings[0],fact_id:'lexical-fact:b'});}],
 ['duplicate arrays',x=>x.bindings.push({...x.bindings[0]})],['forged exact boundary',x=>{x.bindings[0].link_role='reviewed_lexical_base_component';x.bindings[0].component_segmentation={before:'wrong',component:'creat',after:'e',head:'create',boundary_proof:'synthetic'};x.facts[0].component_stems=['creat'];}],
 ['proper-name identity without a finite grant',x=>{x.records[0].word='Create Inc';x.records[0].lemma_id='synthetic:name';x.bindings=[];}],
])check('recognition: '+name,()=>{const x=fixture();mutate(x);let accepted=false;try{accepted=recognizeFiniteHeadBindings(x).recognized.length>0;}catch{}require(!accepted,'adversarial identity admitted');return {synthetic_fixture:true,accepted:0};});
check('morphological proposals grant no identity or membership',()=>{const x=fixture();x.records[0].word='creates';const p=proposeMorphologicalHeads(x.records,x.facts);require(p.length&&p.every(r=>r.identity_established===false&&r.family_membership_established===false),'proposal grants membership');return {synthetic_fixture:true};});
check('competing aggregate senses are deferred without fabricated frequency',()=>{const r=decideLexicalRow({membership_object:'lexical_row_or_component',formal_continuity:'accepted',analyses:[{history:'a',verdict:'accepted',evidence:['synthetic']},{history:'b',verdict:'excluded',evidence:['synthetic']}]});require(r.decision==='deferred'&&r.token_senses_established===false&&r.frequency_status==='aggregate_only_not_sense_frequency','unsafe sense inference');return r;});
const cache=new Map(),runtime=await loadV6ShadowRuntime({readJson:async p=>{if(!cache.has(p)){cache.set(p,read(p));if(cache.size>12)cache.delete(cache.keys().next().value);}return cache.get(p);}});
check('independent literal Russian alias expectations',()=>{for(const[q,f,n]of [['операция','family:oper',138],['мутация','family:mut',41]]){const actual=runtime.search(q,'ru');require(actual.length===n&&actual.every(m=>m.family_id===f),'alias failure '+q);const expected=members.filter(m=>m.language==='ru'&&m.family_id===f);require(JSON.stringify(actual.map(key).sort())===JSON.stringify(expected.map(key).sort()),'alias question loss');}return {oper_ru:138,mut_ru:41};});
check('195 shared IDs deduplicate rows without double-counting measured frequency',()=>{const rows=read('audit/associative-family-v6/prompt09-shadow-20261007/generated/hydrated-accepted-corpus-rows.json.gz');const list=Array.isArray(rows)?rows:rows.rows;require(list,'unknown hydration schema');const ids=new Set(list.map(r=>r.language+'\0'+r.lemma_id));require(list.length===21371&&ids.size===list.length,'duplicate measured rows');require(list.reduce((n,r)=>n+r.accepted_memberships.length,0)===21566,'lost finite component proof');return {unique_rows:list.length,memberships:21566};});
const report={schema_version:6,baseline_sha:'ec43ff50383e6b632a95a5f6b9a4b8d7b0d44003',tested_sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),script_sha256:hash(fs.readFileSync('scripts/audit-associative-v6-independent.mjs')),status:results.some(r=>r.status==='fail')?'fail':'pass',production_enabled:false,full_linguistic_certification:false,results,counts:{pass:results.filter(r=>r.status==='pass').length,fail:results.filter(r=>r.status==='fail').length},limitations:['Independent technical oracle is not independent linguistic adjudication.','Synthetic negative fixtures are outside real registries.','Fail status blocks foundation closure even if old consistency CI succeeds.']};
fs.mkdirSync(out.slice(0,out.lastIndexOf('/')),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,counts:report.counts,failures:results.filter(r=>r.status==='fail').map(r=>r.name),out}));if(process.argv.includes('--strict')&&report.status==='fail')process.exitCode=1;
