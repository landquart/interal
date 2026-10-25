// Independent native JSON decoder; checks every source edge and every affected ID.
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const [snapshot,result,output]=process.argv.slice(2);
if(!output)throw Error('Usage: verify.mjs SNAPSHOT RUN OUTPUT');
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const gzip=p=>gunzipSync(readFileSync(p)).toString('utf8');
const root=join(snapshot,'current/associativvordes/family-index-v5');
const tails=new Set(json('audit/associative-v5-diagnostics/SUFFIX-EXPOSURE.json').records.map(x=>x.family_id));
const hi=json(join(result,'HISTORY-INDEX.json'));
if(createHash('sha256').update(readFileSync(join(result,'history.sqlite'))).digest('hex')!==hi.sha256)throw Error('history index checksum');
const historyRows=JSON.parse(execFileSync('python3',['-c',"import sqlite3,json,sys;d=sqlite3.connect('file:'+sys.argv[1]+'?mode=ro',uri=True);print(json.dumps(list(d.execute('SELECT family,language,lemma,decision FROM ids ORDER BY family,language,lemma,decision'))))",join(result,'history.sqlite')],{maxBuffer:128*1024*1024,encoding:'utf8'}));
const history=new Map();
for(const [fid,lang,lid,id] of historyRows){const key=JSON.stringify([fid,lang,lid]);if(!history.has(key))history.set(key,[]);history.get(key).push(id);}
const dispositions={},candidateDispositions={};
let families=0,memberships=0,candidateFamilies=0,candidateMemberships=0;
for(let bi=0;bi<256;bi++){
 const b=bi.toString(16).padStart(2,'0');
 const source=JSON.parse(gzip(join(root,'families',b+'.json.gz')));
 const rows=gzip(join(result,'buckets',b,'FAMILIES.ndjson.gz')).trim().split('\n').filter(Boolean).map(JSON.parse);
 const records=new Map(rows.map(x=>[x.family_id,x]));
 if(records.size!==rows.length||records.size!==Object.keys(source).length)throw Error('family coverage');
 const expected=new Set();const scopes=new Map();const sizes=new Map();const claimTypes=new Map(),historyIds=new Map();
 for(const [fid,f] of Object.entries(source)){
  const flags=[];
  if([...f.canonical].length<=3)flags.push('SHORT_FRAGMENT_EXPOSURE');
  if(tails.has(fid))flags.push('CONFIGURED_TAIL_EXPOSURE');
  if(f.source==='surface_singleton'&&f.support>1)flags.push('MULTI_MEMBER_HEURISTIC_SURFACE');
  const r=records.get(fid);
  if(!r||JSON.stringify(flags.sort())!==JSON.stringify(r.flags)||r.candidate!==(flags.length>0))throw Error('independent selection mismatch');
  if(!['RETAIN_WITH_REVIEW','INSUFFICIENT_EVIDENCE'].includes(r.operation)||r.automatic_exclusion)throw Error('unproved exclusion');
  sizes.set(fid,0);claimTypes.set(fid,new Set());historyIds.set(fid,new Set());families++;
  if(flags.length){candidateFamilies++;scopes.set(fid,[]);}
 }
 for(const lang of ['en','de','fr','es','it','ru']){
  const groups=JSON.parse(gzip(join(root,'members',lang,b+'.json.gz')));
  for(const [fid,values] of Object.entries(groups)){
   if(!records.has(fid))throw Error('unaccounted membership group');
   sizes.set(fid,sizes.get(fid)+values.length);memberships+=values.length;
   for(let ordinal=0;ordinal<values.length;ordinal++){
    const row=values[ordinal];
    for(const component of row.components||[])for(const e of component.evidence||[])claimTypes.get(fid).add(e.type||'UNKNOWN');
    for(const id of history.get(JSON.stringify([fid,lang,row.lemma_id]))||[])historyIds.get(fid).add(id);
    if(scopes.has(fid)){
     const k=JSON.stringify([fid,lang,row.lemma_id,ordinal]);
     if(expected.has(k))throw Error('duplicate expected edge');
     expected.add(k);scopes.get(fid).push([lang,row.lemma_id]);candidateMemberships++;
    }
   }
  }
 }
 const actual=gzip(join(result,'buckets',b,'AFFECTED-IDS.ndjson.gz')).trim().split('\n').filter(Boolean);
 if(new Set(actual).size!==actual.length||actual.length!==expected.size)throw Error('affected cardinality');
 for(const k of actual)if(!expected.delete(k))throw Error('unexpected affected ID');
 if(expected.size)throw Error('lost affected ID');
 for(const [fid,r] of records){
  const historical=source[fid].source!=='surface_singleton'||Boolean(source[fid].relation_evidence && (!Array.isArray(source[fid].relation_evidence)||source[fid].relation_evidence.length));
  const competing=[...claimTypes.get(fid)].some(x=>!['compound_morphology','morphological_parse','surface_identity'].includes(x));
  const prior=[...historyIds.get(fid)].sort();
  const operation=historical||competing||prior.length?'RETAIN_WITH_REVIEW':'INSUFFICIENT_EVIDENCE';
  if(r.operation!==operation||JSON.stringify(prior)!==JSON.stringify(r.history_decision_ids))throw Error('independent family disposition mismatch');
  dispositions[operation]=(dispositions[operation]||0)+1;
  if(r.candidate)candidateDispositions[operation]=(candidateDispositions[operation]||0)+1;
  if(sizes.get(fid)!==r.memberships||sizes.get(fid)!==source[fid].support)throw Error('membership count');
  if(scopes.has(fid)){
   const ids=scopes.get(fid).sort((a,b)=>a[0].localeCompare(b[0])||a[1].localeCompare(b[1]));
   const hash=createHash('sha256').update(JSON.stringify(ids)).digest('hex');
   if(hash!==r.full_scope_sha256||ids.length!==r.full_scope_memberships)throw Error('full scope digest');
  }
 }
 if(bi%32===31)console.log(JSON.stringify({bucket:b,families,memberships}));
}
const summary=json(join(result,'SUMMARY.json'));
if(families!==summary.totals.families||memberships!==summary.totals.memberships||candidateFamilies!==summary.totals.candidate_families||candidateMemberships!==summary.totals.candidate_memberships)throw Error('global totals');
for(const [operation,n] of Object.entries(dispositions))if(summary.totals['disposition:'+operation]!==n)throw Error('disposition totals');
for(const [operation,n] of Object.entries(candidateDispositions))if(summary.totals['candidate:'+operation]!==n)throw Error('candidate disposition totals');
if(readFileSync(join(result,'PROPOSED-EXCLUSIONS.ndjson')).length)throw Error('unexpected nonempty exclusions');
const receipt={schema:'v5-surface-independent-verification/1',status:'PASS',buckets:256,families,memberships,candidate_families:candidateFamilies,candidate_memberships:candidateMemberships,every_family_disposition_recomputed:true,every_affected_id_checked:true,every_candidate_full_scope_sha256_checked:true,production_writes:0};
writeFileSync(output,JSON.stringify(receipt)+'\n');console.log(JSON.stringify(receipt));
