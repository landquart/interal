import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

function el(){ return { value:'', hidden:false, disabled:false, dataset:{}, classList:{ add(){}, remove(){}, toggle(){}, contains(){return false;} }, addEventListener(){}, setAttribute(){}, querySelector(){return el()}, querySelectorAll(){return []}, focus(){}, append(){}, prepend(){}, remove(){}, click(){}, style:{}, textContent:'' }; }
function load(){
  const modal=el(); modal.id='jsonCardModal';
  const elements={ jsonCardModal:modal, generateJsonCardBtn:el(), jsonCardOutput:el(), jsonCardBtn:el(), closeJsonCardBtn:el(), copyJsonCardBtn:el(), downloadJsonCardBtn:el(), useAuthorBlock:el(), jsonAuthorFields:el(), authorDisplayName:el(), authorContactType:{...el(), value:'telegram'}, authorContactValue:el() };
  const alerts=[]; const calls=[];
  const context={ console, calls, alert:(msg)=>alerts.push(msg), setTimeout, clearTimeout, requestAnimationFrame:(fn)=>setTimeout(fn,0), CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}}, location:{hostname:'localhost', pathname:'/test/', origin:'http://localhost'}, navigator:{clipboard:{writeText:async()=>{}}}, localStorage:{getItem(){return null}, setItem(){}, removeItem(){}}, Blob:class{}, URL:Object.assign(URL,{createObjectURL(){return 'blob:'}, revokeObjectURL(){}}), fetch:async()=>({ok:true,json:async()=>({ok:true,hasSupabaseUrl:true,hasSupabaseKey:true})}), document:{dispatchEvent(){}, documentElement:{lang:'ru', classList:{add(){}, remove(){}, toggle(){}, contains(){return false}}, style:{setProperty(){}}}, body:{appendChild(){}, append(){}, prepend(){}, classList:{add(){}, remove(){}, toggle(){}, contains(){return false}}}, createElement(){return el()}, querySelector(sel){return sel.includes('/shared/ui.js')?{src:'/shared/ui.js?v=test'}:null}, querySelectorAll(){return []}, getElementById(id){return elements[id]||null}, addEventListener(){}}, window:null };
  context.addEventListener=()=>{}; context.removeEventListener=()=>{}; context.matchMedia=()=>({matches:false, addEventListener(){}, removeEventListener(){}}); context.window=context; vm.createContext(context); vm.runInContext(fs.readFileSync('shared/ui.js','utf8'), context); return {context,elements,alerts,calls};
}
function okResponse(data,status=200){ return {ok:status>=200&&status<300,status,json:async()=>data}; }
function badResponse(error,status){ return {ok:false,status,json:async()=>({ok:false,error})}; }

let {context,elements,alerts,calls}=load();
const { extractSavedCard, createCardOnServer, validateCardId } = context.window.InteralJsonCards;
const draft={section:'internationalismes', interal:{word:'test'}};
assert.equal(extractSavedCard({card:{payload:{id:'in_ABCDEFGHIJKL'}}}, draft).persistence.mode, 'supabase');
assert.equal(extractSavedCard({id:'in_123456789abc', section:'internationalismes', status:'pending', discussionId:'card-in_123456789abc'}, draft).discussionId, 'card-in_123456789abc');
assert.throws(()=>extractSavedCard({ok:true}, draft), /ID/);
assert.throws(()=>validateCardId({id:'zz_123456789abc'}, 'internationalismes'), /invalid/);
assert.throws(()=>validateCardId({id:'av_123456789abc'}, 'internationalismes'), /another section/);

context.fetch=async(url,opts)=> { calls.push(String(url)); return String(url).includes('health') ? okResponse({ok:true,hasSupabaseUrl:true,hasSupabaseKey:true}) : okResponse({ok:true,id:'in_123456789abc',section:'internationalismes',status:'pending'}); };
let saved=await createCardOnServer(draft,{section:'internationalismes',title:'test'});
assert.equal(saved.id,'in_123456789abc'); assert.equal(saved.status,'pending'); assert.equal(saved.persistence.saved,true); assert.equal(saved.persistence.mode,'supabase');

context.fetch=async(url)=> { calls.push(String(url)); return badResponse('Internal server error',500); };
await assert.rejects(createCardOnServer(draft,{section:'internationalismes',title:'test'}), /Internal server error/);
assert.ok(!calls.some((url)=>url.includes('cards-next-id')));

context.fetch=async()=>Promise.reject(new Error('post down'));
await assert.rejects(createCardOnServer(draft,{section:'internationalismes',title:'test'}), /post down/);

for (const [error,status] of [['Invalid title',400], ['Payload too large',400]]) { calls.length=0; context.fetch=async(url)=>{ calls.push(String(url)); return badResponse(error,status); }; await assert.rejects(createCardOnServer(draft,{section:'internationalismes',title:'test'}), new RegExp(error)); assert.ok(!calls.some((url)=>url.includes('cards-next-id'))); }

({context,elements,alerts,calls}=load());
let builds=0;
context.window.InteralJsonCardModal.init({buildCard:async()=>({section:'internationalismes', interal:{word:'x'}, n:++builds}), createCardOnServer:async(card)=>({...card,id:'in_000000000004',section:'internationalismes',status:'pending',discussionId:'card-in_000000000004',persistence:{saved:true,mode:'supabase'}}), formatCard:c=>JSON.stringify(c)});
await context.document.getElementById('jsonCardModal')._interalJsonModalApi.generate();
assert.match(elements.jsonCardOutput.value, /in_000000000004/); assert.equal(alerts.length, 0);
({context,elements,alerts}=load());
context.window.InteralJsonCardModal.init({buildCard:async()=>draft, createCardOnServer:async()=>{ throw new Error('save down'); }, formatCard:c=>JSON.stringify(c)});
await context.document.getElementById('jsonCardModal')._interalJsonModalApi.generate();
assert.match(elements.jsonCardOutput.value, /save down/); assert.equal(alerts.length, 0);
const api1=context.window.InteralJsonCardModal.init({buildCard:async()=>draft});
const api2=context.window.InteralJsonCardModal.init({buildCard:async()=>draft});
assert.equal(api1,api2);
const assoc=fs.readFileSync('associativvordes/script.js','utf8');
assert.match(assoc, /function compactAssociativeCard/);
assert.match(assoc, /45000/);
console.log('json-card-utils ok');
