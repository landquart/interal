import assert from 'node:assert/strict';

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;

function makeButton() {
  const classes = new Set();
  const label = { textContent: '' };
  return {
    disabled: false,
    attributes: {},
    classList: {
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
      contains(name) { return classes.has(name); }
    },
    querySelector(selector) { return selector === '.btn-text' ? label : null; },
    setAttribute(name, value) { this.attributes[name] = value; },
    get label() { return label; }
  };
}

try {
  const button = makeButton();
  const timers = [];
  globalThis.document = { querySelector: selector => selector === '#calculateBtn' ? button : null };
  globalThis.window = {
    setTimeout(callback) { timers.push(callback); return timers.length - 1; },
    clearTimeout(id) { if (id != null) timers[id] = null; }
  };

  await import(`../shared/button-status.js?test=${Date.now()}`);
  const controller = window.InteralButtonStatus.createButtonStatusController({
    selector: '#calculateBtn',
    getDefaultText: () => 'Calculate',
    getSuccessText: () => 'Done',
    getErrorText: () => 'Error',
    successDelayMs: 800,
    setTimeout: callback => { timers.push(callback); return timers.length - 1; },
    clearTimeout: id => { if (id != null) timers[id] = null; }
  });

  const token = controller.start('Calculating…');
  assert.equal(button.disabled, true);
  assert.equal(button.classList.contains('is-loading'), true);
  assert.equal(button.attributes['aria-busy'], 'true');

  controller.success(token);
  assert.equal(button.label.textContent, 'Done');
  assert.equal(button.disabled, true, 'success remains temporarily protected from double click');
  assert.equal(button.classList.contains('is-loading'), false, 'success removes loader immediately');
  assert.equal(button.attributes['aria-busy'], 'false');

  timers.at(-1)?.();
  assert.equal(button.label.textContent, 'Calculate');
  assert.equal(button.disabled, false);
  assert.equal(button.classList.contains('is-loading'), false);

  const errorToken = controller.start('Calculating…');
  controller.error(errorToken);
  assert.equal(button.label.textContent, 'Error');
  assert.equal(button.disabled, false);
  assert.equal(button.classList.contains('is-loading'), false);

  const abortToken = controller.start('Again…');
  controller.abort(abortToken);
  assert.equal(button.label.textContent, 'Calculate');
  assert.equal(button.disabled, false);
  assert.equal(button.classList.contains('is-loading'), false);

  const staleToken = controller.start('Old run');
  controller.success(staleToken);
  const staleRestore = timers.at(-1);
  const newToken = controller.start('New run');
  staleRestore?.();
  assert.equal(controller.isCurrent(newToken), true);
  assert.equal(button.label.textContent, 'New run', 'stale timer cannot reset a newer run');
  assert.equal(button.classList.contains('is-loading'), true);
} finally {
  globalThis.window = originalWindow;
  globalThis.document = originalDocument;
}

console.log('button status success tests passed');
