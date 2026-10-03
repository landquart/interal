// Recognition consumes finite, independently reviewed lexical facts. Proposals
// are deliberately a different output and can never create an accepted link.
import {normalizeHead} from './associative-family-v6.js';
export function validateLexicalFacts(facts, evidence) {
 const ids=new Set(),cache=new Map(evidence.map(e=>[e.id,e]));
 for(const f of facts){
  if(ids.has(f.id)||!f.id.startsWith('lexical-fact:')||!f.language||!f.normalized_head||!f.sense||!f.evidence_ids?.length||f.evidence_ids.some(id=>!cache.has(id)))throw Error('Invalid lexical fact evidence/identity');
  ids.add(f.id);
  for(const id of f.evidence_ids){const e=cache.get(id);if(e.language!==f.language||normalizeHead(e.head)!==f.normalized_head||e.sense!==f.sense||!e.sources?.length||e.status!=='accepted')throw Error('Evidence does not prove this language/head/sense');}
 }
 return cache;
}
export function recognizeFiniteHeadBindings({records,facts,evidence,bindings}) {
 const cache=validateLexicalFacts(facts,evidence),factMap=new Map(facts.map(f=>[f.id,f])),source=new Map(),byRecord=new Map();
 for(const r of records){const k=r.language+'\0'+r.family_id+'\0'+r.lemma_id;if(source.has(k))throw Error('Duplicate source identity');source.set(k,r);}
 for(const b of bindings){
  const f=factMap.get(b.fact_id),key=b.language+'\0'+b.family_id+'\0'+b.lemma_id,r=source.get(key);
  if(!f||!r||b.language!==f.language||r.word!==b.word||!b.identity_proof?.length||!['whole_lexeme','inflection','reviewed_lexical_base_component'].includes(b.link_role))throw Error('Unproved finite head binding');
  if(b.link_role!=='reviewed_lexical_base_component'&&(!Array.isArray(f.forms)||!f.forms.includes(b.word)))throw Error('Unlisted lexical form');
  if(b.link_role==='reviewed_lexical_base_component'){
   const s=b.component_segmentation;
   if(!s||s.before+s.component+s.after!==b.word||s.head!==f.normalized_head||!f.component_stems?.includes(s.component)||!s.boundary_proof)throw Error('Missing exact reviewed component boundary');
  }
  const list=byRecord.get(key)||[];if(list.some(x=>x.fact_id===b.fact_id))throw Error('Duplicate finite binding');list.push(b);byRecord.set(key,list);
 }
 const recognized=[],unresolved=[],rejected=[];
 for(const[k,r]of source){const candidates=byRecord.get(k)||[];
  if(candidates.length!==1){unresolved.push(r);if(candidates.length>1)rejected.push({record:r,candidates,reason:'ambiguous_sense_or_multiple_heads_no_merge'});continue;}
  const b=candidates[0],f=factMap.get(b.fact_id);recognized.push({...b,fact:f,evidence:f.evidence_ids.map(id=>cache.get(id))});
 }
 return {recognized,unresolved,rejected};
}
export function proposeMorphologicalHeads(records, facts) {
 const proposals=[];
 // Retrieval-only regular endings; never a canonical-root or membership rule.
 const endings={en:['s','es','ed','ing'],de:['e','em','en','er','es'],fr:['s','es','ent'],es:['s','es','o','a','os','as'],it:['i','e','o','a'],ru:['а','у','ом','ами','ы','и']};
 for(const r of records)for(const f of facts){if(r.language!==f.language)continue;const w=normalizeHead(r.word),h=f.normalized_head;
  if(w===h||(endings[r.language]||[]).some(e=>w===h+e))proposals.push({language:r.language,lemma_id:r.lemma_id,word:r.word,fact_id:f.id,proposed_head:h,status:'proposal_requires_review',identity_established:false,family_membership_established:false});
 }
 return proposals;
}
