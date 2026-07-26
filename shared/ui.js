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

  if (!document.querySelector('link[data-interal-liquid-glass-css]')) {
    const liquidGlassStylesheet = document.createElement('link');
    liquidGlassStylesheet.rel = 'stylesheet';
    liquidGlassStylesheet.dataset.interalLiquidGlassCss = 'true';
    liquidGlassStylesheet.href = new URL('liquid-glass.css?v=telegram-portal-20260726-2', sharedRoot).href;
    document.head.appendChild(liquidGlassStylesheet);
  }

  if (!document.querySelector('link[data-interal-liquid-glass-tuning-css]')) {
    const liquidGlassTuningStylesheet = document.createElement('link');
    liquidGlassTuningStylesheet.rel = 'stylesheet';
    liquidGlassTuningStylesheet.dataset.interalLiquidGlassTuningCss = 'true';
    liquidGlassTuningStylesheet.href = new URL('liquid-glass-tuning.css?v=refraction-blur-20260726-2', sharedRoot).href;
    document.head.appendChild(liquidGlassTuningStylesheet);
  }

  const core = loadSource('ui-core.js?v=json-author-autosave-20260725-1');
  const coreSource = core.source.replace(
    'const currentScript = document.currentScript;',
    'const currentScript = document.querySelector(\'script[data-interal-ui-loader="true"]\');'
  );
  (0, eval)(`${coreSource}\n//# sourceURL=${core.url.href}`);

  const liquidGlass = loadSource('liquid-glass.js?v=telegram-portal-20260726-2');
  (0, eval)(`${liquidGlass.source}\n//# sourceURL=${liquidGlass.url.href}`);

  const liquidGlassIsolation = loadSource('liquid-glass-isolation.js?v=telegram-portal-20260726-2');
  (0, eval)(`${liquidGlassIsolation.source}\n//# sourceURL=${liquidGlassIsolation.url.href}`);

  const liquidGlassTuning = loadSource('liquid-glass-tuning.js?v=refraction-blur-20260726-3');
  (0, eval)(`${liquidGlassTuning.source}\n//# sourceURL=${liquidGlassTuning.url.href}`);

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
    stylesheet.href = new URL('instrumentes.css?v=20260722-3', sharedRoot).href;
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

  for (const name of ['instrumentes-nav.js', 'instrumentes-page.js?v=20260722-3']) {
    const file = loadSource(name);
    (0, eval)(`${file.source}\n//# sourceURL=${file.url.href}`);
  }
})();
