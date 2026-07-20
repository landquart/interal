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

  const core = loadSource('ui-core.js');
  const coreSource = core.source.replace(
    'const currentScript = document.currentScript;',
    'const currentScript = document.querySelector(\'script[data-interal-ui-loader="true"]\');'
  );
  (0, eval)(`${coreSource}\n//# sourceURL=${core.url.href}`);

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('instrumentes.css?v=20260720-6', sharedRoot).href;
  document.head.appendChild(stylesheet);

  const siteRoot = new URL('../', loader.src);
  window.InteralInstrumentes = {
    joinUrl(path) {
      return new URL(path.replace(/^\//, ''), siteRoot).pathname;
    },
    getLang() {
      return localStorage.getItem('interal.lang') === 'en' ? 'en' : 'ru';
    }
  };

  for (const name of ['instrumentes-nav.js', 'instrumentes-page.js']) {
    const file = loadSource(name);
    (0, eval)(`${file.source}\n//# sourceURL=${file.url.href}`);
  }
})();
