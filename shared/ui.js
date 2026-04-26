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

  const topNavWindow = document.createElement('div');
  topNavWindow.className = 'top-nav-window';
  topNavWindow.append(brandLink, menuButton);

  document.body.classList.add('has-global-menu');
  topNav.append(topNavWindow);
  document.body.prepend(overlay);
  document.body.prepend(menu);
  document.body.prepend(topNav);

  initTheme();

  menuButton.addEventListener('click', function () {
    document.body.classList.toggle('menu-open');
  });
  overlay.addEventListener('click', closeMenu);
  menu.querySelector('.menu-theme-btn').addEventListener('click', function () {
    toggleTheme();
  });
})();
