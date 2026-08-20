(function () {
  const PAGE_TRANSITION_KEY = 'interal.page-transition.pending';
  const PAGE_TRANSITION_DURATION_MS = 480;

  function prefersReducedMotion() {
    return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  }

  function ensurePageTransitionStyles() {
    if (!document.head || document.getElementById('interal-page-transition-style')) return;

    const style = document.createElement('style');
    style.id = 'interal-page-transition-style';
    style.textContent = `
      .interal-page-transition {
        position: fixed;
        inset: -1px;
        z-index: 2147483000;
        background: #F4D84B;
        transform: translate3d(0, 101%, 0);
        transform-origin: center;
        pointer-events: none;
        visibility: visible;
        transition: transform ${PAGE_TRANSITION_DURATION_MS}ms cubic-bezier(.76, 0, .24, 1);
        will-change: transform;
      }

      .interal-page-transition.is-covering {
        transform: translate3d(0, 0, 0);
        pointer-events: auto;
      }

      .interal-page-transition.is-revealing {
        transform: translate3d(0, -101%, 0);
      }

      .interal-page-transition.is-resetting {
        transition: none !important;
      }

      @media (prefers-reduced-motion: reduce) {
        .interal-page-transition {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function initPageTransitions() {
    if (!document.body || prefersReducedMotion()) return;

    ensurePageTransitionStyles();

    const overlay = document.createElement('div');
    overlay.className = 'interal-page-transition';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);

    const resetHiddenPosition = () => {
      overlay.classList.add('is-resetting');
      overlay.classList.remove('is-covering', 'is-revealing');
      void overlay.offsetWidth;
      overlay.classList.remove('is-resetting');
    };

    let shouldRevealOnEntry = false;
    try {
      shouldRevealOnEntry = sessionStorage.getItem(PAGE_TRANSITION_KEY) === '1';
      sessionStorage.removeItem(PAGE_TRANSITION_KEY);
    } catch (_) {}

    if (shouldRevealOnEntry) {
      overlay.classList.add('is-covering');
      const reveal = () => {
        overlay.classList.remove('is-covering');
        overlay.classList.add('is-revealing');
      };
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => requestAnimationFrame(reveal));
      } else {
        reveal();
      }
      overlay.addEventListener('transitionend', resetHiddenPosition, { once: true });
      window.setTimeout(resetHiddenPosition, PAGE_TRANSITION_DURATION_MS + 120);
    }

    const isEligibleInternalLink = (anchor, event) => {
      if (!anchor || event.defaultPrevented) return false;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
      if (anchor.hasAttribute('download')) return false;
      if (anchor.matches('[data-no-page-transition], [data-interal-no-transition]')) return false;
      const target = anchor.getAttribute('target');
      if (target && target.toLowerCase() !== '_self') return false;

      let url;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch (_) {
        return false;
      }

      if (!/^https?:$/.test(url.protocol) || url.origin !== window.location.origin) return false;

      const current = new URL(window.location.href);
      const sameDocument =
        url.pathname === current.pathname &&
        url.search === current.search;

      if (sameDocument && (url.hash || current.hash)) return false;
      if (url.href === current.href) return false;

      return true;
    };

    document.addEventListener('click', (event) => {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!isEligibleInternalLink(anchor, event)) return;

      event.preventDefault();
      resetHiddenPosition();

      let destination;
      try {
        destination = new URL(anchor.href, window.location.href).href;
      } catch (_) {
        return;
      }

      try {
        sessionStorage.setItem(PAGE_TRANSITION_KEY, '1');
      } catch (_) {}

      let navigated = false;
      const navigate = () => {
        if (navigated) return;
        navigated = true;
        window.location.assign(destination);
      };

      const handleCovered = (transitionEvent) => {
        if (transitionEvent.target !== overlay || transitionEvent.propertyName !== 'transform') return;
        navigate();
      };

      overlay.addEventListener('transitionend', handleCovered, { once: true });
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => overlay.classList.add('is-covering'));
      } else {
        overlay.classList.add('is-covering');
      }
      window.setTimeout(navigate, PAGE_TRANSITION_DURATION_MS + 140);
    });

    window.addEventListener('pageshow', (event) => {
      if (event.persisted) resetHiddenPosition();
    });
  }

  function ensureHomepageEditorialStyles() {
    if (!document.head || document.getElementById('interal-home-editorial-motion-style')) return;

    const style = document.createElement('style');
    style.id = 'interal-home-editorial-motion-style';
    style.textContent = `
      body.homepage.home-editorial-motion-ready .hero-copy {
        transform: translate3d(0, var(--hero-copy-y, 0px), 0);
        opacity: var(--hero-content-opacity, 1);
        will-change: transform, opacity;
      }

      body.homepage.home-editorial-motion-ready .hero-logo {
        transform:
          translate3d(0, var(--hero-logo-y, 0px), 0)
          scale(var(--hero-logo-scale, 1));
        opacity: var(--hero-content-opacity, 1);
        transform-origin: center;
        will-change: transform, opacity;
      }

      body.homepage.home-editorial-motion-ready .home-intro {
        --yellow-plane-scale: .86;
        --yellow-plane-y: 44px;
        --yellow-plane-opacity: .34;
        --yellow-quote-y: 30px;
        --yellow-copy-y: 42px;
        position: relative;
        left: 50%;
        width: 100dvw;
        margin-left: -50dvw;
        min-height: clamp(620px, 88svh, 900px);
        padding:
          clamp(58px, 7vw, 104px)
          max(24px, calc((100dvw - 1240px) / 2 + 24px));
        isolation: isolate;
        overflow: hidden;
        align-items: center;
        color: #171714;
      }

      body.homepage.home-editorial-motion-ready .home-intro::before {
        content: "";
        position: absolute;
        inset: 0;
        z-index: 0;
        background: #F4D84B;
        opacity: var(--yellow-plane-opacity);
        transform:
          translate3d(0, var(--yellow-plane-y), 0)
          scaleY(var(--yellow-plane-scale));
        transform-origin: center bottom;
        will-change: transform, opacity;
      }

      body.homepage.home-editorial-motion-ready .home-intro-quotes,
      body.homepage.home-editorial-motion-ready .home-intro-description {
        position: relative;
        z-index: 1;
        will-change: transform;
      }

      body.homepage.home-editorial-motion-ready .home-intro-quotes {
        transform: translate3d(0, var(--yellow-quote-y), 0);
      }

      body.homepage.home-editorial-motion-ready .home-intro-description {
        transform: translate3d(0, var(--yellow-copy-y), 0);
      }

      body.homepage.home-editorial-motion-ready .home-intro .home-quote,
      body.homepage.home-editorial-motion-ready .home-intro .home-intro-description,
      body.homepage.dark-theme.home-editorial-motion-ready .home-intro .home-quote,
      body.homepage.dark-theme.home-editorial-motion-ready .home-intro .home-intro-description {
        color: #171714;
      }

      body.homepage.home-editorial-motion-ready .home-about-title,
      body.homepage.home-editorial-motion-ready .home-section-title,
      body.homepage.home-editorial-motion-ready .home-footer {
        opacity: 1;
        transform: translate3d(0, 0, 0);
        transition:
          opacity 680ms cubic-bezier(.22, 1, .36, 1) var(--editorial-delay, 0ms),
          transform 820ms cubic-bezier(.22, 1, .36, 1) var(--editorial-delay, 0ms);
      }

      body.homepage.home-editorial-motion-ready .home-section .tool-link {
        opacity: 1;
        transform: translate3d(0, 0, 0);
        transition:
          opacity 650ms cubic-bezier(.22, 1, .36, 1) var(--editorial-delay, 0ms),
          transform 780ms cubic-bezier(.22, 1, .36, 1) var(--editorial-delay, 0ms),
          background-color .18s ease,
          border-color .18s ease,
          box-shadow .18s ease;
      }

      body.homepage.home-editorial-motion-ready .home-about-title:not(.is-editorial-revealed),
      body.homepage.home-editorial-motion-ready .home-section-title:not(.is-editorial-revealed),
      body.homepage.home-editorial-motion-ready .home-section .tool-link:not(.is-editorial-revealed),
      body.homepage.home-editorial-motion-ready .home-footer:not(.is-editorial-revealed) {
        opacity: 0;
        transform: translate3d(0, 34px, 0);
      }

      body.homepage.home-editorial-motion-ready .home-section-title::after {
        transform: scaleX(1);
        transform-origin: left center;
        transition: transform 700ms cubic-bezier(.22, 1, .36, 1) 120ms;
      }

      body.homepage.home-editorial-motion-ready .home-section-title:not(.is-editorial-revealed)::after {
        transform: scaleX(0);
      }

      @media (max-width: 860px) {
        body.homepage.home-editorial-motion-ready .home-intro {
          width: 100dvw;
          margin-left: -50dvw;
          min-height: 0;
          padding: 52px 24px 60px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        body.homepage.home-editorial-motion-ready .hero-copy,
        body.homepage.home-editorial-motion-ready .hero-logo,
        body.homepage.home-editorial-motion-ready .home-intro-quotes,
        body.homepage.home-editorial-motion-ready .home-intro-description,
        body.homepage.home-editorial-motion-ready .home-about-title,
        body.homepage.home-editorial-motion-ready .home-section-title,
        body.homepage.home-editorial-motion-ready .home-section .tool-link,
        body.homepage.home-editorial-motion-ready .home-footer {
          opacity: 1 !important;
          transform: none !important;
          transition: none !important;
          will-change: auto !important;
        }

        body.homepage.home-editorial-motion-ready .home-intro::before {
          opacity: 1 !important;
          transform: none !important;
          will-change: auto !important;
        }

        body.homepage.home-editorial-motion-ready .home-section-title::after {
          transform: scaleX(1) !important;
          transition: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function initHomepageEditorialMotion() {
    const body = document.body;
    if (!body?.classList.contains('homepage')) return;

    ensureHomepageEditorialStyles();

    const intro = document.querySelector('.home-intro');
    const heroStage = document.querySelector('.hero-stage');
    const revealTargets = Array.from(document.querySelectorAll(
      '.home-about-title, .home-section-title, .home-section .tool-link, .home-footer'
    ));

    body.classList.add('home-editorial-motion-ready');

    revealTargets.forEach((target, index) => {
      if (target.classList.contains('tool-link')) {
        target.style.setProperty('--editorial-delay', `${(index % 3) * 70}ms`);
      }
    });

    if (prefersReducedMotion()) {
      revealTargets.forEach((target) => target.classList.add('is-editorial-revealed'));
      return;
    }

    if ('IntersectionObserver' in window) {
      const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-editorial-revealed');
          revealObserver.unobserve(entry.target);
        });
      }, {
        threshold: 0.12,
        rootMargin: '0px 0px -8% 0px'
      });

      const immediateBoundary = (window.innerHeight || 1) * 0.9;
      revealTargets.forEach((target) => {
        const rect = target.getBoundingClientRect();
        if (rect.top < immediateBoundary && rect.bottom > 0) {
          target.classList.add('is-editorial-revealed');
        } else {
          revealObserver.observe(target);
        }
      });
    } else {
      revealTargets.forEach((target) => target.classList.add('is-editorial-revealed'));
    }

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    let sceneFrame = 0;

    const updateScenes = () => {
      sceneFrame = 0;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;

      if (heroStage) {
        const rect = heroStage.getBoundingClientRect();
        const heroHeight = Math.max(heroStage.offsetHeight, 1);
        const progress = clamp(-rect.top / (heroHeight * 0.76), 0, 1);
        heroStage.style.setProperty('--hero-copy-y', `${(-48 * progress).toFixed(2)}px`);
        heroStage.style.setProperty('--hero-logo-y', `${(34 * progress).toFixed(2)}px`);
        heroStage.style.setProperty('--hero-logo-scale', (1 - progress * 0.045).toFixed(4));
        heroStage.style.setProperty('--hero-content-opacity', (1 - progress * 0.42).toFixed(4));
      }

      if (intro) {
        const rect = intro.getBoundingClientRect();
        const rawProgress = clamp((viewportHeight - rect.top) / (viewportHeight * 0.94), 0, 1);
        const progress = 1 - Math.pow(1 - rawProgress, 3);
        intro.style.setProperty('--yellow-plane-scale', (0.86 + progress * 0.14).toFixed(4));
        intro.style.setProperty('--yellow-plane-y', `${((1 - progress) * 44).toFixed(2)}px`);
        intro.style.setProperty('--yellow-plane-opacity', (0.34 + progress * 0.66).toFixed(4));
        intro.style.setProperty('--yellow-quote-y', `${(30 - progress * 40).toFixed(2)}px`);
        intro.style.setProperty('--yellow-copy-y', `${(42 - progress * 48).toFixed(2)}px`);
      }
    };

    const requestSceneUpdate = () => {
      if (sceneFrame) return;
      sceneFrame = window.requestAnimationFrame(updateScenes);
    };

    window.addEventListener('scroll', requestSceneUpdate, { passive: true });
    window.addEventListener('resize', requestSceneUpdate, { passive: true });
    requestSceneUpdate();
  }

  const start = () => {
    initPageTransitions();
    initHomepageEditorialMotion();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
