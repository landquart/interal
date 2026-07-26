(function () {
  const VERSION = 'refraction-blur-v3';
  const root = document.documentElement;
  if (!root || root.dataset.liquidGlassTuning === VERSION) return;
  root.dataset.liquidGlassTuning = VERSION;

  function extractFilterId(value) {
    const match = String(value || '').match(/url\(["']?#([^"')]+)["']?\)/);
    return match ? match[1] : '';
  }

  function tuneViewport(viewport) {
    if (!(viewport instanceof HTMLElement)) return;
    const filterId = extractFilterId(viewport.style.filter);
    if (!filterId) return;

    const filter = document.getElementById(filterId);
    if (!(filter instanceof Element) || filter.tagName.toLowerCase() !== 'filter') return;

    const displacement = filter.querySelector('feDisplacementMap');
    const blur = filter.querySelector('feGaussianBlur');

    /* Stronger edge refraction while the central area remains readable. */
    displacement?.setAttribute('scale', '82');

    /* Moderate frost: visible, but far below the old generic 20+ px blur. */
    blur?.setAttribute('stdDeviation', '1.15');

    viewport.style.filter = `url("#${filterId}") saturate(1.10) contrast(1.025)`;
    viewport.dataset.liquidTuned = VERSION;
  }

  function scan(scope) {
    if (scope instanceof Element && scope.matches('.top-nav-window .liquid-portal-viewport')) {
      tuneViewport(scope);
    }
    scope.querySelectorAll?.('.top-nav-window .liquid-portal-viewport').forEach(tuneViewport);
  }

  function tuneAfterLayout() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scan(document));
    });
  }

  function boot() {
    scan(document);
    const observer = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element) scan(node);
        }
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true
    });

    window.addEventListener('resize', tuneAfterLayout, { passive: true });
    window.addEventListener('pageshow', tuneAfterLayout, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
