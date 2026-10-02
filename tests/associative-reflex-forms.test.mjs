import assert from 'node:assert/strict';
import {test} from 'node:test';
import {matchesReviewedAssociativeForm} from '../associativvordes/js/associative-reflex-forms.js';
import {FamilyIndexLoader} from '../associativvordes/js/family-index-loader.js';
test('reviewed reflexes are root- and language-specific, not unrestricted spelling substitutions',()=>{
 const f={canonical:'observ',surface_forms:{it:['osserv'],en:['observ'],ru:['обсерв']}};
 assert(matchesReviewedAssociativeForm({word:'osservazione'},f,'it'));
 assert(matchesReviewedAssociativeForm({word:'osservare'},f,'it'));
 assert(!matchesReviewedAssociativeForm({word:'osservazione'},f,'en'));
 assert(!matchesReviewedAssociativeForm({word:'Schlösserverwaltung'},f,'de'));
 assert(matchesReviewedAssociativeForm({word:'обсервационный'},f,'ru'));
 assert(!matchesReviewedAssociativeForm({word:'naive'},{canonical:'nat'},'en'));
 assert(!matchesReviewedAssociativeForm({word:'lieu'},{canonical:'loc'},'fr'));
});
test('reflex query and canonical query use the same reviewed family and keep manual evidence mandatory',async()=>{
 const f={id:'family:observ',canonical:'observ',aliases:['observ','osserv'],exact_component:true,associative_component:true,runtime_curated:true,surface_forms:{it:['osserv']}};
 const member=(word,reviewed)=>({lemma_id:word,word,components:[{evidence:[{type:reviewed?'manual_override':'substring'}]}]});
 const l=new FamilyIndexLoader({fetchJson:async p=>p.endsWith('manifest.json')?{version:'5',languages:['it'],sharding:{alias_template:'aliases/{bucket}',family_template:'families/{bucket}',member_template:'members/{language}/{bucket}'}}:p.includes('/aliases/')?{observ:[f.id],osserv:[f.id]}:p.includes('/families/')?{[f.id]:f}:{[f.id]:[member('osservazione',true),member('osservare',true),member('osservazionejunk',false),member('integrazione',true)]}});
 for(const query of ['observ','osserv'])assert.deepEqual((await l.candidateEntries(query,'it')).map(m=>m.word),['osservazione','osservare']);
});
