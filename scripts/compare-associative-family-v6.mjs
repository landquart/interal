#!/usr/bin/env node
import fs from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {buildSearchForm} from '../associativvordes/js/search-normalizer.js';
import {loadV6ShadowRuntime} from '../associativvordes/js/associative-family-v6-shadow.js';
const read=async p=>JSON.parse(p.endsWith('.gz')?gunzipSync(await fs.readFile(p)):await fs.readFile(p));
const index=await loadV6ShadowRuntime({readJson:read}),queries=process.argv.slice(2);
if(!queries.length)queries.push('ped','pede','creat','observ','osserv','loc','lok','лок','act','inform','информ','nat','inter','val');
const bucket=value=>{let h=0x811c9dc5;for(const c of value){h^=c.codePointAt(0);h=Math.imul(h,0x01000193);}return ((h>>>0)%256).toString(16).padStart(2,'0');},reports=[];
for(const query of queries){
 const q=buildSearchForm(query),aliases=await read('associativvordes/family-index-v5/aliases/'+bucket(q)+'.json.gz'),targets=aliases[q]||[],old=new Map();
 for(const id of targets)for(const language of ['en','de','fr','es','it','ru'])for(const m of (await read('associativvordes/family-index-v5/members/'+language+'/'+bucket(id)+'.json.gz'))[id]||[]){const key=language+'\0'+m.lemma_id,entry=old.get(key)||{language,lemma_id:m.lemma_id,word:m.word,legacy_routes:[]};entry.legacy_routes.push(id);old.set(key,entry);}
 const current=new Map(index.search(query).map(m=>[m.language+'\0'+m.lemma_id,m])),additions=[...current].filter(([k])=>!old.has(k)).map(([,m])=>({...m,reason:'explicit_catalog_and_accepted_finite_head_edge',expected:true})),removed=[...old].filter(([k])=>!current.has(k)).map(([,m])=>({...m,reason:'legacy_evidence_or_component_route_has_no_accepted_v6_family_edge',expected:true,linguistic_exclusion_claim:false}));
 reports.push({query,normalized_query:q,legacy_targets:targets,v6_route:await index.routeQuery(query),v5_unique_lemmas:old.size,v6_unique_lemmas:current.size,preserved_exact_ids:[...current.keys()].filter(k=>old.has(k)),additions,removals:removed});
}
await fs.mkdir('audit/associative-family-v6',{recursive:true});await fs.writeFile('audit/associative-family-v6/query-differential.json.gz',gzipSync(Buffer.from(JSON.stringify({scope:'Complete persisted v5 alias arrays compared with accepted v6 head edges; no runtime display caps',queries:reports,production_enabled:false})+'\n'),{level:9,mtime:0}));console.log(JSON.stringify(reports.map(r=>({query:r.query,v5:r.v5_unique_lemmas,v6:r.v6_unique_lemmas,additions:r.additions.length,demoted_unaccepted:r.removals.length}))));
