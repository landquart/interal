(function () {
  const THEME_KEY = 'interal.theme';
  const LANG_KEY = 'interal.lang';
  const currentScript = document.currentScript;
  const sharedPath = currentScript ? new URL(currentScript.src, window.location.href).pathname : '/shared/ui.js';
  const siteRoot = sharedPath.replace(/\/shared\/ui\.js$/, '/');
  const joinUrl = (path) => new URL(path.replace(/^\//, ''), window.location.origin + siteRoot).pathname;

  const i18n = {
    ru: {
      openMenu: 'Открыть настройки',
      menuTitle: 'Настройки',
      mobileMenuLabel: 'Меню',
      desktopMenuLabel: 'Настройки',
      themeToLight: 'Светлая тема',
      themeToDark: 'Тёмная тема',
      themeLabel: 'Тема',
      themeDark: 'Тёмная',
      themeLight: 'Светлая',
      langLabel: 'Язык',
      langChoose: 'Выбрать язык',
      navSimilarita: 'Similaritá',
      navAssociativ: 'Associativ vordes',
      navDeterminator: 'Determinator of valen typ',
      navAriaLabel: 'Разделы сайта',
      ru: 'Русский',
      en: 'English',
      quickTitle: 'Быстрые действия',
      copyState: '📋 Скопировать ссылку с данными',
      shared: 'Ссылка скопирована',
      sharedWarn: 'Не удалось сократить или скопировать ссылку'
    },
    en: {
      openMenu: 'Open settings',
      menuTitle: 'Settings',
      mobileMenuLabel: 'Menu',
      desktopMenuLabel: 'Settings',
      themeToLight: 'Light theme',
      themeToDark: 'Dark theme',
      themeLabel: 'Theme',
      themeDark: 'Dark',
      themeLight: 'Light',
      langLabel: 'Language',
      langChoose: 'Choose language',
      navSimilarita: 'Similaritá',
      navAssociativ: 'Associativ vordes',
      navDeterminator: 'Determinator of valen typ',
      navAriaLabel: 'Site sections',
      ru: 'Русский',
      en: 'English',
      quickTitle: 'Quick actions',
      copyState: '📋 Copy link with data',
      shared: 'Link copied',
      sharedWarn: 'Could not shorten or copy link'
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
  menuButtonIcon.textContent = '☰';

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
  desktopControls.innerHTML = `
    <a class="top-desktop-link" href="${joinUrl('similarita/')}" data-nav="similarita"><span class="top-desktop-link-main"></span></a>
    <a class="top-desktop-link" href="${joinUrl('associativvordes/')}" data-nav="associativ"><span class="top-desktop-link-main"></span></a>
    <a class="top-desktop-link" href="${joinUrl('determinatorofvalentyp/')}" data-nav="determinator"><span class="top-desktop-link-main"></span></a>
  `;

  const overlay = document.createElement('div');
  overlay.className = 'side-menu-overlay';

  const menu = document.createElement('aside');
  menu.className = 'side-menu';
  menu.id = 'interal-side-menu';
  menu.innerHTML = `
    <h2 class="menu-title"></h2>
    <nav class="menu-nav" aria-label="Site sections">
      <a class="menu-nav-link" href="${joinUrl('similarita/')}" data-nav="similarita"><span class="menu-nav-main"></span></a>
      <a class="menu-nav-link" href="${joinUrl('associativvordes/')}" data-nav="associativ"><span class="menu-nav-main"></span></a>
      <a class="menu-nav-link" href="${joinUrl('determinatorofvalentyp/')}" data-nav="determinator"><span class="menu-nav-main"></span></a>
    </nav>
    <div class="menu-controls-row">
      <div class="menu-lang-dropdown">
        <button class="menu-lang-btn menu-lang-trigger" type="button" data-lang-trigger="true" aria-expanded="false">
          <span class="menu-lang-icon" aria-hidden="true">
            <svg viewBox="0 0 64 64" width="22" height="22" role="presentation" focusable="false">
              <path fill="currentColor" d="M8 12h40v8H33c-1 6-4 11-8 15 5 4 10 9 14 14l-6 6c-4-5-8-9-12-13-4 3-8 6-13 9l-4-7c4-2 8-5 12-8-4-4-8-9-11-14h9c2 4 4 7 7 10 3-3 5-7 6-10H8z"/>
              <path fill="currentColor" d="M42 56l10-28h8l10 28h-9l-2-6H51l-2 6zm12-13h5l-2-8z"/>
            </svg>
          </span>
          <span class="menu-lang-caret" aria-hidden="true">▾</span>
        </button>
        <div class="menu-lang-list" hidden>
          <button class="menu-lang-btn" type="button" data-lang="ru"><span class="flag-emoji" aria-hidden="true">🇷🇺</span><span class="menu-lang-name">Русский</span></button>
          <button class="menu-lang-btn" type="button" data-lang="en"><span class="flag-emoji" aria-hidden="true">🇺🇸</span><span class="menu-lang-name">English</span></button>
        </div>
      </div>
      <button class="menu-theme-btn" type="button" aria-pressed="false"></button>
    </div>
  `;

  function getLang() {
    const saved = localStorage.getItem(LANG_KEY);
    return saved === 'en' ? 'en' : 'ru';
  }

  function closeMenu() {
    document.body.classList.remove('menu-open');
    menuButton.setAttribute('aria-expanded', 'false');
  }

  function openMenu() {
    document.body.classList.add('menu-open');
    menuButton.setAttribute('aria-expanded', 'true');
  }

  function toggleLanguageList(force) {
    const list = menu.querySelector('.menu-lang-list');
    const trigger = menu.querySelector('[data-lang-trigger="true"]');
    if (!list || !trigger) return;
    const shouldOpen = typeof force === 'boolean' ? force : list.hidden;
    list.hidden = !shouldOpen;
    trigger.setAttribute('aria-expanded', String(shouldOpen));
  }

  function applyTheme(theme) {
    document.body.classList.toggle('dark-theme', theme === 'dark');
    const btn = menu.querySelector('.menu-theme-btn');
    const t = i18n[getLang()];
    const themeEmoji = theme === 'dark' ? '🌙' : '🔆';
    if (btn) btn.textContent = themeEmoji;
    if (btn) btn.setAttribute('aria-pressed', String(theme === 'dark'));
    if (btn) btn.setAttribute('aria-label', theme === 'dark' ? t.themeToLight : t.themeToDark);
  }

  function toggleTheme() {
    const dark = !document.body.classList.contains('dark-theme');
    const theme = dark ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    applyTheme(saved === 'dark' ? 'dark' : 'light');
  }

  function applyLanguage(lang) {
    const nextLang = lang === 'en' ? 'en' : 'ru';
    localStorage.setItem(LANG_KEY, nextLang);
    document.documentElement.lang = nextLang;

    const t = i18n[nextLang];
    menuButton.setAttribute('aria-label', t.openMenu);
    menu.querySelector('.menu-title').textContent = t.menuTitle;
    const siteNav = menu.querySelector('.menu-nav');
    if (siteNav) siteNav.setAttribute('aria-label', t.navAriaLabel);
    const isDesktop = window.matchMedia('(min-width: 980px)').matches;
    menuButtonText.textContent = isDesktop ? t.desktopMenuLabel : t.mobileMenuLabel;

    const similaritaLink = menu.querySelector('[data-nav="similarita"]');
    const associativLink = menu.querySelector('[data-nav="associativ"]');
    const determinatorLink = menu.querySelector('[data-nav="determinator"]');
    if (similaritaLink) {
      similaritaLink.querySelector('.menu-nav-main').textContent = t.navSimilarita;
    }
    if (associativLink) {
      associativLink.querySelector('.menu-nav-main').textContent = t.navAssociativ;
    }
    if (determinatorLink) {
      determinatorLink.querySelector('.menu-nav-main').textContent = t.navDeterminator;
    }

    desktopControls.querySelectorAll('.top-desktop-link').forEach((link) => {
      const labels = { similarita: t.navSimilarita, associativ: t.navAssociativ, determinator: t.navDeterminator };
      link.querySelector('.top-desktop-link-main').textContent = labels[link.dataset.nav] || '';
    });

    menu.querySelectorAll('.menu-lang-btn[data-lang]').forEach((btn) => {
      const code = btn.dataset.lang;
      const label = btn.querySelector('.menu-lang-name');
      if (label) label.textContent = t[code];
      btn.classList.toggle('is-active', code === nextLang);
    });
    const trigger = menu.querySelector('[data-lang-trigger="true"]');
    if (trigger) trigger.setAttribute('aria-label', t.langChoose);

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



  async function shortenLink(url) {
    const endpoint = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`;
    const response = await fetch(endpoint, { method: 'GET', mode: 'cors', cache: 'no-store' });
    if (!response.ok) throw new Error('Shortener unavailable');
    const shortUrl = (await response.text()).trim();
    if (!/^https?:\/\//i.test(shortUrl)) throw new Error('Invalid short URL response');
    return shortUrl;
  }

  function markCurrentPage() {
    const path = window.location.pathname;
    const currentNav = path.includes('/similarita/')
      ? 'similarita'
      : path.includes('/associativvordes/')
        ? 'associativ'
        : path.includes('/determinatorofvalentyp/')
          ? 'determinator'
          : '';

    document.querySelectorAll('[data-nav]').forEach((link) => {
      link.classList.toggle('is-active', !!currentNav && link.dataset.nav === currentNav);
    });
  }

  const topNavWindow = document.createElement('div');
  topNavWindow.className = 'top-nav-window';
  topNavWindow.append(menuButton, brandLink, desktopControls);

  document.body.classList.add('has-global-menu');
  topNav.append(topNavWindow);
  document.body.prepend(overlay);
  document.body.prepend(menu);
  document.body.prepend(topNav);

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

  menu.querySelector('.menu-theme-btn').addEventListener('click', toggleTheme);

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
  const hashMatch = window.location.hash.match(/state=([^&]+)/);
  if (hashMatch && hashMatch[1]) {
    const decoded = decodeState(hashMatch[1]);
    if (decoded) {
      window.addEventListener('load', () => applyPageState(decoded));
      setTimeout(() => applyPageState(decoded), 80);
    }
  }

})();
