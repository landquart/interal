import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {buildSearchForm} from '../associativvordes/js/search-normalizer.js';
const root='associativvordes/family-index-v5',out='audit/associative-family-v5/action-reflex-checkpoint-20261001';
// Retrieval only: action national forms, including Italian att-/azion-.
// These patterns intentionally include unrelated stems needing adjudication.
const forms={act:['act','akt','accion','azion','att','акт','акц']};
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
// Preserve the complete pre-repair actio/acti source containers too: records
// outside the modern retrieval patterns still need an explicit disposition.
const originalAll=JSON.parse(gunzipSync(await readFile('audit/associative-family-v5/latin-pairs-checkpoint-20261001/original-families.json.gz'))),retired=['ety:751cdacbf4a9','ety:9a86a987fafc'];
const original={families:Object.fromEntries(retired.map(id=>[id,originalAll.families[id]])),members:Object.fromEntries(Object.keys(counts).map(l=>[l,Object.fromEntries(retired.map(id=>[id,originalAll.members[l][id]]))]))};
const ob=gzipSync(JSON.stringify(original),{level:6});await writeFile(out+'/original-families.json.gz',ob);artifacts['original-families.json.gz']=createHash('sha256').update(ob).digest('hex');
for(const language of Object.keys(counts)){
 const name=language+'-candidates.json.gz',payload=JSON.parse(gunzipSync(await readFile(out+'/'+name))),map=new Map(payload.act.map(m=>[m.lemma_id,m]));
 for(const id of retired)for(const m of original.members[language][id]){const old=map.get(m.lemma_id);if(old){if(!old.source_family_ids.includes(id))old.source_family_ids.push(id);}else map.set(m.lemma_id,{...m,source_family_ids:[id]});}
 payload.act=[...map.values()].sort((a,b)=>a.word.localeCompare(b.word,'en')||a.lemma_id.localeCompare(b.lemma_id));const bytes=gzipSync(JSON.stringify(payload),{level:6});await writeFile(out+'/'+name,bytes);artifacts[name]=createHash('sha256').update(bytes).digest('hex');counts[language].act=map.size;
}
const provenance=JSON.parse(await readFile(root+'/repository-provenance.json'));
await writeFile(out+'/inventory.json',JSON.stringify({source_run_id:35647932153,source_tree_content_sha256:provenance.tree_content_sha256,retrieval_forms:forms,retired_source_families:retired,method:'Full frozen actio/acti containers plus all six-language materialized member shards scanned; every matching original record and independent source-family route retained. Broad retrieval is not linguistic acceptance. Candidate completeness is relative to these explicit retrieval forms and available corpus.',counts,artifacts,review_status:'unadjudicated_source_candidates',limitations:['No inherited or reflex variant outside the declared retrieval frame is claimed covered.','No guessed frequency or synthetic corpus lemma is added.','act is a retrieval label, not a decision to merge actio, Actium, Greek actin-, fact/pact/tact/tract, or all Italian -azione suffixes.']},null,2)+'\n');
