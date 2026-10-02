import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {FamilyIndexLoader, familyBucket} from '../associativvordes/js/family-index-loader.js';
import {auditActionStage} from '../scripts/lib/associative-action-stage-audit.mjs';
const base='audit/associative-family-v5/',root='associativvordes/family-index-v5',cp=base+'action-positive-extension-20261002/';
const read=async p=>JSON.parse((p.endsWith('.gz')?gunzipSync(await readFile(p)):await readFile(p)).toString()),sha=b=>createHash('sha256').update(b).digest('hex');
const applied=(await read(root+'/repository-provenance.json')).repository_repairs.some(r=>r.repair==='extend_reviewed_action_memberships_20261002');
test('action extension preserves the complete decision frame and all original accepted records',async()=>{
 const initial=await read(base+'action-continuation-20261002/linguistic-decisions.json.gz'),states=new Map();
 for(const [language,rows]of Object.entries(initial.decisions))for(const m of rows)states.set(language+'\0'+m.lemma_id,{...m,language});
 const originals=[...states.values()].filter(m=>m.status==='accepted');
 for(const folder of ['action-italian-stage-20261002','action-independent-heads-20261002','action-russian-heads-20261002','action-positive-extension-20261002']){
  const d=await read(base+folder+'/decisions.json');
  for(const m of d.decisions){const k=m.language+'\0'+m.lemma_id,prior=states.get(k);assert.equal(prior.status,m.previous_status);assert.equal(prior.word,m.word);assert.deepEqual(prior.source_family_ids,m.source_family_ids);states.set(k,{...prior,...m});}
 }
 assert.equal(states.size,52277);for(const m of originals)assert.deepEqual(states.get(m.language+'\0'+m.lemma_id),m);
 const d=await read(cp+'decisions.json');for(const [l,counts]of Object.entries(d.counts))for(const [s,n]of Object.entries(counts))assert.equal([...states.values()].filter(m=>m.language===l&&m.status===s).length,n);
 const audited=await auditActionStage(root);assert.equal(audited.added_memberships,applied?2268:2098);assert.equal(audited.removed_memberships,0);assert.equal(audited.full_family_certification,false);
});
test('new reviewed action compounds reach runtime while source measurements and components remain intact',{skip:!applied},async()=>{
 const d=await read(cp+'decisions.json'),proof=(await read(cp+'source-records.json.gz')).records;
 const loader=new FamilyIndexLoader({baseUrl:root,fetchJson:read});
 for(const language of ['en','de']){
  const entries=await loader.candidateEntries('act',language),byId=new Map(entries.map(m=>[m.lemma_id,m]));
  const storedById=new Map((await read(root+'/members/'+language+'/'+familyBucket('family:act')+'.json.gz'))['family:act'].map(m=>[m.lemma_id,m]));
  for(const row of d.decisions.filter(m=>m.language===language)){
   const m=byId.get(row.lemma_id);assert(m,row.word);assert.equal(m.family_id,'family:act');
   const {source_family_ids,components,...original}=proof.find(p=>p.language===language&&p.member.lemma_id===row.lemma_id).member;
   // Loader entries also carry query-side fields; compare stored corpus records.
   const stored=storedById.get(row.lemma_id);
   const {components:storedComponents,...storedMeasured}=stored;
   assert.deepEqual(storedMeasured,original,row.word);assert.deepEqual(storedComponents.slice(0,-1),components||[],row.word);assert.equal(storedComponents.at(-1).evidence[0].source,cp+'materialization-ledger.json');
  }
  const words=new Set(entries.map(m=>m.word));for(const w of language==='en'?['fraction','attraction','redact','actium','actingg']:['fraktion','abstraktion','redaktion','aktivieit'])assert(!words.has(w),w);
 }
 const status=await read(cp+'materialization-status.json');assert.equal(status.runtime_support,2268);assert.equal(status.runtime_applied,true);assert.equal(status.alias_delta,0);
});
test('reapplying the extension fails before changing any corpus file',{skip:!applied},async()=>{
 const paths=[root+'/families/'+familyBucket('family:act')+'.json.gz',...['en','de'].map(l=>root+'/members/'+l+'/'+familyBucket('family:act')+'.json.gz'),...['manifest.json','report.json','repository-provenance.json'].map(p=>root+'/'+p)];
 const before=await Promise.all(paths.map(async p=>sha(await readFile(p))));
 const r=spawnSync(process.execPath,['scripts/materialize-associative-action-extension-20261002.mjs','--apply'],{encoding:'utf8'});assert.notEqual(r.status,0);assert.match(r.stderr,/Already applied/);
 assert.deepEqual(await Promise.all(paths.map(async p=>sha(await readFile(p)))),before);
});
