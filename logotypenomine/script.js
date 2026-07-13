(function () {
  const text = {
    ru: {
      title: 'Логотип и название',
      descriptionTitle: 'Описание логотипа',
      descriptionText: 'Логотип Интераля представляет собой золотистую фигуру, состоящую из круга, четырёх волн и восьмиконечной звезды в верхней части. Круг означает единение людей, говорящих на индоевропейских языках. Волны символизируют речь. Звезда — распространённость индоевропейских языков во всех частях света. Золотой цвет выражает процветание и ассоциируется с солнцем. В свою очередь солнце символизирует свет знания и открытость миру.',
      logoUseTitle: 'Использование логотипа',
      logoUseText1: 'Разрешается использовать неизменённый логотип для информационного упоминания проекта, размещения ссылок на его официальный сайт, публикации обзоров, научных и образовательных материалов, а также для распространения официальных материалов Интераля.',
      logoUseText2: 'Запрещается использование логотипа способом, создающим ложное впечатление об официальной связи с проектом или о том, что стороннее лицо либо организация официально представляет Интераль.',
      logoUseText3: 'Без предварительного разрешения не допускаются:<br>— изменение формы, пропорций, цветов или элементов логотипа;<br>— размещение логотипа на продукции, предназначенной для продажи.',
      colorsTitle: 'Цвета',
      goldName: 'Золотисто-янтарный',
      blackName: 'Чёрный',
      whiteName: 'Белый',
      nameUseTitle: 'Использование названия',
      nameUseText1: 'Название «Интераль»/Interal и все производные от него разрешается свободно использовать для обозначения языка и достоверного упоминания проекта, включая научные, образовательные, информационные и критические материалы.',
      nameUseText2: 'Запрещается регистрация доменных имён и названий аккаунтов, способных создать ложное впечатление, что они принадлежат официальному проекту Интераля или связаны с ним.',
      download: 'Скачать',
      formatLabel: 'Формат',
      sizeLabel: 'Размер',
      altGold: 'Золотистый логотип Интераля',
      altWhite: 'Белый логотип Интераля',
      altBlack: 'Чёрный логотип Интераля',
      copyColor: 'Скопировать',
      copiedColor: 'Скопировано'
    },
    en: {
      title: 'Logo and name',
      descriptionTitle: 'Logo description',
      descriptionText: 'The Interal logo is a golden figure consisting of a circle, four waves, and an eight-pointed star at the top. The circle means the unity of people who speak Indo-European languages. The waves symbolize speech. The star is the spread of Indo-European languages in all parts of the world. The golden color expresses prosperity and is associated with the sun. In turn, the sun symbolizes the light of knowledge and openness to the world.',
      logoUseTitle: 'Logo use',
      logoUseText1: 'The unchanged logo may be used for informational mention of the project, placement of links to its official website, publication of reviews, scientific and educational materials, and distribution of official Interal materials.',
      logoUseText2: 'Use of the logo in a way that creates a false impression of an official connection with the project, or that a third party or organization officially represents Interal, is prohibited.',
      logoUseText3: 'Without prior permission, the following are not allowed:<br>— changing the shape, proportions, colors, or elements of the logo;<br>— placing the logo on products intended for sale.',
      colorsTitle: 'Colors',
      goldName: 'Golden amber',
      blackName: 'Black',
      whiteName: 'White',
      nameUseTitle: 'Name use',
      nameUseText1: 'The name Interal and all derivatives of it may be used freely to designate the language and make accurate mention of the project, including scientific, educational, informational, and critical materials.',
      nameUseText2: 'Registration of domain names and account names that may create a false impression that they belong to or are connected with the official Interal project is prohibited.',
      download: 'Download',
      formatLabel: 'Format',
      sizeLabel: 'Size',
      altGold: 'Golden Interal logo',
      altWhite: 'White Interal logo',
      altBlack: 'Black Interal logo',
      copyColor: 'Copy',
      copiedColor: 'Copied'
    }
  };

  const logoSets = {
    png: {
      512: ['interalen logo 512.png', 'interalen logo 512 w.png', 'interalen logo 512 b.png'],
      1024: ['interalen logo 1024.png', 'interalen logo 1024 w.png', 'interalen logo 1024 b.png'],
      2048: ['interalen logo 2048.png', 'interalen logo 2048 w.png', 'interalen logo 2048 b.png']
    },
    svg: { default: ['interalen logo.svg', 'interalen logo w.svg', 'interalen logo b.svg'] }
  };

  let format = 'png';
  let size = '512';
  const grid = document.getElementById('logoPreviewGrid');
  const sizeGroup = document.querySelector('[data-control="size"]');

  function currentLang() { return localStorage.getItem('interal.lang') === 'en' ? 'en' : 'ru'; }
  function variantKey(file) { return file.includes(' w.') ? 'white' : file.includes(' b.') ? 'black' : 'gold'; }
  function variantClass(file) { return `logo-preview--${variantKey(file)}`; }
  function logoAlt(file, t) { return t[`alt${variantKey(file).charAt(0).toUpperCase()}${variantKey(file).slice(1)}`]; }
  function href(file) { return `../elements/${encodeURIComponent(file)}`; }

  function renderLogos() {
    const files = format === 'svg' ? logoSets.svg.default : logoSets.png[size];
    const t = text[currentLang()];
    sizeGroup.classList.toggle('is-visually-hidden', format === 'svg');
    sizeGroup.setAttribute('aria-hidden', String(format === 'svg'));
    grid.innerHTML = files.map((file) => `
      <article class="logo-variant">
        <div class="logo-preview ${variantClass(file)}">
          <div class="logo-preview-inset"><img src="${href(file)}" alt="${logoAlt(file, t)}"></div>
        </div>
        <a class="logo-download-btn" href="${href(file)}" download aria-label="${t.download} ${file}"><img src="../elements/Download.svg" alt="" aria-hidden="true"></a>
      </article>`).join('');
  }

  function syncButtons() {
    document.querySelectorAll('[data-format]').forEach((btn) => {
      const active = btn.dataset.format === format;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('[data-size]').forEach((btn) => {
      const active = btn.dataset.size === size;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  function applyLanguage(lang) {
    const t = text[lang === 'en' ? 'en' : 'ru'];
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      node.innerHTML = t[node.dataset.i18n];
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((node) => {
      node.setAttribute('aria-label', t[node.dataset.i18nAria]);
    });
    document.title = t.title;
    renderLogos();
    updateCopyLabels();
  }

  function updateCopyLabels() {
    const t = text[currentLang()];
    document.querySelectorAll('[data-copy-color]').forEach((btn) => {
      btn.setAttribute('aria-label', `${t.copyColor} #${btn.dataset.copyColor}`);
    });
  }

  function copyColor(btn) {
    const value = `#${btn.dataset.copyColor}`;
    const write = navigator.clipboard && window.isSecureContext
      ? navigator.clipboard.writeText(value)
      : Promise.reject(new Error('Clipboard API unavailable'));
    write.catch(() => {
      const input = document.createElement('input');
      input.value = value;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }).finally(() => {
      const t = text[currentLang()];
      btn.setAttribute('aria-label', `${t.copiedColor} ${value}`);
      window.setTimeout(() => btn.setAttribute('aria-label', `${t.copyColor} ${value}`), 1200);
    });
  }

  document.querySelectorAll('[data-copy-color]').forEach((btn) => btn.addEventListener('click', () => copyColor(btn)));

  document.querySelectorAll('[data-format]').forEach((btn) => btn.addEventListener('click', () => {
    format = btn.dataset.format;
    syncButtons();
    renderLogos();
  }));
  document.querySelectorAll('[data-size]').forEach((btn) => btn.addEventListener('click', () => {
    size = btn.dataset.size;
    syncButtons();
    renderLogos();
  }));

  document.addEventListener('interal:languagechange', (event) => applyLanguage(event.detail.lang));
  syncButtons();
  applyLanguage(currentLang());
}());
