(function () {
  const THEME_KEY = 'interal.theme';
  const LANG_KEY = 'interal.lang';
  const COPY_FEEDBACK_TIMEOUT = 3200;

  let lockedScrollY = 0;
  let menuScrollLocked = false;

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
    },
    logoName: {
      path: 'logotypenomine/',
      icon: '',
      mobileIcon: 'elements/interalen%20logo.svg',
      labelKey: 'navLogoName',
      group: 'identity'
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


  function getTelegramSafeAreaInset(name) {
    const webApp = window.Telegram?.WebApp;
    const contentInset = webApp?.contentSafeAreaInset?.[name];
    const safeInset = webApp?.safeAreaInset?.[name];
    return Math.max(Number(contentInset) || 0, Number(safeInset) || 0, 0);
  }

  function syncVisualViewportVars() {
    const vv = window.visualViewport;
    const top = vv ? Math.max(0, vv.offsetTop || 0) : 0;
    const height = vv ? Math.max(0, vv.height || window.innerHeight || 0) : (window.innerHeight || 0);
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--visual-viewport-top', `${top}px`);
    if (height) rootStyle.setProperty('--visual-viewport-height', `${height}px`);
    rootStyle.setProperty('--app-safe-top', `${getTelegramSafeAreaInset('top')}px`);
    rootStyle.setProperty('--app-safe-bottom', `${getTelegramSafeAreaInset('bottom')}px`);
  }

  syncVisualViewportVars();
  window.addEventListener('resize', syncVisualViewportVars, { passive: true });
  window.addEventListener('orientationchange', syncVisualViewportVars, { passive: true });
  window.visualViewport?.addEventListener('resize', syncVisualViewportVars, { passive: true });
  window.visualViewport?.addEventListener('scroll', syncVisualViewportVars, { passive: true });

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
    if (path.includes('/logotypenomine/')) return 'logoName';
    return '';
  }

  const i18n = {
    ru: {
      openMenu: 'Открыть меню',
      closeMenu: 'Закрыть меню',
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
      navRegistry: 'Registre of lexical cartes',
      navInternationalismes: 'Internationalismes',
      navCommunities: 'Vordes of communités',
      navGrammar: 'Grammatic e brevi vordes',
      navAltervordes: 'Alter vordes',
      navAffixes: 'Affixes',
      navLogoName: 'Логотип и название',
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
      resetWarningCancel: 'Отмена',
      backToTop: 'Вернуться к началу страницы'
    },
    en: {
      openMenu: 'Open menu',
      closeMenu: 'Close menu',
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
      navRegistry: 'Registre of lexical cartes',
      navInternationalismes: 'Internationalismes',
      navCommunities: 'Vordes of communités',
      navGrammar: 'Grammatic e brevi vordes',
      navAltervordes: 'Alter vordes',
      navAffixes: 'Affixes',
      navLogoName: 'Logo and name',
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
      resetWarningCancel: 'Cancel',
      backToTop: 'Back to top'
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
  const sidebarIconSource = joinUrl('elements/sidebar_corrected_v2.svg');
  menuButtonIcon.innerHTML = `
    <svg class="sidebar-state-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <use class="sidebar-state-outline" href="${sidebarIconSource}#sidebar-outline" />
      <use class="sidebar-state-divider" href="${sidebarIconSource}#sidebar-divider" />
    </svg>
  `;

  const menuButtonText = document.createElement('span');
  menuButtonText.className = 'top-menu-btn-text';
  menuButtonText.textContent = 'Меню';

  menuButton.append(menuButtonIcon, menuButtonText);

  const brandLink = document.createElement('a');
  brandLink.className = 'top-brand';
  brandLink.href = joinUrl('index.html');
  brandLink.innerHTML = `
    <img
      class="top-brand-logo"
      src="${joinUrl('elements/interalen%20logo.svg')}"
      alt=""
      aria-hidden="true"
    />
    <span class="top-brand-text">Interal</span>
  `;

  function navIconHtml(item, className) {
    return item.icon ? `<img class="${className}" src="${joinUrl(item.icon)}" alt="" aria-hidden="true" />` : '';
  }

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
          return `<a class="top-desktop-dropdown-link" href="${joinUrl(item.path)}" data-nav="${key}" role="menuitem">${navIconHtml(item, 'top-desktop-dropdown-icon')}<span class="top-desktop-link-main"></span></a>`;
        }).join('')}
      </div>
    </div>
    <a class="top-desktop-link" href="${joinUrl(pageNavItems.registry.path)}" data-nav="registry">
      <span class="top-desktop-link-main"></span>
    </a>
    <a class="top-desktop-link" href="${joinUrl(pageNavItems.logoName.path)}" data-nav="logoName">
      <span class="top-desktop-link-main"></span>
    </a>
  `;

  const mobileCurrentPageLink = document.createElement('a');
  mobileCurrentPageLink.className = 'top-current-page-link';
  mobileCurrentPageLink.setAttribute('aria-current', 'page');
  mobileCurrentPageLink.innerHTML = '<img class="top-current-page-icon" alt="" aria-hidden="true" />';

  const overlay = document.createElement('div');
  overlay.className = 'side-menu-overlay';

  const backToTopButton = document.createElement('button');
  backToTopButton.className = 'interal-back-to-top';
  backToTopButton.type = 'button';
  backToTopButton.setAttribute('aria-label', i18n.ru.backToTop);
  backToTopButton.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6.5 14.5 12 9l5.5 5.5" />
    </svg>
  `;

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
          return `<a class="menu-nav-link" href="${joinUrl(item.path)}" data-nav="${key}">${navIconHtml(item, 'menu-nav-icon')}<span class="menu-nav-main"></span></a>`;
        }).join('')}
      </div>
      <div class="menu-divider menu-divider--mobile" aria-hidden="true"></div>
      <a class="menu-nav-link" href="${joinUrl(pageNavItems.registry.path)}" data-nav="registry">${navIconHtml(pageNavItems.registry, 'menu-nav-icon')}<span class="menu-nav-main"></span></a>
      <a class="menu-nav-link" href="${joinUrl(pageNavItems.logoName.path)}" data-nav="logoName">${navIconHtml(pageNavItems.logoName, 'menu-nav-icon')}<span class="menu-nav-main"></span></a>
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
    <div class="menu-lang-modal select-modal-overlay profile-language-modal" hidden>
      <div class="menu-lang-modal-content profile-language-modal-card" role="dialog" aria-modal="true" aria-label="Language">
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

  function syncMenuButtonState() {
    const expanded = document.body.classList.contains('menu-open');
    const labels = i18n[currentLang()];
    menuButton.setAttribute('aria-expanded', String(expanded));
    menuButton.setAttribute('aria-label', expanded ? labels.closeMenu : labels.openMenu);
  }

  function lockPageScroll() {
    if (menuScrollLocked) return;
    lockedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    document.body.style.setProperty('--menu-scroll-y', `-${lockedScrollY}px`);
    document.documentElement.classList.add('menu-scroll-locked');
    menuScrollLocked = true;
  }

  function unlockPageScroll() {
    if (!menuScrollLocked) {
      document.documentElement.classList.remove('menu-scroll-locked');
      document.body.style.removeProperty('--menu-scroll-y');
      return;
    }
    document.documentElement.classList.remove('menu-scroll-locked');
    document.body.style.removeProperty('--menu-scroll-y');
    menuScrollLocked = false;
    window.scrollTo(0, lockedScrollY);
  }

  function syncMenuScrollLock() {
    if (document.body.classList.contains('menu-open')) lockPageScroll();
    else unlockPageScroll();
  }

  function closeMenu() {
    const wasOpen = document.body.classList.contains('menu-open');
    document.body.classList.remove('menu-open');
    toggleLanguageList(false);
    if (wasOpen) unlockPageScroll();
    syncMenuButtonState();
    scheduleScrollUiState();
  }

  function openMenu() {
    if (!document.body.classList.contains('menu-open')) lockPageScroll();
    document.body.classList.add('menu-open');
    syncMenuButtonState();
    scheduleScrollUiState();
  }

  function toggleLanguageList(force, source) {
    const list = menu.querySelector('.menu-lang-modal');
    const trigger = menu.querySelector('[data-lang-trigger="true"]');
    if (!list || !trigger) return;
    const shouldOpen = typeof force === 'boolean'
      ? force
      : !document.body.classList.contains('menu-modal-open');
    const panel = list.querySelector('.menu-lang-modal-content');
    const motion = window.InteralModalMotion;
    const applyOpen = () => {
      list.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      document.body.classList.add('menu-modal-open');
    };
    const applyClose = () => {
      list.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-modal-open');
    };

    if (!motion) {
      if (shouldOpen) applyOpen();
      else applyClose();
      return Promise.resolve();
    }

    if (shouldOpen) {
      return motion.open(list, {
        panel,
        trigger: source || trigger,
        applyOpen,
        focusTarget: () => list.querySelector('.menu-lang-btn.is-active, .menu-lang-btn[data-lang]')
      });
    }

    return motion.close(list, { panel, applyClose, focusTarget: trigger });
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
    syncMenuButtonState();
    backToTopButton.setAttribute('aria-label', t.backToTop);
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

  function applyBrandLogo() {
    const logo = brandLink.querySelector('.top-brand-logo');
    if (!logo) return;
    logo.src = joinUrl('elements/interalen%20logo.svg');
    logo.alt = '';
    logo.setAttribute('aria-hidden', 'true');
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
      let finishing = false;
      const finish = async (value) => {
        if (finishing) return;
        finishing = true;
        document.removeEventListener('keydown', onKeydown);
        cancelBtn.removeEventListener('click', onCancel);
        okBtn.removeEventListener('click', onOk);
        dialog.removeEventListener('click', onOverlayClick);
        const applyClose = () => {
          dialog.classList.remove('show');
          dialog.hidden = true;
        };
        if (window.InteralModalMotion) {
          await window.InteralModalMotion.close(dialog, {
            panel: dialog.querySelector('.interal-confirm-dialog'),
            applyClose,
            focusTarget: previousFocus
          });
        } else {
          applyClose();
          previousFocus?.focus?.();
        }
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
      const applyOpen = () => {
        dialog.hidden = false;
        dialog.classList.add('show');
      };
      if (window.InteralModalMotion) {
        window.InteralModalMotion.open(dialog, {
          panel: dialog.querySelector('.interal-confirm-dialog'),
          trigger: previousFocus,
          applyOpen,
          focusTarget: cancelBtn
        });
      } else {
        applyOpen();
        cancelBtn.focus();
      }
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
    const hideMobileCurrentPageLink = !currentItem || currentNav === 'logoName';
    mobileCurrentPageLink.hidden = hideMobileCurrentPageLink;
    if (currentItem) {
      const t = i18n[getLang()];
      const label = t[currentItem.labelKey];
      const mobileIcon = currentItem.mobileIcon || currentItem.icon || '';
      const icon = mobileCurrentPageLink.querySelector('.top-current-page-icon');
      mobileCurrentPageLink.href = joinUrl(currentItem.path);
      mobileCurrentPageLink.setAttribute('aria-label', label);
      mobileCurrentPageLink.setAttribute('title', label);
      mobileCurrentPageLink.classList.toggle('top-current-page-link--text', !mobileIcon);
      if (icon) {
        icon.hidden = !mobileIcon;
        if (mobileIcon) icon.src = joinUrl(mobileIcon);
      }
      mobileCurrentPageLink.dataset.label = mobileIcon ? '' : label;
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
  document.body.append(backToTopButton);


  let scrollUiFrame = 0;

  function hasBlockingOverlay() {
    return document.body.classList.contains('menu-open')
      || document.body.classList.contains('select-modal-open')
      || document.body.classList.contains('menu-modal-open')
      || Boolean(document.querySelector('.interal-confirm-overlay.show, #jsonCardModal.show'));
  }

  function syncScrollUiState() {
    scrollUiFrame = 0;
    const scrollY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
    const revealAt = Math.max(480, Math.round((window.innerHeight || 0) * 0.7));
    document.body.classList.toggle('nav-scrolled', scrollY > 16);
    backToTopButton.classList.toggle('is-visible', scrollY > revealAt && !hasBlockingOverlay());
  }

  function scheduleScrollUiState() {
    if (scrollUiFrame) return;
    scrollUiFrame = requestAnimationFrame(syncScrollUiState);
  }

  syncScrollUiState();

  window.addEventListener(
    'scroll',
    scheduleScrollUiState,
    { passive: true }
  );
  window.addEventListener('resize', scheduleScrollUiState, { passive: true });

  backToTopButton.addEventListener('click', () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, left: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  if (window.MutationObserver) {
    const menuStateObserver = new window.MutationObserver(() => {
      syncMenuScrollLock();
      syncMenuButtonState();
      scheduleScrollUiState();
    });
    menuStateObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  document.addEventListener('mouseover', (event) => {
    const target = event.target.closest?.('.menu-nav-link, .menu-copy-btn, .top-desktop-link, .top-desktop-dropdown-link, .menu-lang-modal .menu-lang-btn');
    if (target) requestAnimationFrame(applyAdaptiveTextContrast);
  });

  initTheme();
  applyLanguage(getLang());
  applyBrandLogo();
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
        toggleLanguageList(undefined, btn);
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
    modal.className = 'interal-select-modal select-modal-overlay';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="interal-select-modal-backdrop" data-select-close></div>
      <div class="interal-select-modal-panel" role="dialog" aria-modal="true" aria-labelledby="interalSelectModalTitle" tabindex="-1">
        <div class="interal-select-modal-head">
          <strong class="interal-select-modal-title" id="interalSelectModalTitle"></strong>
          <button class="interal-select-modal-close" type="button" data-select-close aria-label="Закрыть">×</button>
        </div>
        <div class="interal-select-modal-options" role="listbox" tabindex="-1"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const title = modal.querySelector('.interal-select-modal-title');
  const closeButton = modal.querySelector('.interal-select-modal-close');
  const optionsBox = modal.querySelector('.interal-select-modal-options');

  if (modal.dataset.modalSelectListeners !== 'true') {
    modal.dataset.modalSelectListeners = 'true';
    modal._modalSelectState = { activeSelect: null, activeTrigger: null, scrollY: 0, previousFocus: null };

    modal._closeModalSelect = function closeModal() {
      const state = modal._modalSelectState;
      const focusTarget = state.activeTrigger || state.previousFocus;
      const applyClose = () => {
        modal.hidden = true;
        document.body.classList.remove('select-modal-open');
        document.body.style.removeProperty('--select-modal-scroll-y');
        optionsBox.innerHTML = '';
        state.activeTrigger?.setAttribute('aria-expanded', 'false');
        window.scrollTo(0, state.scrollY || 0);
        state.activeSelect = null;
        state.activeTrigger = null;
        state.previousFocus = null;
        state.scrollY = 0;
      };
      if (window.InteralModalMotion) {
        return window.InteralModalMotion.close(modal, {
          panel: modal.querySelector('.interal-select-modal-panel'),
          backdrop: modal.querySelector('.interal-select-modal-backdrop'),
          applyClose,
          focusTarget
        });
      }
      applyClose();
      focusTarget?.focus?.();
      return Promise.resolve();
    };

    modal.addEventListener('click', (event) => {
      if (event.target.closest('[data-select-close]')) {
        modal._closeModalSelect();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (modal.hidden) return;
      const enabledOptions = Array.from(optionsBox.querySelectorAll('.interal-select-option:not(:disabled)'));
      const currentIndex = enabledOptions.indexOf(document.activeElement);
      const focusOption = (index) => {
        const option = enabledOptions[index];
        if (!option) return;
        event.preventDefault();
        option.focus();
        option.scrollIntoView({ block: 'nearest' });
      };
      if (event.key === 'Escape') { event.preventDefault(); modal._closeModalSelect(); }
      else if (event.key === 'ArrowDown') focusOption(currentIndex < enabledOptions.length - 1 ? currentIndex + 1 : 0);
      else if (event.key === 'ArrowUp') focusOption(currentIndex > 0 ? currentIndex - 1 : enabledOptions.length - 1);
      else if (event.key === 'Home') focusOption(0);
      else if (event.key === 'End') focusOption(enabledOptions.length - 1);
      else if (event.key === 'Tab') {
        const focusable = [closeButton, ...enabledOptions].filter(Boolean);
        const index = focusable.indexOf(document.activeElement);
        if (event.shiftKey && index <= 0) { event.preventDefault(); focusable.at(-1)?.focus(); }
        else if (!event.shiftKey && index === focusable.length - 1) { event.preventDefault(); focusable[0]?.focus(); }
      }
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

      const check = document.createElement('img');
      check.className = 'interal-select-option-check';
      check.src = joinUrl('elements/Unread.svg');
      check.alt = '';
      check.setAttribute('aria-hidden', 'true');
      check.draggable = false;
      check.width = 18;
      check.height = 18;
      check.style.display = 'block';
      check.style.filter = 'var(--menu-icon-filter, none)';

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
    state.previousFocus = document.activeElement;
    state.scrollY = window.scrollY || document.documentElement.scrollTop || 0;

    const label = select.id ? document.querySelector(`label[for="${cssEscape(select.id)}"]`) : null;
    title.textContent = label?.textContent?.trim() || getUiText('selectChoose');
    closeButton?.setAttribute('aria-label', getUiText('close'));
    buildModalOptions(select, trigger);

    syncVisualViewportVars();
    document.body.style.setProperty('--select-modal-scroll-y', `-${state.scrollY}px`);
    document.body.classList.add('select-modal-open');
    const selectedButton = optionsBox.querySelector('.is-selected:not(:disabled)') || optionsBox.querySelector('.interal-select-option:not(:disabled)');
    const applyOpen = () => {
      modal.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
    };
    const afterOpen = () => selectedButton?.scrollIntoView({ block: 'nearest' });
    if (window.InteralModalMotion) {
      window.InteralModalMotion.open(modal, {
        panel: modal.querySelector('.interal-select-modal-panel'),
        backdrop: modal.querySelector('.interal-select-modal-backdrop'),
        trigger,
        applyOpen,
        afterOpen,
        focusTarget: selectedButton || closeButton
      });
    } else {
      applyOpen();
      (selectedButton || closeButton)?.focus();
      afterOpen();
    }
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
    ru: { close: 'Закрыть JSON-карточку', title: 'JSON-карточка', useAuthor: 'Указать авторство', authorName: 'Имя или ник', contactType: 'Тип контакта', contact: 'Контакт', rememberAuthor: 'Запомнить для следующих карточек', clearSavedAuthor: 'Удалить сохранённые данные', generate: 'Сгенерировать карточку', generating: 'Генерация...', output: 'Готовый JSON', copy: 'Скопировать JSON-карточку', copied: 'JSON-карточка скопирована', copiedTitle: 'Скопировано', download: 'Скачать JSON-карточку', empty: 'Сначала сгенерируйте JSON-карточку.', unavailable: 'JSON-карточка доступна только после успешной проверки.' },
    en: { close: 'Close JSON card', title: 'JSON card', useAuthor: 'Add authorship', authorName: 'Name or nickname', contactType: 'Contact type', contact: 'Contact', rememberAuthor: 'Remember for future cards', clearSavedAuthor: 'Delete saved data', generate: 'Generate card', generating: 'Generating...', output: 'Generated JSON', copy: 'Copy JSON card', copied: 'JSON card copied', copiedTitle: 'Copied', download: 'Download JSON card', empty: 'Generate the JSON card first.', unavailable: 'The JSON card is available only after a successful check.' }
  };
  const CONTACT_TYPE_LABELS = {
    ru: { telegram: 'Telegram', discord: 'Discord', email: 'Email', signal: 'Signal', matrix: 'Matrix', simplex: 'Simplex', other: 'Другое' },
    en: { telegram: 'Telegram', discord: 'Discord', email: 'Email', signal: 'Signal', matrix: 'Matrix', simplex: 'Simplex', other: 'Other' }
  };
  const CONTACT_TYPE_ORDER = ['telegram', 'discord', 'email', 'signal', 'matrix', 'simplex', 'other'];
  const AUTHOR_STORAGE_KEY = 'interal:json-card-author:v1';
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


  const INTERAL_JSON_MODULE_VERSION = 'contact-types-20260713-1';
  const CARD_ID_PATTERN = /^(iv|av|in|vc|gv|al|af)_[0-9A-Za-z]{12}$/;
  const SECTION_PREFIX = { internationalismes:'in', associativvordes:'av', indoeuropanvordes:'iv', vordesofcommunites:'vc', grammaticebrevivordes:'gv', altervordes:'al', affixes:'af' };
  const API_ENDPOINT = location.hostname === 'landquart.github.io' ? 'https://interal.vercel.app/api/cards' : '/api/cards';
  function publicJsonError(error, fallback){
    const raw = error?.publicMessage || error?.message || error?.error || error || fallback || 'JSON card error';
    const message=String(raw);
    return message.replace(/(apikey|authorization|service_role|bearer|supabase[_-]?(service)?[_-]?role[_-]?key)\s*[:=]\s*\S+/ig,'$1: [hidden]');
  }
  function extractSavedCard(data, draftCard){
    const payload = data?.card?.payload;

    const savedCard = payload && typeof payload === 'object'
      ? { ...payload, id: payload.id || data.id, status: payload.status || data.status || 'pending' }
      : { ...draftCard, id: data?.id, status: data?.status || 'pending' };
    delete savedCard.section;
    delete savedCard.discussionId;
    delete savedCard.persistence;

    if (!savedCard.id) throw new Error('The server did not return a card ID.');

    return savedCard;
  }
  function validateCardId(card, section){ const id=card?.id; if(!CARD_ID_PATTERN.test(String(id||''))) throw new Error('The server returned an invalid card ID.'); const prefix=SECTION_PREFIX[section]; if(prefix && !String(id).startsWith(`${prefix}_`)) throw new Error('The server returned a card ID for another section.'); return true; }
  function getJsonByteSize(value){
    const text = JSON.stringify(value);
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
    if (typeof Blob !== 'undefined') { const size = new Blob([text]).size; if (Number.isFinite(size)) return size; }
    return encodeURIComponent(text).replace(/%[0-9A-F]{2}/g, 'x').length;
  }
  async function createCardOnServer(card,{section,title,category,endpoint=API_ENDPOINT,onProgress}={}){
    if(!card||typeof card!=='object') throw new Error(document.documentElement.lang==='en'?'Invalid source data for JSON card.':'Некорректные исходные данные JSON-карточки.');
    if(!section) throw new Error(document.documentElement.lang==='en'?'Invalid card section.':'Некорректный раздел карточки.');
    const safeTitle=title||card?.interal?.word||card?.title||card?.form||card?.selectedForm||'Untitled card';

    onProgress?.(document.documentElement.lang?.startsWith('en')?'Saving card...':'Сохранение карточки...');

    const payloadBytes = getJsonByteSize(card);
    console.info('JSON card payload size', { section, payloadBytes });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        section,
        title: safeTitle,
        category: category || card?.vord_type || card?.card_type || null,
        payload: card
      })
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
      const error = new Error(publicJsonError(data?.error, 'Card creation failed'));
      error.responseStatus = response.status;
      error.apiError = data?.error;
      error.code = data?.code || null;
      error.requestSection = section;
      error.payloadBytes = payloadBytes;
      throw error;
    }

    const savedCard = extractSavedCard(data, card);
    validateCardId(savedCard, section);
    return savedCard;
  }


  function safeLocalStorage() {
    try { return window.localStorage || null; } catch { return null; }
  }
  function cleanAuthorData(data) {
    if (!data || typeof data !== 'object') return null;
    const displayName = typeof data.displayName === 'string' ? data.displayName.trim() : '';
    const contactValue = typeof data.contactValue === 'string' ? data.contactValue.trim() : '';
    let contactType = typeof data.contactType === 'string' ? data.contactType : 'telegram';
    if (!CONTACT_TYPE_ORDER.includes(contactType)) contactType = 'telegram';
    if (!displayName && !contactValue) return null;
    return { version: 1, displayName, contactType, contactValue };
  }
  function readSavedAuthorData() {
    try {
      const storage = safeLocalStorage();
      const raw = storage?.getItem(AUTHOR_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const cleaned = cleanAuthorData(parsed);
      if (!cleaned) storage?.removeItem(AUTHOR_STORAGE_KEY);
      return cleaned;
    } catch {
      try { safeLocalStorage()?.removeItem(AUTHOR_STORAGE_KEY); } catch {}
      return null;
    }
  }
  function saveAuthorData(data) {
    try {
      const cleaned = cleanAuthorData(data);
      if (!cleaned) return false;
      safeLocalStorage()?.setItem(AUTHOR_STORAGE_KEY, JSON.stringify(cleaned));
      return true;
    } catch { return false; }
  }
  function clearSavedAuthorData() {
    try { safeLocalStorage()?.removeItem(AUTHOR_STORAGE_KEY); } catch {}
  }
  function hasSavedAuthorData() { return Boolean(readSavedAuthorData()); }
  function restoreAuthorData(options = {}) {
    const data = readSavedAuthorData();
    if (!data) return false;
    const useAuthor = $(options.useAuthorBlockId || 'useAuthorBlock');
    const fields = $(options.authorFieldsId || 'jsonAuthorFields');
    const name = $(options.authorDisplayNameId || 'authorDisplayName');
    const type = $(options.authorContactTypeId || 'authorContactType');
    const contact = $(options.authorContactValueId || 'authorContactValue');
    const remember = $(options.rememberAuthorDataId || 'rememberAuthorData');
    if (useAuthor) useAuthor.checked = true;
    if (fields) fields.style.display = 'grid';
    if (name) name.value = data.displayName;
    if (type) {
      const hasOption = Array.from(type.options || []).some((option) => option.value === data.contactType);
      type.value = hasOption ? data.contactType : 'telegram';
      window.refreshCustomSelect?.(type);
    }
    if (contact) contact.value = data.contactValue;
    if (remember) remember.checked = true;
    return true;
  }
  function syncAuthorStorageControls(ids) {
    const clearButton = $(ids.clearSavedAuthorDataId);
    if (clearButton) {
      const hidden = !hasSavedAuthorData();
      clearButton.hidden = hidden;
      const actions = clearButton.closest('.author-data-actions');
      if (actions) actions.hidden = hidden;
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
  function applyContactTypeLabels(selectOrId = 'authorContactType', language = document.documentElement.lang || 'ru') {
    const select = typeof selectOrId === 'string' ? $(selectOrId) : selectOrId;
    if (!select) return;
    const labels = CONTACT_TYPE_LABELS[String(language).startsWith('en') ? 'en' : 'ru'];
    const previousValue = select.value || 'telegram';
    CONTACT_TYPE_ORDER.forEach((value) => {
      let option = Array.from(select.options || []).find((item) => item.value === value);
      if (!option) {
        option = document.createElement('option');
        option.value = value;
        select.appendChild(option);
      }
      option.textContent = labels[value] || value;
    });
    select.value = CONTACT_TYPE_ORDER.includes(previousValue) ? previousValue : 'telegram';
    window.refreshCustomSelect?.(select);
  }
  function init(options = {}) {
    const ids = { modalId:'jsonCardModal', openButtonId:'jsonCardBtn', closeButtonId:'closeJsonCardBtn', useAuthorBlockId:'useAuthorBlock', authorFieldsId:'jsonAuthorFields', authorDisplayNameId:'authorDisplayName', authorContactTypeId:'authorContactType', authorContactValueId:'authorContactValue', rememberAuthorDataId:'rememberAuthorData', rememberAuthorDataLabelId:'rememberAuthorDataLabel', clearSavedAuthorDataId:'clearSavedAuthorData', generateButtonId:'generateJsonCardBtn', outputId:'jsonCardOutput', copyButtonId:'copyJsonCardBtn', downloadButtonId:'downloadJsonCardBtn', ...options };
    const lang = () => (options.getLanguage?.() || document.documentElement.lang || 'ru').startsWith('en') ? 'en' : 'ru';
    const texts = () => ({ ...DEFAULT_TEXTS[lang()], ...(options.getTexts?.() || {}) });
    const output = () => $(ids.outputId);
    let opener = null;
    let timer = 0;
    function applyTexts(){ const t=texts(); const map={jsonCardTitle:t.title,useAuthorBlockLabel:t.useAuthor,authorDisplayNameLabel:t.authorName,authorContactTypeLabel:t.contactType,authorContactValueLabel:t.contact,[ids.rememberAuthorDataLabelId]:t.rememberAuthor,[ids.clearSavedAuthorDataId]:t.clearSavedAuthor,jsonCardOutputLabel:t.output}; Object.entries(map).forEach(([id,v])=>{ if($(id)) $(id).textContent=v; }); applyContactTypeLabels(ids.authorContactTypeId, lang()); const generateButton=$(ids.generateButtonId); if(generateButton){ const textEl=generateButton.querySelector('.btn-text') || generateButton; textEl.textContent=t.generate; } if($(ids.closeButtonId)) $(ids.closeButtonId).setAttribute('aria-label',t.close); [ids.copyButtonId,ids.downloadButtonId].forEach((id)=>{ const b=$(id); if(!b) return; const v=id===ids.copyButtonId?t.copy:t.download; b.setAttribute('aria-label',v); b.title=v; }); }
    function resetCopy(){ const b=$(ids.copyButtonId); clearTimeout(timer); if(b){ b.classList.remove('is-copied'); b.title=texts().copy; b.setAttribute('aria-label',texts().copy); } }
    function showError(message){ if(output()) output().value=message; }
    function open(source){ opener=source?.currentTarget instanceof Element?source.currentTarget:source instanceof Element?source:document.activeElement; resetCopy(); restoreAuthorData(ids); syncAuthorStorageControls(ids); const m=$(ids.modalId); const btn=$(ids.generateButtonId); if(btn){ btn.hidden=false; setButtonStatus(btn, texts().generate, false); } if(!m) return Promise.resolve(false); const applyOpen=()=>{ m.classList.add('show'); m.setAttribute('aria-hidden','false'); }; if(window.InteralModalMotion){ return window.InteralModalMotion.open(m,{panel:m.querySelector('.modal-inner'),trigger:opener,applyOpen,focusTarget:btn}); } applyOpen(); setTimeout(()=>btn?.focus(),0); return Promise.resolve(true); }
    function close(){ const m=$(ids.modalId); resetCopy(); const btn=$(ids.generateButtonId); if(btn) setButtonStatus(btn, texts().generate, false); if(!m) return Promise.resolve(false); const applyClose=()=>{ m.classList.remove('show'); m.setAttribute('aria-hidden','true'); }; if(window.InteralModalMotion){ return window.InteralModalMotion.close(m,{panel:m.querySelector('.modal-inner'),applyClose,focusTarget:opener}); } applyClose(); opener?.focus?.(); return Promise.resolve(true); }
    function getAuthor(){ if(!$(ids.useAuthorBlockId)?.checked) return null; const name=$(ids.authorDisplayNameId)?.value.trim()||''; const type=$(ids.authorContactTypeId)?.value||'telegram'; const rawContact=$(ids.authorContactValueId)?.value||''; const contact=normalizeContact(type,rawContact); if($(ids.rememberAuthorDataId)?.checked) saveAuthorData({ displayName:name, contactType:type, contactValue:rawContact }); if(!name && !contact) throw new Error(lang()==='en'?'Add a name or contact for authorship.':'Укажите имя или контакт для авторства.'); const author={}; if(name) author.display_name=name; if(contact) author.contacts=[{type,url:contact}]; return author; }
    async function generate(){ const btn=$(ids.generateButtonId); const t=texts(); try{ if(btn) setButtonStatus(btn, t.generating, true); const author=getAuthor(); if(output()) output().value=''; let card=await options.buildCard?.({author, onProgress: text => btn && setButtonStatus(btn, text, true)}); if(!card||typeof card!=='object') throw new Error(lang()==='en'?'The page did not create a valid JSON card.':'Страница не создала корректную JSON-карточку.'); if(options.createCardOnServer){ card=await options.createCardOnServer(card,{author,onProgress:text=>btn&&setButtonStatus(btn,text,true)}); } const formatted=options.formatCard?options.formatCard(card):JSON.stringify(card,null,2); if(output()) output().value=formatted; if(btn) setButtonStatus(btn, texts().done || (lang()==='en'?'Done':'Готово'), true); }catch(e){ console.error('JSON card generation failed:', e); const msg=publicJsonError(e, lang()==='en'?'Could not generate JSON card.':'Не удалось сформировать JSON-карточку.'); if(btn) setButtonStatus(btn, texts().error || (lang()==='en'?'Error':'Ошибка'), false); showError(msg); return; }finally{ if(btn) setTimeout(()=>setButtonStatus(btn, texts().generate, false), 800); } }
    async function copy(){ const text=output()?.value||''; if(!text.trim()) return alert(texts().empty); await (window.copyText ? window.copyText(text) : navigator.clipboard.writeText(text)); const b=$(ids.copyButtonId); if(b){ b.classList.add('is-copied'); b.title=texts().copiedTitle; b.setAttribute('aria-label',texts().copied); timer=setTimeout(resetCopy,1500); } }
    function download(){ const text=output()?.value||''; if(!text.trim()) return alert(texts().empty); let filename=options.getFilename?.(text)||'json-card.json'; try{ const id=JSON.parse(text)?.id; if(id) filename=`${id}.json`; }catch{} const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'})); a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href); }
    const modal=$(ids.modalId); if(modal?.dataset.interalJsonModalInit==='1') return modal._interalJsonModalApi; if(modal) modal.dataset.interalJsonModalInit='1'; applyTexts(); $(ids.openButtonId)?.addEventListener('click', open); $(ids.closeButtonId)?.addEventListener('click', close); $(ids.modalId)?.addEventListener('click', e=>{ if(e.target===$(ids.modalId)) close(); }); $(ids.useAuthorBlockId)?.addEventListener('change', e=>{ if($(ids.authorFieldsId)) $(ids.authorFieldsId).style.display=e.target.checked?'grid':'none'; }); $(ids.rememberAuthorDataId)?.addEventListener('change', e=>{ if(!e.target.checked){ clearSavedAuthorData(); syncAuthorStorageControls(ids); } }); $(ids.clearSavedAuthorDataId)?.addEventListener('click', ()=>{ clearSavedAuthorData(); if($(ids.rememberAuthorDataId)) $(ids.rememberAuthorDataId).checked=false; syncAuthorStorageControls(ids); }); $(ids.generateButtonId)?.addEventListener('click', generate); $(ids.copyButtonId)?.addEventListener('click', copy); $(ids.downloadButtonId)?.addEventListener('click', download); document.addEventListener('keydown', e=>{ if(e.key==='Escape' && $(ids.modalId)?.classList.contains('show')) close(); }); document.addEventListener('interal:languagechange', applyTexts); const api = { open, close, generate, getAuthor, applyTexts }; if(modal) modal._interalJsonModalApi=api; return api;
  }
  window.InteralJsonCards = { extractSavedCard, createCardOnServer, validateCardId, publicJsonError };
  window.InteralJsonAuthorStorage = { readSavedAuthorData, saveAuthorData, clearSavedAuthorData, restoreAuthorData, hasSavedAuthorData };
  window.InteralJsonDiagnostics = { getStatus(){ return { version: INTERAL_JSON_MODULE_VERSION, modalLoaded:Boolean(window.InteralJsonCardModal), cardsHelperLoaded:Boolean(window.InteralJsonCards), helpers:Object.keys(window.InteralJsonCards || {}), page:window.location.pathname, scriptUrl:document.querySelector('script[src*="shared/ui.js"]')?.src || null }; } };
  window.InteralJsonCardModal = { init, normalizeContact, applyContactTypeLabels, readSavedAuthorData, saveAuthorData, clearSavedAuthorData, restoreAuthorData, hasSavedAuthorData };
  window.InteralButtonStatus = { setButtonStatus };
})();
