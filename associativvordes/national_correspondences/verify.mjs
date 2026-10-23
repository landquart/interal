// Independent byte/proposal verification. No linguistic verdicts or writes.
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,join,relative} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(process.argv[2]??'.'),d=join(root,'audit/associative-national-correspondences');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const lock=read(join(d,'CURRENT.json'));
for(const k of ['registry','sources'])assert.equal(hash(join(d,lock[k])),lock[k+'_sha256']);
const registry=read(join(d,lock.registry)),sources=read(join(d,lock.sources));
assert.equal(registry.sources_sha256,lock.sources_sha256);
assert.deepEqual(registry.global_rules,[]);assert.equal(registry.production_enabled,false);
for(const s of sources.sources)assert.equal(createHash('sha256').update(s.excerpt).digest('hex'),s.excerpt_sha256);
const roots=new Map(registry.roots.map(r=>[r.canonical_root_id,r]));
assert.deepEqual([...roots.keys()].sort(),['manu','regul','creat','ocul','ped','inter','liber','mut'].map(x=>'family:'+x).sort());
assert.deepEqual(roots.get('family:ped').legacy_family_ids,['family:pede']);
assert.equal(roots.get('family:inter').element_kind,'preposition');
assert.equal(roots.get('family:liber').target_binding,'UNRESOLVED');
for(const e of registry.entries){
 assert.equal(e.membership_status,'UNRESOLVED');assert.equal(e.association_status,'NOT_ASSESSED');
 assert.equal(e.scope.propagation,'FORBIDDEN');assert.equal(e.scope.regular_language_rule,false);
 assert.equal(e.normative_form,roots.get(e.canonical_root_id).normative_form);
 assert.equal(e.path.at(-1).to_form,e.language+':'+e.lexeme.lemma);
 for(let i=1;i<e.path.length;i++)assert.equal(e.path[i-1].to_form,e.path[i].from_form);
}
const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(p,e.name)):[join(p,e.name)]);
const discovered=['structural','surface','morphology'].flatMap(k=>walk(join(root,'audit/associative-v5-'+k+'-cleanup'))).filter(p=>p.endsWith('.ndjson')&&(p.endsWith('/SAFE-FIXES.ndjson')||p.includes('/PROPOSED')||p.endsWith('/VERIFIED-RELATION-CORRECTIONS.ndjson'))).sort();
const coverage=read(join(d,'EXCLUSION-COVERAGE.json')),state=read(join(d,'OUTPUT-STATE.json'));let rows=0;
assert.equal(state.status,'COMPLETE');assert.equal(hash(join(d,'EXCLUSION-COVERAGE.json')),state.coverage_sha256);
assert.equal(hash(join(d,'BLOCKED-OPERATIONS.ndjson')),coverage.blocked_output_sha256);assert.equal(state.blocked_sha256,coverage.blocked_output_sha256);
for(const p of discovered){
 const input=coverage.inputs.find(i=>i.path===relative(root,p));assert.ok(input,'missing proposal manifest');
 assert.equal(hash(p),input.sha256);assert.equal(statSync(p).size,input.bytes);
 const lines=readFileSync(p,'utf8').split(/\r?\n/).filter(x=>x.trim());assert.equal(lines.length,input.rows);rows+=lines.length;
 for(const l of lines)JSON.parse(l);
}
assert.equal(discovered.length,coverage.inputs.filter(i=>i.path.endsWith('.ndjson')).length);
assert.equal(rows,coverage.physical_proposal_rows);assert.equal(coverage.registry_sha256,lock.registry_sha256);
for(const i of read(join(d,'SOURCE-LOCK.json')).inputs)assert.equal(hash(join(root,i.path)),i.sha256);
for(const i of read(join(d,'CODE-LOCK.json')).files)assert.equal(hash(join(root,i.path)),i.sha256);
for(const name of ['NATIONAL-CORRESPONDENCE-REGISTRY.json','SOURCE-RECEIPTS.json'])assert.equal(hash(join(d,'snapshots',hash(join(d,name))+'.json')),hash(join(d,name)));
console.log(JSON.stringify({status:'PASS',scope:'Independent JavaScript receipt and complete proposal-input verification; no linguistic certification',entries:registry.entries.length,sources:sources.sources.length,proposal_manifests:discovered.length,proposal_rows:rows,production_writes:0}));
