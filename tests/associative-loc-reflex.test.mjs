import {preActionShard} from '../scripts/lib/associative-action-stage-audit.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {FamilyIndexLoader,familyBucket} from '../associativvordes/js/family-index-loader.js';
import {createCandidateIndexLoader} from '../associativvordes/js/candidate-index-loader.js';
const root='associativvordes/family-index-v5',base='audit/associative-family-v5/';
const read=async p=>JSON.parse((p.endsWith('.gz')?gunzipSync(await readFile(p)):await readFile(p)).toString());
const pairs=ms=>ms.map(m=>[m.lemma_id,m.word]).sort(),digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
test('loc and lok expose the complete reviewed place-root family with original members and corpus measurements intact',async()=>{
 const ledger=await read(base+'loc-reflex-materialization-20261001.json'),original=await read(ledger.archive_path),source=(await read(base+'component-checkpoint-20261001/candidate-records.json.gz')).loc;
 const f=new FamilyIndexLoader({baseUrl:root,fetchJson:read}),loader=createCandidateIndexLoader({familyIndexLoader:f,fetch:async()=>{throw Error('Broad fallback requested')}});
 for(const [language,before]of Object.entries(original.members)){
  const accepted=ledger.additions[language]||[],expected=[...before,...accepted];
  for(const query of ['loc','lok'])assert.deepEqual(pairs(await loader.loadCandidateEntries(language,query)),pairs(expected),query+'/'+language);
  const ms=await f.members('family:loc',language);assert.deepEqual(ms.slice(0,before.length),before);
  for(const added of accepted){const actual=ms.find(m=>m.lemma_id===added.lemma_id),old=source[language].find(m=>m.lemma_id===added.lemma_id);for(const field of ['word','normalized','search_form','rank','frequency_score','sources','category_breakdown','corpus_quality'])assert.deepEqual(actual[field],old[field]);}
 }
 const de=await f.candidateEntries('loc','de'),ru=await f.candidateEntries('loc','ru');
 for(const w of ['lokal','lokation','lokomotive','dampflok','lokführer'])assert(de.some(m=>m.word===w));
 for(const w of ['локальный','локация','локомотив','локатор','эхолокация'])assert(ru.some(m=>m.word===w));
 for(const w of ['kilokalorie','cellokonzert','lokum','loki'])assert(!de.some(m=>m.word===w));
 for(const w of ['блок','молоко','яблоко','локоть','велокомпьютер','креслокаталка'])assert(!ru.some(m=>m.word===w));
 assert(!(await f.candidateEntries('loc','fr')).some(m=>['lieu','lieutenant'].includes(m.word)));
 assert.deepEqual(await f.resolveAlias('lok',{elementType:'preposition'}),[]);
});
test('loc repair keeps unrelated shard contents and supplies a disposition for every saved lok spelling candidate',async()=>{
 const l=await read(base+'loc-reflex-materialization-20261001.json'),d=await read(base+'loc-reflex-decisions-20261001.json'),source=(await read(base+'component-checkpoint-20261001/candidate-records.json.gz')).loc;
 for(const [language,needle]of [['de','lok'],['ru','лок']]){const candidates=source[language].filter(m=>m.word.toLowerCase().includes(needle));const ds=d.decisions.filter(x=>x.language===language);assert.deepEqual(pairs(ds),pairs(candidates));for(const record of ds)assert(['accepted','excluded','uncertain'].includes(record.status)&&record.reason.length>20);}
 for(const p of l.preservation){const s=await preActionShard(await read(`${root}/${p.part}/${p.bucket}.json.gz`),p.part,p.bucket),other=Object.fromEntries(Object.entries(s).filter(([id])=>p.part==='aliases'?!l.aliases.includes(id):id!=='family:loc'));assert.equal(digest(other),p.unrelated_sha256);}
});
