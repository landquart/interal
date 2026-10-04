import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
const script=resolve('scripts/integrate-associative-v6-reviewed-stage.mjs');
for(const [name,change,error] of [
 ['missing binding',s=>delete s.binding_authorized,/binding not approved/],
 ['false binding',s=>s.binding_authorized=false,/binding not approved/],
 ['string binding',s=>s.binding_authorized='true',/binding not approved/],
 ['missing acceptance',s=>delete s.accepted_membership_authorized,/not explicitly approved/],
 ['false acceptance',s=>s.accepted_membership_authorized=false,/not explicitly approved/],
 ['synthetic registry',s=>s.synthetic_fixture=true,/Synthetic fixture/],
 ['stale version',s=>s.predecessor_review_version=99,/predecessor version/],
 ['stale hash',s=>s.predecessor_review_sha256='0'.repeat(64),/predecessor hash/],
])test('finite stage rejects '+name+' before registry mutation',()=>{
 const dir=mkdtempSync(join(tmpdir(),'v6-stage-synthetic-'));
 try {
  mkdirSync(join(dir,'associativvordes/family-index-v6'),{recursive:true});
  const registry=join(dir,'associativvordes/family-index-v6/lexical-head-review.json.gz');
  const before=gzipSync(JSON.stringify({version:1,lexical_facts:[],evidence_cache:[],finite_bindings:[],head_reviews:[]}));writeFileSync(registry,before);
  writeFileSync(join(dir,'source.json'),'{}');
  const s={schema_version:6,production_enabled:false,binding_authorized:true,accepted_membership_authorized:true,source_queue:'source.json',source_queue_sha256:createHash('sha256').update('{}').digest('hex'),groups:[{status:'accepted'}]};change(s);writeFileSync(join(dir,'decision.json'),JSON.stringify(s));
  assert.throws(()=>execFileSync(process.execPath,[script,'decision.json'],{cwd:dir,stdio:'pipe'}),error);
  assert.deepEqual(readFileSync(registry),before);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
