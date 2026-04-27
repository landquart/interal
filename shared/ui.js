(function () {
  const THEME_KEY = 'interal.theme';
  const LANG_KEY = 'interal.lang';
  const inSubDir = /\/(similarita|determinatorofvalentyp)(\/|$)/.test(window.location.pathname);
  const prefix = inSubDir ? '../' : '';

  const i18n = {
    ru: {
      openMenu: 'Открыть настройки',
      menuTitle: 'Menú (Меню)',
      navSimilarita: 'Similaritá',
      navDeterminator: 'Determinator of valen typ',
      themeToLight: '☀️ Светлая тема',
      themeToDark: '🌙 Тёмная тема',
      langLabel: 'Язык',
      ru: 'Русский',
      en: 'English'
    },
    en: {
      openMenu: 'Open settings',
      menuTitle: 'Menú (Menu)',
      navSimilarita: 'Similaritá',
      navDeterminator: 'Determinator of valen typ',
      themeToLight: '☀️ Light theme',
      themeToDark: '🌙 Dark theme',
      langLabel: 'Language',
      ru: 'Русский',
      en: 'English'
    }
  };

  const topNav = document.createElement('div');
  topNav.className = 'top-nav';

  const menuButton = document.createElement('button');
  menuButton.className = 'top-menu-btn';
  menuButton.type = 'button';
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-controls', 'interal-side-menu');
  menuButton.textContent = '☰';

  const brandLink = document.createElement('a');
  brandLink.className = 'top-brand';
  brandLink.href = `${prefix}index.html`;
  brandLink.innerHTML = `
    <img class="top-brand-logo" src="${prefix}favicon/favicon%20interal%2064.png" alt="Interal logo" />
    <span class="top-brand-text">Interal</span>
  `;

  const overlay = document.createElement('div');
  overlay.className = 'side-menu-overlay';

  const menu = document.createElement('aside');
  menu.className = 'side-menu';
  menu.id = 'interal-side-menu';
  menu.innerHTML = `
    <h2 class="menu-title"></h2>
    <nav class="menu-nav" aria-label="Site sections">
      <a class="menu-nav-link" href="${prefix}similarita/" data-nav="similarita"></a>
      <a class="menu-nav-link" href="${prefix}determinatorofvalentyp/" data-nav="determinator"></a>
    </nav>
    <button class="menu-theme-btn" type="button"></button>
    <div class="menu-lang-wrap">
      <p class="menu-lang-title"></p>
      <div class="menu-lang-buttons">
        <button class="menu-lang-btn" type="button" data-lang="ru"><span class="flag flag-ru" aria-hidden="true"></span><span>Русский</span></button>
        <button class="menu-lang-btn" type="button" data-lang="en"><span class="flag flag-en" aria-hidden="true"></span><span>English</span></button>
      </div>
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

  function applyTheme(theme) {
    document.body.classList.toggle('dark-theme', theme === 'dark');
    const btn = menu.querySelector('.menu-theme-btn');
    if (btn) {
      const t = i18n[getLang()];
      btn.textContent = theme === 'dark' ? t.themeToLight : t.themeToDark;
    }
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
    const similaritaLink = menu.querySelector('[data-nav="similarita"]');
    const determinatorLink = menu.querySelector('[data-nav="determinator"]');
    if (similaritaLink) similaritaLink.textContent = t.navSimilarita;
    if (determinatorLink) determinatorLink.textContent = t.navDeterminator;

    menu.querySelectorAll('.menu-lang-btn').forEach((btn) => {
      const code = btn.dataset.lang;
      const label = btn.querySelector('span:last-child');
      label.textContent = t[code];
      btn.classList.toggle('is-active', code === nextLang);
    });

    const currentTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
    applyTheme(currentTheme);

    document.dispatchEvent(new CustomEvent('interal:languagechange', { detail: { lang: nextLang } }));
  }

  const topNavWindow = document.createElement('div');
  topNavWindow.className = 'top-nav-window';
  topNavWindow.append(menuButton, brandLink);

  document.body.classList.add('has-global-menu');
  topNav.append(topNavWindow);
  document.body.prepend(overlay);
  document.body.prepend(menu);
  document.body.prepend(topNav);

  initTheme();
  applyLanguage(getLang());

  menuButton.addEventListener('click', function () {
    if (document.body.classList.contains('menu-open')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  overlay.addEventListener('click', closeMenu);

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && document.body.classList.contains('menu-open')) {
      closeMenu();
    }
  });

  menu.querySelector('.menu-theme-btn').addEventListener('click', function () {
    toggleTheme();
  });

  menu.querySelectorAll('.menu-lang-btn').forEach((btn) => {
    btn.addEventListener('click', function () {
      applyLanguage(btn.dataset.lang);
    });
  });
})();
