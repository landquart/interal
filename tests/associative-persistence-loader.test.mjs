import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { compactAssociativeState } from '../associativvordes/js/associative-state.js';

const copyPlainSource = fs.readFileSync('shared/copy-plain.js', 'utf8');

function makeCopyPlainContext({ includeDeclaredFormDraft = true } = {}) {
  const listeners = new Map();
  const appendedScripts = [];
  const copyScript = { src: 'https://interal.vercel.app/shared/copy-plain.js' };
  const declaredFormDraft = { src: 'https://interal.vercel.app/shared/form-draft.js?v=page-state' };
  const scripts = includeDeclaredFormDraft ? [copyScript, declaredFormDraft] : [copyScript];

  const document = {
    baseURI: 'https://interal.vercel.app/associativvordes/',
    currentScript: copyScript,
    readyState: 'loading',
    scripts,
    head: {
      appendChild(script) {
        appendedScripts.push(script);
        scripts.push(script);
        return script;
      }
    },
    createElement(tagName) {
      return { tagName: String(tagName).toUpperCase(), src: '' };
    },
    getElementById(id) {
      return id === 'interal-design-refinements' ? { id } : null;
    },
    addEventListener(type, listener) {
      const list = listeners.get(type) || [];
      list.push(listener);
      listeners.set(type, list);
    }
  };

  const context = {
    console,
    URL,
    Promise,
    queueMicrotask,
    document,
    location: { pathname: '/associativvordes/' },
    getSelection() { return null; },
    window: null
  };
  context.window = context;

  vm.createContext(context);
  vm.runInContext(copyPlainSource, context);

  return {
    context,
    appendedScripts,
    dispatch(type) {
      for (const listener of listeners.get(type) || []) listener({ type });
    }
  };
}

{
  const { context, appendedScripts, dispatch } = makeCopyPlainContext({ includeDeclaredFormDraft: true });
  const savedState = {
    version: 1,
    page: 'associativvordes',
    state: { root: 'alter', checked: true, result: { accepted: true } }
  };

  // An early form-draft restore is buffered before the page module is ready.
  assert.equal(context.window.InteralPageStateImport(savedState), true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.window.InteralPageStateExport())),
    savedState
  );

  let imported = null;
  context.window.InteralPageStateExport = () => imported;
  context.window.InteralPageStateImport = (state) => {
    imported = state;
    return true;
  };

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(JSON.parse(JSON.stringify(imported)), savedState);
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.window.InteralPageStateExport())),
    savedState
  );

  // The explicitly declared form-draft.js must prevent the fallback loader
  // from appending a second copy.
  dispatch('DOMContentLoaded');
  assert.equal(appendedScripts.length, 0);
}

{
  const { appendedScripts, dispatch } = makeCopyPlainContext({ includeDeclaredFormDraft: false });
  dispatch('DOMContentLoaded');
  assert.equal(appendedScripts.length, 1);
  assert.match(appendedScripts[0].src, /\/shared\/form-draft\.js\?/);
}

{
  const codes = ['en', 'de', 'fr', 'es', 'it', 'ru'];
  const languages = Object.fromEntries(codes.map((code) => [
    code,
    Array.from({ length: 35 }, (_, index) => ({
      word: `${code}-${index}`,
      model: `model-${index}`,
      model_key: `model-${index}`,
      selected: index < 5,
      final_score: 100 - index,
      sources: [{ id: `${code}-${index}`, file: `${code}.json`, category: 'web', ipm: index + 1 }]
    }))
  ]));

  const compact = compactAssociativeState({
    root: 'alter',
    meaning: 'другой',
    elementType: 'root',
    maxModels: 5,
    languages,
    checked: true,
    languageStatuses: Object.fromEntries(codes.map((code) => [code, { status: 'completed' }])),
    globalStatus: 'completed'
  }, {
    languages: codes,
    activeLang: 'en',
    calculateResult: () => ({ finalAssociation: 60, accepted: true })
  });

  for (const items of Object.values(compact.state.languages)) {
    assert.equal(items.length, 20);
    assert.equal(items.filter((item) => item.selected).length, 5);
    assert.equal(items[0].sources.length, 1);
  }
}

console.log('associative persistence loader tests passed');
