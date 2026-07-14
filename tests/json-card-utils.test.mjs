import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { CARD_PREFIXES, buildPublicCardPayload, createCardId, getPayloadSizeBytes, getSupabaseConstraint, MAX_PAYLOAD_BYTES } from '../api/cards.js';

function el(){return {style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},getAttribute(){return null},append(){},appendChild(){},prepend(){},remove(){},addEventListener(){},querySelector(){return el()},querySelectorAll(){return []},focus(){},click(){},textContent:'',value:'',checked:false,hidden:false,disabled:false};}
function loadUi(){
  const elements={}; const alerts=[]; const calls=[];
  const context={ console, calls, alert:(msg)=>alerts.push(msg), setTimeout, clearTimeout, requestAnimationFrame:(fn)=>setTimeout(fn,0), CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}}, location:{hostname:'localhost', pathname:'/internationalismes/', origin:'http://localhost'}, navigator:{clipboard:{writeText:async()=>{}}}, localStorage:{getItem(){return null}, setItem(){}, removeItem(){}}, Blob:class{}, URL:Object.assign(URL,{createObjectURL(){return 'blob:'}, revokeObjectURL(){}}), TextEncoder, fetch:async()=>({ok:true,json:async()=>({ok:true,id:'in_123456789abc',section:'internationalismes',status:'pending'})}), document:{currentScript:{src:'http://localhost/shared/ui.js?v=contact-types-20260713-1'}, dispatchEvent(){}, documentElement:{lang:'ru', classList:{add(){}, remove(){}, toggle(){}, contains(){return false}}, style:{setProperty(){}}}, body:{appendChild(){}, append(){}, prepend(){}, classList:{add(){}, remove(){}, toggle(){}, contains(){return false}}}, createElement(){return el()}, querySelector(sel){return sel.includes('shared/ui.js')?{src:'/shared/ui.js?v=contact-types-20260713-1'}:null}, querySelectorAll(){return []}, getElementById(id){return elements[id]||null}, addEventListener(){}}, window:null };
  context.addEventListener=()=>{}; context.removeEventListener=()=>{}; context.matchMedia=()=>({matches:false, addEventListener(){}, removeEventListener(){}}); context.window=context; vm.createContext(context); vm.runInContext(fs.readFileSync('shared/ui.js','utf8'), context); return {context,elements,alerts,calls};
}
const okResponse=(data)=>({ok:true,status:200,json:async()=>data});
const badResponse=(error,status=500,code='SUPABASE_INSERT_FAILED')=>({ok:false,status,json:async()=>({ok:false,error,code})});

const {context,calls}=loadUi();
const { extractSavedCard, createCardOnServer, validateCardId } = context.window.InteralJsonCards;
const draft={section:'internationalismes', interal:{word:'test'}};

const storage = new Map();
context.localStorage = { getItem(key){ return storage.has(key) ? storage.get(key) : null; }, setItem(key, value){ storage.set(key, String(value)); }, removeItem(key){ storage.delete(key); } };
const authorStorage = context.window.InteralJsonCardModal;
assert.equal(authorStorage.saveAuthorData({ displayName: 'Landquart', contactType: 'telegram', contactValue: '@username' }), true);
assert.equal(JSON.stringify(authorStorage.readSavedAuthorData()), JSON.stringify({ version: 1, displayName: 'Landquart', contactType: 'telegram', contactValue: '@username' }));
assert.equal(authorStorage.hasSavedAuthorData(), true);
authorStorage.clearSavedAuthorData();
assert.equal(authorStorage.readSavedAuthorData(), null);
storage.set('interal:json-card-author:v1', '{broken');
assert.equal(authorStorage.readSavedAuthorData(), null);
assert.equal(storage.has('interal:json-card-author:v1'), false);
assert.equal(authorStorage.saveAuthorData({ displayName: '', contactType: 'telegram', contactValue: '' }), false);
assert.equal(authorStorage.saveAuthorData({ displayName: 'Name', contactType: 'unknown', contactValue: 'value', token: 'secret' }), true);
assert.equal(JSON.stringify(authorStorage.readSavedAuthorData()), JSON.stringify({ version: 1, displayName: 'Name', contactType: 'telegram', contactValue: 'value' }));

