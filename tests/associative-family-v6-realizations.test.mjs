import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRealizations,generalRealizations} from '../associativvordes/js/associative-family-v6.js';
const supported=()=>({families:[{id:'family:observ',reflexes:[{family_id:'family:observ',language:'it',realization:'osserv',realization_type:'canonical_reflex',status:'accepted',supporting_heads:['osservare'],head_scope:[{language:'it',normalized_head:'osservare',sense:'observation',evidence:[{source:'native-dictionary'}]}],evidence:[{source:'review'}],general_family_realization:true,establishes_membership:false}]}]});
test('productive realization requires independently scoped head evidence',()=>{
 const c=supported();assert.equal(generalRealizations(c,'family:observ','it').length,1);
 for(const edit of [r=>r.supporting_heads=[],r=>r.head_scope=[],r=>r.head_scope[0].language='es',r=>r.head_scope[0].evidence=[],r=>r.establishes_membership=true]){const d=supported();edit(d.families[0].reflexes[0]);assert.throws(()=>validateRealizations(d));}
});
test('inflections, branch stems and aliases cannot grant a general reflex',()=>{
 for(const type of ['lexical_branch_realization','derivational_stem','inflectional_form','query_alias','historical_evidence_form']){const c=supported(),r=c.families[0].reflexes[0];r.realization_type=type;assert.throws(()=>validateRealizations(c));r.general_family_realization=false;validateRealizations(c);assert.deepEqual(generalRealizations(c,'family:observ','it'),[]);}
});
