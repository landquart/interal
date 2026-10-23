// Independent JSON decoding and selection over all source edges and output IDs.
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
const [snapshot,result,output]=process.argv.slice(2);
if(!output)throw Error('Usage: verify.mjs SNAPSHOT RUN OUTPUT');
const j=p=>JSON.parse(readFileSync(p,'utf8'));
const gz=p=>gunzipSync(readFileSync(p)).toString('utf8');
const root=join(snapshot,'current/associativvordes/family-index-v5');
let families=0,memberships=0,selected=0,history=0;
for(let i=0;i<256;i++){
 const b=i.toString(16).padStart(2,'0');const fs=jz(join(root,'families',b+'.json.gz'));families+=Object.keys(fs).length;
 const expected=new Map();
 for(const lang of ['en','de','fr','es','it','ru']){
  const groups=jz(join(root,'members',lang,b+'.json.gz'));
  for(const [fid,rows] of Object.entries(groups)){
   if(!fs[fid])throw Error('missing family');
   for(let ordinal=0;ordinal<rows.length;ordinal++){
    const r=rows[ordinal];memberships++;
    const e=(r.components??[]).flatMap(c=>c.evidence??[]),ts=[...new Set(e.map(x=>x.type??'UNKNOWN'))],ss=new Set(e.map(x=>x.source??'UNKNOWN'));
    const inf=ts.some(t=>t.includes('inflect')||t==='form_of'),der=ts.some(t=>['morphological_parse','compound_morphology','derivation','derivational'].includes(t));
    const chosen=!ts.length||ts.every(t=>['surface_identity','substring','surface_match','suffix_match'].includes(t))||ts.some(t=>t.includes('compound')||t.includes('allomorph'))||(inf&&der)||ss.has('candidate_index')||ss.has('manually_verified');
    if(chosen){selected++;expected.set(JSON.stringify([fid,lang,r.lemma_id,ordinal]),r.word);}
   }
  }
 }
 const actual=gz(join(result,'buckets',b,'UNRESOLVED.ndjson.gz')).trim().split('\n').filter(Boolean);
 if(actual.length!==expected.size)throw Error('scope size');
 for(const line of actual){
  const r=JSON.parse(line),key=JSON.stringify(r.slice(0,4));
  if(expected.get(key)!==r[4])throw Error('lost/duplicate/changed edge');expected.delete(key);
  let bits=r[6],n=0;while(bits){n+=bits&1;bits>>=1;}
  if(r[5]!==(n>1?'COMPETING_ANALYSES':'INSUFFICIENT_EVIDENCE'))throw Error('unproved verdict');
  if(r[8].length)history++;
 }
 if(expected.size)throw Error('missing IDs');
}
const summary=j(join(result,'SUMMARY.json'));
if(families!==summary.totals.families||memberships!==summary.totals.memberships||selected!==summary.totals.selected||history!==summary.totals.exact_history_overlap)throw Error('summary mismatch');
writeFileSync(output,JSON.stringify({status:'PASS',families,memberships,selected,exact_history_overlap:history,independent_decoder:'Node JSON/gzip',scope:'All IDs, spelling, selection, status; source profiles separately hash checked; no semantic certification'})+'\n');
function jz(p){return JSON.parse(gz(p));}
