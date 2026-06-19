(function () {
  const THEME_KEY = 'interal.theme';
  const LANG_KEY = 'interal.lang';
  const COPY_FEEDBACK_TIMEOUT = 3200;

  const PAGE_STATE_PREFIX = 'interal.pageState:';
  let lockedScrollY = 0;

  const currentScript = document.currentScript;
  const sharedPath = currentScript ? new URL(currentScript.src, window.location.href).pathname : '/shared/ui.js';
  const siteRoot = sharedPath.replace(/\/shared\/ui\.js$/, '/');
  const joinUrl = (path) => new URL(path.replace(/^\//, ''), window.location.origin + siteRoot).pathname;

  const canCopyPageState = /\/(indoeuropanvordes|associativvordes|determinatorofvalentyp)(\/|$)/.test(window.location.pathname);

  const pageNavItems = {
    indoeuropanvordes: {
      path: 'indoeuropanvordes/',
      icon: 'elements/indoeuropan%20vordes.svg',
      labelKey: 'navSimilarita'
    },
    associativ: {
      path: 'associativvordes/',
      icon: 'elements/associativ%20vordes.svg',
      labelKey: 'navAssociativ'
    },
    determinator: {
      path: 'determinatorofvalentyp/',
      icon: 'elements/determinator%20of%20valen%20typ.svg',
      labelKey: 'navDeterminator'
    },
    registry: {
      path: 'registre/',
      icon: 'elements/registre.svg',
      labelKey: 'navRegistry'
    }
  };

  function getCurrentPageNav() {
    const path = window.location.pathname;
    if (path.includes('/indoeuropanvordes/')) return 'indoeuropanvordes';
    if (path.includes('/associativvordes/')) return 'associativ';
    if (path.includes('/determinatorofvalentyp/')) return 'determinator';
    if (path.includes('/registre/')) return 'registry';
    return '';
  }

  const i18n = {
    ru: {
      openMenu: 'Открыть меню',
      menuTitle: 'Меню',
      mobileMenuLabel: 'Меню',
      desktopMenuLabel: 'Настройки',
      themeToLight: 'Светлая тема',
      themeToDark: 'Тёмная тема',
      themeLabel: 'Тема',
      themeDark: 'Тёмная',
      themeLight: 'Светлая',
      langLabel: 'Язык',
      langChoose: 'Выбрать язык',
      navSimilarita: 'Indoeuropan vordes',
      navAssociativ: 'Associativ vordes',
      navDeterminator: 'Determinator of valen typ',
      navRegistry: 'Registre of vordesen cartes',
      navAriaLabel: 'Разделы сайта',
      ru: 'Русский',
      en: 'English',
      quickTitle: 'Быстрые действия',
      copyState: 'Скопировать ссылку с данными',
      shared: 'Ссылка скопирована',
      sharedWarn: 'Не удалось создать или скопировать ссылку'
    },
    en: {
      openMenu: 'Open menu',
      menuTitle: 'Menu',
      mobileMenuLabel: 'Menu',
      desktopMenuLabel: 'Settings',
      themeToLight: 'Light theme',
      themeToDark: 'Dark theme',
      themeLabel: 'Theme',
      themeDark: 'Dark',
      themeLight: 'Light',
      langLabel: 'Language',
      langChoose: 'Choose language',
      navSimilarita: 'Indoeuropan vordes',
      navAssociativ: 'Associativ vordes',
      navDeterminator: 'Determinator of valen typ',
      navRegistry: 'Registre of vordesen cartes',
      navAriaLabel: 'Site sections',
      ru: 'Русский',
      en: 'English',
      quickTitle: 'Quick actions',
      copyState: 'Copy link with data',
      shared: 'Link copied',
      sharedWarn: 'Could not create or copy link'
    }
  };

  const topNav = document.createElement('div');
  topNav.className = 'top-nav';

  const menuButton = document.createElement('button');
  menuButton.className = 'top-menu-btn';
  menuButton.type = 'button';
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-controls', 'interal-side-menu');

  const menuButtonIcon = document.createElement('span');
  menuButtonIcon.className = 'top-menu-btn-icon';
  menuButtonIcon.innerHTML = `<img src="${joinUrl('elements/Hamburger%20Menu.svg')}" alt="" aria-hidden="true" />`; 

  const menuButtonText = document.createElement('span');
  menuButtonText.className = 'top-menu-btn-text';
  menuButtonText.textContent = 'Меню';

  menuButton.append(menuButtonIcon, menuButtonText);

  const brandLink = document.createElement('a');
  brandLink.className = 'top-brand';
  brandLink.href = joinUrl('index.html');
  brandLink.innerHTML = `
    <img class="top-brand-logo" src="${joinUrl('favicon/favicon%20interal%2064.png')}" alt="Interal logo" />
    <span class="top-brand-text">Interal</span>
  `;

  const desktopControls = document.createElement('div');
  desktopControls.className = 'top-desktop-controls';
  desktopControls.innerHTML = Object.entries(pageNavItems).map(([key, item]) => `
    <a class="top-desktop-link" href="${joinUrl(item.path)}" data-nav="${key}"><span class="top-desktop-link-main"></span></a>
  `).join('');

  const mobileCurrentPageLink = document.createElement('a');
  mobileCurrentPageLink.className = 'top-current-page-link';
  mobileCurrentPageLink.setAttribute('aria-current', 'page');
  mobileCurrentPageLink.innerHTML = '<img class="top-current-page-icon" alt="" aria-hidden="true" />';

  const overlay = document.createElement('div');
  overlay.className = 'side-menu-overlay';

  const menu = document.createElement('aside');
  menu.className = 'side-menu';
  menu.id = 'interal-side-menu';
  menu.innerHTML = `
    <h2 class="menu-title"></h2>
    <div class="menu-divider menu-divider--mobile" aria-hidden="true"></div>
    <nav class="menu-nav" aria-label="Site sections">
      ${Object.entries(pageNavItems).map(([key, item]) => `<a class="menu-nav-link" href="${joinUrl(item.path)}" data-nav="${key}"><span class="menu-nav-main"></span></a>`).join('')}
      ${canCopyPageState ? `
      <div class="menu-divider menu-divider--mobile" aria-hidden="true"></div>
      <button class="menu-copy-btn" type="button" data-copy-state="true">
        <span class="menu-copy-icon-stack" aria-hidden="true">
          <img class="menu-copy-icon menu-copy-icon-link" src="${joinUrl('elements/Link%20Round%20Angle.svg')}" alt="" />
          <svg class="menu-copy-icon menu-copy-icon-check" viewBox="0 0 24 24" focusable="false">
            <path d="M5 12.5l4.2 4.2L19 7" />
          </svg>
        </span>
        <span class="menu-copy-label"></span>
      </button>
      ` : ''}
    </nav>
    <div class="menu-preferences-row">
      <button class="menu-lang-btn menu-lang-trigger" type="button" data-lang-trigger="true" aria-expanded="false">
        <img class="menu-lang-icon-img" src="${joinUrl('elements/lingue.svg')}" alt="" aria-hidden="true" />
      </button>
      <button class="menu-theme-toggle" type="button" aria-label="Theme toggle">
      <img class="menu-theme-icon" src="${joinUrl('elements/moon.svg')}" alt="" aria-hidden="true" />
      </button>
    </div>
    <div class="menu-lang-modal" hidden>
      <div class="menu-lang-modal-content">
        <button class="menu-lang-btn" type="button" data-lang="ru"><img class="menu-lang-flag" src="${joinUrl('elements/russia_flag_duolingo_minimal.svg')}" alt="" aria-hidden="true" /><span class="menu-lang-name">Русский</span></button>
        <button class="menu-lang-btn" type="button" data-lang="en"><img class="menu-lang-flag" src="${joinUrl('elements/uk_flag_duolingo_minimal.svg')}" alt="" aria-hidden="true" /><span class="menu-lang-name">English</span></button>
      </div>
    </div>
  `;

  function getLang() {
    const saved = localStorage.getItem(LANG_KEY);
    return saved === 'en' ? 'en' : 'ru';
  }

  function lockPageScroll() {
    lockedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    document.body.style.setProperty('--menu-scroll-y', `-${lockedScrollY}px`);
  }

  function unlockPageScroll() {
    document.body.style.removeProperty('--menu-scroll-y');
    window.scrollTo(0, lockedScrollY);
  }

  function closeMenu() {
    const wasOpen = document.body.classList.contains('menu-open');
    document.body.classList.remove('menu-open');
    toggleLanguageList(false);
    if (wasOpen) unlockPageScroll();
    menuButton.setAttribute('aria-expanded', 'false');
  }

  function openMenu() {
    if (!document.body.classList.contains('menu-open')) lockPageScroll();
    document.body.classList.add('menu-open');
    menuButton.setAttribute('aria-expanded', 'true');
  }

  function toggleLanguageList(force) {
    const list = menu.querySelector('.menu-lang-modal');
    const trigger = menu.querySelector('[data-lang-trigger="true"]');
    if (!list || !trigger) return;
    const shouldOpen = typeof force === 'boolean' ? force : list.hidden;
    list.hidden = !shouldOpen;
    trigger.setAttribute('aria-expanded', String(shouldOpen));
    document.body.classList.toggle('menu-modal-open', shouldOpen);
  }


  function parseColor(color) {
    const value = (color || '').trim();
    if (!value) return null;
    if (value.startsWith('rgb')) {
      const nums = value.match(/[\d.]+/g);
      if (!nums || nums.length < 3) return null;
      return {
        r: Number(nums[0]),
        g: Number(nums[1]),
        b: Number(nums[2]),
        a: nums.length > 3 ? Number(nums[3]) : 1
      };
    }
    return null;
  }

  function getContrastColorForBackground(bgColor) {
    const rgb = parseColor(bgColor);
    if (!rgb || rgb.a === 0) return '';
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance > 0.6 ? '#111111' : '#ffffff';
  }

  function applyAdaptiveTextContrast() {
    const targets = document.querySelectorAll('.menu-nav-link, .menu-copy-btn, .top-desktop-link, .menu-lang-modal .menu-lang-btn');
    targets.forEach((el) => {
      const bg = getComputedStyle(el).backgroundColor;
      const color = getContrastColorForBackground(bg);
      if (color) {
        el.style.setProperty('--auto-contrast-color', color);
        el.classList.add('auto-contrast-text');
      } else {
        el.style.removeProperty('--auto-contrast-color');
        el.classList.remove('auto-contrast-text');
      }
    });
  }

  function updateThemeIcon(theme) {
    const icon = menu.querySelector('.menu-theme-icon');
    if (!icon) return;
    icon.src = theme === 'dark' ? joinUrl('elements/sun.svg') : joinUrl('elements/moon.svg');
  }

  function applyTheme(theme) {
    document.body.classList.toggle('dark-theme', theme === 'dark');
    const btn = menu.querySelector('.menu-theme-toggle');
    const t = i18n[getLang()];
    if (btn) btn.setAttribute('aria-label', theme === 'dark' ? t.themeToLight : t.themeToDark);
    updateThemeIcon(theme);
    requestAnimationFrame(applyAdaptiveTextContrast);
  }

  function getRevealOrigin(trigger) {
    const icon = trigger?.querySelector('.menu-theme-icon');
    const originElement = icon || trigger || menu.querySelector('.menu-theme-icon');

    if (originElement) {
      const rect = originElement.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0;

      if (isVisible) {
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        };
      }
    }

    return {
      x: window.innerWidth / 2,
      y: 0
    };
  }

  function toggleTheme(event) {
    const isDarkTheme = document.body.classList.contains('dark-theme');
    const theme = isDarkTheme ? 'light' : 'dark';
    const shouldContractToButton = isDarkTheme && theme === 'light';
    const { x, y } = getRevealOrigin(event?.currentTarget);
    const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    if (document.startViewTransition) {
      document.documentElement.style.setProperty('--reveal-x', `${x}px`);
      document.documentElement.style.setProperty('--reveal-y', `${y}px`);
      document.documentElement.style.setProperty('--reveal-end-radius', `${endRadius}px`);
      document.documentElement.classList.toggle('theme-transition-contract', shouldContractToButton);
      const transition = document.startViewTransition(() => {
        localStorage.setItem(THEME_KEY, theme);
        applyTheme(theme);
      });
      transition.finished.finally(() => {
        document.documentElement.style.removeProperty('--reveal-x');
        document.documentElement.style.removeProperty('--reveal-y');
        document.documentElement.style.removeProperty('--reveal-end-radius');
        document.documentElement.classList.remove('theme-transition-contract');
      });
      return;
    }

    const layer = document.createElement('div');
    const currentThemeColor = getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#fff';
    layer.className = shouldContractToButton ? 'theme-reveal-fallback theme-reveal-fallback--contract' : 'theme-reveal-fallback';
    layer.style.setProperty('--reveal-x', `${x}px`);
    layer.style.setProperty('--reveal-y', `${y}px`);
    layer.style.setProperty('--reveal-end-radius', `${endRadius}px`);

    localStorage.setItem(THEME_KEY, theme);

    if (shouldContractToButton) {
      layer.style.setProperty('--reveal-color', currentThemeColor);
      applyTheme(theme);
      document.body.appendChild(layer);
      layer.addEventListener('animationend', () => layer.remove(), { once: true });
      return;
    }

    const wasDarkTheme = document.body.classList.contains('dark-theme');
    document.body.classList.toggle('dark-theme', theme === 'dark');
    const nextThemeColor = getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#fff';
    document.body.classList.toggle('dark-theme', wasDarkTheme);

    layer.style.setProperty('--reveal-color', nextThemeColor);
    document.body.appendChild(layer);
    layer.addEventListener('animationend', () => {
      applyTheme(theme);
      layer.remove();
    }, { once: true });
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    applyTheme(saved === 'dark' ? 'dark' : 'light');
    requestAnimationFrame(applyAdaptiveTextContrast);
  }

  function applyLanguage(lang) {
    const nextLang = lang === 'en' ? 'en' : 'ru';
    localStorage.setItem(LANG_KEY, nextLang);
    document.documentElement.lang = nextLang;

    const t = i18n[nextLang];
    const isDesktop = window.matchMedia('(min-width: 980px)').matches;
    menuButton.setAttribute('aria-label', t.openMenu);
    const menuTitle = menu.querySelector('.menu-title');
    if (menuTitle) menuTitle.textContent = isDesktop ? t.desktopMenuLabel : t.mobileMenuLabel;
    const siteNav = menu.querySelector('.menu-nav');
    if (siteNav) siteNav.setAttribute('aria-label', t.navAriaLabel);
    menuButtonText.textContent = isDesktop ? t.desktopMenuLabel : t.mobileMenuLabel;

    const indoeuropanvordesLink = menu.querySelector('[data-nav="indoeuropanvordes"]');
    const associativLink = menu.querySelector('[data-nav="associativ"]');
    const determinatorLink = menu.querySelector('[data-nav="determinator"]');
    const registryLink = menu.querySelector('[data-nav="registry"]');
    if (indoeuropanvordesLink) {
      indoeuropanvordesLink.querySelector('.menu-nav-main').textContent = t.navSimilarita;
    }
    if (associativLink) {
      associativLink.querySelector('.menu-nav-main').textContent = t.navAssociativ;
    }
    if (determinatorLink) {
      determinatorLink.querySelector('.menu-nav-main').textContent = t.navDeterminator;
    }
    if (registryLink) {
      registryLink.querySelector('.menu-nav-main').textContent = t.navRegistry;
    }

    const labels = Object.fromEntries(Object.entries(pageNavItems).map(([key, item]) => [key, t[item.labelKey]]));
    desktopControls.querySelectorAll('.top-desktop-link').forEach((link) => {
      link.querySelector('.top-desktop-link-main').textContent = labels[link.dataset.nav] || '';
    });
    const currentMobileNav = getCurrentPageNav();
    if (currentMobileNav && labels[currentMobileNav]) {
      mobileCurrentPageLink.setAttribute('aria-label', labels[currentMobileNav]);
      mobileCurrentPageLink.setAttribute('title', labels[currentMobileNav]);
    }

    menu.querySelectorAll('.menu-lang-btn[data-lang]').forEach((btn) => {
      const code = btn.dataset.lang;
      const label = btn.querySelector('.menu-lang-name');
      if (label) label.textContent = t[code];
      btn.classList.toggle('is-active', code === nextLang);
    });
    const trigger = menu.querySelector('[data-lang-trigger="true"]');
    if (trigger) trigger.setAttribute('aria-label', t.langChoose);
    document.querySelectorAll('[data-copy-state="true"]').forEach((copyBtn) => {
      const label = copyBtn.querySelector('.menu-copy-label, .top-desktop-copy-label');
      const isCopied = copyBtn.classList.contains('is-copied');
      if (label) label.textContent = t.copyState;
      copyBtn.setAttribute('aria-label', isCopied ? t.shared : t.copyState);
    });

    const currentTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
    applyTheme(currentTheme);

    document.dispatchEvent(new CustomEvent('interal:languagechange', { detail: { lang: nextLang } }));
  }

  function applyMobileBrandLogo() {
    const logo = brandLink.querySelector('.top-brand-logo');
    if (!logo) return;
    logo.src = joinUrl('favicon/favicon%20interal%2064.png');
    logo.alt = 'Interal logo';
  }


  function showToast(message) {
    let toast = document.querySelector('.interal-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'interal-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  function toBase64Url(input) {
    return btoa(unescape(encodeURIComponent(input))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function fromBase64Url(input) {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLength);
    return decodeURIComponent(escape(atob(padded)));
  }

  function encodeState(entries) {
    try {
      return toBase64Url(JSON.stringify(entries));
    } catch (_) {
      return '';
    }
  }

  function decodeState(encoded) {
    try {
      const decoded = JSON.parse(fromBase64Url(encoded));
      return Array.isArray(decoded) ? decoded : [];
    } catch (_) {
      return [];
    }
  }

  function collectPageState() {
    const entries = [];
    document.querySelectorAll('input, textarea, select').forEach((el) => {
      if (!el.id && !el.name) return;
      if (el.type === 'file') return;
      const key = el.id || el.name;
      if (el.type === 'checkbox' || el.type === 'radio') {
        if (el.checked) entries.push([key, 1]);
      } else if (typeof el.value === 'string' && el.value !== '') {
        entries.push([key, el.value]);
      }
    });
    return entries;
  }

  function applyPageState(entries) {
    if (!Array.isArray(entries)) return;
    entries.forEach((entry) => {
      if (!Array.isArray(entry) || entry.length < 2) return;
      const [key, value] = entry;
      const el = document.getElementById(key) || document.querySelector(`[name="${CSS.escape(key)}"]`);
      if (!el) return;
      if (el.type === 'checkbox' || el.type === 'radio') {
        el.checked = value === 1 || value === true || value === '1';
      } else if (typeof value === 'string') {
        el.value = value;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  function getPageStateStorageKey() {
    return `${PAGE_STATE_PREFIX}${window.location.pathname}`;
  }

  function saveCurrentPageState() {
    try {
      const entries = collectPageState();
      const key = getPageStateStorageKey();
      if (!entries.length) {
        localStorage.removeItem(key);
        return;
      }
      localStorage.setItem(key, JSON.stringify(entries));
    } catch (_) {
      // ignore storage errors
    }
  }

  function loadSavedPageState() {
    try {
      const raw = localStorage.getItem(getPageStateStorageKey());
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }


  function setCopyButtonCopied(copyButton, copied) {
    const t = i18n[getLang()];
    clearTimeout(copyButton._copyStateTimer);
    copyButton.classList.toggle('is-copied', copied);
    copyButton.setAttribute('aria-label', copied ? t.shared : t.copyState);
    if (copied) {
      copyButton._copyStateTimer = setTimeout(() => {
        copyButton.classList.remove('is-copied');
        copyButton.setAttribute('aria-label', i18n[getLang()].copyState);
      }, COPY_FEEDBACK_TIMEOUT);
    }
  }

  function shareStateApiUrl(code) {
    const apiPath = joinUrl('api/share-state');
    const url = new URL(apiPath, window.location.origin);
    if (code) url.searchParams.set('code', code);
    return url;
  }

  async function createShareCode(entries) {
    const response = await fetch(shareStateApiUrl().toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ entries })
    });
    if (!response.ok) throw new Error('Share state API unavailable');
    const payload = await response.json();
    if (!payload || !/^[0-9A-Za-z]{12}$/.test(payload.code)) throw new Error('Invalid share code response');
    return payload.code;
  }

  async function loadSharedState(code) {
    try {
      const response = await fetch(shareStateApiUrl(code).toString(), { method: 'GET', cache: 'no-store' });
      if (!response.ok) return [];
      const payload = await response.json();
      return Array.isArray(payload.entries) ? payload.entries : [];
    } catch (_) {
      return [];
    }
  }

  function markCurrentPage() {
    const currentNav = getCurrentPageNav();

    document.querySelectorAll('[data-nav]').forEach((link) => {
      link.classList.toggle('is-active', !!currentNav && link.dataset.nav === currentNav);
    });

    const currentItem = currentNav ? pageNavItems[currentNav] : null;
    mobileCurrentPageLink.hidden = !currentItem;
    if (currentItem) {
      const t = i18n[getLang()];
      const label = t[currentItem.labelKey];
      const icon = mobileCurrentPageLink.querySelector('.top-current-page-icon');
      mobileCurrentPageLink.href = joinUrl(currentItem.path);
      mobileCurrentPageLink.setAttribute('aria-label', label);
      mobileCurrentPageLink.setAttribute('title', label);
      if (icon) icon.src = joinUrl(currentItem.icon);
    }
  }

  const topNavWindow = document.createElement('div');
  topNavWindow.className = 'top-nav-window';
  topNavWindow.append(menuButton, brandLink, desktopControls, mobileCurrentPageLink);

  document.body.classList.add('has-global-menu');
  topNav.append(topNavWindow);
  document.body.prepend(overlay);
  document.body.prepend(menu);
  document.body.prepend(topNav);

  document.addEventListener('mouseover', (event) => {
    const target = event.target.closest?.('.menu-nav-link, .menu-copy-btn, .top-desktop-link, .menu-lang-modal .menu-lang-btn');
    if (target) requestAnimationFrame(applyAdaptiveTextContrast);
  });

  initTheme();
  applyLanguage(getLang());
  applyMobileBrandLogo();
  window.addEventListener('resize', applyMobileBrandLogo);
  markCurrentPage();

  menuButton.addEventListener('click', function () {
    if (document.body.classList.contains('menu-open')) closeMenu();
    else openMenu();
  });

  overlay.addEventListener('click', closeMenu);

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && document.body.classList.contains('menu-open')) closeMenu();
  });

  menu.querySelector('.menu-theme-toggle').addEventListener('click', toggleTheme);

  menu.querySelectorAll('.menu-lang-btn').forEach((btn) => {
    btn.addEventListener('click', function () {
      if (btn.dataset.langTrigger === 'true') {
        toggleLanguageList();
        return;
      }
      applyLanguage(btn.dataset.lang);
      toggleLanguageList(false);
    });
  });
  document.addEventListener('click', (event) => {
    const langModal = menu.querySelector('.menu-lang-modal');
    const trigger = menu.querySelector('[data-lang-trigger="true"]');
    if (!langModal || !trigger) return;
    if (langModal.hidden) return;
    if (trigger.contains(event.target) || langModal.querySelector('.menu-lang-modal-content')?.contains(event.target)) return;
    toggleLanguageList(false);
  });

  document.querySelectorAll('[data-copy-state="true"]').forEach((copyButton) => copyButton.addEventListener('click', async () => {
    const t = i18n[getLang()];
    try {
      const entries = collectPageState();
      const url = new URL(window.location.href);
      url.hash = '';
      url.searchParams.delete('state');
      url.searchParams.delete('s');
      if (entries.length) {
        const code = await createShareCode(entries);
        url.searchParams.set('s', code);
      }
      await navigator.clipboard.writeText(url.toString());
      setCopyButtonCopied(copyButton, true);
      showToast(t.shared);
    } catch (_) {
      showToast(t.sharedWarn);
    }
  }));

  window.addEventListener('resize', () => applyLanguage(getLang()));

  let touchStartX = null;
  let touchStartY = null;
  menu.addEventListener('touchstart', function (event) {
    if (!document.body.classList.contains('menu-open')) return;
    const t = event.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  }, { passive: true });

  menu.addEventListener('touchmove', function (event) {
    if (!document.body.classList.contains('menu-open') || touchStartX === null || touchStartY === null) return;
    const t = event.touches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if (Math.abs(dx) > 48 && dx < 0 && Math.abs(dx) > Math.abs(dy)) {
      closeMenu();
      touchStartX = null;
      touchStartY = null;
    }
  }, { passive: true });

  menu.addEventListener('touchend', function () {
    touchStartX = null;
    touchStartY = null;
  }, { passive: true });
  function scheduleApplyPageState(entries) {
    if (!entries.length) return;
    window.addEventListener('load', () => applyPageState(entries));
    setTimeout(() => applyPageState(entries), 80);
  }

  async function restoreInitialPageState() {
    const params = new URLSearchParams(window.location.search);
    const shareCode = params.get('s') || '';
    const sharedState = /^[0-9A-Za-z]{12}$/.test(shareCode) ? await loadSharedState(shareCode) : [];
    if (sharedState.length) {
      scheduleApplyPageState(sharedState);
      return;
    }
    const hashMatch = window.location.hash.match(/state=([^&]+)/);
    const hashState = hashMatch && hashMatch[1] ? decodeState(hashMatch[1]) : [];
    const fallbackSavedState = hashState.length ? [] : loadSavedPageState();
    scheduleApplyPageState(hashState.length ? hashState : fallbackSavedState);
  }

  restoreInitialPageState();

  const debouncedSaveState = (() => {
    let timer = null;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(saveCurrentPageState, 120);
    };
  })();

  document.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.matches('input, textarea, select')) return;
    debouncedSaveState();
  }, true);

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.matches('input, textarea, select')) return;
    debouncedSaveState();
  }, true);


