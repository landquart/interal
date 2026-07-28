import assert from 'node:assert/strict';
import { waitForNextPaint } from '../associativvordes/js/associative-calculation-runner.js';

{
  let frameCallback;
  let timeoutCallback;
  const cleared = [];
  const result = waitForNextPaint({
    scheduleFrame(callback) {
      frameCallback = callback;
    },
    scheduleTimeout(callback, delay) {
      timeoutCallback = callback;
      assert.equal(delay, 100);
      return 17;
    },
    cancelTimeout(id) {
      cleared.push(id);
    }
  });

  frameCallback();
  assert.equal(await result, 'frame');
  assert.deepEqual(cleared, [17], 'the fallback timer is cleared after a painted frame');
  timeoutCallback();
  assert.deepEqual(cleared, [17], 'a late timeout cannot settle or clean up twice');
}

{
  let frameCallback;
  let timeoutCallback;
  let clearCount = 0;
  const result = waitForNextPaint({
    scheduleFrame(callback) {
      frameCallback = callback;
    },
    scheduleTimeout(callback) {
      timeoutCallback = callback;
      return 23;
    },
    cancelTimeout() {
      clearCount += 1;
    }
  });

  timeoutCallback();
  assert.equal(await result, 'timeout', 'a frozen animation frame falls back to the timer');
  frameCallback();
  assert.equal(clearCount, 1, 'a late frame cannot settle or clean up twice');
}

{
  let timeoutCallback;
  const result = waitForNextPaint({
    scheduleFrame() {
      throw new Error('animation frames unavailable');
    },
    scheduleTimeout(callback) {
      timeoutCallback = callback;
      return 31;
    },
    cancelTimeout() {}
  });

  assert.equal(await result, 'frame_error', 'a throwing animation-frame scheduler cannot reject the wait');
  timeoutCallback();
}

assert.equal(
  await waitForNextPaint({ scheduleFrame: undefined }),
  'skipped',
  'the wait resolves immediately when requestAnimationFrame is absent'
);

assert.equal(
  await waitForNextPaint({ documentHidden: true, scheduleFrame() { throw new Error('must not run'); } }),
  'skipped',
  'a hidden document does not wait for throttled animation frames'
);

{
  let frameCount = 0;
  assert.equal(
    await waitForNextPaint({
      scheduleFrame(callback) {
        frameCount += 1;
        callback();
      },
      scheduleTimeout() {
        throw new Error('timer unavailable');
      }
    }),
    'frame'
  );
  assert.equal(frameCount, 1, 'the paint wait schedules at most one animation frame');
}

console.log('Associative paint wait tests passed.');
