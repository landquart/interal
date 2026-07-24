import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('shared/copy-plain.js', 'utf8');
const documentListeners = new Map();
const windowListeners = new Map();
const observerCallbacks = [];

const section = { hidden: true };
const buttons = [118, 146, 132].map((naturalWidth) => ({
  naturalWidth,
  style: { width: '0px' },
  getBoundingClientRect() {
    return { width: section.hidden ? 0 : this.naturalWidth };
  }
}));
const tabs = {
  querySelectorAll(selector) {
    return selector === '.tab' ? buttons : [];
  },
  getClientRects() {
    return section.hidden ? [] : [{}];
  }
};

const copyScript = { src: 'https://interal.vercel.app/shared/copy-plain.js' };
const formDraftScript = { src: 'https://interal.vercel.app/shared/form-draft.js?v=page-state' };
const document = {
  baseURI: 'https://interal.vercel.app/associativvordes/',
  currentScript: copyScript,
  readyState: 'complete',
  scripts: [copyScript, formDraftScript],
  fonts: { ready: Promise.resolve() },
  head: { appendChild() { throw new Error('form-draft.js must not be loaded twice'); } },
  createElement() { return { src: '' }; },
  getElementById(id) {
    if (id === 'interal-design-refinements') return { id };
    if (id === 'languagesSection') return section;
    if (id === 'tabs') return tabs;
    return null;
  },
  addEventListener(type, listener) {
    const listeners = documentListeners.get(type) || [];
    listeners.push(listener);
    documentListeners.set(type, listeners);
  }
};

class MutationObserver {
  constructor(callback) {
    this.callback = callback;
    observerCallbacks.push(callback);
  }

  observe() {}
  disconnect() {}
}

const context = {
  console,
  URL,
  Promise,
  Array,
  Object,
  Number,
  Math,
  MutationObserver,
  document,
  location: { pathname: '/associativvordes/' },
  getSelection() { return null; },
  queueMicrotask,
  requestAnimationFrame(callback) { callback(); return 1; },
  cancelAnimationFrame() {},
  setTimeout(callback) { callback(); return 1; },
  addEventListener(type, listener) {
    const listeners = windowListeners.get(type) || [];
    listeners.push(listener);
    windowListeners.set(type, listeners);
  },
  window: null
};
context.window = context;

vm.createContext(context);
vm.runInContext(source, context);
await new Promise((resolve) => setImmediate(resolve));

assert.deepEqual(
  buttons.map((button) => button.style.width),
  ['', '', ''],
  'a hidden restored section must not retain stale zero-width inline styles'
);

for (const button of buttons) button.style.width = '0px';
section.hidden = false;
for (const callback of observerCallbacks) callback([]);

assert.deepEqual(
  buttons.map((button) => button.style.width),
  ['146px', '146px', '146px'],
  'tabs must be remeasured after the restored section becomes visible'
);

buttons[0].naturalWidth = 164;
for (const listener of windowListeners.get('resize') || []) listener();
assert.deepEqual(
  buttons.map((button) => button.style.width),
  ['164px', '164px', '164px'],
  'tab widths must remain synchronized after a viewport change'
);

console.log('Associative restored tab-width tests passed');
