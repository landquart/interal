(function () {
  const THEME_KEY = 'interal.theme';
  const inSubDir = /\/(similarita|determinatorofvalentyp)(\/|$)/.test(window.location.pathname);
  const prefix = inSubDir ? '../' : '';

  const menuButton = document.createElement('button');
  menuButton.className = 'top-menu-btn';
  menuButton.type = 'button';
  menuButton.setAttribute('aria-label', 'Открыть меню');
  menuButton.textContent = '☰';

  const overlay = document.createElement('div');
  overlay.className = 'side-menu-overlay';

  const menu = document.createElement('aside');
  menu.className = 'side-menu';
  menu.innerHTML = `
    <nav class="menu-links">
      <a class="menu-link" href="${prefix}similarita/">Similaritá</a>
      <a class="menu-link" href="${prefix}determinatorofvalentyp/">Determinator of valen typ</a>
      <a class="menu-link" href="${prefix}index.html">General</a>
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

  document.body.classList.add('has-global-menu');
  document.body.prepend(overlay);
  document.body.prepend(menu);
  document.body.prepend(menuButton);

  initTheme();

  menuButton.addEventListener('click', function () {
    document.body.classList.toggle('menu-open');
  });
  overlay.addEventListener('click', closeMenu);
  menu.querySelector('.menu-theme-btn').addEventListener('click', function () {
    toggleTheme();
  });
})();
