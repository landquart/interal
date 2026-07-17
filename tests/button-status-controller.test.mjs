import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile('shared/button-status.js', 'utf8');
const timers = [];
const canceled = new Set();
const calls = [];
const context = {
  document: { querySelector: () => null },
  window: {
    setTimeout(fn, delay) {
      const id = timers.length;
      timers.push({ fn, delay });
      return id;
    },
    clearTimeout(id) {
      canceled.add(id);
    }
  }
};
context.window.window = context.window;
context.window.document = context.document;
vm.runInNewContext(source, context);

const controller = context.window.InteralButtonStatus.createButtonStatusController({
  setStatus(text, disabled, options) {
    calls.push({ text, disabled, loading: options.loading });
  },
  getDefaultText: () => 'Calculate',
  successDelayMs: 800
});

const first = controller.start('Calculating...');
assert.deepEqual(calls.at(-1), { text: 'Calculating...', disabled: true, loading: true }, 'run start disables busy loading button');

controller.success(first, 'Done');
assert.deepEqual(calls.at(-1), { text: 'Done', disabled: true, loading: false }, 'success keeps Done visible without showing the loader');
assert.equal(timers.at(-1).delay, 800, 'success restore uses 800 ms delay');

const second = controller.start('Calculating again...');
assert.equal(canceled.has(0), true, 'new run cancels previous success restore timer');
assert.deepEqual(calls.at(-1), { text: 'Calculating again...', disabled: true, loading: true }, 'new run owns the button');

timers[0].fn();
assert.deepEqual(calls.at(-1), { text: 'Calculating again...', disabled: true, loading: true }, 'stale timer cannot restore a newer run');

controller.error(second, 'Calculation error');
assert.deepEqual(calls.at(-1), { text: 'Calculation error', disabled: false, loading: false }, 'error message leaves button enabled while visible');
timers[1].fn();
assert.deepEqual(calls.at(-1), { text: 'Calculate', disabled: false, loading: false }, 'error restore returns default enabled button');

const third = controller.start('Calculating...');
controller.abort(third);
assert.deepEqual(calls.at(-1), { text: 'Calculate', disabled: false, loading: false }, 'abort always restores enabled default button');

console.log('button status controller tests passed');
