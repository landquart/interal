(function () {
  'use strict';

  const VERSION = 'telegram-efficient-v1';
  const root = document.documentElement;
  if (!root || root.dataset.interalLiquidGlass === VERSION) return;
  root.dataset.interalLiquidGlass = VERSION;

  const target = document.querySelector('.top-nav-window');
  if (!target) return;

  const media = {
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)'),
    reducedTransparency: window.matchMedia?.('(prefers-reduced-transparency: reduce)'),
    highContrast: window.matchMedia?.('(prefers-contrast: more)')
  };

  const supportsBackdrop = typeof CSS !== 'undefined' && (
    CSS.supports('backdrop-filter', 'blur(4px)')
    || CSS.supports('-webkit-backdrop-filter', 'blur(4px)')
  );
  const supportsPortal = typeof SVGFEImageElement !== 'undefined'
    && typeof HTMLCanvasElement !== 'undefined'
    && typeof Path2D !== 'undefined';

  const state = {
    tier: 'solid',
    portal: null,
    filterSvg: null,
    filterId: 'interal-topbar-efficient-refraction',
    scrollFrame: 0,
    resizeFrame: 0,
    refreshTimer: 0,
    longTasks: [],
    frameMonitorRunning: false,
    destroyed: false
  };

  function chooseInitialTier() {
    if (!supportsBackdrop || media.reducedTransparency?.matches || media.highContrast?.matches) {
      return 'solid';
    }

    const memory = Number(navigator.deviceMemory) || 4;
    const cores = Number(navigator.hardwareConcurrency) || 4;
    const saveData = Boolean(navigator.connection?.saveData);

    if (saveData || memory <= 2 || cores <= 2) return 'lite';
    if (!supportsPortal || media.reducedMotion?.matches || memory < 6 || cores < 6) return 'balanced';
    return 'full';
  }

  function tierRank(tier) {
    return { solid: 0, lite: 1, balanced: 2, full: 3 }[tier] ?? 0;
  }

  function nextLowerTier(tier) {
    if (tier === 'full') return 'balanced';
    if (tier === 'balanced') return 'lite';
    if (tier === 'lite') return 'solid';
    return 'solid';
  }

  function setTier(nextTier, reason) {
    if (state.destroyed) return;
    const tier = ['full', 'balanced', 'lite', 'solid'].includes(nextTier) ? nextTier : 'solid';
    if (state.tier === tier && root.dataset.liquidGlassTier === tier) return;

    state.tier = tier;
    root.dataset.liquidGlassTier = tier;
    root.dataset.liquidGlassReason = reason || 'initial';

    if (tier === 'full') {
      schedulePortalMount();
    } else {
      destroyPortal();
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function roundedRectSdf(x, y, width, height, radius) {
    const px = x - width / 2;
    const py = y - height / 2;
    const sx = px < 0 ? -1 : 1;
    const sy = py < 0 ? -1 : 1;
    const ax = Math.abs(px);
    const ay = Math.abs(py);
    const bx = Math.max(0, width / 2 - radius);
    const by = Math.max(0, height / 2 - radius);
    const qx = ax - bx;
    const qy = ay - by;

    let distance;
    let nx;
    let ny;

    if (qx > 0 && qy > 0) {
      const length = Math.hypot(qx, qy) || 1;
      distance = length - radius;
      nx = (qx / length) * sx;
      ny = (qy / length) * sy;
    } else if (qx > qy) {
      distance = qx - radius;
      nx = sx;
      ny = 0;
    } else {
      distance = qy - radius;
      nx = 0;
      ny = sy;
    }

    return { distance, nx, ny };
  }

  function createNormalMap(width, height, radius, depth) {
    const mapWidth = 144;
    const mapHeight = Math.max(24, Math.round(mapWidth * height / Math.max(1, width)));
    const canvas = document.createElement('canvas');
    canvas.width = mapWidth;
    canvas.height = mapHeight;
    const context = canvas.getContext('2d');
    if (!context) return '';

    const image = context.createImageData(mapWidth, mapHeight);
    for (let row = 0; row < mapHeight; row += 1) {
      for (let column = 0; column < mapWidth; column += 1) {
        const x = (column + 0.5) / mapWidth * width;
        const y = (row + 0.5) / mapHeight * height;
        const { distance, nx, ny } = roundedRectSdf(x, y, width, height, radius);
        const distanceFromEdge = -distance;
        let red = 128;
        let green = 128;

        if (distance <= 0 && distanceFromEdge <= depth) {
          const t = clamp(distanceFromEdge / Math.max(1, depth), 0, 1);
          const effect = (1 - t) * (1 - t);
          red = Math.round(clamp(128 - nx * effect * 127, 0, 255));
          green = Math.round(clamp(128 - ny * effect * 127, 0, 255));
        }

        const offset = (row * mapWidth + column) * 4;
        image.data[offset] = red;
        image.data[offset + 1] = green;
        image.data[offset + 2] = 128;
        image.data[offset + 3] = 255;
      }
    }

    context.putImageData(image, 0, 0);
    return canvas.toDataURL('image/png');
  }

  function createFilter(width, height) {
    state.filterSvg?.remove();

    const namespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(namespace, 'svg');
    svg.classList.add('liquid-filter-defs');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    Object.assign(svg.style, {
      position: 'fixed',
      width: '0',
      height: '0',
      overflow: 'hidden',
      pointerEvents: 'none'
    });

    const defs = document.createElementNS(namespace, 'defs');
    const filter = document.createElementNS(namespace, 'filter');
    filter.id = state.filterId;
    filter.setAttribute('filterUnits', 'userSpaceOnUse');
    filter.setAttribute('primitiveUnits', 'userSpaceOnUse');
    filter.setAttribute('x', '0');
    filter.setAttribute('y', '0');
    filter.setAttribute('width', String(width));
    filter.setAttribute('height', String(height));
    filter.setAttribute('color-interpolation-filters', 'sRGB');

    const map = document.createElementNS(namespace, 'feImage');
    map.setAttribute('x', '0');
    map.setAttribute('y', '0');
    map.setAttribute('width', String(width));
    map.setAttribute('height', String(height));
    map.setAttribute('preserveAspectRatio', 'none');
    map.setAttribute('result', 'normalMap');

    const computed = getComputedStyle(target);
    const radius = Number.parseFloat(computed.borderTopLeftRadius) || height / 2;
    const mapUrl = createNormalMap(width, height, radius, 10);
    map.setAttribute('href', mapUrl);
    map.setAttributeNS('http://www.w3.org/1999/xlink', 'href', mapUrl);

    const displacement = document.createElementNS(namespace, 'feDisplacementMap');
    displacement.setAttribute('in', 'SourceGraphic');
    displacement.setAttribute('in2', 'normalMap');
    displacement.setAttribute('scale', '82');
    displacement.setAttribute('xChannelSelector', 'R');
    displacement.setAttribute('yChannelSelector', 'G');
    displacement.setAttribute('result', 'refracted');

    const blur = document.createElementNS(namespace, 'feGaussianBlur');
    blur.setAttribute('in', 'refracted');
    blur.setAttribute('stdDeviation', '1.15');

    filter.append(map, displacement, blur);
    defs.appendChild(filter);
    svg.appendChild(defs);
    document.body.appendChild(svg);
    state.filterSvg = svg;
  }

  function copyStyles(shadowRoot) {
    for (const source of document.querySelectorAll('link[rel="stylesheet"], style')) {
      const clone = source.cloneNode(true);
      if (clone instanceof HTMLLinkElement) clone.href = source.href;
      shadowRoot.appendChild(clone);
    }

    const safety = document.createElement('style');
    safety.textContent = `
      *, *::before, *::after {
        pointer-events: none !important;
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `;
    shadowRoot.appendChild(safety);
  }

  function createBodyCopy() {
    const copy = document.body.cloneNode(true);
    copy.querySelectorAll([
      '.top-nav',
      '.side-menu',
      '.side-menu-overlay',
      '.menu-lang-modal',
      '[data-liquid-portal-host]',
      '.liquid-filter-defs',
      'script',
      'noscript'
    ].join(',')).forEach(node => node.remove());
    copy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    copy.className = `${document.body.className} liquid-portal-copy`;
    copy.setAttribute('aria-hidden', 'true');
    copy.setAttribute('inert', '');
    Object.assign(copy.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      margin: '0',
      width: `${document.documentElement.clientWidth}px`,
      minHeight: `${Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, window.innerHeight)}px`,
      maxWidth: 'none',
      overflow: 'visible',
      pointerEvents: 'none',
      transformOrigin: '0 0',
      contain: 'layout style paint'
    });
    return copy;
  }

  function updatePortalTransform() {
    if (!state.portal?.copy || state.tier !== 'full') return;
    const rect = target.getBoundingClientRect();
    const x = -(rect.left + window.scrollX);
    const y = -(rect.top + window.scrollY);
    state.portal.copy.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  function schedulePortalTransform() {
    if (state.scrollFrame || state.tier !== 'full') return;
    state.scrollFrame = requestAnimationFrame(() => {
      state.scrollFrame = 0;
      updatePortalTransform();
    });
  }

  function refreshPortalCopy() {
    if (state.tier !== 'full' || !state.portal) return;
    const nextCopy = createBodyCopy();
    state.portal.copy?.remove();
    state.portal.copy = nextCopy;
    state.portal.shadowRoot.appendChild(nextCopy);
    updatePortalTransform();
  }

  function schedulePortalRefresh() {
    if (state.tier !== 'full') return;
    clearTimeout(state.refreshTimer);
    state.refreshTimer = window.setTimeout(() => {
      const run = () => refreshPortalCopy();
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(run, { timeout: 1200 });
      } else {
        run();
      }
    }, 700);
  }

  function mountPortal() {
    if (state.tier !== 'full' || state.portal || !supportsPortal) return;

    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    createFilter(Math.round(rect.width), Math.round(rect.height));

    const viewport = document.createElement('span');
    viewport.className = 'liquid-portal-viewport';
    viewport.dataset.liquidPortalHost = 'true';
    viewport.setAttribute('aria-hidden', 'true');
    viewport.setAttribute('inert', '');
    viewport.style.filter = `url("#${state.filterId}") saturate(1.10) contrast(1.025)`;

    const host = document.createElement('span');
    host.className = 'liquid-portal-shadow-host';
    host.setAttribute('aria-hidden', 'true');
    host.setAttribute('inert', '');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    copyStyles(shadowRoot);
    viewport.appendChild(host);
    target.prepend(viewport);

    const copy = createBodyCopy();
    shadowRoot.appendChild(copy);

    const classObserver = new MutationObserver(() => {
      copy.className = `${document.body.className} liquid-portal-copy`;
    });
    classObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    const contentObserver = new MutationObserver(records => {
      const relevant = records.some(record => {
        const element = record.target instanceof Element ? record.target : record.target.parentElement;
        return !element?.closest?.('.top-nav') && !element?.closest?.('[data-liquid-portal-host]');
      });
      if (relevant) schedulePortalRefresh();
    });
    contentObserver.observe(document.body, { subtree: true, childList: true });

    state.portal = { viewport, host, shadowRoot, copy, classObserver, contentObserver };
    updatePortalTransform();
  }

  function schedulePortalMount() {
    if (state.portal || state.tier !== 'full') return;
    const mount = () => mountPortal();
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(mount, { timeout: 800 });
    } else {
      window.setTimeout(mount, 0);
    }
  }

  function destroyPortal() {
    if (state.scrollFrame) cancelAnimationFrame(state.scrollFrame);
    state.scrollFrame = 0;
    clearTimeout(state.refreshTimer);
    state.refreshTimer = 0;
    state.portal?.classObserver?.disconnect();
    state.portal?.contentObserver?.disconnect();
    state.portal?.viewport?.remove();
    state.portal = null;
    state.filterSvg?.remove();
    state.filterSvg = null;
  }

  function downgrade(reason) {
    const next = nextLowerTier(state.tier);
    if (next !== state.tier) setTier(next, reason);
  }

  function monitorFrames() {
    if (state.frameMonitorRunning || document.hidden || state.tier === 'solid') return;
    state.frameMonitorRunning = true;
    const samples = [];
    let previous = performance.now();

    function frame(now) {
      samples.push(now - previous);
      previous = now;
      if (samples.length < 45) {
        requestAnimationFrame(frame);
        return;
      }

      state.frameMonitorRunning = false;
      const sorted = samples.slice().sort((a, b) => a - b);
      const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
      const p95 = sorted[Math.floor(sorted.length * 0.95)] || average;
      if (average > 24 || p95 > 42) downgrade('frame-budget');
    }

    requestAnimationFrame(frame);
  }

  function observeLongTasks() {
    if (!('PerformanceObserver' in window)) return;
    try {
      const observer = new PerformanceObserver(list => {
        const now = performance.now();
        for (const entry of list.getEntries()) {
          if (entry.duration >= 55) state.longTasks.push(now);
        }
        state.longTasks = state.longTasks.filter(value => now - value < 5000);
        if (state.longTasks.length >= 2) {
          state.longTasks = [];
          downgrade('long-task');
        }
      });
      observer.observe({ type: 'longtask', buffered: true });
    } catch (_) {
      // Long Task API is optional.
    }
  }

  function handleResize() {
    if (state.resizeFrame) return;
    state.resizeFrame = requestAnimationFrame(() => {
      state.resizeFrame = 0;
      if (state.tier === 'full') {
        destroyPortal();
        schedulePortalMount();
      }
    });
  }

  function handleVisibility() {
    root.classList.toggle('liquid-glass-paused', document.hidden);
    if (!document.hidden) {
      schedulePortalTransform();
      window.setTimeout(monitorFrames, 250);
    }
  }

  window.addEventListener('scroll', schedulePortalTransform, { passive: true });
  window.addEventListener('resize', handleResize, { passive: true });
  window.visualViewport?.addEventListener('resize', handleResize, { passive: true });
  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('pageshow', () => {
    schedulePortalTransform();
    schedulePortalRefresh();
  }, { passive: true });
  window.addEventListener('interal:liquid-refresh', schedulePortalRefresh);

  media.reducedTransparency?.addEventListener?.('change', () => setTier(chooseInitialTier(), 'preference'));
  media.highContrast?.addEventListener?.('change', () => setTier(chooseInitialTier(), 'preference'));
  media.reducedMotion?.addEventListener?.('change', () => setTier(chooseInitialTier(), 'preference'));

  setTier(chooseInitialTier(), 'initial');
  observeLongTasks();
  window.setTimeout(monitorFrames, 1200);

  navigator.getBattery?.().then(battery => {
    const applyBatteryTier = () => {
      if (!battery.charging && battery.level <= 0.18 && tierRank(state.tier) > tierRank('lite')) {
        setTier('lite', 'low-battery');
      }
    };
    applyBatteryTier();
    battery.addEventListener?.('levelchange', applyBatteryTier);
    battery.addEventListener?.('chargingchange', applyBatteryTier);
  }).catch(() => {});
})();
