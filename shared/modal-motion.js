(function () {
  'use strict';

  const SESSION_KEY = 'interal.modalMotionMode.v2';
  const MODES = Object.freeze({ FULL: 'full', LITE: 'lite', OFF: 'off' });
  const MINIMUM_QUALITY_INTERVAL = 1000 / 60;
  const DOWNGRADE_STREAK = Object.freeze({ [MODES.FULL]: 2, [MODES.LITE]: 3 });
  const PANEL_SELECTORS = [
    '[role="dialog"]',
    '.modal-card',
    '.modal-inner',
    '.registry-modal-card',
    '.giscus-modal-card',
    '.interal-confirm-dialog',
    '.interal-select-modal-panel',
    '.menu-lang-modal-content'
  ];
  const BACKDROP_SELECTORS = [
    '.modal-backdrop',
    '.registry-backdrop',
    '.giscus-backdrop',
    '.interal-select-modal-backdrop'
  ];
  const modalStates = new WeakMap();
  const reduceMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const median = (values) => {
    if (!values.length) return 16.67;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
  const wait = (duration) => new Promise((resolve) => window.setTimeout(resolve, duration));

  function readDebugMode() {
    try {
      const value = new URLSearchParams(window.location.search).get('modal-motion');
      return Object.values(MODES).includes(value) ? value : null;
    } catch (_) {
      return null;
    }
  }

  class ModalMotionPerformance {
    constructor() {
      this.debugMode = readDebugMode();
      this.baselineFrameInterval = 16.67;
      this.baselineSamples = [];
      this.poorStreak = 0;
      this.lastAnimationQuality = null;
      this.preliminaryMode = this.getPreliminaryMode();
      this.sessionMode = this.readSessionMode();
      this.sampleBaseline();
    }

    readSessionMode() {
      try {
        const value = sessionStorage.getItem(SESSION_KEY);
        return Object.values(MODES).includes(value) ? value : null;
      } catch (_) {
        return null;
      }
    }

    getPreliminaryMode() {
      if (reduceMotionQuery?.matches) return MODES.OFF;
      const memory = Number(navigator.deviceMemory || 0);
      const cores = Number(navigator.hardwareConcurrency || 0);
      const saveData = navigator.connection?.saveData === true;
      const slowUpdates = window.matchMedia?.('(update: slow)').matches === true;
      if (saveData || slowUpdates || (memory > 0 && memory <= 2) || (cores > 0 && cores <= 2)) return MODES.LITE;
      return MODES.FULL;
    }

    getMode() {
      if (this.debugMode) return this.debugMode;
      if (reduceMotionQuery?.matches) return MODES.OFF;
      return this.sessionMode || this.preliminaryMode;
    }

    sampleBaseline() {
      if (typeof requestAnimationFrame !== 'function') return;
      let previous = 0;
      let frames = 0;
      const sample = (timestamp) => {
        if (document.hidden) {
          previous = timestamp;
          requestAnimationFrame(sample);
          return;
        }
        if (previous) {
          const interval = timestamp - previous;
          if (interval >= 5 && interval <= 40) this.baselineSamples.push(interval);
        }
        previous = timestamp;
        frames += 1;
        if (frames < 18) {
          requestAnimationFrame(sample);
          return;
        }
        if (this.baselineSamples.length) {
          this.baselineFrameInterval = clamp(median(this.baselineSamples), 6.5, 33.34);
        }
      };
      requestAnimationFrame(sample);
    }

    downgrade(fromMode) {
      if (this.debugMode || reduceMotionQuery?.matches) return;
      const next = fromMode === MODES.FULL ? MODES.LITE : fromMode === MODES.LITE ? MODES.OFF : MODES.OFF;
      if (next === fromMode) return;
      this.sessionMode = next;
      this.poorStreak = 0;
      try { sessionStorage.setItem(SESSION_KEY, next); } catch (_) {}
    }

    reportAnimation({ mode, frameTimes, duration }) {
      if (this.debugMode || reduceMotionQuery?.matches || mode === MODES.OFF) return;
      if (!Array.isArray(frameTimes) || frameTimes.length < 8 || duration < 160) return;

      const expected = clamp(this.baselineFrameInterval || median(frameTimes), 6.5, 33.34);
      const qualityInterval = Math.max(expected, MINIMUM_QUALITY_INTERVAL);
      const badLimit = Math.max(qualityInterval * 1.82, qualityInterval + 9);
      const badFrames = frameTimes.filter((time) => time > badLimit);
      const badRatio = badFrames.length / frameTimes.length;
      const average = frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
      const maximum = Math.max(...frameTimes);
      const isPoor = (
        (badRatio > (mode === MODES.FULL ? 0.24 : 0.32) && maximum > qualityInterval * 2.2)
        || average > qualityInterval * (mode === MODES.FULL ? 1.58 : 1.72)
        || (badRatio > 0.12 && maximum > qualityInterval * 4.6)
      );

      this.lastAnimationQuality = { mode, expected, qualityInterval, badRatio, average, maximum, isPoor };
      this.poorStreak = isPoor ? this.poorStreak + 1 : 0;
      const requiredFailures = DOWNGRADE_STREAK[mode] || Number.POSITIVE_INFINITY;
      if (this.poorStreak >= requiredFailures) this.downgrade(mode);
    }

    getStatus() {
      return {
        mode: this.getMode(),
        baselineFrameInterval: this.baselineFrameInterval,
        debugMode: this.debugMode,
        sessionMode: this.sessionMode,
        poorStreak: this.poorStreak,
        lastAnimationQuality: this.lastAnimationQuality
      };
    }
  }

  const performanceController = new ModalMotionPerformance();

  function getModalState(container) {
    let state = modalStates.get(container);
    if (!state) {
      state = {
        phase: 'closed',
        promise: Promise.resolve(),
        trigger: null,
        triggerRect: null,
        modalRect: null,
        panel: null
      };
      modalStates.set(container, state);
    }
    return state;
  }

  function asElement(value) {
    if (value instanceof Element) return value;
    if (value?.currentTarget instanceof Element) return value.currentTarget;
    return null;
  }

  function validRect(rect) {
    return rect && Number.isFinite(rect.left) && Number.isFinite(rect.top) && rect.width > 0 && rect.height > 0;
  }

  function cloneRect(rect) {
    if (!validRect(rect)) return null;
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      x: rect.x,
      y: rect.y
    };
  }

  function getViewportBounds() {
    const viewport = window.visualViewport;
    const left = Math.max(0, viewport?.offsetLeft || 0);
    const top = Math.max(0, viewport?.offsetTop || 0);
    const width = Math.max(1, viewport?.width || window.innerWidth || document.documentElement.clientWidth || 1);
    const height = Math.max(1, viewport?.height || window.innerHeight || document.documentElement.clientHeight || 1);
    return { left, top, right: left + width, bottom: top + height, width, height };
  }

  function clampSourceRect(rect) {
    if (!validRect(rect)) return null;
    const viewport = getViewportBounds();
    const padding = 10;
    const centerX = clamp(rect.left + rect.width / 2, viewport.left + padding, viewport.right - padding);
    const centerY = clamp(rect.top + rect.height / 2, viewport.top + padding, viewport.bottom - padding);
    const width = clamp(rect.width, 18, Math.min(120, viewport.width * 0.45));
    const height = clamp(rect.height, 18, Math.min(84, viewport.height * 0.32));
    return {
      left: centerX - width / 2,
      top: centerY - height / 2,
      right: centerX + width / 2,
      bottom: centerY + height / 2,
      width,
      height,
      x: centerX - width / 2,
      y: centerY - height / 2
    };
  }

  function sourceRectFor(trigger, fallback) {
    if (trigger?.isConnected) {
      const current = clampSourceRect(trigger.getBoundingClientRect());
      if (current) return current;
    }
    if (validRect(fallback)) return clampSourceRect(fallback);
    const viewport = getViewportBounds();
    const width = 72;
    const height = 42;
    const centerX = viewport.left + viewport.width / 2;
    const centerY = viewport.bottom - Math.max(24, Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-safe-bottom')) || 0) - 28;
    return {
      left: centerX - width / 2,
      right: centerX + width / 2,
      top: centerY - height / 2,
      bottom: centerY + height / 2,
      width,
      height,
      x: centerX - width / 2,
      y: centerY - height / 2
    };
  }

  function resolvePanel(container, explicit) {
    const panel = typeof explicit === 'function' ? explicit() : explicit;
    if (panel instanceof Element) return panel;
    return container.querySelector(PANEL_SELECTORS.join(',')) || container.firstElementChild || container;
  }

  function resolveBackdrop(container, panel, explicit) {
    const backdrop = typeof explicit === 'function' ? explicit() : explicit;
    if (backdrop instanceof Element) return backdrop;
    return container.querySelector(BACKDROP_SELECTORS.join(',')) || (panel !== container ? container : null);
  }

  function captureInlineStyles(element, properties) {
    const saved = {};
    properties.forEach((property) => { saved[property] = element.style[property]; });
    return () => properties.forEach((property) => { element.style[property] = saved[property]; });
  }

  function preparePanel(panel) {
    const restore = captureInlineStyles(panel, ['opacity', 'visibility', 'pointerEvents', 'transition', 'animation', 'transform', 'willChange']);
    panel.style.transition = 'none';
    panel.style.animation = 'none';
    panel.style.transform = 'none';
    panel.style.opacity = '0';
    panel.style.visibility = 'visible';
    panel.style.pointerEvents = 'none';
    panel.style.willChange = 'opacity';
    return restore;
  }

  function createShell(container, panel, rect, mode) {
    if (!validRect(rect)) return null;
    const style = getComputedStyle(panel);
    const shell = document.createElement('div');
    shell.className = `interal-modal-motion-shell interal-modal-motion-shell--${mode}`;
    shell.setAttribute('aria-hidden', 'true');
    Object.assign(shell.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      background: style.background,
      backgroundColor: style.backgroundColor,
      border: style.border,
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
      opacity: '0',
      zIndex: String((Number.parseInt(getComputedStyle(container).zIndex, 10) || 10000) + 2),
      willChange: 'transform, opacity'
    });
    document.body.appendChild(shell);
    return shell;
  }

  function geometry(source, target, mode) {
    const minScaleX = mode === MODES.FULL ? 0.11 : 0.22;
    const minScaleY = mode === MODES.FULL ? 0.075 : 0.14;
    const sourceCenterX = source.left + source.width / 2;
    const sourceCenterY = source.top + source.height / 2;
    const targetCenterX = target.left + target.width / 2;
    const targetCenterY = target.top + target.height / 2;
    return {
      tx: sourceCenterX - targetCenterX,
      ty: sourceCenterY - targetCenterY,
      sx: clamp(source.width / target.width, minScaleX, 0.9),
      sy: clamp(source.height / target.height, minScaleY, 0.86),
      skewX: clamp(((sourceCenterY - targetCenterY) / Math.max(target.height, 1)) * -7, -6, 6),
      skewY: clamp(((sourceCenterX - targetCenterX) / Math.max(target.width, 1)) * 7, -6, 6)
    };
  }

  function fullKeyframes(direction, source, target) {
    const g = geometry(source, target, MODES.FULL);
    const start = `translate3d(${g.tx}px, ${g.ty}px, 0) scale(${g.sx}, ${g.sy}) skew(${g.skewX * 0.32}deg, ${g.skewY * 0.32}deg)`;
    const pulled = `translate3d(${g.tx * 0.56}px, ${g.ty * 0.56}px, 0) scale(${g.sx + (1 - g.sx) * 0.38}, ${g.sy + (1 - g.sy) * 0.3}) skew(${g.skewX}deg, ${g.skewY}deg)`;
    const released = `translate3d(${g.tx * 0.16}px, ${g.ty * 0.16}px, 0) scale(${0.86 + g.sx * 0.14}, ${0.8 + g.sy * 0.2}) skew(${g.skewX * 0.38}deg, ${g.skewY * 0.38}deg)`;
    const opened = { transform: 'translate3d(0, 0, 0) scale(1, 1) skew(0deg, 0deg)', opacity: 0 };
    const compact = { transform: start, opacity: 0.5 };
    const stretched = { transform: pulled, opacity: 0.98, offset: 0.38 };
    const almost = { transform: released, opacity: 1, offset: 0.74 };

    if (direction === 'open') return [compact, stretched, almost, opened];
    return [
      { ...opened, opacity: 0.94 },
      { ...almost, opacity: 1, offset: 0.3 },
      { ...stretched, opacity: 0.94, offset: 0.64 },
      { ...compact, opacity: 0.18 }
    ];
  }

  function liteKeyframes(direction, source, target) {
    const g = geometry(source, target, MODES.LITE);
    const compact = { transform: `translate3d(${g.tx}px, ${g.ty}px, 0) scale(${g.sx}, ${g.sy})`, opacity: 0.46 };
    const middle = { transform: `translate3d(${g.tx * 0.34}px, ${g.ty * 0.34}px, 0) scale(${g.sx + (1 - g.sx) * 0.72}, ${g.sy + (1 - g.sy) * 0.68})`, opacity: 0.98, offset: 0.56 };
    const opened = { transform: 'translate3d(0, 0, 0) scale(1, 1)', opacity: 0.04 };
    return direction === 'open'
      ? [compact, middle, opened]
      : [{ ...opened, opacity: 0.9 }, { ...middle, opacity: 0.92, offset: 0.38 }, { ...compact, opacity: 0.08 }];
  }

  function offKeyframes(direction) {
    const still = reduceMotionQuery?.matches;
    const closed = still
      ? { opacity: 0 }
      : { opacity: 0, transform: 'translate3d(0, 7px, 0) scale(0.985)' };
    const opened = still
      ? { opacity: 1 }
      : { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' };
    return direction === 'open' ? [closed, opened] : [opened, closed];
  }

  function playAnimation(element, keyframes, options) {
    if (!element || typeof element.animate !== 'function') {
      if (element && keyframes.length) {
        const finalFrame = { ...keyframes.at(-1) };
        delete finalFrame.offset;
        delete finalFrame.easing;
        Object.assign(element.style, finalFrame);
      }
      return wait(options.duration || 0);
    }
    const animation = element.animate(keyframes, options);
    return animation.finished.catch(() => undefined).finally(() => animation.cancel());
  }

  function startFrameProbe(mode) {
    const frameTimes = [];
    const startedAt = performance.now();
    let previous = 0;
    let running = true;
    let frameId = 0;
    const sample = (timestamp) => {
      if (!running) return;
      if (previous && !document.hidden) frameTimes.push(timestamp - previous);
      previous = timestamp;
      frameId = requestAnimationFrame(sample);
    };
    frameId = requestAnimationFrame(sample);
    return () => {
      running = false;
      cancelAnimationFrame(frameId);
      performanceController.reportAnimation({ mode, frameTimes, duration: performance.now() - startedAt });
    };
  }

  function focusElement(value) {
    const target = typeof value === 'function' ? value() : value;
    if (target?.isConnected && typeof target.focus === 'function') {
      try { target.focus({ preventScroll: true }); } catch (_) { target.focus(); }
    }
  }

  function animateBackdrop(backdrop, direction, mode) {
    if (!backdrop) return Promise.resolve();
    const duration = direction === 'open'
      ? (mode === MODES.OFF ? 180 : 230)
      : (mode === MODES.OFF ? 150 : 190);
    return playAnimation(backdrop, direction === 'open' ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }], {
      duration,
      easing: 'ease-out',
      fill: 'both'
    });
  }

  function cleanContainerState(container) {
    delete container.dataset.modalMotionState;
    container.removeAttribute('data-modal-motion-active');
  }

  function open(container, options = {}) {
    if (!(container instanceof Element)) return Promise.resolve(false);
    const state = getModalState(container);
    if (state.phase === 'opening' || state.phase === 'open') return state.promise;
    if (state.phase === 'closing') return state.promise.then(() => open(container, options));

    const task = (async () => {
      state.phase = 'opening';
      container.dataset.modalMotionState = 'opening';
      container.setAttribute('data-modal-motion-active', 'true');
      const explicitTrigger = asElement(options.trigger);
      const activeElement = asElement(document.activeElement);
      state.trigger = explicitTrigger || (activeElement !== document.body && activeElement !== document.documentElement ? activeElement : null);
      state.triggerRect = clampSourceRect(options.triggerRect) || sourceRectFor(state.trigger, state.triggerRect);

      options.beforeOpen?.();
      if (options.applyOpen) options.applyOpen();
      else {
        container.hidden = false;
        container.classList.add('show');
        container.setAttribute('aria-hidden', 'false');
      }

      await nextFrame();
      const panel = resolvePanel(container, options.panel);
      const modalRect = cloneRect(panel.getBoundingClientRect());
      state.panel = panel;
      state.modalRect = modalRect;
      const mode = performanceController.getMode();
      const backdrop = resolveBackdrop(container, panel, options.backdrop);
      const restorePanel = preparePanel(panel);
      const restoreBackdrop = backdrop ? captureInlineStyles(backdrop, ['opacity', 'transition', 'willChange']) : () => {};
      if (backdrop) {
        backdrop.style.transition = 'none';
        backdrop.style.willChange = 'opacity';
      }
      const stopProbe = startFrameProbe(mode);
      let shell = null;

      try {
        const backdropAnimation = animateBackdrop(backdrop, 'open', mode);
        if (mode === MODES.OFF || !validRect(modalRect)) {
          await Promise.all([
            backdropAnimation,
            playAnimation(panel, offKeyframes('open'), { duration: reduceMotionQuery?.matches ? 160 : 210, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both' })
          ]);
        } else {
          shell = createShell(container, panel, modalRect, mode);
          const duration = mode === MODES.FULL ? 410 : 340;
          const shellFrames = mode === MODES.FULL
            ? fullKeyframes('open', state.triggerRect, modalRect)
            : liteKeyframes('open', state.triggerRect, modalRect);
          const contentRevealOffset = mode === MODES.FULL ? 0.52 : 0.46;
          await Promise.all([
            backdropAnimation,
            playAnimation(shell, shellFrames, { duration, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both' }),
            playAnimation(panel, [{ opacity: 0 }, { opacity: 0, offset: contentRevealOffset }, { opacity: 1 }], { duration, easing: 'ease-out', fill: 'both' })
          ]);
        }
      } finally {
        stopProbe();
        shell?.remove();
        restoreBackdrop();
        restorePanel();
        panel.style.removeProperty('will-change');
        state.phase = 'open';
        cleanContainerState(container);
      }

      options.afterOpen?.();
      focusElement(options.focusTarget);
      container.dispatchEvent(new CustomEvent('interal:modalmotionopen', { bubbles: true, detail: { mode } }));
      return true;
    })();

    state.promise = task;
    return task;
  }

  function close(container, options = {}) {
    if (!(container instanceof Element)) return Promise.resolve(false);
    const state = getModalState(container);
    if (state.phase === 'closing' || state.phase === 'closed') return state.promise;
    if (state.phase === 'opening') return state.promise.then(() => close(container, options));

    const task = (async () => {
      state.phase = 'closing';
      container.dataset.modalMotionState = 'closing';
      container.setAttribute('data-modal-motion-active', 'true');
      const panel = resolvePanel(container, options.panel || state.panel);
      const modalRect = cloneRect(panel.getBoundingClientRect()) || state.modalRect;
      state.modalRect = modalRect;
      const source = sourceRectFor(state.trigger, state.triggerRect);
      state.triggerRect = source;
      const mode = performanceController.getMode();
      const backdrop = resolveBackdrop(container, panel, options.backdrop);
      const restorePanel = preparePanel(panel);
      const restoreBackdrop = backdrop ? captureInlineStyles(backdrop, ['opacity', 'transition', 'willChange']) : () => {};
      if (backdrop) {
        backdrop.style.transition = 'none';
        backdrop.style.willChange = 'opacity';
      }
      const stopProbe = startFrameProbe(mode);
      let shell = null;

      try {
        const backdropAnimation = animateBackdrop(backdrop, 'close', mode);
        if (mode === MODES.OFF || !validRect(modalRect)) {
          await Promise.all([
            backdropAnimation,
            playAnimation(panel, offKeyframes('close'), { duration: reduceMotionQuery?.matches ? 140 : 180, easing: 'cubic-bezier(.4, 0, .6, 1)', fill: 'both' })
          ]);
        } else {
          shell = createShell(container, panel, modalRect, mode);
          const duration = mode === MODES.FULL ? 330 : 285;
          const shellFrames = mode === MODES.FULL
            ? fullKeyframes('close', source, modalRect)
            : liteKeyframes('close', source, modalRect);
          await Promise.all([
            backdropAnimation,
            playAnimation(shell, shellFrames, { duration, easing: 'cubic-bezier(.4, 0, .6, 1)', fill: 'both' }),
            playAnimation(panel, [{ opacity: 1 }, { opacity: 0 }], { duration: 135, easing: 'ease-in', fill: 'both' })
          ]);
        }
      } finally {
        stopProbe();
        shell?.remove();
        restoreBackdrop();
        restorePanel();
        if (options.applyClose) options.applyClose();
        else {
          container.classList.remove('show', 'is-open');
          container.hidden = true;
          container.setAttribute('aria-hidden', 'true');
        }
        state.phase = 'closed';
        cleanContainerState(container);
      }

      options.afterClose?.();
      if (options.restoreFocus !== false) focusElement(options.focusTarget || state.trigger);
      container.dispatchEvent(new CustomEvent('interal:modalmotionclose', { bubbles: true, detail: { mode } }));
      return true;
    })();

    state.promise = task;
    return task;
  }

  reduceMotionQuery?.addEventListener?.('change', () => {
    performanceController.preliminaryMode = performanceController.getPreliminaryMode();
  });

  window.InteralModalMotion = Object.freeze({
    MODES,
    open,
    close,
    getMode: () => performanceController.getMode(),
    getStatus: () => performanceController.getStatus(),
    getPhase: (container) => container instanceof Element ? getModalState(container).phase : 'closed'
  });
})();
