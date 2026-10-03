// Parallel v6 runtime: the caller supplies the single authoritative catalog.
export const EDGE_STATUSES = Object.freeze(['accepted','excluded','uncertain','pending']);
export const REALIZATION_TYPES = Object.freeze(['canonical_reflex','lexical_branch_realization','derivational_stem','inflectional_form','query_alias','historical_evidence_form']);
export function validateRealizations(catalog) {
  for (const f of catalog.families) for (const r of f.reflexes || []) {
    if (!REALIZATION_TYPES.includes(r.realization_type) || r.family_id !== f.id || !r.language || !r.realization || !EDGE_STATUSES.includes(r.status) || !r.evidence?.length || !Array.isArray(r.supporting_heads) || !Array.isArray(r.head_scope) || r.establishes_membership !== false) throw Error('Invalid typed realization');
    if (r.realization_type === 'canonical_reflex' && r.status === 'accepted' && (!r.supporting_heads.length || !r.head_scope.length || r.supporting_heads.some(h => !r.head_scope.some(s => s.language === r.language && s.normalized_head === normalizeHead(h) && s.evidence?.length)))) throw Error('General reflex requires evidenced supporting heads');
    if (r.realization_type !== 'canonical_reflex' && r.general_family_realization !== false) throw Error('Branch, form and alias cannot become general reflex');
    if (r.general_family_realization !== (r.realization_type === 'canonical_reflex' && r.status === 'accepted')) throw Error('Invalid productive realization status');
    if (r.head_scope.some(h => h.language !== r.language || !h.normalized_head || !h.sense || !h.evidence?.length)) throw Error('Invalid realization head scope');
  }
  return catalog;
}
export function generalRealizations(catalog, familyId, language) {
  validateRealizations(catalog);
  return catalog.families.find(f => f.id === familyId)?.reflexes.filter(r => r.language === language && r.general_family_realization) || [];
}
export const normalizeHead = s => String(s).normalize('NFC').toLowerCase();
export function validateCatalog(catalog) {
  if (catalog?.schema_version !== 6 || catalog.production_enabled !== false) throw Error('Invalid parallel v6 catalog');
  const ids = new Set();
  for (const f of catalog.families) {
    if (f.id !== 'family:'+f.canonical || ids.has(f.id) || f.canonical_decision?.status !== 'accepted' || !f.canonical_decision.reason) throw Error('Missing explicit canonical decision');
    ids.add(f.id);
  }
  if (!ids.has('family:ped') || ids.has('family:pede') || !ids.has('family:creat') || ids.has('family:cre')) throw Error('Invalid canonical boundary');
  for (const p of catalog.head_policies) if (!ids.has(p.family_id) || !p.language || !p.head || !Array.isArray(p.forms) || !p.source_references?.length) throw Error('Invalid finite head policy');
  if (catalog.realization_schema_version === 1) validateRealizations(catalog);
  return catalog;
}
export function resolveV6Alias(catalog, query) {
  const q = normalizeHead(query);
  return catalog.families.filter(f => [f.canonical,...f.aliases].some(a => normalizeHead(a) === q)).map(f => f.id);
}
export function classifyV5Object(family, catalog) {
  const promoted = catalog.families.find(f => f.legacy_ids.includes(family.id));
  if (promoted) return {kind:family.verified?'verified_associative_family':'promoted_manual_associative_family',family_id:promoted.id};
  if (family.id.startsWith('surface:')) return {kind:'surface_component_candidate',family_id:null};
  if (family.id.startsWith('ety:')) return {kind:'etymological_evidence_cluster',family_id:null};
  return {kind:'unknown_requires_review',family_id:null};
}
export function finiteHeadPolicies(catalog, language, familyId, word) {
  const w = normalizeHead(word);
  return catalog.head_policies.filter(p => p.language === language && p.family_id === familyId && p.forms.some(f => normalizeHead(f) === w));
}
export function generateV6Memberships({catalog,heads,edges,links,corpus}) {
  const familyIds=new Set(validateCatalog(catalog).families.map(f=>f.id));
  const headMap = new Map(heads.map(h => [h.id,h])), edgeMap = new Map();
  for (const e of edges) {
    if (!headMap.has(e.head_id) || !EDGE_STATUSES.includes(e.status) || !familyIds.has(e.family_id) || !e.evidence?.length || !Array.isArray(e.lemma_ids)) throw Error('Invalid head edge');
    const k = e.head_id+'\0'+e.family_id;
    if (edgeMap.has(k)) throw Error('Conflicting or duplicate head edge');
    edgeMap.set(k,e);
  }
  const out = [], seen = new Set();
  for (const link of links) {
    const head = headMap.get(link.head_id), lemma = corpus.get(link.language+'\0'+link.lemma_id);
    if (!head || !lemma || head.language !== link.language || lemma.word !== link.word || !link.evidence?.length) throw Error('Invalid finite lemma/head link');
    const edge = edgeMap.get(link.head_id+'\0'+link.family_id);
    if (edge?.status !== 'accepted') continue;
    if (!edge.lemma_ids.includes(link.lemma_id)) throw Error('Unlisted lemma cannot propagate');
    const k = link.language+'\0'+link.family_id+'\0'+link.lemma_id;
    if (seen.has(k)) throw Error('Duplicate generated membership');
    seen.add(k); out.push({language:link.language,family_id:link.family_id,lemma_id:link.lemma_id,word:link.word,head_id:head.id,edge_version:edge.version,source_proof:link.evidence});
  }
  return out.sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b),'en'));
}
export function searchV6(index, query, language) {
  const ids = new Set(resolveV6Alias(index.catalog,query));
  return index.memberships.filter(m => ids.has(m.family_id) && (!language || m.language === language));
}
export function stemProposal(value, proposedRoot) {
  return {evidence_form:value,proposed_root:proposedRoot,status:'proposal_requires_review',family_id:null};
}
export function applyHeadReview(index, decision) {
  const head=index.heads.find(h=>h.id===decision.head_id);
  if (!head || !index.catalog.families.some(f=>f.id===decision.family_id) || !EDGE_STATUSES.includes(decision.status) || !decision.evidence?.length || !decision.reason) throw Error('Incomplete head review');
  const old=index.edges.find(e=>e.head_id===decision.head_id && e.family_id===decision.family_id);
  if (decision.expected_version !== (old?.version || 0)) throw Error('Stale head review');
  const affected=index.links.filter(l=>l.head_id===head.id && l.family_id===decision.family_id);
  const ids=[...new Set(affected.map(l=>l.lemma_id))].sort();
  if (JSON.stringify(ids)!==JSON.stringify([...new Set(decision.lemma_ids)].sort())) throw Error('Head review must enumerate its exact affected links');
  if (head.identity_kind==='legacy_exact_record' && decision.morphology_policy!=='no_propagation') throw Error('Unresolved identity cannot propagate');
  const edge={...decision,version:(old?.version||0)+1,scope:head.identity_kind==='legacy_exact_record'?'exact_lemma_only':'finite_evidenced_links'};
  const edges=[...index.edges.filter(e=>e!==old),edge];
  return {...index,edges,memberships:generateV6Memberships({...index,edges}),decision_ledger:{...edge,affected_lemma_ids:ids}};
}
export function evidenceClusterSimilarity(left,right) {
  const a=new Set(left),b=new Set(right),intersection=[...a].filter(x=>b.has(x)).length;
  const hash=s=>{let h=0x811c9dc5;for(const c of s){h^=c.codePointAt(0);h=Math.imul(h,0x01000193);}return h>>>0;};
  const signature=s=>[0,1,2,3].map(seed=>{let min=0xffffffff;for(const k of s)min=Math.min(min,hash(seed+'\0'+k));return min;});
  const sa=signature(a),sb=signature(b);
  return {jaccard:intersection/(a.size+b.size-intersection||1),minhash_left:sa,minhash_right:sb,lsh_candidate:sa.some((v,i)=>v===sb[i]),action:'review_only_no_merge'};
}
export async function loadParallelV6({readJson,base='associativvordes/family-index-v6'}) {
  const catalog=validateCatalog(await readJson(base+'/catalog.json'));
  const memberships=await readJson(base+'/generated/memberships.json.gz');
  const bucket=value=>{let hash=0x811c9dc5;for(const c of value){hash^=c.codePointAt(0);hash=Math.imul(hash,0x01000193);}return ((hash>>>0)%256).toString(16).padStart(2,'0');};
  const old='associativvordes/family-index-v5';
  return {catalog,memberships,search:(q,l)=>searchV6({catalog,memberships},q,l),
    async routeQuery(query){const q=normalizeHead(query),aliases=await readJson(old+'/aliases/'+bucket(q)+'.json.gz');return {query:q,family_targets:resolveV6Alias(catalog,q),evidence_targets:(aliases[q]||[]).filter(id=>!catalog.families.some(f=>f.legacy_ids.includes(id))),establishes_membership:false};},
    async getEvidenceNode(id){if(!id.startsWith('ety:'))throw Error('Not an etymological node');const rows=await readJson(old+'/families/'+bucket(id)+'.json.gz');if(!rows[id])return null;return {legacy_id:id,etymon_keys:rows[id].etymon_keys||[],relation_evidence:rows[id].relation_evidence||[],source_locator:{path:old+'/families/'+bucket(id)+'.json.gz',id},associative_family_id:null};},
    async getComponentCandidate(id){if(!id.startsWith('surface:'))throw Error('Not a component candidate');const rows=await readJson(old+'/families/'+bucket(id)+'.json.gz');if(!rows[id])return null;return {id,language:id.split(':')[1],surface:rows[id].canonical,associative_family_id:null,evidence:rows[id].relation_evidence||[],source_locator:{path:old+'/families/'+bucket(id)+'.json.gz',id}};},
    async getCorpusRecord(locator){const rows=await readJson(locator.path);return rows[locator.family_id]?.find(m=>m.lemma_id===locator.lemma_id)||null;}
  };
}
