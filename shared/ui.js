(function () {
  const THEME_KEY = 'interal.theme';
  const LANG_KEY = 'interal.lang';
  const currentScript = document.currentScript;
  const sharedPath = currentScript ? new URL(currentScript.src, window.location.href).pathname : '/shared/ui.js';
  const siteRoot = sharedPath.replace(/\/shared\/ui\.js$/, '/');
  const joinUrl = (path) => new URL(path.replace(/^\//, ''), window.location.origin + siteRoot).pathname;

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
      navSimilarita: 'Similaritá',
      navAssociativ: 'Associativ vordes',
      navDeterminator: 'Determinator of valen typ',
      navAriaLabel: 'Разделы сайта',
      ru: 'Русский',
      en: 'English',
      quickTitle: 'Быстрые действия',
      copyState: 'Скопировать ссылку с данными',
      shared: 'Ссылка скопирована',
      sharedWarn: 'Не удалось сократить или скопировать ссылку'
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
      navSimilarita: 'Similaritá',
      navAssociativ: 'Associativ vordes',
      navDeterminator: 'Determinator of valen typ',
      navAriaLabel: 'Site sections',
      ru: 'Русский',
      en: 'English',
      quickTitle: 'Quick actions',
      copyState: 'Copy link with data',
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
      <button class="menu-copy-btn" type="button" data-copy-state="true"><img class="menu-copy-icon" src="${joinUrl('elements/Link%20Round%20Angle.svg')}" alt="" aria-hidden="true" /><span class="menu-copy-label"></span></button>
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
        <button class="menu-lang-btn" type="button" data-lang="ru"><span class="flag-emoji" aria-hidden="true">🇷🇺</span><span class="menu-lang-name">Русский</span></button>
        <button class="menu-lang-btn" type="button" data-lang="en"><span class="flag-emoji" aria-hidden="true">🇬🇧</span><span class="menu-lang-name">English</span></button>
      </div>
    </div>
  `;

  function getLang() {
    const saved = localStorage.getItem(LANG_KEY);
    return saved === 'en' ? 'en' : 'ru';
  }

  function closeMenu() {
    document.body.classList.remove('menu-open');
    toggleLanguageList(false);
    menuButton.setAttribute('aria-expanded', 'false');
  }

  function openMenu() {
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
      return { r: Number(nums[0]), g: Number(nums[1]), b: Number(nums[2]) };
    }
    return null;
  }

  function getContrastColorForBackground(bgColor) {
    const rgb = parseColor(bgColor);
    if (!rgb) return '';
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

  function animateThemeReveal(originEl, nextTheme) {
    const rect = originEl?.getBoundingClientRect?.();
    const x = rect ? `${rect.left + rect.width / 2}px` : `${window.innerWidth / 2}px`;
    const y = rect ? `${rect.top + rect.height / 2}px` : `0px`;
    const layer = document.createElement('div');
    const previousTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
    const toDark = nextTheme === 'dark';
    layer.className = `theme-reveal-layer is-animating ${toDark ? 'is-out' : 'is-in'}`;
    layer.style.setProperty('--reveal-x', x);
    layer.style.setProperty('--reveal-y', y);
    const snapshot = document.body.cloneNode(true);
    snapshot.classList.add('theme-reveal-snapshot');
    snapshot.classList.toggle('dark-theme', previousTheme === 'dark');
    snapshot.classList.toggle('light-theme', previousTheme !== 'dark');
    snapshot.querySelectorAll('script').forEach((node) => node.remove());
    layer.appendChild(snapshot);
    document.body.appendChild(layer);
    layer.addEventListener('animationend', () => layer.remove(), { once: true });
  }

  function toggleTheme(event) {
    const dark = !document.body.classList.contains('dark-theme');
    const theme = dark ? 'dark' : 'light';
    if (theme === 'dark') {
      animateThemeReveal(event?.currentTarget, theme);
      localStorage.setItem(THEME_KEY, theme);
      applyTheme(theme);
      return;
    }
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
    animateThemeReveal(event?.currentTarget, theme);
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
    document.querySelectorAll('[data-copy-state="true"]').forEach((copyBtn) => {
      const label = copyBtn.querySelector('.menu-copy-label, .top-desktop-copy-label');
      if (label) label.textContent = t.copyState;
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
      if (entries.length) {
        url.hash = `state=${encodeState(entries)}`;
      }
      const short = await shortenLink(url.toString());
      await navigator.clipboard.writeText(short);
      showToast(t.shared);
      closeMenu();
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
  const hashMatch = window.location.hash.match(/state=([^&]+)/);
  if (hashMatch && hashMatch[1]) {
    const decoded = decodeState(hashMatch[1]);
    if (decoded) {
      window.addEventListener('load', () => applyPageState(decoded));
      setTimeout(() => applyPageState(decoded), 80);
    }
  }

})();
