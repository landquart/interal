(function () {
  const THEME_KEY = 'interal.theme';
  const LANG_KEY = 'interal.lang';
  const COPY_FEEDBACK_TIMEOUT = 3200;

  let lockedScrollY = 0;

  const currentScript = document.currentScript;
  const sharedPath = currentScript ? new URL(currentScript.src, window.location.href).pathname : '/shared/ui.js';
  const siteRoot = sharedPath.replace(/\/shared\/ui\.js$/, '/');
  const joinUrl = (path) => new URL(path.replace(/^\//, ''), window.location.origin + siteRoot).pathname;

  const canCopyPageState = /\/(indoeuropanvordes|associativvordes|determinatorofvalentyp|internationalismes|vordesofcommunites|grammaticebrevivordes|altervordes)\//.test(window.location.pathname);

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
    registry: {
      path: 'registre/',
      icon: 'elements/registre.svg',
      labelKey: 'navRegistry',
      group: 'registry'
    }
  };

  const instrumentNavKeys = Object.keys(pageNavItems).filter((key) => pageNavItems[key].group === 'instruments');

  function getCurrentPageNav() {
    const path = window.location.pathname;
    if (path.includes('/indoeuropanvordes/')) return 'indoeuropanvordes';
    if (path.includes('/associativvordes/')) return 'associativ';
    if (path.includes('/determinatorofvalentyp/')) return 'determinator';
    if (path.includes('/internationalismes/')) return 'internationalismes';
    if (path.includes('/vordesofcommunites/')) return 'communities';
    if (path.includes('/grammaticebrevivordes/')) return 'grammar';
    if (path.includes('/altervordes/')) return 'altervordes';
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
      navInternationalismes: 'Internationalismes',
      navCommunities: 'Vordes of communités',
      navGrammar: 'Grammatic e brevi vordes',
      navAltervordes: 'Alter vordes',
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
    document.documentElement.lang = nextLang;

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
    const lang = getCurrentLanguage();
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

    const arrow = document.createElement('img');
    arrow.className = 'custom-select-arrow';
    arrow.src = joinUrl('elements/Alt Arrow Down.svg');
    arrow.alt = '';
    arrow.setAttribute('aria-hidden', 'true');

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
      arrow.src = joinUrl('elements/Alt Arrow Down.svg');
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
      arrow.src = joinUrl('elements/Alt Arrow Up.svg');
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
