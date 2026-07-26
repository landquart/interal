(function () {
  const VERSION = 'telegram-portal-shadow-v2';
  const root = document.documentElement;
  if (!root || root.dataset.liquidGlassIsolation === VERSION) return;
  root.dataset.liquidGlassIsolation = VERSION;

  function copyDocumentStyles(shadowRoot) {
    document.querySelectorAll('link[rel="stylesheet"], style').forEach(source => {
      const clone = source.cloneNode(true);
      if (clone instanceof HTMLLinkElement) {
        clone.href = source.href;
        clone.removeAttribute('id');
      }
      shadowRoot.appendChild(clone);
    });

    const safetyStyle = document.createElement('style');
    safetyStyle.textContent = `
      *, *::before, *::after {
        pointer-events: none !important;
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `;
    shadowRoot.appendChild(safetyStyle);
  }

  function ensureIsolated(viewport) {
    if (!(viewport instanceof HTMLElement)) return;

    let host = viewport.querySelector(':scope > .liquid-portal-shadow-host');
    if (!host) {
      host = document.createElement('span');
      host.className = 'liquid-portal-shadow-host';
      host.setAttribute('aria-hidden', 'true');
      host.setAttribute('inert', '');
      Object.assign(host.style, {
        position: 'absolute',
        inset: '0',
        display: 'block',
        overflow: 'visible',
        pointerEvents: 'none'
      });
      const shadowRoot = host.attachShadow({ mode: 'open' });
      copyDocumentStyles(shadowRoot);
      viewport.appendChild(host);
    }

    const copy = viewport.querySelector(':scope > .liquid-portal-copy');
    if (!copy || !host.shadowRoot) return;

    copy.querySelectorAll('[id]').forEach(element => {
      element.dataset.liquidSourceId = element.id;
      element.removeAttribute('id');
    });
    Object.assign(copy.style, {
      maxWidth: 'none',
      overflow: 'visible',
      userSelect: 'none',
      contain: 'layout style paint'
    });
    host.shadowRoot.appendChild(copy);
  }

  document.querySelectorAll('.liquid-portal-viewport').forEach(ensureIsolated);

  const observer = new MutationObserver(records => {
    for (const record of records) {
      const parentViewport = record.target instanceof Element
        ? record.target.closest('.liquid-portal-viewport')
        : null;
      if (parentViewport) ensureIsolated(parentViewport);

      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches('.liquid-portal-viewport')) ensureIsolated(node);
        node.querySelectorAll?.('.liquid-portal-viewport').forEach(ensureIsolated);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
