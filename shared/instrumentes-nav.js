(function () {
  const context = window.InteralInstrumentes;
  if (!context) return;

  const instrumentsUrl = context.joinUrl('instrumentes/');
  const labels = {
    ru: { instruments: 'Инструменты', show: 'Показать страницы инструментов', hide: 'Скрыть страницы инструментов' },
    en: { instruments: 'Instruments', show: 'Show instrument pages', hide: 'Hide instrument pages' }
  };

  const desktopTrigger = document.querySelector('.top-desktop-dropdown-trigger');
  if (desktopTrigger) {
    desktopTrigger.addEventListener('click', (event) => {
      if (!event.defaultPrevented) window.location.assign(instrumentsUrl);
    });
    if (location.pathname.includes('/instrumentes/')) {
      desktopTrigger.classList.add('is-active');
      desktopTrigger.setAttribute('aria-current', 'page');
    }
  }

  const section = document.querySelector('.menu-nav-section[data-menu-section="instruments"]');
  if (!section) return;

  const instrumentLinks = Array.from(section.children).filter(
    (node) => node.classList && node.classList.contains('menu-nav-link')
  );

  const row = document.createElement('div');
  row.className = 'menu-instruments-row';

  const pageLink = document.createElement('a');
  pageLink.className = 'menu-nav-link menu-instruments-page-link';
  pageLink.href = instrumentsUrl;
  pageLink.dataset.nav = 'instruments';
  pageLink.innerHTML = '<span class="menu-nav-main"></span>';

  const list = document.createElement('div');
  list.className = 'menu-instruments-list';
  list.id = 'interal-instrument-pages';
  list.hidden = true;
  instrumentLinks.forEach((link) => list.appendChild(link));

  const toggle = document.createElement('button');
  toggle.className = 'menu-instruments-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-controls', list.id);
  toggle.setAttribute('aria-expanded', 'false');

  row.append(pageLink, toggle);
  section.replaceChildren(row, list);

  if (/\/(instrumentes|indoeuropanvordes|associativvordes|determinatorofvalentyp|internationalismes|vordesofcommunites|grammaticebrevivordes|altervordes|affixes)\//.test(location.pathname)) {
    pageLink.classList.add('is-active');
    if (location.pathname.includes('/instrumentes/')) pageLink.setAttribute('aria-current', 'page');
  }

  function update() {
    const t = labels[context.getLang()];
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    pageLink.querySelector('.menu-nav-main').textContent = t.instruments;
    toggle.setAttribute('aria-label', t[expanded ? 'hide' : 'show']);
  }

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') !== 'true';
    list.hidden = !expanded;
    toggle.setAttribute('aria-expanded', String(expanded));
    update();
  });

  document.addEventListener('interal:languagechange', update);
  update();
})();
