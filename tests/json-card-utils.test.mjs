import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

function el(){ return { value:'', hidden:false, disabled:false, dataset:{}, classList:{ add(){}, remove(){}, toggle(){}, contains(){return false;} }, addEventListener(){}, setAttribute(){}, querySelector(){return el()}, querySelectorAll(){return []}, focus(){}, append(){}, prepend(){}, remove(){}, style:{}, textContent:'' }; }
function load(){
  const modal=el(); modal.id='jsonCardModal';
  const elements={ jsonCardModal:modal, generateJsonCardBtn:el(), jsonCardOutput:el(), jsonCardBtn:el(), closeJsonCardBtn:el(), copyJsonCardBtn:el(), downloadJsonCardBtn:el(), useAuthorBlock:el(), jsonAuthorFields:el(), authorDisplayName:el(), authorContactType:{...el(), value:'telegram'}, authorContactValue:el() };
  const context={ console, setTimeout, clearTimeout, requestAnimationFrame:(fn)=>setTimeout(fn,0), CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}}, location:{hostname:'localhost', pathname:'/test/', origin:'http://localhost'}, navigator:{clipboard:{writeText:async()=>{}}}, localStorage:{getItem(){return null}, setItem(){}, removeItem(){}}, Blob:class{}, URL:Object.assign(URL,{createObjectURL(){return 'blob:'}, revokeObjectURL(){}}), fetch:async()=>({ok:true,json:async()=>({ok:true,hasSupabaseUrl:true,hasSupabaseKey:true})}), document:{dispatchEvent(){}, documentElement:{lang:'ru', classList:{add(){}, remove(){}, toggle(){}, contains(){return false}}, style:{setProperty(){}}}, body:{appendChild(){}, append(){}, prepend(){}, classList:{add(){}, remove(){}, toggle(){}, contains(){return false}}}, createElement(){return el()}, querySelector(sel){return sel.includes('/shared/ui.js')?{src:'/shared/ui.js?v=test'}:null}, querySelectorAll(){return []}, getElementById(id){return elements[id]||null}, addEventListener(){}}, window:null };
  context.addEventListener=()=>{}; context.removeEventListener=()=>{}; context.matchMedia=()=>({matches:false, addEventListener(){}, removeEventListener(){}}); context.window=context; vm.createContext(context); vm.runInContext(fs.readFileSync('shared/ui.js','utf8'), context); return {context,elements};
}
let {context,elements}=load();
const { extractSavedCard, createCardOnServer, validateCardId } = context.window.InteralJsonCards;
const draft={section:'internationalismes', interal:{word:'test'}};
assert.equal(extractSavedCard({card:{payload:{id:'in_ABCDEFGHIJKL'}}}, draft).id, 'in_ABCDEFGHIJKL');
assert.equal(extractSavedCard({payload:{id:'in_zzzzzzzzzzzz'}}, draft).id, 'in_zzzzzzzzzzzz');
assert.equal(extractSavedCard({id:'in_123456789abc', section:'internationalismes', status:'pending'}, draft).discussionId, 'card-in_123456789abc');
assert.throws(()=>extractSavedCard({ok:true}, draft), /ID/);
assert.throws(()=>validateCardId({id:'zz_123456789abc'}, 'internationalismes'), /invalid/);
assert.throws(()=>validateCardId({id:'av_123456789abc'}, 'internationalismes'), /another section/);
context.fetch=async(url,opts)=> String(url).includes('health') ? {ok:true,json:async()=>({ok:true,hasSupabaseUrl:true,hasSupabaseKey:true})} : {ok:true,json:async()=>({ok:true,id:'in_123456789abc',section:'internationalismes',status:'pending'})};
assert.equal((await createCardOnServer(draft,{section:'internationalismes',title:'test'})).id,'in_123456789abc');
for (const status of [400,500]) { context.fetch=async(url)=> String(url).includes('health') ? {ok:true,json:async()=>({ok:true,hasSupabaseUrl:true,hasSupabaseKey:true})} : {ok:false,status,json:async()=>({ok:false,error:'bad'})}; await assert.rejects(createCardOnServer(draft,{section:'internationalismes',title:'test'}), /bad|error/i); }
context.fetch=async()=>({ok:true,json:async()=>({ok:true,hasSupabaseUrl:false,hasSupabaseKey:false})});
await assert.rejects(createCardOnServer(draft,{section:'internationalismes',title:'test'}), /локально|locally/);
context.fetch=async(url)=>{ if(String(url).includes('health')) throw new Error('down'); throw new Error('post down'); };
await assert.rejects(createCardOnServer(draft,{section:'internationalismes',title:'test'}), /post down|Network/);
({context,elements}=load());
let builds=0;
context.window.InteralJsonCardModal.init({buildCard:async()=>({section:'internationalismes', interal:{word:'x'}, n:++builds}), createCardOnServer:async()=>{throw new Error('save failed')}, formatCard:c=>JSON.stringify(c)});
await context.document.getElementById('jsonCardModal')._interalJsonModalApi.generate();
assert.match(elements.jsonCardOutput.value, /save failed|local/);
await context.document.getElementById('jsonCardModal')._interalJsonModalApi.generate();
assert.equal(builds,2);
const api1=context.window.InteralJsonCardModal.init({buildCard:async()=>draft});
const api2=context.window.InteralJsonCardModal.init({buildCard:async()=>draft});
assert.equal(api1,api2);
const assoc=fs.readFileSync('associativvordes/script.js','utf8');
assert.match(assoc, /function compactAssociativeCard/);
assert.match(assoc, /45000/);
console.log('json-card-utils ok');
