(function () {
  const VERSION = 'telegram-portal-v1';
  const root = document.documentElement;
  if (!root || root.dataset.interalLiquidGlass === VERSION) return;
  root.dataset.interalLiquidGlass = VERSION;
  root.classList.remove('liquid-glass-enhanced', 'liquid-glass-lite', 'liquid-glass-refractive', 'liquid-glass-solid');

  const supportsSvgFilters = typeof SVGFEImageElement !== 'undefined'
    && typeof Path2D !== 'undefined'
    && typeof HTMLCanvasElement !== 'undefined';

  root.classList.add(supportsSvgFilters ? 'liquid-glass-portal' : 'liquid-glass-fallback');

  const EXCLUDED_SELECTORS = [
    '.top-nav',
    '.side-menu',
    '.side-menu-overlay',
    '.menu-lang-modal',
    '[data-liquid-portal-host]',
    '#interal-liquid-glass-defs',
    '.liquid-filter-defs',
    'script',
    'noscript'
  ].join(',');

  let portalSequence = 0;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function roundedRectPath(ctx, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function createNormalMap({ width, height, radius, depth, pathData = '' }) {
    const scale = Math.min(1, 640 / Math.max(1, width));
    const mapWidth = Math.max(16, Math.round(width * scale));
    const mapHeight = Math.max(8, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = mapWidth;
    canvas.height = mapHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.clearRect(0, 0, mapWidth, mapHeight);
    ctx.fillStyle = '#fff';
    ctx.save();
    ctx.scale(scale, scale);
    try {
      if (pathData) {
        ctx.fill(new Path2D(pathData));
      } else {
        roundedRectPath(ctx, 0, 0, width, height, radius);
        ctx.fill();
      }
    } catch (_) {
      roundedRectPath(ctx, 0, 0, width, height, radius);
      ctx.fill();
    }
    ctx.restore();

    const image = ctx.getImageData(0, 0, mapWidth, mapHeight);
    const count = mapWidth * mapHeight;
    const inside = new Uint8Array(count);
    const distance = new Float32Array(count);
    const infinity = 1e6;

    for (let index = 0; index < count; index += 1) {
      inside[index] = image.data[index * 4 + 3] > 96 ? 1 : 0;
      distance[index] = inside[index] ? infinity : 0;
    }

    const diagonal = Math.SQRT2;
    for (let y = 0; y < mapHeight; y += 1) {
      for (let x = 0; x < mapWidth; x += 1) {
        const index = y * mapWidth + x;
        if (!inside[index]) continue;
        let best = distance[index];
        if (x > 0) best = Math.min(best, distance[index - 1] + 1);
        if (y > 0) best = Math.min(best, distance[index - mapWidth] + 1);
        if (x > 0 && y > 0) best = Math.min(best, distance[index - mapWidth - 1] + diagonal);
        if (x + 1 < mapWidth && y > 0) best = Math.min(best, distance[index - mapWidth + 1] + diagonal);
        distance[index] = best;
      }
    }

    for (let y = mapHeight - 1; y >= 0; y -= 1) {
      for (let x = mapWidth - 1; x >= 0; x -= 1) {
        const index = y * mapWidth + x;
        if (!inside[index]) continue;
        let best = distance[index];
        if (x + 1 < mapWidth) best = Math.min(best, distance[index + 1] + 1);
        if (y + 1 < mapHeight) best = Math.min(best, distance[index + mapWidth] + 1);
        if (x + 1 < mapWidth && y + 1 < mapHeight) best = Math.min(best, distance[index + mapWidth + 1] + diagonal);
        if (x > 0 && y + 1 < mapHeight) best = Math.min(best, distance[index + mapWidth - 1] + diagonal);
        distance[index] = best;
      }
    }

    const output = ctx.createImageData(mapWidth, mapHeight);
    const depthInMap = Math.max(1, depth * scale);
    const sample = (x, y) => distance[clamp(y, 0, mapHeight - 1) * mapWidth + clamp(x, 0, mapWidth - 1)];

    for (let y = 0; y < mapHeight; y += 1) {
      for (let x = 0; x < mapWidth; x += 1) {
        const index = y * mapWidth + x;
        const pixel = index * 4;
        let red = 128;
        let green = 128;

        if (inside[index] && distance[index] <= depthInMap) {
          const gradientX = sample(x + 1, y) - sample(x - 1, y);
          const gradientY = sample(x, y + 1) - sample(x, y - 1);
          const length = Math.hypot(gradientX, gradientY) || 1;
          const outwardX = -gradientX / length;
          const outwardY = -gradientY / length;
          const t = distance[index] / depthInMap;
          const effect = (1 - t) * (1 - t);
          red = Math.round(clamp(128 - outwardX * effect * 127, 0, 255));
          green = Math.round(clamp(128 - outwardY * effect * 127, 0, 255));
        }

        output.data[pixel] = red;
        output.data[pixel + 1] = green;
        output.data[pixel + 2] = 128;
        output.data[pixel + 3] = 255;
      }
    }

    ctx.putImageData(output, 0, 0);
    return canvas.toDataURL('image/png');
  }

  function createSvgElement(name) {
    return document.createElementNS('http://www.w3.org/2000/svg', name);
  }

  function createFilterDefinitions(id) {
    const svg = createSvgElement('svg');
    svg.classList.add('liquid-filter-defs');
    svg.id = `${id}-defs`;
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'fixed';
    svg.style.width = '0';
    svg.style.height = '0';
    svg.style.pointerEvents = 'none';

    const defs = createSvgElement('defs');
    const filter = createSvgElement('filter');
    filter.id = id;
    filter.setAttribute('filterUnits', 'userSpaceOnUse');
    filter.setAttribute('primitiveUnits', 'userSpaceOnUse');
    filter.setAttribute('color-interpolation-filters', 'sRGB');

    const map = createSvgElement('feImage');
    map.setAttribute('preserveAspectRatio', 'none');
    map.setAttribute('result', 'liquidMap');

    const displacement = createSvgElement('feDisplacementMap');
    displacement.setAttribute('in', 'SourceGraphic');
    displacement.setAttribute('in2', 'liquidMap');
    displacement.setAttribute('xChannelSelector', 'R');
    displacement.setAttribute('yChannelSelector', 'G');
    displacement.setAttribute('result', 'refracted');

    const soften = createSvgElement('feGaussianBlur');
    soften.setAttribute('in', 'refracted');
    soften.setAttribute('stdDeviation', '0.12');

    filter.append(map, displacement, soften);
    defs.appendChild(filter);
    svg.appendChild(defs);
    document.body.appendChild(svg);

    return { svg, filter, map, displacement };
  }

  function copyLiveFormState(source, clone) {
    const sourceControls = Array.from(source.querySelectorAll('input, textarea, select, progress, meter'))
      .filter(element => !element.closest('[data-liquid-portal-host]'));
    const cloneControls = clone.querySelectorAll('input, textarea, select, progress, meter');
    const count = Math.min(sourceControls.length, cloneControls.length);
    for (let index = 0; index < count; index += 1) {
      const original = sourceControls[index];
      const duplicate = cloneControls[index];
      if ('value' in original && 'value' in duplicate) duplicate.value = original.value;
      if ('checked' in original && 'checked' in duplicate) duplicate.checked = original.checked;
      if ('selectedIndex' in original && 'selectedIndex' in duplicate) duplicate.selectedIndex = original.selectedIndex;
    }

    const sourceCanvas = Array.from(source.querySelectorAll('canvas'))
      .filter(element => !element.closest('[data-liquid-portal-host]'));
    const cloneCanvas = clone.querySelectorAll('canvas');
    for (let index = 0; index < Math.min(sourceCanvas.length, cloneCanvas.length); index += 1) {
      const original = sourceCanvas[index];
      const duplicate = cloneCanvas[index];
      duplicate.width = original.width;
      duplicate.height = original.height;
      try {
        duplicate.getContext('2d')?.drawImage(original, 0, 0);
      } catch (_) {
        // Cross-origin canvases remain blank in the portal copy.
      }
    }
  }

  class LiquidPortal {
    constructor(target, options) {
      this.target = target;
      this.options = options;
      this.id = `interal-liquid-filter-${++portalSequence}`;
      this.viewport = null;
      this.copy = null;
      this.filterParts = null;
      this.refreshFrame = 0;
      this.transformFrame = 0;
      this.lastWidth = 0;
      this.lastHeight = 0;
      this.lastPath = '';
      this.sourceObserver = null;
      this.sizeObserver = null;
    }

    mount() {
      if (this.target.dataset.liquidPortalMounted === VERSION) return;
      this.target.dataset.liquidPortalMounted = VERSION;
      this.target.dataset.liquidPortalHost = 'true';

      this.viewport = document.createElement('span');
      this.viewport.className = 'liquid-portal-viewport';
      this.viewport.setAttribute('aria-hidden', 'true');
      this.viewport.setAttribute('inert', '');
      this.target.prepend(this.viewport);

      if (supportsSvgFilters) {
        this.filterParts = createFilterDefinitions(this.id);
        this.viewport.style.filter = `url("#${this.id}")`;
      }

      this.refreshMirror();
      this.updateGeometry(true);

      const scheduleTransform = () => this.scheduleTransform();
      window.addEventListener('scroll', scheduleTransform, { passive: true });
      window.addEventListener('resize', () => {
        this.scheduleTransform();
        this.scheduleGeometry();
      }, { passive: true });
      window.visualViewport?.addEventListener('resize', scheduleTransform, { passive: true });
      window.visualViewport?.addEventListener('scroll', scheduleTransform, { passive: true });

      this.sourceObserver = new MutationObserver(records => {
        const relevant = records.some(record => {
          const element = record.target instanceof Element ? record.target : record.target.parentElement;
          return !element?.closest?.('[data-liquid-portal-host]') && !element?.closest?.('.liquid-filter-defs');
        });
        if (relevant) this.scheduleRefresh();
      });
      this.sourceObserver.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'src', 'hidden', 'open', 'value', 'checked']
      });

      if ('ResizeObserver' in window) {
        this.sizeObserver = new ResizeObserver(() => this.scheduleGeometry());
        this.sizeObserver.observe(this.target);
      }
    }

    scheduleRefresh() {
      if (this.refreshFrame) return;
      this.refreshFrame = requestAnimationFrame(() => {
        this.refreshFrame = 0;
        this.refreshMirror();
        this.updateGeometry(false);
      });
    }

    scheduleTransform() {
      if (this.transformFrame) return;
      this.transformFrame = requestAnimationFrame(() => {
        this.transformFrame = 0;
        this.updateTransform();
      });
    }

    scheduleGeometry() {
      requestAnimationFrame(() => this.updateGeometry(false));
    }

    refreshMirror() {
      if (!this.viewport) return;
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll(EXCLUDED_SELECTORS).forEach(node => node.remove());
      clone.classList.add('liquid-portal-copy');
      clone.removeAttribute('id');
      clone.setAttribute('aria-hidden', 'true');
      clone.setAttribute('inert', '');
      clone.style.position = 'absolute';
      clone.style.left = '0';
      clone.style.top = '0';
      clone.style.margin = '0';
      clone.style.pointerEvents = 'none';
      clone.style.transition = 'none';
      clone.style.animation = 'none';
      clone.style.transformOrigin = '0 0';
      clone.style.width = `${document.documentElement.clientWidth}px`;
      clone.style.minHeight = `${Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, window.innerHeight)}px`;
      copyLiveFormState(document.body, clone);

      this.copy?.remove();
      this.copy = clone;
      this.viewport.appendChild(clone);
      this.updateTransform();
    }

    updateTransform() {
      if (!this.copy || !this.target.isConnected) return;
      const rect = this.target.getBoundingClientRect();
      const x = -(rect.left + window.scrollX);
      const y = -(rect.top + window.scrollY);
      this.copy.style.width = `${document.documentElement.clientWidth}px`;
      this.copy.style.minHeight = `${Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, window.innerHeight)}px`;
      this.copy.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }

    updateGeometry(force) {
      if (!supportsSvgFilters || !this.filterParts || !this.target.isConnected) return;
      const rect = this.target.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const pathData = this.target.dataset.liquidShapePath || '';
      if (!force && width === this.lastWidth && height === this.lastHeight && pathData === this.lastPath) return;

      this.lastWidth = width;
      this.lastHeight = height;
      this.lastPath = pathData;

      const computed = getComputedStyle(this.target);
      const radius = Number.parseFloat(computed.borderTopLeftRadius) || height / 2;
      const mapUrl = createNormalMap({
        width,
        height,
        radius,
        depth: this.options.depth,
        pathData
      });
      if (!mapUrl) return;

      const { filter, map, displacement } = this.filterParts;
      filter.setAttribute('x', '0');
      filter.setAttribute('y', '0');
      filter.setAttribute('width', String(width));
      filter.setAttribute('height', String(height));
      map.setAttribute('x', '0');
      map.setAttribute('y', '0');
      map.setAttribute('width', String(width));
      map.setAttribute('height', String(height));
      map.setAttribute('href', mapUrl);
      map.setAttributeNS('http://www.w3.org/1999/xlink', 'href', mapUrl);
      displacement.setAttribute('scale', String(this.options.refraction * 2));
      this.updateTransform();
    }
  }

  function boot() {
    document.querySelectorAll('.top-nav-window').forEach(target => {
      new LiquidPortal(target, { refraction: 26, depth: 10 }).mount();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
