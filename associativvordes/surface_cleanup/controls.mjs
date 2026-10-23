import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
const [snapshot,run,output]=process.argv.slice(2);
function bucket(s){let h=2166136261;for(const c of s)h=Math.imul(h^c.codePointAt(0),16777619);return((h>>>0)%256).toString(16).padStart(2,'0');}
const cases=[['family:manu','ru','маникюр'],['family:manu','fr','manucure'],['family:regul','fr','règlement'],['family:regul','ru','регламент'],['family:ocul','fr','oculaire'],['family:ocul','de','monokel'],['family:inter','en','international'],['surface:en:creat','en','create'],['surface:it:cre','it','creare']];
const records=[];
for(const [family,language,word]of cases){
 const b=bucket(family);const path=join(snapshot,'current/associativvordes/family-index-v5/members',language,b+'.json.gz');
 const rows=JSON.parse(gunzipSync(readFileSync(path)))[family]||[];
 const matches=rows.filter(x=>x.word.toLocaleLowerCase('und')===word.toLocaleLowerCase('und'));
 const observations=gunzipSync(readFileSync(join(run,'buckets',b,'FAMILIES.ndjson.gz'))).toString().trim().split('\n').filter(Boolean).map(JSON.parse);
 const f=observations.find(x=>x.family_id===family);
 if(f?.automatic_exclusion)throw Error('protected observation excluded');
 records.push({family_id:family,language,word,existing_lemma_ids:matches.map(x=>x.lemma_id),status:matches.length?'PRESERVED_EXACT_LEGACY_RECORD':'NOT_IN_THIS_EXACT_LEGACY_FAMILY_NOT_RESTORED',operation:f?.operation||'NO_CURRENT_FAMILY',native_correspondence_confirmed_by_this_test:false,sense_status:'UNRESOLVED'});
}
const result={schema:'v5-surface-current-form-controls/1',records,production_writes:0,semantics:'Exact legacy lookup and preservation only; these tests do not create national correspondences or memberships.'};
writeFileSync(output,JSON.stringify(result)+'\n');console.log(JSON.stringify({cases:records.length,preserved:records.filter(x=>x.existing_lemma_ids.length).length}));
