import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateCatalog,resolveV6Alias,classifyV5Object,finiteHeadPolicies,generateV6Memberships,stemProposal,applyHeadReview,evidenceClusterSimilarity} from '../associativvordes/js/associative-family-v6.js';
const catalog=JSON.parse(fs.readFileSync('associativvordes/family-index-v6/catalog.json'));
function fixture(status='accepted'){
 const head={id:'head:it:osservare',language:'it',normalized_head:'osservare',identity_kind:'lexical_head'},h=head.id;
 const lemma={lemma_id:'lemma:existing',word:'osservato'};
 return {catalog,heads:[head],edges:[{head_id:h,family_id:'family:observ',status,version:1,scope:'finite_evidenced_links',morphology_policy:'finite_explicit_forms_only',lemma_ids:[lemma.lemma_id],evidence:[{source:'native-proof'}]}],links:[{head_id:h,language:'it',family_id:'family:observ',...lemma,evidence:[{source:'corpus'}]}],corpus:new Map([['it\0'+lemma.lemma_id,lemma]])};
}
test('canonical decisions choose ped and preserve creat; no mechanical stripping',()=>{
 validateCatalog(catalog);assert.deepEqual(resolveV6Alias(catalog,'pede'),['family:ped']);assert.deepEqual(resolveV6Alias(catalog,'ped'),['family:ped']);assert.deepEqual(resolveV6Alias(catalog,'creat'),['family:creat']);assert.deepEqual(resolveV6Alias(catalog,'cre'),[]);
 for(const root of ['cre','pede']){const c=structuredClone(catalog),f=c.families.find(f=>f.canonical===(root==='cre'?'creat':'ped'));f.id='family:'+root;f.canonical=root;assert.throws(()=>validateCatalog(c));}
 assert.equal(stemProposal('actio','act').status,'proposal_requires_review');assert.equal(stemProposal('actio','act').family_id,null);
});
test('surface, etymon and alias do not grant identity or membership',()=>{
 assert.equal(classifyV5Object({id:'surface:de:inform'},catalog).family_id,null);assert.equal(classifyV5Object({id:'ety:any',verified:true},catalog).family_id,null);
 const c=structuredClone(catalog);c.families[0].aliases.push('val');c.families[1].aliases.push('val');assert.equal(resolveV6Alias(c,'val').length,2);assert.equal(resolveV6Alias(catalog,'never-promoted').length,0);
 assert.deepEqual(generateV6Memberships({...fixture(),links:[]}),[]);
});
test('finite morphology is family and language bound, including cross-script reflexes',()=>{
 assert.equal(finiteHeadPolicies(catalog,'it','family:observ','osservato').length,1);
 assert.equal(finiteHeadPolicies(catalog,'en','family:observ','osservato').length,0);assert.equal(finiteHeadPolicies(catalog,'it','family:inform','osservato').length,0);
 assert.equal(finiteHeadPolicies(catalog,'ru','family:loc','локальный').length,1);assert.equal(finiteHeadPolicies(catalog,'de','family:loc','lokal').length,1);
 assert.equal(generateV6Memberships(fixture()).length,1);
 for(const s of ['excluded','uncertain','pending'])assert.equal(generateV6Memberships(fixture(s)).length,0);
});
test('invented corpus IDs, words, languages, conflicts and unlisted propagation are rejected',()=>{
 const f=fixture();assert.throws(()=>generateV6Memberships({...f,corpus:new Map()}));
 const word=structuredClone(f.links);word[0].word='invented';assert.throws(()=>generateV6Memberships({...f,links:word}));
 const edge=structuredClone(f.edges);edge[0].lemma_ids=[];assert.throws(()=>generateV6Memberships({...f,edges:edge}));
 assert.throws(()=>generateV6Memberships({...f,edges:[...f.edges,...f.edges]}));
 const unknown=structuredClone(f.edges);unknown[0].family_id='family:unpromoted';assert.throws(()=>generateV6Memberships({...f,edges:unknown}));
});
test('one versioned negative-head review deterministically resolves exact finite links',()=>{
 const f=fixture(),d={head_id:f.heads[0].id,family_id:'family:observ',status:'excluded',expected_version:1,lemma_ids:['lemma:existing'],morphology_policy:'finite_explicit_forms_only',reason:'Test sense exclusion',evidence:[{source:'head-proof'}]};
 const r=applyHeadReview(f,d);assert.equal(r.memberships.length,0);assert.deepEqual(r.decision_ledger.affected_lemma_ids,['lemma:existing']);assert.equal(r.decision_ledger.version,2);assert.equal(f.edges[0].status,'accepted');assert.throws(()=>applyHeadReview(r,d));assert.throws(()=>applyHeadReview(f,{...d,lemma_ids:[]}));
});
test('duplicate metrics are review aids and never merge identities',()=>{
 const r=evidenceClusterSimilarity(['en:a','de:b'],['en:a','de:b']);assert.equal(r.jaccard,1);assert.equal(r.lsh_candidate,true);assert.equal(r.action,'review_only_no_merge');
});
