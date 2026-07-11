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
const { extractSavedCard, createCardOnServer, validateCardId, createFallbackCardId } = context.window.InteralJsonCards;
const draft={section:'internationalismes', interal:{word:'test'}};
assert.equal(extractSavedCard({card:{payload:{id:'in_ABCDEFGHIJKL'}}}, draft).persistence.mode, 'supabase');
assert.equal(extractSavedCard({payload:{id:'in_zzzzzzzzzzzz'}}, draft).id, 'in_zzzzzzzzzzzz');
assert.equal(extractSavedCard({id:'in_123456789abc', section:'internationalismes', status:'pending'}, draft).discussionId, 'card-in_123456789abc');
assert.throws(()=>extractSavedCard({ok:true}, draft), /ID/);
assert.throws(()=>validateCardId({id:'zz_123456789abc'}, 'internationalismes'), /invalid/);
assert.throws(()=>validateCardId({id:'av_123456789abc'}, 'internationalismes'), /another section/);

context.fetch=async(url,opts)=> { calls.push(String(url)); return String(url).includes('health') ? okResponse({ok:true,hasSupabaseUrl:true,hasSupabaseKey:true}) : okResponse({ok:true,id:'in_123456789abc',section:'internationalismes',status:'pending'}); };
let saved=await createCardOnServer(draft,{section:'internationalismes',title:'test'});
assert.equal(saved.id,'in_123456789abc'); assert.equal(saved.status,'pending'); assert.equal(saved.persistence.saved,true); assert.equal(saved.persistence.mode,'supabase');

context.fetch=async(url)=> { calls.push(String(url)); if(String(url).includes('health')) return okResponse({ok:true,hasSupabaseUrl:false,hasSupabaseKey:false}); if(String(url).includes('cards-next-id')) return okResponse({ok:true,id:'in_000000000001',section:'internationalismes',mode:'fallback-sequential',guarantee:'best-effort-read-check-only'}); throw new Error('POST should not run'); };
saved=await createCardOnServer(draft,{section:'internationalismes',title:'test'});
assert.equal(saved.id,'in_000000000001'); assert.equal(saved.status,'local'); assert.equal(saved.persistence.saved,false); assert.equal(saved.persistence.mode,'fallback-id'); assert.ok(calls.some((url)=>url.includes('cards-next-id')));

for (const [name, responder] of [['500', async(url)=>String(url).includes('health')?okResponse({ok:true,hasSupabaseUrl:true,hasSupabaseKey:true}):String(url).includes('cards-next-id')?okResponse({ok:true,id:'in_000000000002',section:'internationalismes'}):badResponse('Internal server error',500)], ['network', async(url)=>String(url).includes('health')?okResponse({ok:true,hasSupabaseUrl:true,hasSupabaseKey:true}):String(url).includes('cards-next-id')?okResponse({ok:true,id:'in_000000000003',section:'internationalismes'}):Promise.reject(new Error('post down'))]]) { calls.length=0; context.fetch=async(url,opts)=>{ calls.push(String(url)); return responder(url,opts); }; saved=await createCardOnServer(draft,{section:'internationalismes',title:'test'}); assert.match(saved.id,/^in_/); assert.equal(saved.persistence.mode,'fallback-id', name); assert.ok(calls.some((url)=>url.includes('cards-next-id')), name); }

for (const [error,status] of [['Invalid title',400], ['Payload too large',400]]) { calls.length=0; context.fetch=async(url)=>{ calls.push(String(url)); return String(url).includes('health')?okResponse({ok:true,hasSupabaseUrl:true,hasSupabaseKey:true}):badResponse(error,status); }; await assert.rejects(createCardOnServer(draft,{section:'internationalismes',title:'test'}), new RegExp(error)); assert.ok(!calls.some((url)=>url.includes('cards-next-id'))); }

context.fetch=async(url)=> String(url).includes('health')?okResponse({ok:true,hasSupabaseUrl:true,hasSupabaseKey:true}):String(url).includes('cards-next-id')?badResponse('fallback down',500):badResponse('Internal server error',500);
await assert.rejects(createCardOnServer(draft,{section:'internationalismes',title:'test'}), /не удалось|neither/);
try { await createCardOnServer(draft,{section:'internationalismes',title:'test'}); } catch (e) { assert.equal(e.localOnlyCard.id, null); assert.equal(e.localOnlyCard.persistence.mode, 'local-only'); }

context.fetch=async()=>okResponse({ok:true,id:'av_000000000001',section:'associativvordes'});
await assert.rejects(createFallbackCardId(draft,{section:'internationalismes'}), /another section/);
const prefixes={indoeuropanvordes:'iv',associativvordes:'av',internationalismes:'in',vordesofcommunites:'vc',grammaticebrevivordes:'gv',altervordes:'al',affixes:'af'};
for (const [section,prefix] of Object.entries(prefixes)) { context.fetch=async()=>okResponse({ok:true,id:`${prefix}_123456789abc`,section}); const card=await createFallbackCardId(draft,{section}); assert.equal(card.id,`${prefix}_123456789abc`); }

({context,elements,alerts,calls}=load());
let builds=0;
context.window.InteralJsonCardModal.init({buildCard:async()=>({section:'internationalismes', interal:{word:'x'}, n:++builds}), createCardOnServer:async(card)=>({...card,id:'in_000000000004',section:'internationalismes',status:'local',discussionId:'card-in_000000000004',fallbackMode:'fallback-sequential',persistence:{saved:false,mode:'fallback-id',idReserved:false}}), formatCard:c=>JSON.stringify(c)});
await context.document.getElementById('jsonCardModal')._interalJsonModalApi.generate();
assert.match(elements.jsonCardOutput.value, /in_000000000004/); assert.match(alerts.join('\n'), /резервный ID/);
({context,elements,alerts}=load());
context.window.InteralJsonCardModal.init({buildCard:async()=>draft, createCardOnServer:async()=>{ const e=new Error('both down'); e.localOnlyCard={...draft,id:null,status:'local',persistence:{saved:false,mode:'local-only',idReserved:false,primarySaveFailed:true,fallbackIdFailed:true}}; throw e; }, formatCard:c=>JSON.stringify(c)});
await context.document.getElementById('jsonCardModal')._interalJsonModalApi.generate();
assert.match(elements.jsonCardOutput.value, /"id":null/); assert.match(alerts.join('\n'), /ID не был создан/);
const api1=context.window.InteralJsonCardModal.init({buildCard:async()=>draft});
const api2=context.window.InteralJsonCardModal.init({buildCard:async()=>draft});
assert.equal(api1,api2);
const assoc=fs.readFileSync('associativvordes/script.js','utf8');
assert.match(assoc, /function compactAssociativeCard/);
assert.match(assoc, /45000/);
console.log('json-card-utils ok');
