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
      registre: 'Реестр лексических карточек',
      contribution: `
        <p>Вы можете помочь проекту, предлагая лексику, которой ещё нет в языке. Для этого придумайте слово-гипотезу. Проверьте, есть ли она в <a href="${context.joinUrl('registre/')}">реестре лексических карточек</a>. Если нет, то следуйте алгоритму ниже.</p>
        <p><strong>Алгоритм выбора категории слова</strong></p>
        <ol>
          <li>Проверить, является ли слово грамматическим или кратким служебным элементом. Если да, оно относится к категории грамматических и кратких слов.</li>
          <li>Проверить, является ли слово интернационализмом. Если оно проходит установленную процедуру, оно относится к категории интернационализмов.</li>
          <li>Проверить, является ли слово термином либо культурным или социальным заимствованием. Если оно принадлежит профессиональному, субкультурному, юридическому, техническому или культурному сообществу и обычно заимствуется напрямую, оно относится к категории слов сообществ.</li>
          <li>Проверить наличие общей индоевропейской основы. Если в контрольных языках обнаруживаются общий когнат и близкие конечные формы, слово относится к категории индоевропейских слов.</li>
          <li>Если общей формы нет, формы значительно расходятся или плохо узнаются, проверить ассоциативность через дериваты. Если корень или служебный элемент проходит процедуру отбора ассоциативных слов, слово относится к категории ассоциативных слов.</li>
          <li>Если слово не соответствует ни одной из перечисленных категорий, выбрать форму вручную среди контрольных и вспомогательных языков с учётом дополнительных критериев: краткости, произносимости, отсутствия конфликтов и пригодности для дальнейшей деривации. Такое слово относится к категории иных слов.</li>
        </ol>
        <p>Если лексическая единица была принята, скопируйте JSON-карточку и отправьте её в <a href="https://t.me/interalen_bot">https://t.me/interalen_bot</a>.</p>
      `
    },
    en: {
      instruments: 'Instruments', registry: 'Registry',
      promo: 'Contribute to Interal in just a couple of clicks!', try: 'Try it',
      indoeuropan: 'Indo-European words', associativ: 'Associative words',
      internationalismes: 'Internationalisms', communities: 'Words of communities',
      grammar: 'Grammatic and brief words', altervordes: 'Other words',
      affixes: 'Affixes', determinator: 'Value type determinator',
      registre: 'Registry of lexical cards',
      contribution: `
        <p>You can contribute to the project by proposing vocabulary that is not yet included in the language. To do this, create a hypothetical word form and check whether it is already listed in the <a href="${context.joinUrl('registre/')}">registry of lexical cards</a>. If it is not, follow the algorithm below.</p>
        <p><strong>Algorithm for selecting a word category</strong></p>
        <ol>
          <li>Check whether the word is a grammatical or short function element. If so, it belongs to the category of grammatical and short words.</li>
          <li>Check whether the word is an internationalism. If it passes the established procedure, it belongs to the category of internationalisms.</li>
          <li>Check whether the word is a term or a cultural or social borrowing. If it belongs to a professional, subcultural, legal, technical, or cultural community and is usually borrowed directly, it belongs to the category of community words.</li>
          <li>Check for a common Indo-European base. If the control languages contain a shared cognate and similar final forms, the word belongs to the category of Indo-European words.</li>
          <li>If no common form exists, the forms differ significantly, or they are difficult to recognize, evaluate their associativity through derivatives. If the root or function element passes the associative-word selection procedure, the word belongs to the category of associative words.</li>
          <li>If the word does not fit any of the categories above, select a form manually from the control and auxiliary languages according to additional criteria: brevity, pronounceability, absence of conflicts, and suitability for further derivation. Such a word belongs to the category of other words.</li>
        </ol>
        <p>If the lexical item is accepted, copy its JSON card and send it to <a href="https://t.me/interalen_bot">https://t.me/interalen_bot</a>.</p>
      `
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
    document.querySelectorAll('[data-instruments-html]').forEach((node) => {
      const value = dictionary[node.dataset.instrumentsHtml];
      if (value) node.innerHTML = value;
    });
    if (document.body.classList.contains('instrumentes-page')) {
      document.title = dictionary.instruments;
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
