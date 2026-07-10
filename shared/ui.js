(function () {
  const THEME_KEY = 'interal.theme';
  const LANG_KEY = 'interal.lang';
  const COPY_FEEDBACK_TIMEOUT = 3200;

  let lockedScrollY = 0;

  const currentScript = document.currentScript;
  const sharedPath = currentScript ? new URL(currentScript.src, window.location.href).pathname : '/shared/ui.js';
  const siteRoot = sharedPath.replace(/\/shared\/ui\.js$/, '/');
  const joinUrl = (path) => new URL(path.replace(/^\//, ''), window.location.origin + siteRoot).pathname;

  const canCopyPageState = /\/(indoeuropanvordes|associativvordes|determinatorofvalentyp|internationalismes|vordesofcommunites|grammaticebrevivordes|altervordes|affixes)\//.test(window.location.pathname);

  const pageNavItems = {
    indoeuropanvordes: {
      path: 'indoeuropanvordes/',
      icon: 'elements/indoeuropan%20vordes.svg',
      labelKey: 'navSimilarita',
      group: 'instruments'
    },
    associativ: {
      path: 'associativvordes/',
      icon: 'elements/associativ%20vordes.svg',
      labelKey: 'navAssociativ',
      group: 'instruments'
    },
    determinator: {
      path: 'determinatorofvalentyp/',
      icon: 'elements/determinator%20of%20valen%20typ.svg',
      labelKey: 'navDeterminator',
      group: 'instruments'
    },
    internationalismes: {
      path: 'internationalismes/',
      icon: 'elements/internationalismes.svg',
      labelKey: 'navInternationalismes',
      group: 'instruments'
    },
    communities: {
      path: 'vordesofcommunites/',
      icon: 'elements/vordesofcommunites.svg',
      labelKey: 'navCommunities',
      group: 'instruments'
    },
    grammar: {
      path: 'grammaticebrevivordes/',
      icon: 'elements/grammaticebrevivordes.svg',
      labelKey: 'navGrammar',
      group: 'instruments'
    },
    altervordes: {
      path: 'altervordes/',
      icon: 'elements/altervordes.svg',
      labelKey: 'navAltervordes',
      group: 'instruments'
    },
    affixes: {
      path: 'affixes/',
      icon: 'elements/affixes.svg',
      labelKey: 'navAffixes',
      group: 'instruments'
    },
    registry: {
      path: 'registre/',
      icon: 'elements/registre.svg',
      labelKey: 'navRegistry',
      group: 'registry'
    }
  };

  const instrumentNavOrder = [
    'indoeuropanvordes',
    'associativ',
    'internationalismes',
    'communities',
    'grammar',
    'altervordes',
    'affixes',
    'determinator'
  ];

  const instrumentNavKeys = instrumentNavOrder.filter((key) => pageNavItems[key]?.group === 'instruments');

  function getCurrentPageNav() {
    const path = window.location.pathname;
    if (path.includes('/indoeuropanvordes/')) return 'indoeuropanvordes';
    if (path.includes('/associativvordes/')) return 'associativ';
    if (path.includes('/determinatorofvalentyp/')) return 'determinator';
    if (path.includes('/internationalismes/')) return 'internationalismes';
    if (path.includes('/vordesofcommunites/')) return 'communities';
    if (path.includes('/grammaticebrevivordes/')) return 'grammar';
    if (path.includes('/altervordes/')) return 'altervordes';
    if (path.includes('/affixes/')) return 'affixes';
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
      selectChoose: 'Выберите вариант',
      selectEmpty: 'Нет вариантов',
      close: 'Закрыть',
      langLabel: 'Язык',
      langChoose: 'Выбрать язык',
      navSimilarita: 'Indoeuropan vordes',
      navAssociativ: 'Associativ vordes',
      navDeterminator: 'Determinator of valen typ',
      navRegistry: 'Registre of vordesen cartes',
      navInternationalismes: 'Internationalismes',
      navCommunities: 'Vordes of communités',
      navGrammar: 'Grammatic e brevi vordes',
      navAltervordes: 'Alter vordes',
      navAffixes: 'Affixes',
      instrumentsLabel: 'Инструменты',
      navAriaLabel: 'Разделы сайта',
      ru: 'Русский',
      en: 'English',
      quickTitle: 'Быстрые действия',
      copyState: 'Скопировать ссылку с данными',
      shared: 'Ссылка скопирована',
      sharedWarn: 'Не удалось создать или скопировать ссылку',
      resetWarningTitle: 'Сбросить данные?',
      resetWarningMessage: 'Введённые данные будут удалены. Это действие нельзя отменить.',
      resetWarningConfirm: 'Сбросить',
      resetWarningCancel: 'Отмена'
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
      selectChoose: 'Choose option',
      selectEmpty: 'No options',
      close: 'Close',
      langLabel: 'Language',
      langChoose: 'Choose language',
      navSimilarita: 'Indoeuropan vordes',
      navAssociativ: 'Associativ vordes',
      navDeterminator: 'Determinator of valen typ',
      navRegistry: 'Registre of vordesen cartes',
      navInternationalismes: 'Internationalismes',
      navCommunities: 'Vordes of communités',
      navGrammar: 'Grammatic e brevi vordes',
      navAltervordes: 'Alter vordes',
      navAffixes: 'Affixes',
      instrumentsLabel: 'Instruments',
      navAriaLabel: 'Site sections',
      ru: 'Русский',
      en: 'English',
      quickTitle: 'Quick actions',
      copyState: 'Copy link with data',
      shared: 'Link copied',
      sharedWarn: 'Could not create or copy link',
      resetWarningTitle: 'Reset data?',
      resetWarningMessage: 'Entered data will be deleted. This action cannot be undone.',
      resetWarningConfirm: 'Reset',
      resetWarningCancel: 'Cancel'
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
    <img class="top-brand-logo" src="${joinUrl('elements/interalen%20logo.svg')}" alt="Interal logo" />
    <span class="top-brand-text">Interal</span>
  `;

  const desktopControls = document.createElement('div');
  desktopControls.className = 'top-desktop-controls';
  desktopControls.innerHTML = `
    <div class="top-desktop-dropdown" data-instruments-menu>
      <button class="top-desktop-link top-desktop-dropdown-trigger" type="button" aria-expanded="false" aria-haspopup="true">
        <span class="top-desktop-link-main" data-instruments-label></span>
      </button>
      <div class="top-desktop-dropdown-menu" role="menu">
        ${instrumentNavKeys.map((key) => {
          const item = pageNavItems[key];
          return `<a class="top-desktop-dropdown-link" href="${joinUrl(item.path)}" data-nav="${key}" role="menuitem"><img class="top-desktop-dropdown-icon" src="${joinUrl(item.icon)}" alt="" aria-hidden="true" /><span class="top-desktop-link-main"></span></a>`;
        }).join('')}
      </div>
    </div>
    <a class="top-desktop-link" href="${joinUrl(pageNavItems.registry.path)}" data-nav="registry">
      <span class="top-desktop-link-main"></span>
    </a>
  `;

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
      <div class="menu-nav-section" data-menu-section="instruments">
        <div class="menu-nav-heading"></div>
        ${instrumentNavKeys.map((key) => {
          const item = pageNavItems[key];
          return `<a class="menu-nav-link" href="${joinUrl(item.path)}" data-nav="${key}"><img class="menu-nav-icon" src="${joinUrl(item.icon)}" alt="" aria-hidden="true" /><span class="menu-nav-main"></span></a>`;
        }).join('')}
      </div>
      <div class="menu-divider menu-divider--mobile" aria-hidden="true"></div>
      <a class="menu-nav-link" href="${joinUrl(pageNavItems.registry.path)}" data-nav="registry"><img class="menu-nav-icon" src="${joinUrl(pageNavItems.registry.icon)}" alt="" aria-hidden="true" /><span class="menu-nav-main"></span></a>
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
      <button class="menu-lang-btn menu-lang-trigger" type="button" data-lang-trigger="true" aria-label="Language" aria-expanded="false">
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


  function currentLang() {
    return localStorage.getItem('interal.lang') === 'en' ? 'en' : 'ru';
  }

  function getLang() {
    return currentLang();
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
    const targets = document.querySelectorAll('.menu-nav-link, .menu-copy-btn, .top-desktop-link, .top-desktop-dropdown-link, .menu-lang-modal .menu-lang-btn');
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
    document.documentElement.lang = currentLang();

    const t = i18n[nextLang];
    const isDesktop = window.matchMedia('(min-width: 980px)').matches;
    menuButton.setAttribute('aria-label', t.openMenu);
    const menuTitle = menu.querySelector('.menu-title');
    if (menuTitle) menuTitle.textContent = isDesktop ? t.desktopMenuLabel : t.mobileMenuLabel;
    const siteNav = menu.querySelector('.menu-nav');
    if (siteNav) siteNav.setAttribute('aria-label', t.navAriaLabel);
    menuButtonText.textContent = isDesktop ? t.desktopMenuLabel : t.mobileMenuLabel;

    const labels = Object.fromEntries(Object.entries(pageNavItems).map(([key, item]) => [key, t[item.labelKey]]));
    menu.querySelectorAll('[data-nav]').forEach((link) => {
      const label = labels[link.dataset.nav] || '';
      const main = link.querySelector('.menu-nav-main, .top-desktop-link-main');
      if (main) main.textContent = label;
    });
    const menuHeading = menu.querySelector('.menu-nav-heading');
    if (menuHeading) menuHeading.textContent = t.instrumentsLabel;
    const instrumentsLabel = desktopControls.querySelector('[data-instruments-label]');
    if (instrumentsLabel) instrumentsLabel.textContent = t.instrumentsLabel;
    const instrumentsTrigger = desktopControls.querySelector('.top-desktop-dropdown-trigger');
    if (instrumentsTrigger) instrumentsTrigger.setAttribute('aria-label', t.instrumentsLabel);
    desktopControls.querySelectorAll('[data-nav]').forEach((link) => {
      const main = link.querySelector('.top-desktop-link-main');
      if (main) main.textContent = labels[link.dataset.nav] || '';
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
    logo.src = joinUrl('elements/interalen%20logo.svg');
    logo.alt = 'Interal logo';
  }



  function getUiText(key) {
    const lang = getLang();
    return (i18n[lang] && i18n[lang][key]) || i18n.ru[key] || key;
  }

  function getOrCreateResetConfirmDialog() {
    let dialog = document.querySelector('.interal-confirm-overlay[data-confirm="reset"]');
    if (dialog) return dialog;

    dialog = document.createElement('div');
    dialog.className = 'interal-confirm-overlay';
    dialog.dataset.confirm = 'reset';
    dialog.hidden = true;
    dialog.innerHTML = `
      <div class="interal-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="interal-reset-confirm-title" aria-describedby="interal-reset-confirm-message">
        <div class="interal-confirm-icon" aria-hidden="true">!</div>
        <div class="interal-confirm-content">
          <h2 class="interal-confirm-title" id="interal-reset-confirm-title"></h2>
          <p class="interal-confirm-message" id="interal-reset-confirm-message"></p>
        </div>
        <div class="interal-confirm-actions">
          <button class="interal-btn interal-btn--secondary" type="button" data-confirm-cancel></button>
          <button class="interal-btn interal-btn--primary" type="button" data-confirm-ok></button>
        </div>
      </div>`;
    document.body.appendChild(dialog);
    return dialog;
  }

  function confirmReset(options = {}) {
    const dialog = getOrCreateResetConfirmDialog();
    const title = dialog.querySelector('#interal-reset-confirm-title');
    const message = dialog.querySelector('#interal-reset-confirm-message');
    const cancelBtn = dialog.querySelector('[data-confirm-cancel]');
    const okBtn = dialog.querySelector('[data-confirm-ok]');
    title.textContent = options.title || getUiText('resetWarningTitle');
    message.textContent = options.message || getUiText('resetWarningMessage');
    cancelBtn.textContent = options.cancelLabel || getUiText('resetWarningCancel');
    okBtn.textContent = options.confirmLabel || getUiText('resetWarningConfirm');

    return new Promise((resolve) => {
      const previousFocus = document.activeElement;
      const finish = (value) => {
        dialog.hidden = true;
        dialog.classList.remove('show');
        document.removeEventListener('keydown', onKeydown);
        cancelBtn.removeEventListener('click', onCancel);
        okBtn.removeEventListener('click', onOk);
        dialog.removeEventListener('click', onOverlayClick);
        if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
        resolve(value);
      };
      const onCancel = () => finish(false);
      const onOk = () => finish(true);
      const onOverlayClick = (event) => { if (event.target === dialog) finish(false); };
      const onKeydown = (event) => {
        if (event.key === 'Escape') finish(false);
        if (event.key === 'Tab') {
          const focusable = [cancelBtn, okBtn];
          const current = focusable.indexOf(document.activeElement);
          if (event.shiftKey && (current <= 0)) { event.preventDefault(); okBtn.focus(); }
          else if (!event.shiftKey && current === focusable.length - 1) { event.preventDefault(); cancelBtn.focus(); }
        }
      };
      cancelBtn.addEventListener('click', onCancel);
      okBtn.addEventListener('click', onOk);
      dialog.addEventListener('click', onOverlayClick);
      document.addEventListener('keydown', onKeydown);
      dialog.hidden = false;
      requestAnimationFrame(() => dialog.classList.add('show'));
      cancelBtn.focus();
    });
  }

  function cleanResetUrl() {
    const url = new URL(window.location.href);

    url.searchParams.delete('s');
    url.searchParams.delete('state');
    url.searchParams.delete('sid');

    if (/state=/.test(url.hash)) {
      url.hash = '';
    }

    return `${url.pathname}${url.search}${url.hash}`;
  }

  function clearResetStorage(extraKeys = []) {
    const keys = new Set(extraKeys);

    keys.add('interal_associative_state');
    keys.add('determinator-valentyp-state-v1');

    try {
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const key = localStorage.key(i);
        if (!key) continue;

        if (
          key.startsWith('interal.pageState:') ||
          key.startsWith('interal.explicitPageState:') ||
          keys.has(key)
        ) {
          localStorage.removeItem(key);
        }
      }
    } catch (_) {}

    for (const key of keys) {
      try {
        localStorage.removeItem(key);
      } catch (_) {}
    }
  }

  async function resetPageState(options = {}) {
    const message = options.message || 'Сбросить данные?';

    const confirmed = options.skipConfirm
      ? true
      : await (
          window.InteralUI?.confirmReset?.({
            title: options.title,
            message,
            confirmLabel: options.confirmLabel,
            cancelLabel: options.cancelLabel
          })
          ?? Promise.resolve(window.confirm(message))
        );

    if (!confirmed) return false;

    clearResetStorage(options.storageKeys || []);

    const cleanUrl = cleanResetUrl();
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    try {
      window.history.replaceState(null, '', cleanUrl);
    } catch (_) {}

    if (currentUrl === cleanUrl) {
      window.location.reload();
    } else {
      window.location.replace(cleanUrl);
    }

    setTimeout(() => {
      window.location.href = cleanUrl;
    }, 150);

    return true;
  }

  window.InteralUI = Object.assign(window.InteralUI || {}, {
    confirmReset,
    resetPageState
  });

  function markCurrentPage() {
    const currentNav = getCurrentPageNav();

    document.querySelectorAll('[data-nav]').forEach((link) => {
      const isCurrent = !!currentNav && link.dataset.nav === currentNav;
      link.classList.toggle('is-active', isCurrent);
      if (isCurrent) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
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


  function syncTopbarScrollState() {
    document.body.classList.toggle(
      'nav-scrolled',
      window.scrollY > 16
    );
  }

  syncTopbarScrollState();

  window.addEventListener(
    'scroll',
    syncTopbarScrollState,
    { passive: true }
  );

  const glassTopbar = document.querySelector('.top-nav-window');

  const precisePointer = window.matchMedia(
    '(hover: hover) and (pointer: fine)'
  ).matches;

  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  if (glassTopbar && precisePointer && !reducedMotion) {
    glassTopbar.addEventListener('pointermove', (event) => {
      const rect = glassTopbar.getBoundingClientRect();

      const x =
        ((event.clientX - rect.left) / rect.width) * 100;

      glassTopbar.style.setProperty(
        '--glass-highlight-x',
        `${Math.max(8, Math.min(92, x))}%`
      );
    });

    glassTopbar.addEventListener('pointerleave', () => {
      glassTopbar.style.setProperty(
        '--glass-highlight-x',
        '28%'
      );
    });
  }

  document.addEventListener('mouseover', (event) => {
    const target = event.target.closest?.('.menu-nav-link, .menu-copy-btn, .top-desktop-link, .top-desktop-dropdown-link, .menu-lang-modal .menu-lang-btn');
    if (target) requestAnimationFrame(applyAdaptiveTextContrast);
  });

  initTheme();
  applyLanguage(getLang());
  applyMobileBrandLogo();
  window.addEventListener('resize', applyMobileBrandLogo);
  markCurrentPage();
  // Shared page-state restore is intentionally disabled: reset must not reapply URL/hash state.


  const instrumentsMenu = desktopControls.querySelector('[data-instruments-menu]');
  const instrumentsTrigger = desktopControls.querySelector('.top-desktop-dropdown-trigger');
  if (instrumentsMenu && instrumentsTrigger) {
    instrumentsMenu.addEventListener('mouseenter', () => instrumentsTrigger.setAttribute('aria-expanded', 'true'));
    instrumentsMenu.addEventListener('mouseleave', () => instrumentsTrigger.setAttribute('aria-expanded', 'false'));
    instrumentsMenu.addEventListener('focusin', () => instrumentsTrigger.setAttribute('aria-expanded', 'true'));
    instrumentsMenu.addEventListener('focusout', (event) => {
      if (!instrumentsMenu.contains(event.relatedTarget)) instrumentsTrigger.setAttribute('aria-expanded', 'false');
    });
  }

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


function initCustomSelects(root = document) {
  setupModalSelects(root);
}

function setupModalSelects(root = document) {
  const selectRoot = root && root.matches?.('select.js-custom-select') ? root.parentNode || document : root;
  const selects = root && root.matches?.('select.js-custom-select')
    ? [root]
    : Array.from((selectRoot || document).querySelectorAll('select.js-custom-select'));

  if (!selects.length) return;

  let modal = document.querySelector('.interal-select-modal');

  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'interal-select-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="interal-select-modal-backdrop" data-select-close></div>
      <div class="interal-select-modal-panel" role="dialog" aria-modal="true" aria-labelledby="interalSelectModalTitle" tabindex="-1">
        <div class="interal-select-modal-head">
          <strong class="interal-select-modal-title" id="interalSelectModalTitle"></strong>
          <button class="interal-select-modal-close" type="button" data-select-close aria-label="Закрыть">×</button>
        </div>
        <div class="interal-select-modal-options" role="listbox"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const title = modal.querySelector('.interal-select-modal-title');
  const closeButton = modal.querySelector('.interal-select-modal-close');
  const optionsBox = modal.querySelector('.interal-select-modal-options');

  if (modal.dataset.modalSelectListeners !== 'true') {
    modal.dataset.modalSelectListeners = 'true';
    modal._modalSelectState = { activeSelect: null, activeTrigger: null };

    modal._closeModalSelect = function closeModal() {
      const state = modal._modalSelectState;
      modal.hidden = true;
      optionsBox.innerHTML = '';

      if (state.activeTrigger) {
        state.activeTrigger.setAttribute('aria-expanded', 'false');
        state.activeTrigger.focus();
      }

      state.activeSelect = null;
      state.activeTrigger = null;
    };

    modal.addEventListener('click', (event) => {
      if (event.target.closest('[data-select-close]')) {
        modal._closeModalSelect();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (modal.hidden || event.key !== 'Escape') return;
      modal._closeModalSelect();
    });
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function getVisibleOptions(select) {
    return Array.from(select.options).filter((option) => !option.hidden);
  }

  function getSelectTrigger(select) {
    return select.closest('.interal-select-modal-field')?.querySelector(':scope > .interal-select-trigger');
  }

  function ensureSelectHasValidSelection(select) {
    const options = getVisibleOptions(select);
    if (!options.length) return;

    const selected = select.options[select.selectedIndex];
    if (!selected || selected.hidden || selected.disabled) {
      const firstAvailable = options.find((option) => !option.disabled) || options[0];
      if (firstAvailable) select.value = firstAvailable.value;
    }
  }

  function buildModalOptions(select, trigger) {
    optionsBox.replaceChildren();
    ensureSelectHasValidSelection(select);

    const options = getVisibleOptions(select);

    if (!options.length) {
      const empty = document.createElement('div');
      empty.className = 'interal-select-empty';
      empty.textContent = getUiText('selectEmpty') || 'Нет вариантов';
      optionsBox.appendChild(empty);
      return;
    }

    options.forEach((option) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'interal-select-option';
      btn.dataset.value = option.value;
      btn.disabled = option.disabled;
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', String(option.selected));

      const labelText = document.createElement('span');
      labelText.className = 'interal-select-option-text';
      labelText.textContent = option.textContent || option.label || option.value;

      const check = document.createElement('span');
      check.className = 'interal-select-option-check';
      check.setAttribute('aria-hidden', 'true');
      check.textContent = '✓';

      btn.append(labelText, check);

      if (option.selected) {
        btn.classList.add('is-selected');
      }

      btn.addEventListener('click', () => {
        if (option.disabled) return;

        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        select._customSelectRefresh?.();

        modal._closeModalSelect();
      });

      optionsBox.appendChild(btn);
    });
  }

  function openModal(select, trigger) {
    if (select.disabled) return;

    const state = modal._modalSelectState;
    state.activeSelect = select;
    state.activeTrigger = trigger;

    const label = select.id ? document.querySelector(`label[for="${cssEscape(select.id)}"]`) : null;
    title.textContent = label?.textContent?.trim() || getUiText('selectChoose');
    closeButton?.setAttribute('aria-label', getUiText('close'));
    buildModalOptions(select, trigger);

    modal.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');

    const selectedButton = optionsBox.querySelector('.is-selected:not(:disabled)') || optionsBox.querySelector('.interal-select-option:not(:disabled)');
    selectedButton?.focus();
  }

  selects.forEach((select) => {
    if (select.dataset.modalSelectReady === 'true') {
      select.tabIndex = -1;
      if (select.getAttribute('aria-hidden') !== 'true') select.setAttribute('aria-hidden', 'true');
      const existingTrigger = getSelectTrigger(select);
      if (existingTrigger) {
        select._modalSelectRefresh?.();
        return;
      }

      select.dataset.modalSelectReady = 'false';
    }
    select.dataset.modalSelectReady = 'true';
    select.tabIndex = -1;
    if (select.getAttribute('aria-hidden') !== 'true') select.setAttribute('aria-hidden', 'true');

    let wrapper = select.closest('.interal-select-modal-field');

    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'interal-select-modal-field';
      wrapper.dataset.modalSelect = 'true';
      select.parentNode.insertBefore(wrapper, select);
      wrapper.appendChild(select);
    }

    const trigger = document.createElement('button');
    trigger.className = 'interal-select-trigger';
    trigger.type = 'button';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'false');

    const text = document.createElement('span');
    text.className = 'interal-select-trigger-text';

    const icon = document.createElement('span');
    icon.className = 'interal-select-trigger-icon';
    icon.setAttribute('aria-hidden', 'true');

    trigger.append(text, icon);
    wrapper.appendChild(trigger);

    function syncFromSelect() {
      ensureSelectHasValidSelection(select);

      const selected = select.options[select.selectedIndex];
      text.textContent = selected ? selected.textContent : '';

      trigger.disabled = select.disabled;
      trigger.setAttribute('aria-disabled', String(select.disabled));

      const state = modal._modalSelectState;
      if (!modal.hidden && state?.activeSelect === select) {
        buildModalOptions(select, trigger);
      }
    }

    trigger.addEventListener('click', () => openModal(select, trigger));
    select.addEventListener('change', syncFromSelect);

    syncFromSelect();
    select._modalSelectRefresh = syncFromSelect;
    select._customSelectRefresh = syncFromSelect;
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setupModalSelects());
} else {
  setupModalSelects();
}

if (window.MutationObserver) {
  const customSelectObserver = new MutationObserver((mutations) => {
    const selectsToRefresh = new Set();
    const rootsToInit = new Set();

    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        if (mutation.target instanceof HTMLSelectElement && mutation.target.matches('select.js-custom-select')) {
          selectsToRefresh.add(mutation.target);
        }

        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;

          if (node.matches?.('select.js-custom-select')) {
            rootsToInit.add(node);
            selectsToRefresh.add(node);
          }

          node.querySelectorAll?.('select.js-custom-select').forEach((select) => {
            rootsToInit.add(select);
            selectsToRefresh.add(select);
          });

          if (node.tagName === 'OPTION' && node.parentElement?.matches?.('select.js-custom-select')) {
            selectsToRefresh.add(node.parentElement);
          }
        });

        if (mutation.target instanceof HTMLOptionElement && mutation.target.parentElement?.matches?.('select.js-custom-select')) {
          selectsToRefresh.add(mutation.target.parentElement);
        }
      }

      if (mutation.type === 'attributes') {
        const target = mutation.target;
        if (target instanceof HTMLSelectElement && target.matches('select.js-custom-select')) {
          selectsToRefresh.add(target);
        }
        if (target instanceof HTMLOptionElement && target.parentElement?.matches?.('select.js-custom-select')) {
          selectsToRefresh.add(target.parentElement);
        }
      }

      if (mutation.type === 'characterData') {
        const option = mutation.target.parentElement?.closest?.('option');
        const select = option?.parentElement;
        if (select?.matches?.('select.js-custom-select')) {
          selectsToRefresh.add(select);
        }
      }
    });

    rootsToInit.forEach((root) => setupModalSelects(root));
    selectsToRefresh.forEach((select) => select._customSelectRefresh?.());
  });

  const observeCustomSelects = () => {
    if (!document.body || document.body.dataset.customSelectObserver === 'true') return;
    document.body.dataset.customSelectObserver = 'true';
    customSelectObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['disabled', 'hidden', 'label', 'value', 'selected', 'class', 'aria-hidden']
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeCustomSelects);
  } else {
    observeCustomSelects();
  }
}


window.initCustomSelects = initCustomSelects;
window.refreshCustomSelect = function refreshCustomSelect(selectOrId) {
  const select = typeof selectOrId === 'string'
    ? document.getElementById(selectOrId)
    : selectOrId;

  if (!select || !select.matches?.('select.js-custom-select')) return;

  setupModalSelects(select);
  select._customSelectRefresh?.();
};
})();

(function () {
  const DEFAULT_TEXTS = {
    ru: { close: 'Закрыть JSON-карточку', title: 'JSON-карточка', useAuthor: 'Указать авторство', authorName: 'Имя или ник', contactType: 'Тип контакта', contact: 'Контакт', generate: 'Сгенерировать карточку', generating: 'Генерация...', output: 'Готовый JSON', copy: 'Скопировать JSON-карточку', copied: 'JSON-карточка скопирована', copiedTitle: 'Скопировано', download: 'Скачать JSON-карточку', empty: 'Сначала сгенерируйте JSON-карточку.', unavailable: 'JSON-карточка доступна только после успешной проверки.' },
    en: { close: 'Close JSON card', title: 'JSON card', useAuthor: 'Add authorship', authorName: 'Name or nickname', contactType: 'Contact type', contact: 'Contact', generate: 'Generate card', generating: 'Generating...', output: 'Generated JSON', copy: 'Copy JSON card', copied: 'JSON card copied', copiedTitle: 'Copied', download: 'Download JSON card', empty: 'Generate the JSON card first.', unavailable: 'The JSON card is available only after a successful check.' }
  };
  const $ = (id) => document.getElementById(id);

  const buttonLoaderTimers = new Map();
  function setButtonStatus(buttonSelector, text, disabled = true, options = {}) {
    const button = typeof buttonSelector === 'string' ? document.querySelector(buttonSelector) : buttonSelector;
    if (!button) return;
    const timerKey = typeof buttonSelector === 'string' ? buttonSelector : button;
    const textEl = button.querySelector('.btn-text') || button;
    const delay = options.delay ?? 700;
    textEl.textContent = text;
    button.disabled = disabled;
    const previousTimer = buttonLoaderTimers.get(timerKey);
    if (previousTimer) clearTimeout(previousTimer);
    if (disabled) {
      const timer = setTimeout(() => button.classList.add('is-loading'), delay);
      buttonLoaderTimers.set(timerKey, timer);
    } else {
      button.classList.remove('is-loading');
      buttonLoaderTimers.delete(timerKey);
    }
  }

  function normalizeContact(type, value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (type === 'email') return raw.startsWith('mailto:') ? raw : `mailto:${raw}`;
    if (type === 'telegram') {
      let name = raw.replace(/^https?:\/\/t\.me\//i, '').replace(/^t\.me\//i, '').replace(/^@/, '').replace(/^\//, '');
      return `https://t.me/${name}`;
    }
    return raw;
  }
  function init(options = {}) {
    const ids = { modalId:'jsonCardModal', openButtonId:'jsonCardBtn', closeButtonId:'closeJsonCardBtn', useAuthorBlockId:'useAuthorBlock', authorFieldsId:'jsonAuthorFields', authorDisplayNameId:'authorDisplayName', authorContactTypeId:'authorContactType', authorContactValueId:'authorContactValue', generateButtonId:'generateJsonCardBtn', outputId:'jsonCardOutput', copyButtonId:'copyJsonCardBtn', downloadButtonId:'downloadJsonCardBtn', ...options };
    const lang = () => (options.getLanguage?.() || document.documentElement.lang || 'ru').startsWith('en') ? 'en' : 'ru';
    const texts = () => ({ ...DEFAULT_TEXTS[lang()], ...(options.getTexts?.() || {}) });
    const output = () => $(ids.outputId);
    let opener = null;
    let timer = 0;
    function applyTexts(){ const t=texts(); const map={jsonCardTitle:t.title,useAuthorBlockLabel:t.useAuthor,authorDisplayNameLabel:t.authorName,authorContactTypeLabel:t.contactType,authorContactValueLabel:t.contact,jsonCardOutputLabel:t.output}; Object.entries(map).forEach(([id,v])=>{ if($(id)) $(id).textContent=v; }); const generateButton=$(ids.generateButtonId); if(generateButton){ const textEl=generateButton.querySelector('.btn-text') || generateButton; textEl.textContent=t.generate; } if($(ids.closeButtonId)) $(ids.closeButtonId).setAttribute('aria-label',t.close); [ids.copyButtonId,ids.downloadButtonId].forEach((id)=>{ const b=$(id); if(!b) return; const v=id===ids.copyButtonId?t.copy:t.download; b.setAttribute('aria-label',v); b.title=v; }); }
    function resetCopy(){ const b=$(ids.copyButtonId); clearTimeout(timer); if(b){ b.classList.remove('is-copied'); b.title=texts().copy; b.setAttribute('aria-label',texts().copy); } }
    function open(){ opener=document.activeElement; if(output()) output().value=''; resetCopy(); const m=$(ids.modalId); if(m){ m.classList.add('show'); m.setAttribute('aria-hidden','false'); } setTimeout(()=>$(ids.generateButtonId)?.focus(),0); }
    function close(){ const m=$(ids.modalId); resetCopy(); if(m){ m.classList.remove('show'); m.setAttribute('aria-hidden','true'); } if(opener?.focus) opener.focus(); }
    function getAuthor(){ if(!$(ids.useAuthorBlockId)?.checked) return null; const name=$(ids.authorDisplayNameId)?.value.trim()||''; const type=$(ids.authorContactTypeId)?.value||'telegram'; const contact=normalizeContact(type,$(ids.authorContactValueId)?.value||''); if(!name && !contact) throw new Error(lang()==='en'?'Add a name or contact for authorship.':'Укажите имя или контакт для авторства.'); const author={}; if(name) author.display_name=name; if(contact) author.contacts=[{type,url:contact}]; return author; }
    async function generate(){ const btn=$(ids.generateButtonId); const t=texts(); try{ if(btn) setButtonStatus(btn, t.generating, true); const author=getAuthor(); if(btn) setButtonStatus(btn, lang()==='en'?'Generating JSON...':'Генерация JSON...', true); let card=await options.buildCard?.({author, onProgress: text => btn && setButtonStatus(btn, text, true)}); if(options.createCardOnServer){ if(btn) setButtonStatus(btn, lang()==='en'?'Saving card...':'Сохранение карточки...', true); card=await options.createCardOnServer(card); } if(btn) setButtonStatus(btn, lang()==='en'?'Formatting JSON...':'Форматирование JSON...', true); const formatted=options.formatCard?options.formatCard(card):JSON.stringify(card,null,2); if(output()) output().value=formatted; if(btn) setButtonStatus(btn, lang()==='en'?'Done':'Готово', true); }catch(e){ if(btn) setButtonStatus(btn, lang()==='en'?'Error':'Ошибка', false); alert(e.message||String(e)); return; }finally{ if(btn) setTimeout(()=>setButtonStatus(btn, texts().generate, false), 800); } }
    async function copy(){ const text=output()?.value||''; if(!text.trim()) return alert(texts().empty); await (window.copyText ? window.copyText(text) : navigator.clipboard.writeText(text)); const b=$(ids.copyButtonId); if(b){ b.classList.add('is-copied'); b.title=texts().copiedTitle; b.setAttribute('aria-label',texts().copied); timer=setTimeout(resetCopy,1500); } }
    function download(){ const text=output()?.value||''; if(!text.trim()) return alert(texts().empty); let filename=options.getFilename?.(text)||'json-card.json'; try{ const id=JSON.parse(text)?.id; if(id) filename=`${id}.json`; }catch{} const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'})); a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href); }
    applyTexts(); $(ids.openButtonId)?.addEventListener('click', open); $(ids.closeButtonId)?.addEventListener('click', close); $(ids.modalId)?.addEventListener('click', e=>{ if(e.target===$(ids.modalId)) close(); }); $(ids.useAuthorBlockId)?.addEventListener('change', e=>{ if($(ids.authorFieldsId)) $(ids.authorFieldsId).style.display=e.target.checked?'grid':'none'; }); $(ids.generateButtonId)?.addEventListener('click', generate); $(ids.copyButtonId)?.addEventListener('click', copy); $(ids.downloadButtonId)?.addEventListener('click', download); document.addEventListener('keydown', e=>{ if(e.key==='Escape' && $(ids.modalId)?.classList.contains('show')) close(); }); document.addEventListener('interal:languagechange', applyTexts); return { open, close, generate, getAuthor, applyTexts };
  }
  window.InteralJsonCardModal = { init, normalizeContact };
  window.InteralButtonStatus = { setButtonStatus };
})();
