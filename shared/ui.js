(function () {
  const loader = document.currentScript;
  if (!loader) return;

  loader.dataset.interalUiLoader = 'true';
  const sharedRoot = new URL('./', loader.src);
  const INITIAL_LOADER_DELAY_MS = 1000;

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

  function ensureCriticalLoaderStyles() {
    if (!document.head || document.getElementById('interal-critical-loader-style')) return;
    const style = document.createElement('style');
    style.id = 'interal-critical-loader-style';
    style.textContent = `
      .interal-page-loader {
        background: transparent !important;
        background-color: transparent !important;
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
      .interal-page-loader.is-visible:not(.is-leaving) {
        opacity: 1 !important;
        visibility: visible !important;
      }
      .interal-page-loader.is-leaving {
        opacity: 0 !important;
        visibility: hidden !important;
      }
      .interal-page-loader,
      .interal-expressive-loader,
      .interal-expressive-loader svg {
        background: transparent !important;
        background-color: transparent !important;
      }
    `;
    document.head.appendChild(style);
  }

  let expressiveLoaderSource = '';
  try {
    expressiveLoaderSource = loadSource('../elements/material3_expressive_loader.svg?v=interal-loader-20260809-2').source;
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
      svg.style.setProperty('background', 'transparent', 'important');
      svg.style.setProperty('background-color', 'transparent', 'important');
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

    ensureCriticalLoaderStyles();

    try {
      document.body.classList.toggle('dark-theme', localStorage.getItem('interal.theme') === 'dark');
    } catch (_) {}

    const pageLoader = document.createElement('div');
    pageLoader.className = 'interal-page-loader';
    pageLoader.style.setProperty('background', 'transparent', 'important');
    pageLoader.style.setProperty('background-color', 'transparent', 'important');
    pageLoader.setAttribute('role', 'status');
    pageLoader.setAttribute('aria-live', 'polite');
    let language = 'ru';
    try {
      language = localStorage.getItem('interal.lang') === 'en' ? 'en' : 'ru';
    } catch (_) {}
    pageLoader.setAttribute('aria-label', language === 'en' ? 'Loading' : 'Загрузка');
    pageLoader.append(createExpressiveLoader());
    document.body.append(pageLoader);

    const elapsedSinceNavigation = typeof performance?.now === 'function' ? performance.now() : 0;
    const revealDelay = Math.max(0, INITIAL_LOADER_DELAY_MS - elapsedSinceNavigation);
    const revealLoader = () => {
      if (!pageLoader.isConnected || pageLoader.classList.contains('is-leaving')) return;
      pageLoader.classList.add('is-visible');
    };
    const revealTimer = window.setTimeout(() => {
      if (!pageLoader.isConnected || pageLoader.classList.contains('is-leaving')) return;
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => requestAnimationFrame(revealLoader));
      } else {
        revealLoader();
      }
    }, revealDelay);

    const removeLoader = () => {
      window.clearTimeout(revealTimer);
      if (!pageLoader.isConnected || pageLoader.classList.contains('is-leaving')) return;
      pageLoader.classList.remove('is-visible');
      pageLoader.classList.add('is-leaving');
      const remove = () => pageLoader.remove();
      pageLoader.addEventListener('transitionend', remove, { once: true });
      window.setTimeout(remove, 160);
    };

    const finishWhenReady = () => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        window.clearTimeout(fallbackTimer);
        removeLoader();
      };
      const fallbackTimer = window.setTimeout(finish, 100);
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(finish);
      else finish();
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', finishWhenReady, { once: true });
    } else {
      finishWhenReady();
    }

    return pageLoader;
  }

  function initHomepageScrollReveal() {
    const body = document.body;
    if (!body?.classList.contains('homepage')) return;

    const cards = Array.from(document.querySelectorAll('.home-about-card'));
    if (!cards.length) return;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || !('IntersectionObserver' in window)) {
      cards.forEach((card) => card.classList.add('is-revealed'));
      return;
    }

    body.classList.add('home-scroll-reveal-ready');

    /* Second layer only: motion of the SVG after the existing reveal is complete. */
    const motion = cards.map(() => ({ y: 0, rotation: 0, targetY: 0, targetRotation: 0 }));
    let motionFrame = 0;
    let settleTimer = 0;
    let lastScrollY = window.scrollY || window.pageYOffset || 0;

    const runFigureMotion = () => {
      motionFrame = 0;
      let needsAnotherFrame = false;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;

      cards.forEach((card, index) => {
        if (!card.classList.contains('is-parallax-ready')) return;

        const figure = card.querySelector('.home-about-card-figure img');
        if (!figure) return;

        const rect = card.getBoundingClientRect();
        if (rect.bottom < -120 || rect.top > viewportHeight + 120) return;

        const state = motion[index];
        state.y += (state.targetY - state.y) * 0.24;
        state.rotation += (state.targetRotation - state.rotation) * 0.22;

        if (Math.abs(state.targetY - state.y) > 0.08 || Math.abs(state.targetRotation - state.rotation) > 0.01) {
          needsAnotherFrame = true;
        }

        figure.style.setProperty('--figure-parallax-y', `${state.y.toFixed(2)}px`);
        figure.style.setProperty('--figure-parallax-rotate', `${state.rotation.toFixed(3)}deg`);
      });

      if (needsAnotherFrame) motionFrame = window.requestAnimationFrame(runFigureMotion);
    };

    const requestFigureMotion = () => {
      if (!motionFrame) motionFrame = window.requestAnimationFrame(runFigureMotion);
    };

    const settleFigures = () => {
      motion.forEach((state) => {
        state.targetY = 0;
        state.targetRotation = 0;
      });
      requestFigureMotion();
    };

    const resetFiguresImmediately = () => {
      window.clearTimeout(settleTimer);
      if (motionFrame) {
        window.cancelAnimationFrame(motionFrame);
        motionFrame = 0;
      }

      cards.forEach((card, index) => {
        const state = motion[index];
        state.y = 0;
        state.rotation = 0;
        state.targetY = 0;
        state.targetRotation = 0;

        const figure = card.querySelector('.home-about-card-figure img');
        if (!figure) return;
        figure.style.setProperty('--figure-parallax-y', '0px');
        figure.style.setProperty('--figure-parallax-rotate', '0deg');
      });
    };

    const handleDirectionalScroll = () => {
      const currentScrollY = window.scrollY || window.pageYOffset || 0;
      const delta = currentScrollY - lastScrollY;
      lastScrollY = currentScrollY;

      if (delta < -0.25) {
        resetFiguresImmediately();
        return;
      }

      if (delta <= 0.25) return;

      const isMobile = window.innerWidth <= 860;
      const maxY = isMobile ? 10 : 14;
      const maxRotation = isMobile ? 0.75 : 1.05;
      const velocity = Math.min(1, Math.max(0.42, delta / 24));

      cards.forEach((card, index) => {
        if (!card.classList.contains('is-parallax-ready')) return;
        const rect = card.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
        if (rect.bottom < -80 || rect.top > viewportHeight + 80) return;

        const state = motion[index];
        const alternatingRotation = index % 2 === 0 ? -1 : 1;
        state.targetY = maxY * velocity;
        state.targetRotation = maxRotation * velocity * alternatingRotation;
      });

      requestFigureMotion();
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(settleFigures, 110);
    };

    const enableFigureParallax = (card) => {
      window.setTimeout(() => {
        if (!card.isConnected || !card.classList.contains('is-revealed')) return;
        card.classList.add('is-parallax-ready');
      }, 1400);
    };

    const revealCard = (card) => {
      if (card.classList.contains('is-revealed')) return;
      card.classList.add('is-revealed');
      enableFigureParallax(card);
    };

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        revealCard(entry.target);
        observer.unobserve(entry.target);
      }
    }, {
      threshold: 0.16,
      rootMargin: '0px 0px -8% 0px'
    });

    const immediateBoundary = window.innerHeight * 0.82;
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      if (rect.top < immediateBoundary && rect.bottom > 0) {
        revealCard(card);
      } else {
        observer.observe(card);
      }
    });

    window.addEventListener('scroll', handleDirectionalScroll, { passive: true });
  }

  mountInitialPageLoader();

  if (!document.querySelector('link[data-interal-liquid-glass-css]')) {
    const liquidGlassStylesheet = document.createElement('link');
    liquidGlassStylesheet.rel = 'stylesheet';
    liquidGlassStylesheet.dataset.interalLiquidGlassCss = 'true';
    liquidGlassStylesheet.href = new URL('liquid-glass.css?v=mobile-brand-20260804-1', sharedRoot).href;
    document.head.appendChild(liquidGlassStylesheet);
  }

  if (document.body?.classList.contains('homepage') && !document.querySelector('link[data-interal-home-scroll-reveal-css]')) {
    const homeRevealStylesheet = document.createElement('link');
    homeRevealStylesheet.rel = 'stylesheet';
    homeRevealStylesheet.dataset.interalHomeScrollRevealCss = 'true';
    homeRevealStylesheet.href = new URL('home-scroll-reveal.css?v=20260818-4', sharedRoot).href;
    document.head.appendChild(homeRevealStylesheet);
  }

  const core = loadSource('ui-core.js?v=interal-ui-20260809-3');
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
    stylesheet.href = new URL('instrumentes.css?v=instrumentes-promo-title-20260812-1', sharedRoot).href;
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

  const startHomepageReveal = () => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(initHomepageScrollReveal);
    else initHomepageScrollReveal();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startHomepageReveal, { once: true });
  } else {
    startHomepageReveal();
  }
})();
