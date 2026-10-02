import {auditContinuation as auditNativeExtension} from '../scripts/lib/associative-reflex-native-compounds-extension-audit.mjs';
import {auditContinuation as auditRareExtension} from '../scripts/lib/associative-reflex-rare-heads-extension-audit.mjs';
import {auditContinuation as auditHeadExtension} from '../scripts/lib/associative-reflex-heads-extension-audit.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {FamilyIndexLoader} from '../associativvordes/js/family-index-loader.js';
import {createCandidateIndexLoader} from '../associativvordes/js/candidate-index-loader.js';
import {auditContinuation} from '../scripts/lib/associative-reflex-continuation-audit.mjs';
const priorExtension=await auditContinuation('associativvordes/family-index-v5');
const nativeExtension=await auditNativeExtension('associativvordes/family-index-v5');
const rareExtension=await auditRareExtension('associativvordes/family-index-v5');
const headExtension=await auditHeadExtension('associativvordes/family-index-v5');
const extension={additions:[...(priorExtension?.additions||[]),...(headExtension?.additions||[]),...(rareExtension?.additions||[]),...(nativeExtension?.additions||[])]};
const read=async p=>JSON.parse((p.endsWith('.gz')?gunzipSync(await readFile(p)):await readFile(p)).toString());
const treeLoader=()=>new FamilyIndexLoader({baseUrl:'associativvordes/family-index-v5',fetchJson:read});
const ledger=()=>read('audit/associative-family-v5/information-decisions-20260930.json');
const next=()=>read('audit/associative-family-v5/reflex-families-20261001.json');
const archive=()=>read('audit/associative-family-v5/reflex-checkpoint-20261001/original-families.json.gz');
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),pairs=ms=>ms.map(m=>[m.lemma_id,m.word]).sort();
test('broader inform root preserves the historical reviewed information subset and restores informational derivatives',async()=>{
 const l=await ledger(),n=await next(),f=treeLoader(),a=await archive(),loader=createCandidateIndexLoader({familyIndexLoader:f,fetch:async()=>{throw Error('Broad fallback requested')}});
 assert.equal(await f.family(l.deleted_duplicate_family_id),null);assert.equal(await f.family(l.canonical_family_id),null);
 assert.equal(a.families[l.canonical_family_id].support,185);assert.equal(a.families[l.canonical_family_id].canonical,'informatio');
 assert.deepEqual(a.families[l.canonical_family_id].relation_evidence,l.original_families[0].relation_evidence);
 const family=await f.family('family:inform');assert.equal(family.canonical,'inform');assert.equal(family.verified,false);assert.equal(family.review_status,'needs_review');
 for(const d of l.decisions){
  const historical=[...d.retained,...l.added.filter(a=>a.language===d.language).map(a=>a.member)];
  assert.deepEqual(pairs(a.members[d.language][l.canonical_family_id]||[]),pairs(historical));
  const ms=await f.members(family.id,d.language);assert(historical.every(m=>ms.some(x=>x.lemma_id===m.lemma_id&&x.word===m.word)));
  for(const alias of ['inform',...l.aliases])assert.deepEqual(pairs(await loader.loadCandidateEntries(d.language,alias)),pairs([...n.accepted.inform[d.language],...(extension?.additions||[]).filter(m=>m.canonical_root==='inform'&&m.language===d.language)]),`${d.language}/${alias}`);
  for(const m of ms)assert((extension?.additions||[]).some(r=>r.canonical_root==='inform'&&r.language===d.language&&r.lemma_id===m.lemma_id)||m.components.every(c=>c.canonical_candidate==='inform'&&c.evidence.every(e=>e.type==='manual_override'&&e.analysis)));
 }
 const ru=await loader.loadCandidateEntries('ru','информация');assert(ru.some(m=>m.word==='информация'));assert(ru.some(m=>m.word==='информационно'));
 assert(! (await f.candidateEntries('inform','en')).some(m=>m.word==='informal'));
});
test('untouched information neighbours and source memberships remain byte-equivalent; retired etymon containers are archived',async()=>{
 const l=await ledger(),n=await next(),a=await archive(),f=treeLoader(),c=await read('audit/associative-family-v5/creation-families-20261001.json'),ca=await read('audit/associative-family-v5/creation-checkpoint-20261001/original-families.json.gz'),r=await read('audit/associative-family-v5/relation-families-20261001.json'),ra=await read('audit/associative-family-v5/relation-checkpoint-20261001/original-families.json.gz'),o=await read('audit/associative-family-v5/operation-families-20261001.json'),oa=await read('audit/associative-family-v5/operation-checkpoint-20261001/original-families.json.gz'),mu=await read('audit/associative-family-v5/mutation-families-20261001.json'),ma=await read('audit/associative-family-v5/mutation-checkpoint-20261001/original-families.json.gz');
 for(const d of l.preserved_families){
  const mutationRetired=mu.retired_families.includes(d.family_id),creationRetired=c.retired_families.includes(d.family_id),relationRetired=r.retired_families.includes(d.family_id),operationRetired=o.retired_families.includes(d.family_id),retired=n.retired_families.includes(d.family_id)||creationRetired||relationRetired||operationRetired||mutationRetired,archived=mutationRetired?ma:operationRetired?oa:relationRetired?ra:creationRetired?ca:a;assert.equal(digest(retired?archived.families[d.family_id]:await f.family(d.family_id)),d.family_sha256,d.family_id);
  for(const lang of ['en','de','fr','es','it','ru']){const ms=retired?(archived.members[lang][d.family_id]||[]):await f.members(d.family_id,lang);assert.equal(ms.length,d.members[lang].count);assert.equal(digest(ms),d.members[lang].ordered_member_sha256);}
  f.cache.clear();
 }
 for(const [alias,before]of Object.entries(l.alias_before)){
  const prior=before.filter(id=>id!==l.canonical_family_id&&id!==l.deleted_duplicate_family_id);if(l.aliases.includes(alias))prior.push(l.canonical_family_id);
  const expected=prior.filter(id=>!n.retired_families.includes(id)&&!c.retired_families.includes(id)&&!r.retired_families.includes(id)&&!o.retired_families.includes(id)&&!mu.retired_families.includes(id));for(const [root,aliases]of Object.entries(n.aliases))if(aliases.includes(alias))expected.push('family:'+root);
  const action=await read('audit/associative-family-v5/action-materialization-stage-20261002.json');if(action.aliases.includes(alias))expected.push('family:act');
  assert.deepEqual(await f.resolveAlias(alias),[...new Set(expected)].sort(),alias);
 }
 for(const d of l.added)assert.deepEqual((await f.members(d.source_family_id,d.language)).find(m=>m.lemma_id===d.member.lemma_id),d.member);
});
