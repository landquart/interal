// Independent v2 replay: every input ID and every retained source field, all buckets.
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const [input,output,receipt]=process.argv.slice(2);
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const lines=p=>gunzipSync(readFileSync(p)).toString('utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const a=json(join(input,'MANIFEST.json')),b=json(join(output,'MANIFEST.json'));
if(hash(join(input,'MANIFEST.json'))!==b.identity.input_manifest_sha256)throw Error('input manifest');
let rows=0,reclassified=0;const langs={};
for(let i=0;i<256;i++){
 const p=a.buckets[i],q=b.buckets[i];if(p.bucket!==q.bucket)throw Error('bucket identity');
 const name=join('buckets',p.bucket,'UNRESOLVED.ndjson.gz');
 if(hash(join(input,name))!==p.sha256||hash(join(output,name))!==q.sha256)throw Error('partition hash');
 const before=lines(join(input,name)),after=lines(join(output,name));
 if(before.length!==after.length)throw Error('lost IDs');
 for(let j=0;j<before.length;j++){
  const x=before[j],y=after[j];if(y.length!==11||y[5]!=='INSUFFICIENT_EVIDENCE')throw Error('unbound semantic verdict');
  for(let k=0;k<10;k++)if(k!==5&&JSON.stringify(x[k])!==JSON.stringify(y[k]))throw Error('source identity/evidence/alternative changed');
  const reasons=['NATIVE_LEXEME_UNBOUND','SENSE_UNBOUND','ROOT_COMPONENT_PATH_UNVERIFIED'];
  if(!x[7])reasons.push('SOURCE_ROWS_MISSING_NOT_NEGATIVE');
  let mask=x[6],n=0;while(mask){n+=mask&1;mask>>=1;}if(n>1)reasons.push('COEXISTING_CANDIDATE_TYPES_NOT_VERIFIED_CONFLICT');
  if(x[9].includes('COMPOUND_CLAIM_UNVERIFIED'))reasons.push('COMPOUND_SEGMENTATION_ROLE_MEANING_UNVERIFIED');
  if(x[8].length)reasons.push('EXACT_HISTORY_OVERLAP');
  if(JSON.stringify(reasons)!==JSON.stringify(y[10]))throw Error('reason mismatch');
  rows++;reclassified+=x[5]==='COMPETING_ANALYSES';langs[x[1]]=(langs[x[1]]??0)+1;
 }
}
const s=json(join(output,'SUMMARY.json'));
if(s.totals.selected_memberships!==rows||s.totals.legacy_multiple_type_labels_reclassified!==reclassified)throw Error('coverage');
for(const [l,n] of Object.entries(langs))if(s.languages[l].INSUFFICIENT_EVIDENCE!==n)throw Error('language coverage');
writeFileSync(receipt,JSON.stringify({status:'PASS',buckets:256,selected_memberships:rows,reclassified,source_fields_unchanged:true,exact_history_refs_unchanged:true,alternatives_unchanged:true,independent_decoder:'Node JSON/gzip'})+'\n');
