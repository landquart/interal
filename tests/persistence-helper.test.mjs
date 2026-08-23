import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function makeContext(search = '', pathname = '/internationalismes/') {
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
  const ctx = { console, TextEncoder, TextDecoder, URL, location:{ href:`http://localhost${pathname}${search}`, pathname, search, hash:'' }, history:{ replaceState(){ } }, localStorage:{ getItem:k=>store.get(k)||null, setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k), key:i=>[...store.keys()][i]||null, get length(){return store.size;} }, sessionStorage:{ getItem(){return null}, setItem(){}, removeItem(){} }, document:doc, window:null, HTMLElement: function(){}, Event: class { constructor(type){ this.type=type; } }, CustomEvent: class { constructor(type, init){ this.type=type; this.detail=init?.detail; } }, setTimeout(){ return 1; }, clearTimeout(){}, btoa: s=>Buffer.from(s,'binary').toString('base64'), atob: s=>Buffer.from(s,'base64').toString('binary'), fetch: async()=>({ ok:false, status:404, json:async()=>null }), navigator:{ clipboard:null }, addEventListener(type, fn){ events[`window:${type}`] = fn; }, removeEventListener(){}, dispatchEvent(evt){ events[evt.type]?.(evt); } };
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


{
  const pages = ['/indoeuropanvordes/','/associativvordes/','/internationalismes/','/vordesofcommunites/','/grammaticebrevivordes/','/altervordes/','/affixes/'];
  for (const page of pages) {
    const { ctx, store } = makeContext('', page);
    ctx.window.InteralPageStateExport = () => ({ version:2, page, fields:{ value:page }, result:{ ok:true }, flags:{ checked:true, accepted:true }, ui:{ tab:'main' } });
    ctx.window.InteralFormDraft.save();
    assert.ok(store.has(`interal-page-state:v2:${page}`));
  }
}

{
  const { ctx, store } = makeContext('', '/affixes/');
  store.set('interal.theme', 'dark');
  store.set('interal.lang', 'en');
  store.set('affixes-state-v1', 'legacy');
  store.set('interal_affixes_state', 'legacy');
  store.set('interal-page-state:v2:/affixes/', 'new');
  store.set('interal-page-state:v2:/altervordes/', 'other');
  ctx.window.InteralFormDraft.clear();
  assert.equal(store.get('interal.theme'), 'dark');
  assert.equal(store.get('interal.lang'), 'en');
  assert.equal(store.get('interal-page-state:v2:/altervordes/'), 'other');
}

{
  const payload = { version:1, source:'interal-form-draft', path:'/interal/internationalismes/', fields:{ wordInput:'url' }, pageState:{ version:2, fields:{ word:'url' }, result:{ accepted:true }, flags:{ checked:true }, ui:{ tab:'url' } } };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const { ctx, store, fields } = makeContext(`?state=${encoded}`);
  fields.wordInput.readOnly = true;
  store.set('interal-page-state:v2:/internationalismes/', JSON.stringify({ version:1, path:'/interal/internationalismes/', fields:{ wordInput:'local' }, pageState:{ fields:{ word:'local' } } }));
  let imports = 0;
  let restoredState = null;
  ctx.window.InteralPageStateImport = (state) => { imports += 1; restoredState = state; ctx.window.InteralFormDraft.save(); return true; };
  ctx.window.InteralPageStateExport = () => restoredState;
  assert.equal(await ctx.window.InteralFormDraft.restoreInitial(), true);
  assert.equal(await ctx.window.InteralFormDraft.restoreInitial(), true);
  assert.equal(imports, 1);
  assert.equal(fields.wordInput.value, '');
  assert.equal(JSON.parse(store.get('interal-page-state:v2:/internationalismes/')).pageState.fields.word, 'url');
}

{
  const { ctx, store } = makeContext('', '/altervordes/');
  const legacy = { version:1, source:'interal-form-draft', path:'/interal/altervordes/', fields:{ wordInput:'legacy' }, pageState:{ version:2, fields:{ word:'legacy' }, result:{ accepted:true }, flags:{ checked:true } } };
  store.set('altervordes-state-v1', JSON.stringify(legacy));
  let imported = null;
  ctx.window.InteralPageStateImport = (state) => { imported = state; return true; };
  assert.equal(ctx.window.InteralFormDraft.restore(), true);
  assert.equal(imported.fields.word, 'legacy');
}

