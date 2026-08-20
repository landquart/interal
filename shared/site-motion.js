(function () {
  const PAGE_TRANSITION_KEY = 'interal.page-transition.pending';
  const PAGE_TRANSITION_DURATION_MS = 480;
  const PAGE_TRANSITION_YELLOW = '#F5EE91';

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
        background: ${PAGE_TRANSITION_YELLOW};
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

  function initHomepageIconScrollDirection() {
    const body = document.body;
    if (!body?.classList.contains('homepage') || prefersReducedMotion()) return;

    const cards = Array.from(document.querySelectorAll('.home-about-card'));
    if (!cards.length) return;

    let lastScrollY = window.scrollY || window.pageYOffset || 0;
    let scrollingUp = false;

    const disableParallax = () => {
      if (scrollingUp) return;
      scrollingUp = true;

      cards.forEach((card) => {
        card.classList.remove('is-parallax-ready');
        const figure = card.querySelector('.home-about-card-figure img');
        if (!figure) return;
        figure.style.setProperty('--figure-parallax-y', '0px');
        figure.style.setProperty('--figure-parallax-rotate', '0deg');
      });
    };

    const enableParallax = () => {
      if (!scrollingUp) return;
      scrollingUp = false;

      cards.forEach((card) => {
        if (card.classList.contains('is-revealed')) {
          card.classList.add('is-parallax-ready');
        }
      });
    };

    const handleScrollDirection = () => {
      const currentScrollY = window.scrollY || window.pageYOffset || 0;
      const delta = currentScrollY - lastScrollY;
      lastScrollY = currentScrollY;

      if (delta < -0.25) {
        disableParallax();
        return;
      }

      if (delta > 0.25) {
        enableParallax();
      }
    };

    window.addEventListener('scroll', handleScrollDirection, { passive: true });
  }

  const start = () => {
    initPageTransitions();
    initHomepageIconScrollDirection();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
