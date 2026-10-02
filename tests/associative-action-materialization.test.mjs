import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {FamilyIndexLoader,familyBucket} from '../associativvordes/js/family-index-loader.js';
const root='associativvordes/family-index-v5',base='audit/associative-family-v5/',cp=base+'action-continuation-20261002/',read=async p=>JSON.parse((p.endsWith('.gz')?gunzipSync(await readFile(p)):await readFile(p)).toString()),digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const loader=new FamilyIndexLoader({baseUrl:root,fetchJson:read});
test('action uses only adjudicated heads, retains source fields and all independent components',async()=>{
 const d=await read(cp+'linguistic-decisions.json.gz'),ledger=await read(base+'action-materialization-stage-20261002.json'),family=await loader.family('family:act');assert.equal(family.support,2098);assert.deepEqual(family.surface_forms,d.surface_forms);
 for(const [language,ds]of Object.entries(d.decisions)){
  const accepted=ds.filter(x=>x.status==='accepted'),ms=await loader.members(family.id,language),source=await read(base+'action-reflex-checkpoint-20261001/'+language+'-candidates.json.gz'),byId=new Map(source.act.map(m=>[m.lemma_id,m]));
  assert.deepEqual(ms.map(m=>m.lemma_id),accepted.map(m=>m.lemma_id));assert.equal(ms.length,family.language_support[language]);
  for(const m of ms){const {source_family_ids,components,...original}=byId.get(m.lemma_id),{components:next,...measured}=m;assert.deepEqual(measured,original,m.word);assert.deepEqual(next.slice(0,-1),components||[],m.word);assert.equal(next.at(-1).canonical_candidate,'act');assert(next.at(-1).evidence[0].lexical_head);}
 }
 for(const p of ledger.preservation){const s=await read(`${root}/${p.part}/${p.bucket}.json.gz`);const unaffected=Object.fromEntries(Object.entries(s).filter(([k])=>p.part==='aliases'?!ledger.aliases.includes(k):k!=='family:act'));assert.equal(digest(unaffected),p.unrelated_sha256);}
 for(const [alias,before]of Object.entries(ledger.alias_before))assert.deepEqual((await loader.resolveAlias(alias)).filter(id=>id!=='family:act'),before);
 const status=await read(cp+'materialization-status.json');assert.equal(status.runtime_applied,true);assert.equal(status.full_family_certification,false);assert.equal(status.removed_memberships,0);
});
test('action runtime keeps national actor/action forms and withholds unrelated suffixes, names and overlaps',async()=>{
 const controls={en:{yes:['act','action','actors','immunoreactivity'],no:['fact','pact','tact','actium','actin','redact','practice','fracture']},de:{yes:['aktion','aktiengesellschaft','aktenvernichter','reaktorkern'],no:['fraktion','redaktion','praktisch']},fr:{yes:['acteur','transaction','bioréacteur','tensioactif'],no:['abstraction','rédacteur']},es:{yes:['acción','interacción','transacción','turborreactor'],no:['fracción','práctica']},it:{yes:['attore','attrice','interazione','riattualizzazione'],no:['creazione','comunicazione','nazionalizzazione','attaccare','riattaccare','azio']},ru:{yes:['активный','актриса','биореактор','теракт'],no:['акцент','актин','редактор','практика']}};
 for(const [l,{yes,no}]of Object.entries(controls)){const entries=await loader.candidateEntries('act',l),words=new Set(entries.map(m=>m.word));assert(entries.every(m=>m.family_id==='family:act'));for(const w of yes)assert(words.has(w),l+'/'+w);for(const w of no)assert(!words.has(w),l+'/'+w);}
});
test('action checkpoint is immutable and a repeated materialization refuses before writes',async()=>{
 const {spawnSync}=await import('node:child_process'),r=spawnSync(process.execPath,['scripts/materialize-associative-action-20261002.mjs','--apply'],{encoding:'utf8'});assert.notEqual(r.status,0);assert.match(r.stderr,/Already applied/);
});