{
  const { ctx, store } = makeContext('', '/affixes/');
  const legacy = { version:1, source:'interal-form-draft', path:'/interal/affixes/', fields:{ formInput:'-x' }, pageState:{ version:2, fields:{ form:'-x' }, result:{ eligible:true }, flags:{ checked:true } } };
  store.set('interal_affixes_state', JSON.stringify(legacy));
  let imported = null;
  ctx.window.InteralPageStateImport = (state) => { imported = state; return true; };
  assert.equal(ctx.window.InteralFormDraft.restore(), true);
  assert.equal(imported.fields.form, '-x');
}

{
  const { ctx, store } = makeContext('', '/associativvordes/');
  const legacy = { version:1, source:'interal-form-draft', path:'/interal/associativvordes/', fields:{ rootInput:'vid' }, pageState:{ version:2, fields:{ root:'vid' }, result:{ accepted:true }, flags:{ checked:true } } };
  store.set('interal_associative_state', JSON.stringify(legacy));
  let imported = null;
  ctx.window.InteralPageStateImport = (state) => { imported = state; return true; };
  assert.equal(ctx.window.InteralFormDraft.restore(), true);
  assert.equal(imported.fields.root, 'vid');
}


{
  const { ctx, store } = makeContext('', '/associativvordes/');
  const languages = Object.fromEntries(['en', 'de', 'fr', 'es', 'it', 'ru'].map((code) => [
    code,
    Array.from({ length: 80 }, (_, index) => ({
      word: `${code}-word-${index}`,
      normalized: `${code}-word-${index}`,
      search_form: `${code}-word-${index}`,
      match: { type: 'exact', distance: 0, similarity: 1, fragment: 'alter', index: 0 },
      rank: index + 1,
      frequency_score: 90 - index / 10,
      category_breakdown: { subtitles: { score: 88, weight: 1 } },
      sources: Array.from({ length: 12 }, (_, sourceIndex) => ({
        id: `web/source-${sourceIndex}.json`,
        file: `source-${sourceIndex}.json`,
        category: 'web',
        ipm: sourceIndex + 0.5
      })),
      warnings: ['w'.repeat(240)],
      model: `model-${index}`,
      model_key: `model-${index}`,
      selected: index < 8,
      association_score: 70,
      final_score: 75 - index,
      analysisStatus: 'completed',
      analysis: {
        final_score: 75 - index,
        frequency: { frequency_score: 90 - index / 10 },
        swow: {
          bonus: 4,
          target_to_word: { found: true, r1_strength: 0.5, r123_strength: 0.8 },
          word_to_target: { found: false, r1_strength: null, r123_strength: null }
        },
        association: {
          association_score: 70,
          directness: 72,
          field_relatedness: 68,
          domain_shift: 15,
          semantic_confirmed: true,
          explanation: 'x'.repeat(2000)
        },
        warnings: ['warning '.repeat(80)]
      }
    }))
  ]));

  ctx.window.InteralPageStateExport = () => ({
    version: 1,
    page: 'associativvordes',
    state: {
      root: 'alter',
      meaning: 'другой',
      elementType: 'root',
      maxModels: 5,
      activeLang: 'en',
      languages,
      languageStatuses: Object.fromEntries(Object.keys(languages).map((code) => [code, { status: 'completed' }])),
      globalStatus: 'completed',
      checked: true,
      result: { finalAssociation: 61.2, accepted: true }
    }
  });

  let posted = null;
  ctx.fetch = async (_url, options) => {
    posted = JSON.parse(options.body);
    return { ok: true, status: 200, json: async () => ({ ok: true, id: 'AbCdEf123456' }) };
  };

  const shortUrl = await ctx.window.InteralFormDraft.createShortShareUrl();
  assert.equal(shortUrl, 'https://interal.vercel.app/associativvordes/?s=AbCdEf123456');
  assert.ok(posted);
  assert.ok(Buffer.byteLength(JSON.stringify(posted.payload), 'utf8') < 50_000);

  for (const items of Object.values(posted.payload.pageState.state.languages)) {
    assert.equal(items.length, 5);
    assert.ok(items.every((item) => item.selected === true));
    assert.ok(items.every((item) => !('sources' in item)));
    assert.ok(items.every((item) => item.analysis.association.explanation.length <= 320));
  }

  ctx.window.InteralFormDraft.save();
  const locallySaved = JSON.parse(store.get('interal-page-state:v2:/associativvordes/'));
  assert.equal(locallySaved.pageState.state.languages.en.length, 80);
  assert.equal(locallySaved.pageState.state.languages.en[0].sources.length, 12);
}

console.log('persistence-helper tests passed');
