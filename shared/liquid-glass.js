(function () {
  const root = document.documentElement;
  if (!root || root.dataset.interalLiquidGlass === 'ready-v2') return;
  root.dataset.interalLiquidGlass = 'ready-v2';

  const supportsBackdrop = typeof CSS !== 'undefined'
    && (CSS.supports('backdrop-filter', 'saturate(120%)')
      || CSS.supports('-webkit-backdrop-filter', 'saturate(120%)'));

  root.classList.remove('liquid-glass-enhanced', 'liquid-glass-lite');
  root.classList.add(supportsBackdrop ? 'liquid-glass-refractive' : 'liquid-glass-solid');

  function createLayer(className) {
    const layer = document.createElement('span');
    layer.className = className;
    layer.setAttribute('aria-hidden', 'true');
    return layer;
  }

  function decorateGlass(element) {
    if (!(element instanceof Element) || element.dataset.liquidGlassDecorated === 'true') return;
    element.dataset.liquidGlassDecorated = 'true';

    const base = createLayer('liquid-glass-base');
    const refraction = createLayer('liquid-refraction');

    for (const name of ['outer', 'middle', 'inner']) {
      refraction.appendChild(createLayer(`liquid-refraction-band liquid-refraction-band--${name}`));
    }

    element.prepend(refraction);
    element.prepend(base);
  }

  function scan(scope) {
    if (!(scope instanceof Element || scope instanceof Document)) return;
    if (scope instanceof Element && scope.matches('.top-nav-window')) decorateGlass(scope);
    scope.querySelectorAll?.('.top-nav-window').forEach(decorateGlass);
  }

  scan(document);

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element) scan(node);
      }
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
