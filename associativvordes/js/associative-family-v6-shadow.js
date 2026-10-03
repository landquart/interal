import {buildSearchForm} from './search-normalizer.js';
import {loadParallelV6} from './associative-family-v6.js';
// Explicit shadow entry point; production keeps its existing v5 loader.
export async function loadV6ShadowRuntime({readJson}) {
 const cache=new Map(),read=p=>{if(!cache.has(p))cache.set(p,Promise.resolve(readJson(p)));return cache.get(p);};
 const index=await loadParallelV6({readJson:read});
 const search=(query,language)=>index.search(buildSearchForm(query),language);
 return {...index,search,routeQuery:query=>index.routeQuery(buildSearchForm(query)),
  async searchCorpusRows(query,language){return Promise.all(search(query,language).map(async m=>{const p=m.source_proof[0].source,record=await index.getCorpusRecord({...p,lemma_id:m.lemma_id});if(!record)throw Error('Lost source corpus record');return {...record,language:m.language,associative_family_id:m.family_id,lexical_head_id:m.head_id};}));},
  async getZeroMembershipCorpusRecord(language,lemmaId){const report=await read('audit/associative-family-v6/corpus-enumeration.json');return report.zero_membership_source_records.find(r=>r.language===language&&r.lemma_id===lemmaId)||null;}
 };
}
