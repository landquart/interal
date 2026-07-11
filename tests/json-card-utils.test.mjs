import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function el(){return { dataset:{}, classList:{add(){},remove(){},toggle(){},contains(){return false}}, addEventListener(){this._n=(this._n||0)+1}, append(){}, prepend(){}, remove(){}, setAttribute(){}, querySelector(){return el()}, querySelectorAll(){return []}, focus(){}, value:'', textContent:'', disabled:false, hidden:false, style:{} };}
const modal=el();
const elements={ jsonCardModal:modal, generateJsonCardBtn:el(), jsonCardOutput:el(), jsonCardBtn:el(), closeJsonCardBtn:el(), copyJsonCardBtn:el(), downloadJsonCardBtn:el(), useAuthorBlock:el() };
const context={ window:{addEventListener(){}, removeEventListener(){}, scrollY:0, matchMedia(){return {matches:false, addEventListener(){}, removeEventListener(){}}}}, document:{ documentElement:{lang:'ru'}, body:{classList:{add(){},remove(){},toggle(){},contains(){return false}}, appendChild(){}, prepend(){}, append(){}}, getElementById:id=>elements[id]||null, querySelector:sel=>elements[sel.replace('#','')]||null, querySelectorAll(){return []}, addEventListener(){}, createElement(){return el();}, dispatchEvent(){}}, location:{hostname:'localhost', origin:'http://localhost', pathname:'/internationalismes/'}, console, localStorage:{getItem(){return null}, setItem(){}, removeItem(){}}, setTimeout:(fn)=>{fn(); return 1}, clearTimeout(){}, requestAnimationFrame(fn){return fn()}, Blob:class{}, CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}}, URL:Object.assign(URL,{createObjectURL(){return 'blob:x'}, revokeObjectURL(){}}), navigator:{clipboard:{writeText:async()=>{}}}, fetch:async()=>({ok:true,json:async()=>({ok:true,hasSupabaseUrl:true,hasSupabaseKey:true,allowedSections:['internationalismes']})}) };
context.window=context.window; Object.assign(context.window,{document:context.document, location:context.location});
vm.createContext(context);
vm.runInContext(fs.readFileSync('shared/ui.js','utf8'), context);
const { extractSavedCard, createCardOnServer, validateCardId } = context.window.InteralJsonCards;
const draft={ id:'in_abcdefghijkl', section:'internationalismes', discussionId:'card-in_abcdefghijkl', status:'draft', interal:{word:'test'}, vord_type:'in' };
assert.equal(extractSavedCard({card:{payload:{id:'in_ABCDEFGHIJKL'}}}, draft).id, 'in_ABCDEFGHIJKL');
assert.equal(extractSavedCard({id:'in_123456789abc', section:'internationalismes', status:'pending'}, draft).discussionId, 'card-in_123456789abc');
assert.equal(extractSavedCard({payload:{id:'in_zzzzzzzzzzzz'}}, draft).id, 'in_zzzzzzzzzzzz');
assert.throws(()=>extractSavedCard({ok:true}, draft), /ID/);
assert.throws(()=>validateCardId({id:'iev_123456789abc'}, 'indoeuropanvordes'), /invalid/);
let calls=0; context.fetch=async(url, opts)=>{ calls++; if(String(url).includes('health')) return {ok:true,json:async()=>({ok:true,hasSupabaseUrl:true,hasSupabaseKey:true,allowedSections:['internationalismes']})}; return {ok:true,json:async()=>({ok:true,id:'in_123456789abc',section:'internationalismes',status:'pending'})}; };
assert.equal((await createCardOnServer(draft,{section:'internationalismes',title:'test'})).id,'in_123456789abc');
assert.equal(calls,2);
context.fetch=async(url)=> String(url).includes('health') ? {ok:true,json:async()=>({ok:true,hasSupabaseUrl:false,hasSupabaseKey:false,allowedSections:['internationalismes']})} : assert.fail('POST should not run');
assert.equal((await createCardOnServer(draft,{section:'internationalismes',title:'test'})).localOnly,true);
for (const status of [400,500]) { context.fetch=async(url)=> String(url).includes('health') ? {ok:true,json:async()=>({ok:true,hasSupabaseUrl:true,hasSupabaseKey:true})} : {ok:false,status,json:async()=>({ok:false,error:'bad'})}; await assert.rejects(createCardOnServer(draft,{section:'internationalismes',title:'test'}), /bad|error/i); }
const api1=context.window.InteralJsonCardModal.init({buildCard:async()=>draft});
const api2=context.window.InteralJsonCardModal.init({buildCard:async()=>draft});
assert.equal(api1, api2);
assert.equal(modal.dataset.interalJsonModalInit, '1');
elements.jsonCardOutput.value=JSON.stringify(draft);
await api1.generate(); assert.match(elements.jsonCardOutput.value, /in_/); // repeated generation updates output
await context.window.InteralJsonCardModal.init().generate();
console.log('json-card-utils tests passed');