assert.equal(context.window.InteralJsonDiagnostics.getStatus().version, 'contact-types-20260713-1');
assert.equal(JSON.stringify(context.window.InteralJsonDiagnostics.getStatus().helpers), JSON.stringify(['extractSavedCard','createCardOnServer','validateCardId','publicJsonError']));
assert.equal(extractSavedCard({id:'in_123456789abc', section:'internationalismes', status:'pending', discussionId:'card-in_123456789abc'}, draft).discussionId, undefined);
assert.equal(extractSavedCard({id:'in_123456789abc', section:'internationalismes', status:'pending', card:{payload:{version:'1.0'}}}, draft).id, 'in_123456789abc');
assert.throws(() => extractSavedCard({ok:true}, draft), /server did not return/);
assert.throws(()=>validateCardId({id:'av_123456789abc'}, 'internationalismes'), /another section/);

context.fetch=async(url,opts)=> { calls.push({url:String(url),opts}); return okResponse({ok:true,id:'in_123456789abc',section:'internationalismes',status:'pending'}); };
let saved=await createCardOnServer(draft,{section:'internationalismes',title:'test'});
assert.equal(saved.id,'in_123456789abc');
assert.equal(saved.persistence, undefined);
assert.equal(calls.length, 1);
assert.equal(calls[0].opts.method, 'POST');
assert.ok(!calls.some((call)=>call.url.includes(['cards','next','id'].join('-'))));

calls.length=0;
context.fetch=async(url)=>{ calls.push({url:String(url)}); return badResponse('Invalid title',400,'INVALID_TITLE'); };
await assert.rejects(createCardOnServer(draft,{section:'internationalismes',title:'test'}), /Invalid title/);
assert.equal(calls.length, 1);
assert.ok(!calls.some((call)=>call.url.includes(['cards','next','id'].join('-'))));

calls.length=0;
context.fetch=async(url)=>{ calls.push({url:String(url)}); return badResponse('Card persistence failed',500,'SUPABASE_INSERT_FAILED'); };
await assert.rejects(createCardOnServer(draft,{section:'internationalismes',title:'test'}), /Card persistence failed/);
assert.ok(!calls.some((call)=>call.url.includes(['cards','next','id'].join('-'))));

for (const [section,prefix] of Object.entries(CARD_PREFIXES)) {
  const id = createCardId(section);
  assert.match(id, new RegExp(`^${prefix}_[0-9A-Za-z]{12}$`));
  assert.doesNotMatch(id, new RegExp(`^${prefix}_0{12}$`));
}
assert.throws(() => createCardId('in'), /Invalid card section/);

const publicPayload = buildPublicCardPayload({ id:'client', section:'internationalismes', status:'draft', discussionId:'card-client', persistence:{saved:true}, created_at:'client-time', created_at_source:'device', version:'1.0', card_type:'vord_card', vord_type:'in', interal:{word:'test'}, author:null, empty:'', risks:[] }, 'in_123456789abc');
assert.deepEqual(Object.keys(publicPayload).slice(0, 5), ['id','version','card_type','vord_type','status']);
assert.equal(publicPayload.id, 'in_123456789abc');
assert.equal(publicPayload.section, undefined);
assert.equal(publicPayload.discussionId, undefined);
assert.equal(publicPayload.persistence, undefined);
assert.equal(publicPayload.created_at_source, undefined);
assert.equal(publicPayload.author, undefined);
assert.equal(publicPayload.risks, undefined);
assert.match(publicPayload.created_at, /^\d{4}-\d{2}-\d{2}T/);

assert.ok(getPayloadSizeBytes({x:'a'.repeat(MAX_PAYLOAD_BYTES + 1)}) > MAX_PAYLOAD_BYTES);
assert.equal(getSupabaseConstraint({ constraint: 'cards_id_check' }), 'cards_id_check');
assert.equal(getSupabaseConstraint({ message: 'new row for relation "cards" violates check constraint "cards_id_check"' }), 'cards_id_check');

