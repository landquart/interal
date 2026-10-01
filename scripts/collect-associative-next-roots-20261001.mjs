import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {buildSearchForm} from '../associativvordes/js/search-normalizer.js';
const root='associativvordes/family-index-v5',out='audit/associative-family-v5/next-roots-checkpoint-20261001';
// These broad forms retrieve possible reflexes; they confer no membership.
const forms={relat:['relat','relaz','релат','релят','реляц'],oper:['oper','опер'],mut:['mut','мут'],creat:['creat','creaz','crea','kreat','krea','креат','креац','креа']};
const normalized=Object.fromEntries(Object.entries(forms).map(([k,fs])=>[k,[...new Set(fs.map(buildSearchForm))]]));
await mkdir(out,{recursive:true});const counts={},artifacts={};
for(const language of ['en','de','fr','es','it','ru']){
 const maps=Object.fromEntries(Object.keys(forms).map(k=>[k,new Map()]));
 for(const name of (await readdir(root+'/members/'+language)).sort()){
  const shard=JSON.parse(gunzipSync(await readFile(root+'/members/'+language+'/'+name)));
  for(const [id,ms]of Object.entries(shard))for(const m of ms){const word=buildSearchForm(m.word);for(const [key,fs]of Object.entries(normalized))if(fs.some(f=>word.includes(f))){const existing=maps[key].get(m.lemma_id);if(existing){if(!existing.source_family_ids.includes(id))existing.source_family_ids.push(id);}else maps[key].set(m.lemma_id,{...m,source_family_ids:[id]});}}
 }
 const payload=Object.fromEntries(Object.entries(maps).map(([key,map])=>[key,[...map.values()].sort((a,b)=>a.word.localeCompare(b.word,'en')||a.lemma_id.localeCompare(b.lemma_id))]));
 const name=language+'-candidates.json.gz',bytes=gzipSync(JSON.stringify(payload),{level:6});await writeFile(out+'/'+name,bytes);artifacts[name]=createHash('sha256').update(bytes).digest('hex');counts[language]=Object.fromEntries(Object.entries(maps).map(([k,m])=>[k,m.size]));console.log(language,JSON.stringify(counts[language]));
}
const provenance=JSON.parse(await readFile(root+'/repository-provenance.json'));
await writeFile(out+'/inventory.json',JSON.stringify({source_run_id:35647932153,source_tree_content_sha256:provenance.tree_content_sha256,retrieval_forms:forms,method:'All six-language materialized member shards scanned; every matching original record and independent source-family route retained. Broad retrieval is not linguistic acceptance. Candidate completeness is relative to these explicit retrieval forms and available corpus.',counts,artifacts,review_status:'unadjudicated_source_candidates',limitations:['No inherited or reflex variant outside the declared retrieval frame is claimed covered.','No guessed frequency or synthetic corpus lemma is added.','creat is a retrieval group label; final associative canonical choice must cover the reviewed creation/create/crear/creare national forms.']},null,2)+'\n');
