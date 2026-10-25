// Full historical scopes, not sample-based linguistic re-adjudication.
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const [run,out,catalogPath]=process.argv.slice(2);
const catalog=JSON.parse(readFileSync(catalogPath||run+'/HISTORICAL-SCHEMES.json'));
const pointer=JSON.parse(readFileSync('audit/associative-history-registry/CURRENT.json'));
const history=JSON.parse(readFileSync('audit/associative-history-registry/'+pointer.snapshot));
const records=[];
for(const pattern of catalog.patterns){
 if(!pattern.member_list_sha256)continue;
 let verified=null;
 const candidates=history.decisions.filter(d=>d.scope.family_id===pattern.family_id&&d.scope.language===pattern.language&&d.scope.selector?.before);
 for(const d of candidates){
  const blob=d.scope.selector.before;
  const raw=execFileSync('git',['cat-file','blob',blob],{maxBuffer:100*1024*1024});
  const locked=history.sources.find(s=>s.blob===blob);
  if(!locked||raw.length!==locked.bytes||createHash('sha256').update(raw).digest('hex')!==locked.sha256)throw Error('unlocked historical bytes');
  const rows=JSON.parse(gunzipSync(raw))[pattern.family_id]||[];
  if(rows.length!==pattern.expected_members)continue;
  const h=createHash('sha256');const evidence={};
  for(const r of rows.slice().sort((a,b)=>a.lemma_id.localeCompare(b.lemma_id))){
   h.update(r.lemma_id+'\0'+r.word+'\n');
   for(const c of r.components||[])for(const e of c.evidence||[]){const k=e.type+':'+e.source;evidence[k]=(evidence[k]||0)+1;}
  }
  if(h.digest('hex')!==pattern.member_list_sha256)continue;
  const evidenceEqual=Object.keys(evidence).length===Object.keys(pattern.expected_evidence||{}).length&&Object.entries(pattern.expected_evidence||{}).every(([k,n])=>evidence[k]===n);
  if(!evidenceEqual)throw Error('historical evidence counts mismatch');
  verified={family_id:pattern.family_id,language:pattern.language,source_path:pattern.source_path,source_pointer:pattern.pointer,verified_complete_rows:rows.length,before_blob:blob,member_list_sha256:pattern.member_list_sha256,evidence_counts_match:evidenceEqual,historical_decision_id:d.id,authority:d.authority,current_scope_transfer_allowed:false,independent_linguistic_gold:false};
  break;
 }
 records.push(verified||{family_id:pattern.family_id,source_path:pattern.source_path,status:'HISTORICAL_SCOPE_UNRESOLVED',current_scope_transfer_allowed:false});
}
const result={schema:'v5-surface-historical-scope/1',records,verified:records.filter(x=>x.verified_complete_rows).length,unresolved:records.filter(x=>!x.verified_complete_rows).length,semantics:'Full old row/evidence digests verified; no new linguistic conclusion or transfer to other scopes'};
writeFileSync(out,JSON.stringify(result)+'\n');console.log(JSON.stringify({verified:result.verified,unresolved:result.unresolved}));