function initCustomSelects(root = document) {
  const selects = root.querySelectorAll('select.js-custom-select');

  selects.forEach((select) => {
    if (select.dataset.customSelectReady === 'true') {
      if (typeof select._customSelectRefresh === 'function') {
        select._customSelectRefresh();
      }
      return;
    }
    select.dataset.customSelectReady = 'true';

    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select';

    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);

    select.classList.add('custom-select-native');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'custom-select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');

    const value = document.createElement('span');
    value.className = 'custom-select-value';

    const arrow = document.createElement('span');
    arrow.className = 'custom-select-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '⌄';

    trigger.append(value, arrow);

    const menu = document.createElement('div');
    menu.className = 'custom-select-menu';
    menu.setAttribute('role', 'listbox');
    menu.hidden = true;

    wrapper.append(trigger, menu);

    function getSelectedOption() {
      return select.options[select.selectedIndex];
    }

    function syncFromSelect() {
      const selected = getSelectedOption();
      value.textContent = selected ? selected.textContent : '';

      menu.querySelectorAll('.custom-select-option').forEach((btn) => {
        const isSelected = btn.dataset.value === select.value;
        btn.setAttribute('aria-selected', String(isSelected));
        btn.classList.toggle('is-active', isSelected);
      });
    }

    function closeMenu() {
      wrapper.classList.remove('is-open');
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    }

    function buildOptions() {
      menu.innerHTML = '';

      Array.from(select.options).forEach((option) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'custom-select-option';
        btn.setAttribute('role', 'option');
        btn.dataset.value = option.value;
        btn.textContent = option.textContent;

        btn.addEventListener('click', () => {
          select.value = option.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          closeMenu();
          syncFromSelect();
          trigger.focus();
        });

        menu.appendChild(btn);
      });

      syncFromSelect();
    }

    function positionCustomSelectMenu() {
      const rect = trigger.getBoundingClientRect();
      const gap = 6;
      const viewportPadding = 12;
      const preferredMaxHeight = 260;

      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const spaceAbove = rect.top - viewportPadding;
      const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;

      const availableHeight = openUp
        ? Math.max(120, spaceAbove - gap)
        : Math.max(120, spaceBelow - gap);

      menu.style.left = `${rect.left}px`;
      menu.style.width = `${rect.width}px`;
      menu.style.maxHeight = `${Math.min(preferredMaxHeight, availableHeight)}px`;

      if (openUp) {
        menu.style.top = 'auto';
        menu.style.bottom = `${window.innerHeight - rect.top + gap}px`;
      } else {
        menu.style.bottom = 'auto';
        menu.style.top = `${rect.bottom + gap}px`;
      }
    }

    function openMenu() {
      wrapper.classList.add('is-open');
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      positionCustomSelectMenu();

      const active = menu.querySelector('[aria-selected="true"]');
      if (active) active.scrollIntoView({ block: 'nearest' });
    }

    function toggleMenu() {
      if (menu.hidden) openMenu();
      else closeMenu();
    }

    function updatePositionIfOpen() {
      if (!menu.hidden) positionCustomSelectMenu();
    }

    window.addEventListener('resize', updatePositionIfOpen);
    window.addEventListener('scroll', updatePositionIfOpen, true);

    trigger.addEventListener('click', toggleMenu);

    trigger.addEventListener('keydown', (event) => {
      const options = Array.from(menu.querySelectorAll('.custom-select-option'));
      const currentIndex = options.findIndex((btn) => btn.dataset.value === select.value);

      if (event.key === 'Escape') {
        closeMenu();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (menu.hidden) openMenu();

        const next = options[Math.min(currentIndex + 1, options.length - 1)] || options[0];
        if (next) {
          select.value = next.dataset.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          syncFromSelect();
        }
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (menu.hidden) openMenu();

        const prev = options[Math.max(currentIndex - 1, 0)] || options[0];
        if (prev) {
          select.value = prev.dataset.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          syncFromSelect();
        }
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleMenu();
      }
    });

    document.addEventListener('click', (event) => {
      if (!wrapper.contains(event.target)) closeMenu();
    });

    select.addEventListener('change', syncFromSelect);

    buildOptions();
    select._customSelectRefresh = buildOptions;
  });
}

window.initCustomSelects = initCustomSelects;

})();
