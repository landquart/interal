import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function makeContext(search = '') {
  const store = new Map();
  const events = {};
  const fields = { wordInput: { id:'wordInput', type:'text', value:'', disabled:false, readOnly:false, tagName:'INPUT', closest(){return null}, matches(){return false}, dispatchEvent(evt){ events[evt.type]?.({ target:this }); } } };
  const doc = {
    currentScript:{ src:'http://localhost/shared/form-draft.js' },
    body:{}, documentElement:{},
    getElementById(id){ return fields[id] || null; },
    querySelectorAll(sel){ return sel === 'input, textarea, select' ? Object.values(fields) : []; },
    addEventListener(type, fn, capture){ events[type] = fn; },
    dispatchEvent(){}
  };
  const ctx = { console, TextEncoder, TextDecoder, URL, location:{ href:`http://localhost/internationalismes/${search}`, pathname:'/internationalismes/', search, hash:'' }, history:{ replaceState(){ } }, localStorage:{ getItem:k=>store.get(k)||null, setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k), key:i=>[...store.keys()][i]||null, get length(){return store.size;} }, sessionStorage:{ getItem(){return null}, setItem(){}, removeItem(){} }, document:doc, window:null, HTMLElement: function(){}, Event: class { constructor(type){ this.type=type; } }, CustomEvent: class { constructor(type, init){ this.type=type; this.detail=init?.detail; } }, setTimeout(fn){ fn(); return 1; }, clearTimeout(){}, btoa: s=>Buffer.from(s,'binary').toString('base64'), atob: s=>Buffer.from(s,'base64').toString('binary'), fetch: async()=>({ ok:false, status:404, json:async()=>null }), navigator:{ clipboard:null }, addEventListener(type, fn){ events[`window:${type}`] = fn; }, removeEventListener(){}, dispatchEvent(evt){ events[evt.type]?.(evt); } };
  Object.setPrototypeOf(fields.wordInput, ctx.HTMLElement.prototype);
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('shared/form-draft.js','utf8'), ctx);
  return { ctx, store, fields, events };
}

{
  const { ctx, store } = makeContext();
  ctx.window.InteralPageStateExport = () => ({ version:2, fields:{ word:'demo' }, result:{ accepted:true }, flags:{ checked:true, accepted:true } });
  ctx.window.InteralFormDraft.save();
  const key = 'interal-page-state:v2:/internationalismes/';
  assert.ok(store.has(key));
  const parsed = JSON.parse(store.get(key));
  assert.equal(parsed.pageState.result.accepted, true);
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.pageState)).fields, { word:'demo' });
}

{
  const payload = { version:1, source:'interal-form-draft', path:'/interal/internationalismes/', fields:{ wordInput:'from-url' }, pageState:{ version:2, fields:{ word:'from-url' }, result:{ accepted:true }, flags:{ checked:true } } };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const { ctx, store } = makeContext(`?state=${encoded}`);
  store.set('interal-page-state:v2:/internationalismes/', JSON.stringify({ version:1, path:'/interal/internationalismes/', fields:{ wordInput:'local' } }));
  let imported = null;
  ctx.window.InteralPageStateImport = (state) => { imported = state; return true; };
  await ctx.window.InteralFormDraft.restoreInitial();
  assert.equal(imported.result.accepted, true);
}

{
  const { ctx, store, fields } = makeContext();
  store.set('interal-page-state:v2:/internationalismes/', '{bad json');
  assert.equal(ctx.window.InteralFormDraft.restore(), false);
  assert.equal(store.has('interal-page-state:v2:/internationalismes/'), false);
  fields.wordInput.value = 'kept';
}

{
  const { ctx, store } = makeContext();
  store.set('interal-page-state:v2:/internationalismes/', 'x');
  store.set('interal-page-state:v2:/affixes/', 'y');
  ctx.window.InteralFormDraft.clear();
  assert.equal(store.has('interal-page-state:v2:/internationalismes/'), false);
  assert.equal(store.get('interal-page-state:v2:/affixes/'), 'y');
}

console.log('persistence-helper tests passed');
