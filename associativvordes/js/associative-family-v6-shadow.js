import {loadParallelV6,v6QueryKey,V6_LANGUAGES} from './associative-family-v6.js';
const measuredFields=['lemma_id','word','normalized','search_form','rank','frequency_score','category_breakdown','sources','corpus_quality'];
// Object serialization order is not a different measurement. Preserve arrays and
// the returned original objects; canonicalize only this internal equality key.
const orderedValue=value=>Array.isArray(value)?value.map(orderedValue):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,orderedValue(value[k])])):value;
const measuredSignature=record=>JSON.stringify(orderedValue(measuredFields.map(k=>[k,record[k]])));
export function deduplicateV6CorpusRows(rows) {
 const byId=new Map();
 for(const row of rows){
  const key=row.language+'\0'+row.lemma_id,previous=byId.get(key);
  if(!previous){byId.set(key,{...row,accepted_memberships:[...row.accepted_memberships]});continue;}
  if(measuredSignature(previous)!==measuredSignature(row))throw Error('Conflicting original corpus measurements');
  for(const membership of row.accepted_memberships)if(!previous.accepted_memberships.some(m=>m.family_id===membership.family_id&&m.head_id===membership.head_id&&m.edge_version===membership.edge_version))previous.accepted_memberships.push(membership);
 }
 return [...byId.values()];
}
// Explicit shadow entry point; production keeps its existing v5 loader.
export async function loadV6ShadowRuntime({readJson}) {
 // Source shards can be large; failed reads must remain retryable.
 const cache=new Map(),read=p=>{
  if(!cache.has(p)){
   const request=Promise.resolve().then(()=>readJson(p));cache.set(p,request);
   request.catch(()=>{if(cache.get(p)===request)cache.delete(p);});
   if(cache.size>32)cache.delete(cache.keys().next().value);
  }
  return cache.get(p);
 };
 const index=await loadParallelV6({readJson:read});
 const search=(query,language)=>index.search(query,language);
 const zeroRows=async()=> (await read('audit/associative-family-v6/corpus-enumeration.json')).zero_membership_source_records;
 const validateLanguage=language=>{if(language!=null&&!V6_LANGUAGES.includes(language))throw Error('Unsupported v6 query language');};
 return {...index,search,routeQuery:(query,language)=>index.routeQuery(query,language),
  async searchCorpusRows(query,language){
   const rows=[];
   // Sequential hydration keeps only a bounded number of immutable source shards alive.
   for(const m of search(query,language)){
    const p=m.source_proof[0].source,record=await index.getCorpusRecord({...p,lemma_id:m.lemma_id});
    if(!record||record.lemma_id!==m.lemma_id||record.word!==m.word)throw Error('Lost or mismatched source corpus record');
    rows.push({...record,language:m.language,associative_family_id:m.family_id,lexical_head_id:m.head_id,accepted_memberships:[{family_id:m.family_id,head_id:m.head_id,edge_version:m.edge_version,source_proof:m.source_proof}]});
   }
   return deduplicateV6CorpusRows(rows);
  },
  async getZeroMembershipCorpusRecord(language,lemmaId){validateLanguage(language);if(language==null)throw Error('Corpus ID retrieval requires language');return (await zeroRows()).find(r=>r.language===language&&r.lemma_id===lemmaId)||null;},
  async searchZeroMembershipCorpusRecords(query,language){validateLanguage(language);const key=v6QueryKey(query);return key?(await zeroRows()).filter(r=>(language==null||r.language===language)&&v6QueryKey(r.word)===key):[];}
 };
}
