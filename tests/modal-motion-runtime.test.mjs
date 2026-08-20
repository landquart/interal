import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile('shared/modal-motion.js', 'utf8');

class FakeStyle {
  removeProperty(name) { delete this[name]; }
}

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(...values) { values.forEach((value) => this.values.add(value)); }
  remove(...values) { values.forEach((value) => this.values.delete(value)); }
}

function createRuntime(mode) {
  const animations = [];
  let frameId = 0;
  let timestamp = 0;

  class FakeElement {
    constructor(name, rect = { left: 0, top: 0, width: 1, height: 1 }) {
      this.name = name;
      this.rect = { ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top };
      this.style = new FakeStyle();
      this.dataset = {};
      this.classList = new FakeClassList();
      this.isConnected = true;
      this.firstElementChild = null;
    }
    animate(keyframes, options) {
      animations.push({ element: this, keyframes, options });
      return { finished: Promise.resolve(), cancel() {} };
    }
    getBoundingClientRect() { return { ...this.rect }; }
    querySelector() { return null; }
    setAttribute() {}
    removeAttribute() {}
    dispatchEvent() {}
    remove() { this.removed = true; }
    focus() {}
  }

  const documentElement = new FakeElement('documentElement');
  const body = new FakeElement('body');
  body.appendChild = (element) => { element.isConnected = true; };
  const document = {
    hidden: false,
    body,
    documentElement,
    activeElement: body,
    createElement: (name) => new FakeElement(name),
  };
  const mediaQuery = { matches: false, addEventListener() {} };
  const context = {
    console,
    document,
    Element: FakeElement,
    CustomEvent: class CustomEvent {},
    URLSearchParams,
    navigator: { deviceMemory: 8, hardwareConcurrency: 8, connection: { saveData: false } },
    sessionStorage: { getItem() { return null; }, setItem() {} },
    performance,
    setTimeout,
    clearTimeout,
    matchMedia: () => mediaQuery,
    getComputedStyle: () => ({
      background: 'rgba(255, 255, 255, .86)',
      backgroundColor: 'rgba(255, 255, 255, .86)',
      border: '1px solid rgba(0, 0, 0, .1)',
      borderRadius: '24px',
      borderTopLeftRadius: '24px',
      boxShadow: '0 18px 40px rgba(0, 0, 0, .16)',
      zIndex: '1600',
      getPropertyValue: () => '0'
    }),
    requestAnimationFrame(callback) {
      const id = ++frameId;
      queueMicrotask(() => { timestamp += 16.67; callback(timestamp); });
      return id;
    },
    cancelAnimationFrame() {},
    innerWidth: 390,
    innerHeight: 844,
    visualViewport: { offsetLeft: 0, offsetTop: 0, width: 390, height: 844 },
    location: { search: `?modal-motion=${mode}` }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);

  const container = new FakeElement('container', { left: 0, top: 0, width: 390, height: 844 });
  const panel = new FakeElement('panel', { left: 16, top: 132, width: 358, height: 580 });
  const backdrop = new FakeElement('backdrop', { left: 0, top: 0, width: 390, height: 844 });
  const trigger = new FakeElement('trigger', { left: 285, top: 752, width: 48, height: 48 });

  return { context, animations, container, panel, backdrop, trigger };
}

for (const mode of ['full', 'lite', 'off']) {
  const runtime = createRuntime(mode);
  await runtime.context.InteralModalMotion.open(runtime.container, {
    panel: runtime.panel,
    backdrop: runtime.backdrop,
    trigger: runtime.trigger,
    applyOpen() {}
  });

  assert.equal(runtime.context.InteralModalMotion.getMode(), mode);
  const panelAnimation = runtime.animations.find((entry) => entry.element === runtime.panel);
  assert.ok(panelAnimation, `${mode} animates the real panel`);
  assert.ok(panelAnimation.options.duration >= 160, `${mode} remains perceptible`);

  if (mode === 'off') {
    assert.equal(runtime.animations.filter((entry) => entry.element.name === 'div').length, 0, 'Off avoids a temporary shell');
    assert.match(panelAnimation.keyframes[0].transform, /translate3d\(0, 7px, 0\) scale\(0\.985\)/, 'Off uses subtle motion, not an instant state change');
  } else {
    const shellAnimation = runtime.animations.find((entry) => entry.element.name === 'div');
    assert.ok(shellAnimation, `${mode} animates a temporary shell`);
    assert.ok(shellAnimation.keyframes[0].opacity >= 0.46, `${mode} shell is visible from the trigger`);
    assert.ok(shellAnimation.keyframes.every((frame) => !('clipPath' in frame)), `${mode} avoids clip-path painting`);
    if (mode === 'full') assert.match(shellAnimation.keyframes[0].transform, /skew\(/, 'Full keeps directional deformation');
  }
}

console.log('Modal motion runtime tests passed');
