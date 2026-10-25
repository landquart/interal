// Explicit historical keep/retained lists, including genea/sonus and other mechanisms.
import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const [snapshot,output]=process.argv.slice(2);const dir='audit/associative-family-v5';
const selected=new Map();const sources={};const patterns=[];
function walk(x,source,pointer='',family=null,language=null){
 if(Array.isArray(x)){x.forEach((v,i)=>walk(v,source,pointer+'/'+i,family,language));return;}
 if(!x||typeof x!=='object')return;
 family=x.family_id||family;language=x.language||language;
 if(family&&language&&x.member_list_sha256&&Number.isInteger(x.expected_members))patterns.push({family_id:family,language,reason:x.reason,expected_members:x.expected_members,member_list_sha256:x.member_list_sha256,expected_evidence:x.expected_evidence,source_path:source,pointer,authority:'HISTORICAL_CLAIM_NOT_NEW_GOLD'});
 for(const key of ['keep','retained'])if(Array.isArray(x[key]))for(const r of x[key]){
  if(family&&language&&r&&typeof r==='object'&&r.lemma_id){
   const k=JSON.stringify([family,language,r.lemma_id]);
   const v=selected.get(k)||{family_id:family,language,lemma_id:r.lemma_id,word:r.word,source_refs:[],authority:'HISTORICAL_RETAINED_CLAIM_NOT_NEW_GOLD'};
   v.source_refs.push({path:source,pointer:pointer+'/'+key,source_sha256:sources[source]});selected.set(k,v);
  }
 }
 for(const [k,v]of Object.entries(x))walk(v,source,pointer+'/'+k,family,language);
}
for(const name of readdirSync(dir).sort())if(name.endsWith('.json')){
 const p=join(dir,name);const raw=readFileSync(p);sources[p]=createHash('sha256').update(raw).digest('hex');
 walk(JSON.parse(raw),p);
}
function bucket(s){let h=2166136261;for(const c of s)h=Math.imul(h^c.codePointAt(0),16777619);return((h>>>0)%256).toString(16).padStart(2,'0');}
const cache=new Map();const records=[];
for(const r of selected.values()){
 const p=join(snapshot,'current/associativvordes/family-index-v5/members',r.language,bucket(r.family_id)+'.json.gz');
 if(!cache.has(p))cache.set(p,JSON.parse(gunzipSync(readFileSync(p))));
 const rows=cache.get(p)[r.family_id]||[];const matches=rows.filter(x=>x.lemma_id===r.lemma_id);
 r.current_matches=matches.length;r.status=matches.length===1?'PRESERVED_EXACT_ID':'CURRENT_SCOPE_REVIEW_REQUIRED';records.push(r);
}
const result={schema:'v5-surface-all-historical-retentions/1',records,patterns,source_sha256:sources,unique_explicit_retained_ids:records.length,preserved_current_memberships:records.filter(x=>x.current_matches===1).length,unresolved:records.filter(x=>x.current_matches!==1).length,no_restoration_or_membership_change:true};
writeFileSync(output,JSON.stringify(result)+'\n');console.log(JSON.stringify({retained:records.length,preserved:result.preserved_current_memberships,unresolved:result.unresolved}));
