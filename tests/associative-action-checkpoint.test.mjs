import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {FamilyIndexLoader} from '../associativvordes/js/family-index-loader.js';
const base='audit/associative-family-v5/',read=async p=>JSON.parse((p.endsWith('.gz')?gunzipSync(await readFile(p)):await readFile(p)).toString());
const pairs=ms=>ms.map(m=>[m.lemma_id,m.word]);
test('action checkpoint covers all saved IDs, preserves source hashes, and separates lexical and name branches',async()=>{
 const inv=await read(base+'action-review-checkpoint-20261001/inventory.json'),bytes=await readFile(base+'action-review-checkpoint-20261001/linguistic-decisions.json.gz'),d=JSON.parse(gunzipSync(bytes));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),inv.decision_sha256);assert.equal(d.runtime_applied,false);
 for(const [file,hash]of Object.entries(inv.source_artifacts))assert.equal(createHash('sha256').update(await readFile(base+'action-reflex-checkpoint-20261001/'+file)).digest('hex'),hash);
 let total=0;
 for(const [language,ds]of Object.entries(d.decisions)){
  const source=await read(base+'action-reflex-checkpoint-20261001/'+language+'-candidates.json.gz');assert.deepEqual(pairs(ds),pairs(source.act));total+=ds.length;
  assert(ds.every(x=>['accepted','excluded','uncertain'].includes(x.status)&&x.reason&&x.source_family_ids.length));
  for(const x of ds.filter(x=>x.status==='accepted'))assert.equal(x.branch,'lexical_action');
 }
 assert.equal(total,52277);
 const find=(l,w)=>d.decisions[l].find(x=>x.word===w);
 for(const [l,w]of [['en','action'],['de','aktion'],['fr','acteur'],['es','acción'],['it','attore'],['it','interazione'],['it','reazione'],['ru','активный']])assert.equal(find(l,w)?.status,'accepted',l+'/'+w);
 for(const [l,w]of [['en','fact'],['en','pact'],['en','tact'],['it','creazione'],['it','attaccare'],['ru','акцент']])assert.equal(find(l,w)?.status,'excluded',l+'/'+w);
 for(const [l,w]of [['en','actium'],['en','actin'],['en','redact']])assert.equal(find(l,w)?.status,'uncertain',l+'/'+w);
 const f=new FamilyIndexLoader({baseUrl:'associativvordes/family-index-v5',fetchJson:read}),old=await read(base+'action-reflex-checkpoint-20261001/original-families.json.gz');
 for(const [id,family]of Object.entries(old.families)){
  assert.deepEqual(await f.family(id),family,id);
  for(const language of Object.keys(d.decisions))assert.deepEqual(await f.members(id,language),old.members[language][id]||[],id+'/'+language);
 }
});
