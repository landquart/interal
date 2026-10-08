import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {familyBucket} from '../associativvordes/js/family-index-loader.js';
import {buildSearchForm} from '../associativvordes/js/search-normalizer.js';
import {recountMaterializedMembers,refreshFamilySummaries,repositoryTreeMetadata} from './lib/associative-repository-materialization.mjs';
const root='associativvordes/family-index-v5',audit='audit/associative-family-v5',ledgerPath=audit+'/component-continuation-decisions-20261001.json';
const repair='continue_exact_component_recall_and_exclusions_20261001',apply=process.argv.includes('--apply');
const read=async p=>JSON.parse((p.endsWith('.gz')?gunzipSync(await readFile(p)):await readFile(p)).toString());
const write=(p,v)=>writeFile(p,p.endsWith('.gz')?gzipSync(JSON.stringify(v),{level:6}):JSON.stringify(v,null,2)+'\n');
const sha=v=>createHash('sha256').update(v).digest('hex'),digest=v=>sha(JSON.stringify(v));
const previousBytes=await readFile(audit+'/exact-components-20261001.json'),previous=JSON.parse(previousBytes);
const candidatesBytes=await readFile(audit+'/component-checkpoint-20261001/candidate-records.json.gz'),candidates=JSON.parse(gunzipSync(candidatesBytes));
const selections=[
 ['nat','fr',['contre-nature'],'contre + nature; CNRTL explicitly records the composition','https://www.cnrtl.fr/etymologie/contre-nature'],
 ['nat','es',['contranatural'],'contra + natural; RAE explicitly records the composition','https://dle.rae.es/contranatural'],
 ['nat','es',['innatamente'],'regular feminine-base -mente adverb of innato, from Latin innatus','https://dle.rae.es/innato'],
 ['loc','en',['deallocate','deallocated','deallocation'],'de- + allocate and regular participial/nominal derivatives; allocate from allocare < ad + locare < locus','https://www.etymonline.com/word/allocate'],
 ['loc','fr',['echolocation'],'source spelling without accent of écholocation: echo + location; original spelling and frequency retained','https://www.dictionnaire-academie.fr/article/A9E0218'],
 ['loc','fr',['geolocalisation'],'source spelling without accent of géolocalisation: géo + localisation; original spelling and frequency retained','https://www.dictionnaire-academie.fr/article/A9_0171'],
 ['loc','fr',['delocalisation'],'source spelling without accent of délocalisation, derivative of délocaliser','https://www.cnrtl.fr/etymologie/délocalisation'],
 ['loc','it',['locandieri'],'regular plural of locandiere, derived from locanda < Latin locanda, gerundive of locare','https://www.treccani.it/vocabolario/locandiere/'],
 ['loc','it',['locomozione'],'French/English locomotion formation on locomotive with Latin motio','https://www.treccani.it/vocabolario/locomozione/'],
 ['loc','es',['locación','locacion'],'Latin locatio; second corpus spelling lacks accent, preserved separately','https://dle.rae.es/locación'],
 ['loc','es',['locador'],'juridical lessor formation in the locación/locar branch','https://dpej.rae.es/lema/locador-ra'],
 ['inter','en',['self-interest'],'self + interest; preserves the already-reviewed inter component of interest','https://www.merriam-webster.com/dictionary/self-interest']
];
const manifest=await read(root+'/manifest.json'),report=await read(root+'/report.json'),provenance=await read(root+'/repository-provenance.json');
assert.equal(provenance.source_run_id,35647932153);assert(!provenance.repository_repairs.some(r=>r.repair===repair),'Already applied');
const path=(part,id)=>`${root}/${part}/${familyBucket(id)}.json.gz`,cache=new Map(),get=async p=>{if(!cache.has(p))cache.set(p,await read(p));return cache.get(p)};
const clean=m=>{const {family_ids,retrieval_only,...value}=m;return value};
const additions=[];
for(const [key,language,words,analysis,url]of selections)for(const word of words){
 const m=candidates[key][language].find(m=>m.word===word);assert(m,`missing corpus record ${key}/${language}/${word}`);
 assert(buildSearchForm(word).includes(key));assert(!previous.accepted[key][language].some(d=>d.lemma_id===m.lemma_id));
 assert.notEqual(m.corpus_quality?.status,'rejected');
 additions.push({key,language,lemma_id:m.lemma_id,word,source_family_ids:m.family_ids,analysis,source_url:url});
}
if(!apply){
 const accepted=structuredClone(previous.accepted);
 for(const a of additions)accepted[a.key][a.language].push({lemma_id:a.lemma_id,word:a.word,source_family_ids:a.source_family_ids});
 // Complete disposition coverage is distinct from lexical certification: words
 // with the whole fragment but unresolved etymology stay pending.
 const dispositions={},counts={};
 for(const [key,byLanguage]of Object.entries(candidates)){dispositions[key]={};counts[key]={};for(const [language,ms]of Object.entries(byLanguage)){
  const ids=new Set(accepted[key][language].map(m=>m.lemma_id)),values=ms.map(m=>({lemma_id:m.lemma_id,word:m.word,status:ids.has(m.lemma_id)?'accepted':!buildSearchForm(m.word).includes(key)?'excluded_absent_exact_fragment':'pending_etymology_or_token_review'}));
  dispositions[key][language]=values;counts[key][language]=values.reduce((out,m)=>(out[m.status]=(out[m.status]||0)+1,out),{});
 }}
 const coveragePath=audit+'/component-candidate-dispositions-20261001.json.gz';await write(coveragePath,{schema_version:1,source_run_id:35647932153,candidate_records_sha256:sha(candidatesBytes),dispositions,counts});
 const before=[];for(const a of additions){const id='family:'+a.key,p=path('members/'+a.language,id);if(!before.some(b=>b.path===p))before.push({path:p,sha256:sha(await readFile(p))});}
 const ledger={schema_version:1,repair,source_run_id:35647932153,previous_ledger_sha256:sha(previousBytes),candidate_records_sha256:sha(candidatesBytes),coverage_path:coveragePath,coverage_sha256:sha(await readFile(coveragePath)),expected_added_memberships:additions.length,expected_removed_memberships:0,additions,explicit_exclusions:[{key:'loc',word:'lieu',reason:'User exclusion: absent literal loc; Latin locus ancestry does not override full-fragment requirement'},{key:'loc',word:'lieutenant',reason:'Absent literal loc'},{key:'nat',word:'naive',reason:'Absent literal nat'},{key:'nat',word:'naïve',reason:'Absent literal nat'}],before,accepted,counts,limitations:['Coverage includes all 18 saved candidate arrays; pending entries are not certified or silently accepted.','Unaccented source spellings are retained as corpus variants; source IDs and frequencies are never rewritten.','Historical candidate snapshots, including excluded lieu, remain evidence only.'],sources:[...new Set(additions.map(a=>a.source_url))].map(url=>({url,accessed:'2026-10-01'}))};
 await write(ledgerPath,ledger);console.log(JSON.stringify({mode:'prepare',additions:additions.length,counts}));
}else{
 const ledgerBytes=await readFile(ledgerPath),ledger=JSON.parse(ledgerBytes);
 assert.equal(ledger.previous_ledger_sha256,sha(previousBytes));assert.equal(ledger.candidate_records_sha256,sha(candidatesBytes));assert.deepEqual(ledger.additions,additions);
 assert.equal(sha(await readFile(ledger.coverage_path)),ledger.coverage_sha256);
 for(const b of ledger.before)assert.equal(sha(await readFile(b.path)),b.sha256);
 // Verify real original source membership before writing any changed shard.
 for(const a of additions){const m=candidates[a.key][a.language].find(m=>m.lemma_id===a.lemma_id),id=m.family_ids[0],s=await get(path('members/'+a.language,id));assert.deepEqual(s[id]?.find(v=>v.lemma_id===a.lemma_id),clean(m));}
 const changed=new Set();
 for(const a of additions){
  const id='family:'+a.key,mp=path('members/'+a.language,id),s=await get(mp),m=structuredClone(clean(candidates[a.key][a.language].find(m=>m.lemma_id===a.lemma_id)));
  assert(!s[id].some(v=>v.lemma_id===m.lemma_id));m.components=[{surface:a.key,canonical_candidate:a.key,confidence:0.95,evidence:[{type:'manual_override',source:ledgerPath,relation_type:a.key==='inter'?'affix_component':'compound_component',exact_fragment:true,analysis:a.analysis,source_url:a.source_url}]}];s[id].push(m);changed.add(mp);
  const fp=path('families',id),f=(await get(fp))[id];f.language_support[a.language]++;f.support++;changed.add(fp);
 }
 for(const [key,langs]of Object.entries(ledger.accepted))for(const [language,expected]of Object.entries(langs)){
  const id='family:'+key,actual=(await get(path('members/'+language,id)))[id]||[];assert.deepEqual(actual.map(m=>[m.lemma_id,m.word]),expected.map(m=>[m.lemma_id,m.word]));
 }
 for(const p of changed)await write(p,cache.get(p));cache.clear();
 await recountMaterializedMembers(root,manifest,report);await refreshFamilySummaries(root,report);
 const delta={repair,source_run_id:35647932153,removed_memberships:0,added_memberships:additions.length,decision_ledger_sha256:sha(ledgerBytes),full_family_certification:false};
 provenance.repository_repairs.push(delta);report.repository_materialization.exact_component_continuation=delta;
 await write(root+'/manifest.json',manifest);await write(root+'/report.json',report);Object.assign(provenance,await repositoryTreeMetadata(root));await write(root+'/repository-provenance.json',provenance);
 console.log(JSON.stringify({mode:'apply',...delta}));
}
