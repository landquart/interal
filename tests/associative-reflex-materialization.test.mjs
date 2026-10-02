import {auditContinuation as auditHeadExtension} from '../scripts/lib/associative-reflex-heads-extension-audit.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {FamilyIndexLoader} from '../associativvordes/js/family-index-loader.js';
import {createCandidateIndexLoader} from '../associativvordes/js/candidate-index-loader.js';
import {auditContinuation} from '../scripts/lib/associative-reflex-continuation-audit.mjs';
const priorExtension=await auditContinuation('associativvordes/family-index-v5');
const headExtension=await auditHeadExtension('associativvordes/family-index-v5');
const continuation={additions:[...(priorExtension?.additions||[]),...(headExtension?.additions||[])]};
const read=async p=>JSON.parse((p.endsWith('.gz')?gunzipSync(await readFile(p)):await readFile(p)).toString());
const base='audit/associative-family-v5/';
const pairs=ms=>ms.map(m=>[m.lemma_id,m.word]).sort();
test('all reviewed observ and inform memberships reach canonical and compatibility queries without truncation',async()=>{
 const plan=await read(base+'reflex-families-20261001.json');
 const f=new FamilyIndexLoader({baseUrl:'associativvordes/family-index-v5',fetchJson:read});
 const loader=createCandidateIndexLoader({familyIndexLoader:f,fetch:async()=>{throw Error('Unexpected broad fallback')}});
 for(const [root,languages] of Object.entries(plan.accepted))for(const [lang,accepted] of Object.entries(languages)){
  const expected=[...accepted,...(continuation?.additions||[]).filter(m=>m.canonical_root===root&&m.language===lang)];
  const ms=await f.members('family:'+root,lang);assert.deepEqual(pairs(ms),pairs(expected),`${root}/${lang} stored`);
  for(const alias of plan.aliases[root])assert.deepEqual(pairs(await loader.loadCandidateEntries(lang,alias)),pairs(expected),`${alias}/${lang} route`);
 }
 const it=await loader.loadCandidateEntries('it','observ');assert(it.some(m=>m.word==='osservare'));assert(it.some(m=>m.word==='osservazione'));assert(!it.some(m=>m.word==='integrazione'));
 for(const id of plan.retired_families)assert.equal(await f.family(id),null);
 assert(!(await f.resolveAlias('azion')).some(id=>plan.new_families.includes(id)||plan.retired_families.includes(id)));
});
test('each retrieved candidate has one accountable disposition and accepted records retain corpus measurements',async()=>{
 const candidates=await read(base+'reflex-checkpoint-20261001/candidates.json.gz');
 const decisions=await read(base+'reflex-checkpoint-20261001/linguistic-decisions.json');
 const f=new FamilyIndexLoader({baseUrl:'associativvordes/family-index-v5',fetchJson:read});
 const counts={accepted:0,excluded:0,uncertain:0};
 for(const [lang,roots] of Object.entries(candidates))for(const [root,source] of Object.entries(roots)){
  const reviewed=decisions.decisions[lang][root];assert.deepEqual(pairs(reviewed),pairs(source));
  const stored=new Map((await f.members('family:'+root,lang)).map(m=>[m.lemma_id,m]));
  for(const decision of reviewed){assert(Object.hasOwn(counts,decision.status));counts[decision.status]++;assert(decision.reason.length>20);
   if(decision.status!=='accepted'){if(!(continuation?.additions||[]).some(m=>m.canonical_root===root&&m.language===lang&&m.lemma_id===decision.lemma_id))assert(!stored.has(decision.lemma_id));continue;}
   const original=source.find(m=>m.lemma_id===decision.lemma_id),current=stored.get(decision.lemma_id);assert(current);
   for(const field of ['word','normalized','search_form','rank','frequency_score','category_breakdown','sources','corpus_quality'])assert.deepEqual(current[field],original[field],`${root}/${lang}/${decision.word}/${field}`);
  }
 }
 assert.deepEqual(counts,{accepted:1740,excluded:3417,uncertain:762});
});