const htmlFiles = ['internationalismes/index.html','indoeuropanvordes/index.html','associativvordes/index.html','vordesofcommunites/index.html','grammaticebrevivordes/index.html','altervordes/index.html','affixes/index.html'];
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  assert.match(html, /shared\/ui\.js\?v=brand-logo-20260713-1/);
  assert.doesNotMatch(html, new RegExp(['cards-primary-id-fix','20260711','1'].join('-')));
}
const ui = fs.readFileSync('shared/ui.js','utf8');
assert.match(ui, /INTERAL_JSON_MODULE_VERSION = 'contact-types-20260713-1'/);
assert.doesNotMatch(ui, new RegExp(['createFallbackCardId','isFallbackEligibleError','checkHealth','createLocalOnlyCard'].join('|')));

const pageSections = {
  'internationalismes/script.js': 'internationalismes',
  'associativvordes/script.js': 'associativvordes',
  'vordesofcommunites/script.js': 'vordesofcommunites',
  'grammaticebrevivordes/script.js': 'grammaticebrevivordes',
  'altervordes/script.js': 'altervordes',
  'affixes/script.js': 'affixes',
  'indoeuropanvordes/index.html': 'indoeuropanvordes'
};
for (const [file, section] of Object.entries(pageSections)) {
  assert.match(fs.readFileSync(file, 'utf8'), new RegExp(`section:\\s*['\"]${section}['\"]|CARD_SECTION\\s*=\\s*['\"]${section}['\"]`));
}

const jsonTextSources = [
  'shared/ui.js',
  'internationalismes/script.js',
  'associativvordes/script.js',
  'vordesofcommunites/script.js',
  'grammaticebrevivordes/script.js',
  'altervordes/script.js',
  'affixes/script.js',
  'indoeuropanvordes/index.html'
];
for (const file of jsonTextSources) {
  const source = fs.readFileSync(file, 'utf8');
  assert.match(source, /Remember for future cards/);
  assert.match(source, /Delete saved data/);
}

const schema = await import('../shared/card-schema.mjs');
const baseIv = { card_type:'vord_card', vord_type:'iv', interal:{ word:'test', part_of_speech:'noun' }, translation:{ language:'ru', word:'тест' } };
assert.equal(schema.getPiPercent({ result: { pi_percent: 58.4 } }), 58.4);
assert.equal(schema.getPiPercent({ result: { pi_percent: 0 }, calculation: { pi_percent: 58.4 } }), 0);
assert.equal(schema.getPiPercent({ calculation: { pi_percent: 58.4 } }), 58.4);
assert.equal(schema.normalizeCardSchema({ calculation: { pi_percent: '58.4' } }).result.pi_percent, 58.4);
assert.equal(schema.validateCard({ ...baseIv, result: { pi_percent: 58.4 } }).ok, true);
assert.equal(schema.validateCard({ ...baseIv, result: { pi_percent: 0 } }).ok, true);
assert.equal(schema.validateCard({ ...baseIv, calculation: { pi_percent: 58.4 } }).ok, true);
assert.equal(schema.validateCard({ ...baseIv }).ok, false);
assert.equal(schema.validateCard({ ...baseIv, result: { pi_percent: 1 } }).ok, true);
assert.equal(schema.validateCard({ ...baseIv, result: { pi_percent: 1 }, author: {} }).ok, false);
assert.equal(schema.validateCard({ ...baseIv, result: { pi_percent: 1 }, author: { contacts: [{ type:'email', url:'mailto:a@example.test' }] } }).ok, true);
assert.equal(context.window.InteralCardSchema.getPiPercent({ result: { pi_percent: 0 } }), 0);

calls.length=0;
context.fetch=async(url,opts)=> { calls.push({url:String(url),opts}); return okResponse({ok:true,id:'iv_123456789abc',section:'indoeuropanvordes',status:'pending',card:{payload:{...baseIv, calculation:{pi_percent:'58.4'}}}}); };
saved=await createCardOnServer({ ...baseIv, calculation: { pi_percent: '58.4' } },{section:'indoeuropanvordes',title:'test'});
assert.equal(JSON.parse(calls[0].opts.body).payload.result.pi_percent, 58.4);
assert.equal(saved.result.pi_percent, 58.4);
