import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateRealizations,generalRealizations} from '../associativvordes/js/associative-family-v6.js';
const supported=()=>({families:[{id:'family:observ',reflexes:[{family_id:'family:observ',language:'it',realization:'osserv',realization_type:'canonical_reflex',status:'accepted',supporting_heads:['osservare'],head_scope:[{language:'it',normalized_head:'osservare',sense:'observation',evidence:[{source:'native-dictionary'}]}],evidence:[{source:'review'}],general_family_realization:true,establishes_membership:false}]}]});
test('productive realization requires independently scoped head evidence',()=>{
 const c=supported();assert.equal(generalRealizations(c,'family:observ','it').length,1);
 for(const edit of [r=>r.supporting_heads=[],r=>r.head_scope=[],r=>r.head_scope[0].language='es',r=>r.head_scope[0].evidence=[],r=>r.establishes_membership=true]){const d=supported();edit(d.families[0].reflexes[0]);assert.throws(()=>validateRealizations(d));}
});
test('inflections, branch stems and aliases cannot grant a general reflex',()=>{
 for(const type of ['lexical_branch_realization','derivational_stem','inflectional_form','query_alias','historical_evidence_form']){const c=supported(),r=c.families[0].reflexes[0];r.realization_type=type;assert.throws(()=>validateRealizations(c));r.general_family_realization=false;validateRealizations(c);assert.deepEqual(generalRealizations(c,'family:observ','it'),[]);}
});
test('reviewed catalog separates syncretic creation forms and Italian action branches',()=>{
 const c=JSON.parse(fs.readFileSync('associativvordes/family-index-v6/catalog.json'));validateRealizations(c);
 const get=(root,language,realization)=>c.families.find(f=>f.canonical===root).reflexes.find(r=>r.language===language&&r.realization===realization);
 assert.equal(get('observ','it','osserv').general_family_realization,true);assert.equal(get('loc','de','lok').general_family_realization,true);assert.equal(get('loc','ru','лок').general_family_realization,true);
 for(const word of ['crea','creo']){const r=get('creat','es',word);assert.equal(r.status,'uncertain');assert.equal(r.realization_type,'inflectional_form');assert.deepEqual(r.supporting_heads,['crear','creer']);}
 assert.equal(get('creat','es','cree').status,'excluded');
 for(const word of ['att','attric','azion'])assert.equal(get('act','it',word).general_family_realization,false);
 assert.deepEqual(get('creat','de','kreier').supporting_heads,['kreieren']);
 for(const f of c.families)for(const r of f.reflexes)if(r.general_family_realization)assert(r.supporting_heads.length&&r.head_scope.length);
});
