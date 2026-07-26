(function () {
  const root = document.documentElement;
  if (!root || root.dataset.interalLiquidGlass === 'ready-v3') return;
  root.dataset.interalLiquidGlass = 'ready-v3';

  const supportsBackdrop = typeof CSS !== 'undefined'
    && (CSS.supports('backdrop-filter', 'saturate(120%)')
      || CSS.supports('-webkit-backdrop-filter', 'saturate(120%)'));

  root.classList.remove(
    'liquid-glass-enhanced',
    'liquid-glass-lite',
    'liquid-glass-refractive',
    'liquid-glass-solid'
  );
  root.classList.add(supportsBackdrop ? 'liquid-glass-refractive' : 'liquid-glass-solid');

  function ensureFilterDefinitions() {
    if (!supportsBackdrop || document.getElementById('interal-liquid-glass-defs')) return;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'interal-liquid-glass-defs';
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.style.position = 'fixed';
    svg.style.width = '0';
    svg.style.height = '0';
    svg.style.pointerEvents = 'none';
    svg.style.overflow = 'hidden';

    svg.innerHTML = `
      <defs>
        <filter id="interal-edge-refraction" x="-14%" y="-45%" width="128%" height="190%" color-interpolation-filters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="5.5" result="softAlpha" />
          <feFlood flood-color="#ffffff" result="white" />
          <feComposite in="white" in2="softAlpha" operator="in" result="alphaRgb" />
          <feConvolveMatrix in="alphaRgb" order="3" kernelMatrix="-1 0 1 -2 0 2 -1 0 1" divisor="2" bias="0.5" edgeMode="duplicate" preserveAlpha="false" result="dx" />
          <feConvolveMatrix in="alphaRgb" order="3" kernelMatrix="-1 -2 -1 0 0 0 1 2 1" divisor="2" bias="0.5" edgeMode="duplicate" preserveAlpha="false" result="dy" />
          <feColorMatrix in="dx" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0 1" result="xChannel" />
          <feColorMatrix in="dy" type="matrix" values="0 0 0 0 0  1 0 0 0 0  0 0 0 0 0  0 0 0 0 0" result="yChannel" />
          <feComposite in="xChannel" in2="yChannel" operator="arithmetic" k2="1" k3="1" result="normalMap" />
          <feDisplacementMap in="SourceGraphic" in2="normalMap" scale="12" xChannelSelector="R" yChannelSelector="G" result="displaced" />
          <feGaussianBlur in="displaced" stdDeviation="0.08" />
        </filter>
      </defs>
    `;

    document.body.appendChild(svg);
  }

  function createLayer(className) {
    const layer = document.createElement('span');
    layer.className = className;
    layer.setAttribute('aria-hidden', 'true');
    return layer;
  }

  function decorateGlass(element) {
    if (!(element instanceof Element) || element.dataset.liquidGlassDecorated === 'v3') return;
    element.querySelectorAll(':scope > .liquid-glass-base, :scope > .liquid-refraction').forEach(node => node.remove());
    element.dataset.liquidGlassDecorated = 'v3';
    element.prepend(createLayer('liquid-refraction-surface'));
    element.prepend(createLayer('liquid-glass-base'));
  }

  function scan(scope) {
    if (!(scope instanceof Element || scope instanceof Document)) return;
    if (scope instanceof Element && scope.matches('.top-nav-window')) decorateGlass(scope);
    scope.querySelectorAll?.('.top-nav-window').forEach(decorateGlass);
  }

  ensureFilterDefinitions();
  scan(document);

  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element) scan(node);
      }
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
