import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {buildSearchForm} from '../associativvordes/js/search-normalizer.js';
import {normalizeHead,resolveV6Alias,v6QueryKey,generateV6Memberships,applyHeadReview} from '../associativvordes/js/associative-family-v6.js';
import {loadV6ShadowRuntime,deduplicateV6CorpusRows} from '../associativvordes/js/associative-family-v6-shadow.js';
import {familyBucket} from '../associativvordes/js/family-index-loader.js';
const cache=new Map();
const read=p=>{if(!cache.has(p)){cache.set(p,JSON.parse(p.endsWith('.gz')?gunzipSync(fs.readFileSync(p)):fs.readFileSync(p)));if(cache.size>24)cache.delete(cache.keys().next().value);}return cache.get(p);};
const catalog=read('associativvordes/family-index-v6/catalog.json');
const runtime=()=>loadV6ShadowRuntime({readJson:async p=>read(p)});
test('real original and normalized catalog forms retain every family route, including both Russian losses',async()=>{
 const i=await runtime();let count=0;
 for(const f of catalog.families)for(const alias of new Set([f.canonical,...f.aliases])){
  count++;assert(resolveV6Alias(catalog,alias).includes(f.id));assert(resolveV6Alias(catalog,buildSearchForm(alias)).includes(f.id));
  assert.deepEqual(i.search(alias),i.search(buildSearchForm(alias)));assert.deepEqual(i.search(alias),i.search(f.canonical));
 }
 assert.equal(count,88);
 for(const [q,id]of [['операция','family:oper'],['мутация','family:mut']]){assert((await i.routeQuery(q,'ru')).family_targets.includes(id));assert(i.search(q,'ru').length>0);}
 assert.deepEqual(i.search('création'),i.search('creation'));assert.deepEqual(i.search('système'),i.search('systeme'));assert.deepEqual(i.search('атом'),i.search('atom'));
});
test('synthetic normalization collisions retain multiple identities, punctuation and lexical distinctions',()=>{
 const c=structuredClone(catalog),ped=c.families.find(f=>f.id==='family:ped'),creat=c.families.find(f=>f.id==='family:creat');
 ped.aliases.push('café','Straße','ёлка','объект','co‐op','l’homme');creat.aliases.push('cafe','Strasse');
 assert.deepEqual(resolveV6Alias(c,'CAFÉ'),['family:ped','family:creat']);assert.deepEqual(resolveV6Alias(c,'straße'),['family:ped','family:creat']);
 for(const [q,key]of [['ёлка','jolka'],['объект','ob-ekt'],['co‐op','co-op'],['l’homme',"l'homme"]]){assert.equal(v6QueryKey(q),key);assert.deepEqual(resolveV6Alias(c,key),['family:ped']);}
 assert.deepEqual(resolveV6Alias(c,'coop'),[]);assert.deepEqual(resolveV6Alias(c,'lhomme'),[]);assert.deepEqual(resolveV6Alias(c,''),[]);
 assert.notEqual(normalizeHead('café'),normalizeHead('cafe'));assert.notEqual(normalizeHead('ё'),normalizeHead('е'));assert.notEqual(normalizeHead('ß'),normalizeHead('ss'));
});
test('real language-scoped val routes are independent actual source routes and remain evidence-only',async()=>{
 const i=await runtime(),all=await i.routeQuery('val');assert.equal(all.evidence_targets.length,15);assert.deepEqual(all.family_targets,[]);assert.deepEqual(i.search('val'),[]);
 for(const language of ['en','de','fr','es','it','ru']){
  const r=await i.routeQuery('val',language);assert.equal(r.language_scope,language);
  const expected=all.evidence_targets.filter(id=>!id.startsWith('surface:')||id.split(':')[1]===language).filter(id=>read('associativvordes/family-index-v5/members/'+language+'/'+familyBucket(id)+'.json.gz')[id]?.length);
  assert.deepEqual(r.evidence_targets,expected);assert(r.evidence_routes.every(x=>x.establishes_membership===false&&x.language_scope===language));
  assert(i.search('oper',language).every(m=>m.language===language));
 }
 await assert.rejects(i.routeQuery('val','xx'),/Unsupported/);assert.throws(()=>i.search('ped','xx'),/Unsupported/);
});
test('synthetic alias collision does not suppress coexisting evidence routes or selected language rows',async()=>{
 const c=structuredClone(catalog);c.families.find(f=>f.id==='family:ped').aliases.push('val');
 const i=await loadV6ShadowRuntime({readJson:async p=>p.endsWith('/catalog.json')?c:read(p)});
 const r=await i.routeQuery('val','fr');assert.deepEqual(r.family_targets,['family:ped']);assert(r.evidence_targets.length>1);assert.equal(r.family_routes[0].accepted_membership_count,i.search('ped','fr').length);assert(i.search('val','fr').every(m=>m.family_id==='family:ped'&&m.language==='fr'));
});
test('real hydrated corpus measurements and source arrays equal original rows exactly',async()=>{
 const i=await runtime();
 for(const [query,language]of [['операция','ru'],['мутация','ru'],['atom','de'],['system','en'],['ped','en']]){
  const rows=await i.searchCorpusRows(query,language);assert(rows.length>0);assert.equal(new Set(rows.map(r=>r.language+'\0'+r.lemma_id)).size,rows.length);
  for(const r of rows)for(const m of r.accepted_memberships){const p=m.source_proof[0].source,original=read(p.path)[p.family_id].find(x=>x.lemma_id===r.lemma_id);for(const k of ['lemma_id','word','normalized','search_form','rank','frequency_score','category_breakdown','sources','corpus_quality'])assert.deepEqual(r[k],original[k]);}
 }
});
test('all 829 real zero-v5 records are retrievable by original ID and evidence-only word key',async()=>{
 const i=await runtime(),source=read('audit/associative-family-v6/corpus-enumeration.json').zero_membership_source_records;assert.equal(source.length,829);
 for(const r of source){assert.deepEqual(await i.getZeroMembershipCorpusRecord(r.language,r.lemma_id),r);const rows=await i.searchZeroMembershipCorpusRecords(buildSearchForm(r.word),r.language);assert(rows.some(x=>x.lemma_id===r.lemma_id));assert.deepEqual(r.associative_family_ids,[]);assert(r.frequency_source_records.length);assert(!i.memberships.some(m=>m.language===r.language&&m.lemma_id===r.lemma_id));}
 assert.equal(await i.getZeroMembershipCorpusRecord('en','lemma:not-real'),null);await assert.rejects(i.getZeroMembershipCorpusRecord(undefined,'x'),/requires language/);
});
test('real shared German corpus ID deduplicates semantically equal measurements with different JSON key order',()=>{
 const memberships=read('associativvordes/family-index-v6/generated/memberships.json.gz').filter(m=>m.language==='de'&&m.lemma_id==='lemma:3b7890b5d782866cb765');assert.equal(memberships.length,2);
 const rows=memberships.map(m=>{const p=m.source_proof[0].source;return {...read(p.path)[p.family_id].find(r=>r.lemma_id===m.lemma_id),language:m.language,accepted_memberships:[{family_id:m.family_id,head_id:m.head_id,edge_version:m.edge_version,source_proof:m.source_proof}]};});
 assert.notEqual(JSON.stringify(rows[0].sources),JSON.stringify(rows[1].sources));assert.deepEqual(rows[0].sources,rows[1].sources);
 const result=deduplicateV6CorpusRows(rows);assert.equal(result.length,1);assert.equal(result[0].accepted_memberships.length,2);assert.equal(result[0].frequency_score,rows[0].frequency_score);assert.deepEqual(result[0].sources,rows[0].sources);
});
test('synthetic revised/excluded and corrected edges disappear while another accepted component survives',async()=>{
 const c=structuredClone(catalog);for(const f of c.families.filter(f=>['family:ped','family:creat'].includes(f.id)))f.aliases.push('fixture');
 const record={lemma_id:'synthetic:one',word:'fixture',normalized:'fixture',search_form:'fixture',rank:17,frequency_score:42,category_breakdown:{normative:{ipm_values:[1.5]}},sources:[{ipm:1.5}],corpus_quality:{status:'accepted'}};
 const heads=['ped','creat'].map(f=>({id:'synthetic:'+f,language:'en',identity_kind:'lexical_head'}));
 const edges=heads.map(h=>({head_id:h.id,family_id:'family:'+h.id.split(':')[1],status:'accepted',version:1,evidence:[{synthetic:true}],lemma_ids:[record.lemma_id]}));
 const links=edges.map(e=>({head_id:e.head_id,family_id:e.family_id,language:'en',lemma_id:record.lemma_id,word:record.word,evidence:[{source:{path:'synthetic:rows',family_id:'synthetic:container'}}]}));
 let state={catalog:c,heads,edges,links,corpus:new Map([['en\0'+record.lemma_id,record]])};state.memberships=generateV6Memberships(state);
 const load=memberships=>loadV6ShadowRuntime({readJson:async p=>p.endsWith('/catalog.json')?c:p.endsWith('/memberships.json.gz')?memberships:p==='synthetic:rows'?{'synthetic:container':[record]}:read(p)});
 const i=await load(state.memberships),rows=await i.searchCorpusRows('fixture','en');assert.equal(rows.length,1);assert.equal(rows[0].accepted_memberships.length,2);assert.equal(rows[0].frequency_score,42);assert.equal(rows.reduce((n,r)=>n+r.frequency_score,0),42);
 const revised=applyHeadReview(state,{...edges[0],status:'excluded',expected_version:1,reason:'Synthetic negative control',morphology_policy:'finite_explicit_lemma_ids'});
 const after=await load(revised.memberships);assert.deepEqual(after.search('ped'),[]);assert.equal(after.search('creat').length,1);assert.equal((await after.searchCorpusRows('fixture'))[0].accepted_memberships.length,1);
 const corrected=generateV6Memberships({...state,correction_verdicts:[{language:'en',family_id:'family:ped',lemma_id:record.lemma_id,status:'uncertain',dossier_id:'synthetic:correction',version:1}]});assert.equal(corrected.length,1);assert.equal(corrected[0].family_id,'family:creat');
 assert.throws(()=>deduplicateV6CorpusRows([rows[0],{...rows[0],frequency_score:43}]),/Conflicting/);
 assert.equal(deduplicateV6CorpusRows([rows[0],{...rows[0],language:'de'}]).length,2);
});
