(function () {
  const THEME_KEY = 'interal.theme';
  const inSubDir = /\/(similarita|determinatorofvalentyp)(\/|$)/.test(window.location.pathname);
  const prefix = inSubDir ? '../' : '';

  const topNav = document.createElement('div');
  topNav.className = 'top-nav';

  const menuButton = document.createElement('button');
  menuButton.className = 'top-menu-btn';
  menuButton.type = 'button';
  menuButton.setAttribute('aria-label', 'Открыть меню');
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

  const topNavLinks = document.createElement('nav');
  topNavLinks.className = 'top-nav-links';
  topNavLinks.innerHTML = `
    <a class="top-nav-link" href="${prefix}similarita/">Similaritá</a>
    <a class="top-nav-link" href="${prefix}determinatorofvalentyp/">Determinator of valen typ</a>
  `;

  const menu = document.createElement('aside');
  menu.className = 'side-menu';
  menu.id = 'interal-side-menu';
  menu.innerHTML = `
  <h2 class="menu-title">Menú</h2>
    <nav class="menu-links">
      <a class="menu-link" href="${prefix}similarita/">Similaritá</a>
      <a class="menu-link" href="${prefix}determinatorofvalentyp/">Determinator of valen typ</a>
    </nav>
 <button class="menu-theme-btn" type="button"></button>
  `;

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
      btn.textContent = theme === 'dark' ? '☀️ Luminosi thema' : '🌙 Obscur thema';
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

  function pathToSegment(pathname) {
    if (pathname.includes('/similarita')) return 'similarita';
    if (pathname.includes('/determinatorofvalentyp')) return 'determinatorofvalentyp';
    return 'home';
  }

  function markActiveLink() {
    const activeSegment = pathToSegment(window.location.pathname);
    const navLinks = [
      ...topNavLinks.querySelectorAll('a.top-nav-link'),
      ...menu.querySelectorAll('a.menu-link')
    ];

    navLinks.forEach((link) => {
      const targetSegment = pathToSegment(new URL(link.href).pathname);
      const isActive = targetSegment === activeSegment;
      link.classList.toggle('is-active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  const topNavWindow = document.createElement('div');
  topNavWindow.className = 'top-nav-window';
  topNavWindow.append(menuButton, brandLink, topNavLinks);

  document.body.classList.add('has-global-menu');
  topNav.append(topNavWindow);
  document.body.prepend(overlay);
  document.body.prepend(menu);
  document.body.prepend(topNav);

  initTheme();
  markActiveLink();

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

  menu.querySelectorAll('a.menu-link').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  menu.querySelector('.menu-theme-btn').addEventListener('click', function () {
    toggleTheme();
  });
})();
