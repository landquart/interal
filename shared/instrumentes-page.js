(function () {
  const context = window.InteralInstrumentes;
  if (!context) return;

  const text = {
    ru: {
      instruments: 'Инструменты', registry: 'Реестр',
      promo: 'Внеси вклад в Интераль всего в пару кликов!', try: 'Попробовать',
      indoeuropan: 'Индоевропейские слова', associativ: 'Ассоциативные слова',
      internationalismes: 'Интернационализмы', communities: 'Слова сообществ',
      grammar: 'Грамматические и краткие слова', altervordes: 'Иные слова',
      affixes: 'Аффиксы', determinator: 'Определитель типа значения',
      registre: 'Реестр лексических карточек'
    },
    en: {
      instruments: 'Instruments', registry: 'Registry',
      promo: 'Contribute to Interal in just a couple of clicks!', try: 'Try it',
      indoeuropan: 'Indo-European words', associativ: 'Associative words',
      internationalismes: 'Internationalisms', communities: 'Words of communities',
      grammar: 'Grammatic and brief words', altervordes: 'Other words',
      affixes: 'Affixes', determinator: 'Value type determinator',
      registre: 'Registry of lexical cards'
    }
  };

  function updateText() {
    const lang = context.getLang();
    const dictionary = text[lang];
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-instruments-text]').forEach((node) => {
      const value = dictionary[node.dataset.instrumentsText];
      if (value) node.textContent = value;
    });
    if (document.body.classList.contains('instrumentes-page')) {
      document.title = lang === 'en' ? dictionary.instruments : `${dictionary.instruments} — Interal`;
    }
  }

  if (document.body.classList.contains('homepage')) {
    const sections = document.querySelectorAll('.home-section');
    const footer = document.querySelector('.home-footer');
    if (sections.length && footer) {
      sections.forEach((section) => section.remove());
      const promo = document.createElement('section');
      promo.className = 'home-instruments-promo';
      promo.setAttribute('aria-labelledby', 'home-instruments-promo-title');
      promo.innerHTML = `
        <img class="home-instruments-promo-bg" src="${context.joinUrl('elements/%D0%BA%D0%B0%D1%80%D1%82%D0%BE%D1%87%D0%BA%D0%B0%20%D0%B4%D0%BB%D1%8F%20%D0%B8%D0%BD%D1%81%D1%82%D1%80%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%BE%D0%B2.svg')}" alt="" aria-hidden="true">
        <div class="home-instruments-promo-content">
          <h2 class="home-instruments-promo-title" id="home-instruments-promo-title" data-instruments-text="promo"></h2>
          <a class="home-instruments-promo-button" href="${context.joinUrl('instrumentes/')}" data-instruments-text="try"></a>
        </div>`;
      footer.before(promo);
    }
  }

  updateText();
  document.addEventListener('interal:languagechange', updateText);
})();
