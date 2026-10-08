import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {normalizeHead} from '../associativvordes/js/associative-family-v6.js';
const base='audit/associative-family-v6/regul-20261008',R=base+'/decisions/review.json',P=base+'/research/prior.json',hash=b=>createHash('sha256').update(b).digest('hex'),obj=o=>hash(JSON.stringify(o)),read=async p=>{const b=await fs.readFile(p);return JSON.parse(p.endsWith('.gz')?gunzipSync(b):b)};
const reviews=await read(R),prior=await read(P),evidence=await read(base+'/research/evidence.json'),reviewPath='associativvordes/family-index-v6/lexical-head-review.json.gz',authPath='associativvordes/family-index-v6/review-application-authorizations.json';
const d=await read(reviewPath),auth=await read(authPath),groups=new Map();
for(const r of reviews.filter(r=>r.decision==='accepted'&&r.prior_state==='legacy_accepted')){const key=r.language+'\0'+r.head;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
for(const[key,rs]of groups){const first=rs[0],h=normalizeHead(first.head),sense='regula_line_bounded_component',id=hash(first.language+'\0'+h+'\0'+sense).slice(0,24),factId='lexical-fact:'+id,evId='evidence:'+id;
 if(d.lexical_facts.some(f=>f.id===factId))throw Error('Existing regul fact needs versioned reuse');
 const stems=[...new Set(rs.map(r=>r.component.form))],sources=[...new Set(rs.flatMap(r=>r.evidence.map(e=>e.source)))];
 d.evidence_cache.push({id:evId,language:first.language,head:h,sense,status:'accepted',evidence_kind:'lexical_identity',sources,finding:'Independent head and finite component analyses in '+R+'; no wildcard acceptance.',establishes_family_membership:false});
 d.lexical_facts.push({id:factId,language:first.language,normalized_head:h,sense,forms:rs.map(r=>r.word),component_stems:stems,finite_component_stems:stems,evidence_ids:[evId],version:1});
 for(const r of rs){const p=prior.find(p=>p.language===r.language&&p.lemma_id===r.lemma_id),s=r.component;
 const b={language:r.language,family_id:r.family_id,lemma_id:r.lemma_id,word:r.word,fact_id:factId,decision_kind:'representation_change',link_role:'reviewed_lexical_base_component',component_segmentation:{before:s.before,component:s.form,after:s.after,head:h,boundary_proof:r.lexical_analysis},whole_compound_identity_established:false,identity_proof:[{path:P,sha256:hash(await fs.readFile(P)),lemma_id:r.lemma_id,word:r.word},{path:R,sha256:hash(await fs.readFile(R)),lemma_id:r.lemma_id,word:r.word}],senses_decision:r.senses_decision,frequency_status:r.frequency_status};
 if(d.finite_bindings.some(x=>x.language===r.language&&x.family_id===r.family_id&&x.lemma_id===r.lemma_id))throw Error('Duplicate representation');
 d.finite_bindings.push(b);auth.bindings.push({binding_sha256:obj(b),binding_authorized:true,identity_only:true,application_scope:'regul-20261008',reason:'User supplied finite regul repair task; exact reviewed source identity and accepted component analysis only.',source_locator:{...p.source_locator,sha256:hash(await fs.readFile(p.source_locator.path))}});
 }
}
d.version++;
await fs.writeFile(base+'/decisions/representation-authorization.json',JSON.stringify({schema_version:6,production_enabled:false,application_scope:'regul-20261008',authorization_basis:'Attached regul task authorizes reversible repair in parallel v6, excludes merge and production rollout.',decision_sha256:hash(await fs.readFile(R)),binding_count:reviews.filter(r=>r.decision==='accepted'&&r.prior_state==='legacy_accepted').length,head_count:groups.size,source_grants:auth.bindings.filter(g=>g.application_scope==='regul-20261008')},null,2)+'\n');
await fs.writeFile(reviewPath,gzipSync(Buffer.from(JSON.stringify(d,null,2)+'\n'),{level:9,mtime:0}));await fs.writeFile(authPath,JSON.stringify(auth,null,2)+'\n');console.log(JSON.stringify({heads:groups.size,bindings:reviews.filter(r=>r.decision==='accepted'&&r.prior_state==='legacy_accepted').length}));
