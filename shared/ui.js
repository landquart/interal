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
      themeToLight: '☀️ Светлая тема',
      themeToDark: '🌙 Тёмная тема',
      langLabel: 'Язык',
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
      themeToLight: '☀️ Light theme',
      themeToDark: '🌙 Dark theme',
      langLabel: 'Language',
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
    <button class="menu-theme-btn" type="button"></button>
    <div class="menu-lang-wrap">
      <p class="menu-lang-title"></p>
      <div class="menu-lang-buttons">
        <button class="menu-lang-btn" type="button" data-lang="ru"><img class="flag" alt="" src="https://static.wikia.nocookie.net/duolingo/images/5/52/Flag-ru.svg/revision/latest?cb=20160603165913" aria-hidden="true" /><span class="menu-lang-name">Русский</span></button>
        <button class="menu-lang-btn" type="button" data-lang="en"><img class="flag" alt="" src="https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fimages.freeimages.com%2Fimages%2Flarge-previews%2Ffb0%2Fuk-flag-1444045.jpg&f=1&nofb=1&ipt=3cdd1f6e844f7b48421dc4a3050f5189814bc6dcd9a19e84d6cb64abcea7cc26" aria-hidden="true" /><span class="menu-lang-name">English</span></button>
      </div>
    </div>
  `;

  const quickTools = document.createElement('div');
  quickTools.className = 'interal-quick-tools';
  quickTools.innerHTML = `
    <p class="interal-quick-title"></p>
    <button class="menu-lang-btn" type="button" data-quick="copy-state"></button>
  `;
  menu.appendChild(quickTools);

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

  function applyTheme(theme) {
    document.body.classList.toggle('dark-theme', theme === 'dark');
    const btn = menu.querySelector('.menu-theme-btn');
    const t = i18n[getLang()];
    const themeLabel = theme === 'dark' ? t.themeToLight : t.themeToDark;
    if (btn) btn.textContent = themeLabel;
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
    menu.querySelector('.menu-lang-title').textContent = t.langLabel;
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

    const quickTitle = menu.querySelector('.interal-quick-title');
    if (quickTitle) quickTitle.textContent = t.quickTitle;
    const shareStateBtn = menu.querySelector('[data-quick="copy-state"]');
    if (shareStateBtn) shareStateBtn.textContent = t.copyState;

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
      applyLanguage(btn.dataset.lang);
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


  menu.querySelector('[data-quick="copy-state"]').addEventListener('click', async function () {
    const url = window.location.href.split('#')[0];
    const encoded = encodeState(collectPageState());
    const fullUrl = encoded ? `${url}#state=${encoded}` : url;
    try {
      const shortUrl = await shortenLink(fullUrl);
      await navigator.clipboard.writeText(shortUrl);
      showToast(i18n[getLang()].shared);
    } catch (_) {
      showToast(i18n[getLang()].sharedWarn);
    }
  });

  const hashMatch = window.location.hash.match(/state=([^&]+)/);
  if (hashMatch && hashMatch[1]) {
    const decoded = decodeState(hashMatch[1]);
    if (decoded) {
      window.addEventListener('load', () => applyPageState(decoded));
      setTimeout(() => applyPageState(decoded), 80);
    }
  }

})();
