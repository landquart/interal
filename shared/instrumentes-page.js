(function () {
  const context = window.InteralInstrumentes;
  if (!context) return;

  const LEXEME_GOAL = 1000;
  let lexemeGoalCount = null;
  let lexemeGoalStatus = 'loading';

  const text = {
    ru: {
      instruments: 'Инструменты', registry: 'Реестр',
      promo: 'Внеси вклад в Интераль всего в пару кликов!', try: 'Попробовать',
      lexemeGoalTitle: 'Наша первая цель — зафиксировать 1000 лексем!',
      lexemeGoalLoading: 'Загрузка данных реестра',
      lexemeGoalUnavailable: 'Количество лексем временно недоступно',
      lexemeGoalAria: (count, goal) => `${count} из ${goal} лексем`,
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
      lexemeGoalTitle: 'Our first goal is to register 1,000 lexemes!',
      lexemeGoalLoading: 'Loading registry data',
      lexemeGoalUnavailable: 'The lexeme count is temporarily unavailable',
      lexemeGoalAria: (count, goal) => `${count} of ${goal} lexemes`,
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

  function getNumberFormatter(options = {}) {
    const locale = context.getLang() === 'en' ? 'en-US' : 'ru-RU';
    return new Intl.NumberFormat(locale, options);
  }

  function renderLexemeGoal() {
    const container = document.querySelector('[data-lexeme-goal]');
    if (!container) return;

    const dictionary = text[context.getLang()];
    const goal = Number.parseInt(container.dataset.goal, 10) || LEXEME_GOAL;
    const countNode = container.querySelector('[data-lexeme-goal-count]');
    const totalNode = container.querySelector('[data-lexeme-goal-total]');
    const percentNode = container.querySelector('[data-lexeme-goal-percent]');
    const progressNode = container.querySelector('[data-lexeme-goal-progress]');

    if (!countNode || !totalNode || !percentNode || !progressNode) return;

    totalNode.textContent = getNumberFormatter().format(goal);

    if (lexemeGoalStatus !== 'ready' || !Number.isFinite(lexemeGoalCount)) {
      countNode.textContent = '—';
      percentNode.textContent = '—%';
      progressNode.style.setProperty('--lexeme-goal-progress', '0%');
      progressNode.setAttribute('aria-valuenow', '0');
      progressNode.setAttribute('aria-busy', lexemeGoalStatus === 'loading' ? 'true' : 'false');
      progressNode.setAttribute(
        'aria-valuetext',
        lexemeGoalStatus === 'loading'
          ? dictionary.lexemeGoalLoading
          : dictionary.lexemeGoalUnavailable
      );
      container.classList.remove('has-progress');
      container.classList.toggle('is-unavailable', lexemeGoalStatus === 'unavailable');
      return;
    }

    const count = Math.max(0, Math.trunc(lexemeGoalCount));
    const cappedCount = Math.min(count, goal);
    const percentage = goal > 0 ? (cappedCount / goal) * 100 : 0;
    const percentageDigits = percentage > 0 && percentage < 10 ? 1 : 0;

    countNode.textContent = getNumberFormatter().format(count);
    percentNode.textContent = `${getNumberFormatter({
      minimumFractionDigits: percentage > 0 && percentage < 1 ? 1 : 0,
      maximumFractionDigits: percentageDigits
    }).format(percentage)}%`;
    progressNode.style.setProperty('--lexeme-goal-progress', `${percentage}%`);
    progressNode.setAttribute('aria-valuenow', String(cappedCount));
    progressNode.setAttribute(
      'aria-valuetext',
      dictionary.lexemeGoalAria(
        getNumberFormatter().format(count),
        getNumberFormatter().format(goal)
      )
    );
    progressNode.setAttribute('aria-busy', 'false');
    container.classList.toggle('has-progress', count > 0);
    container.classList.remove('is-unavailable');
  }

  function readRegistryLexemeCount(registry) {
    const declaredCount = Number(registry?.count);
    if (Number.isInteger(declaredCount) && declaredCount >= 0) {
      return declaredCount;
    }

    if (Array.isArray(registry?.cards)) {
      return registry.cards.length;
    }

    throw new Error('Registry count is unavailable');
  }

  async function loadLexemeGoal() {
    if (!document.querySelector('[data-lexeme-goal]')) return;

    try {
      const response = await fetch(context.joinUrl('cards/registry.json'), {
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Registry request failed with status ${response.status}`);
      }

      lexemeGoalCount = readRegistryLexemeCount(await response.json());
      lexemeGoalStatus = 'ready';
    } catch {
      lexemeGoalCount = null;
      lexemeGoalStatus = 'unavailable';
    }

    renderLexemeGoal();
  }

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
    renderLexemeGoal();
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
  loadLexemeGoal();
  document.addEventListener('interal:languagechange', updateText);
})();
