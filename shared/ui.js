(function () {
  const loader = document.currentScript;
  if (!loader) return;

  loader.dataset.interalUiLoader = 'true';
  const sharedRoot = new URL('./', loader.src);

  function loadSource(name) {
    const url = new URL(name, sharedRoot);
    const request = new XMLHttpRequest();
    request.open('GET', url.href, false);
    request.send(null);
    if (request.status < 200 || request.status >= 300) {
      throw new Error(`Could not load ${name}: ${request.status}`);
    }
    return { source: request.responseText, url };
  }

  let expressiveLoaderSource = '';
  try {
    expressiveLoaderSource = loadSource('../elements/material3_expressive_loader.svg').source;
  } catch (error) {
    console.warn('Could not load the expressive loading indicator.', error);
  }

  function createExpressiveLoader(options = {}) {
    const visual = document.createElement('span');
    visual.className = ['interal-expressive-loader', options.className || ''].filter(Boolean).join(' ');
    if (!expressiveLoaderSource) return visual;

    visual.innerHTML = expressiveLoaderSource.trim();
    const svg = visual.querySelector('svg');
    if (svg) {
      svg.removeAttribute?.('role');
      svg.removeAttribute?.('aria-label');
      svg.setAttribute?.('aria-hidden', 'true');
      svg.setAttribute?.('focusable', 'false');
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        svg.querySelectorAll?.('animate, animateTransform').forEach((node) => node.remove());
      }
    }
    return visual;
  }

  window.InteralExpressiveLoader = Object.assign(window.InteralExpressiveLoader || {}, {
    create: createExpressiveLoader
  });

  function mountInitialPageLoader() {
    if (!expressiveLoaderSource || !document.body) return null;

    try {
      document.body.classList.toggle('dark-theme', localStorage.getItem('interal.theme') === 'dark');
    } catch (_) {}

    const pageLoader = document.createElement('div');
    pageLoader.className = 'interal-page-loader';
    pageLoader.setAttribute('role', 'status');
    pageLoader.setAttribute('aria-live', 'polite');
    let language = 'ru';
    try {
      language = localStorage.getItem('interal.lang') === 'en' ? 'en' : 'ru';
    } catch (_) {}
    pageLoader.setAttribute('aria-label', language === 'en' ? 'Loading' : 'Загрузка');
    pageLoader.append(createExpressiveLoader());
    document.body.append(pageLoader);

    const removeLoader = () => {
      if (!pageLoader.isConnected || pageLoader.classList.contains('is-leaving')) return;
      pageLoader.classList.add('is-leaving');
      const remove = () => pageLoader.remove();
      pageLoader.addEventListener('transitionend', remove, { once: true });
      window.setTimeout(remove, 240);
    };

    const finishWhenReady = () => requestAnimationFrame(() => requestAnimationFrame(removeLoader));
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', finishWhenReady, { once: true });
    } else {
      finishWhenReady();
    }

    return pageLoader;
  }

  mountInitialPageLoader();

  if (!document.querySelector('link[data-interal-liquid-glass-css]')) {
    const liquidGlassStylesheet = document.createElement('link');
    liquidGlassStylesheet.rel = 'stylesheet';
    liquidGlassStylesheet.dataset.interalLiquidGlassCss = 'true';
    liquidGlassStylesheet.href = new URL('liquid-glass.css?v=mobile-brand-20260804-1', sharedRoot).href;
    document.head.appendChild(liquidGlassStylesheet);
  }

  const core = loadSource('ui-core.js?v=ayu-material-20260804-1');
  const coreSource = core.source.replace(
    'const currentScript = document.currentScript;',
    'const currentScript = document.querySelector(\'script[data-interal-ui-loader="true"]\');'
  );
  (0, eval)(`${coreSource}\n//# sourceURL=${core.url.href}`);

  const liquidGlass = loadSource('liquid-glass.js?v=ayu-material-20260804-1');
  (0, eval)(`${liquidGlass.source}\n//# sourceURL=${liquidGlass.url.href}`);

  const authorAutosave = loadSource('json-author-autosave.js?v=json-author-autosave-20260725-1');
  (0, eval)(`${authorAutosave.source}\n//# sourceURL=${authorAutosave.url.href}`);

  if (/\/registre\/?$/.test(window.location.pathname)) {
    const registryFields = loadSource('registry-altervordes-fields.js?v=20260725-1');
    (0, eval)(`${registryFields.source}\n//# sourceURL=${registryFields.url.href}`);
  }

  if (!document.querySelector('link[data-interal-instrumentes-css]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.dataset.interalInstrumentesCss = 'true';
    stylesheet.href = new URL('instrumentes.css?v=instrumentes-ready-20260806-1', sharedRoot).href;
    document.head.appendChild(stylesheet);
  }

  const siteRoot = new URL('../', loader.src);
  window.InteralInstrumentes = {
    joinUrl(path) {
      return new URL(path.replace(/^\//, ''), siteRoot).pathname;
    },
    getLang() {
      return localStorage.getItem('interal.lang') === 'en' ? 'en' : 'ru';
    }
  };

  for (const name of ['instrumentes-nav.js', 'instrumentes-page.js?v=lexeme-goal-20260804-1']) {
    const file = loadSource(name);
    (0, eval)(`${file.source}\n//# sourceURL=${file.url.href}`);
  }

  if (document.body?.classList.contains('instrumentes-page')) {
    document.body.classList.remove('instrumentes-pending');
  }
})();
