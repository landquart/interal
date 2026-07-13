(function () {
  const text = {
    ru: {
      title: 'Логотип и название',
      descriptionTitle: 'Описание логотипа',
      descriptionText: 'Логотип Интераля представляет собой золотистую фигуру, состоящую из круга, четырёх волн и восьмиконечной звезды в верхней части. Круг означает единение людей, говорящих на индоевропейских языках. Волны символизируют речь. Звезда — распространённость индоевропейских языков во всех частях света. Золотой цвет выражает процветание и ассоциируется с солнцем. В свою очередь солнце символизирует свет знания и открытость миру.',
      logoUseTitle: 'Использование логотипа',
      logoUseText1: 'Разрешается использовать неизменённый логотип для информационного упоминания проекта, размещения ссылок на его официальный сайт, публикации обзоров, научных и образовательных материалов, а также для распространения официальных материалов Интераля.',
      logoUseText2: 'Запрещается использование логотипа на любых носителях для создания ложного впечатления об официальной связи с проектом или его представлении.',
      logoUseText3: 'Без предварительного разрешения не допускаются:<br>— изменение формы, пропорций, цветов или элементов логотипа;<br>— размещение логотипа на продукции, предназначенной для продажи.',
      colorsTitle: 'Цвета',
      goldName: 'Золотисто-янтарный',
      blackName: 'Чёрный',
      whiteName: 'Белый',
      nameUseTitle: 'Использование названия',
      nameUseText1: 'Название «Интераль»/Interal и все производные от него разрешается свободно использовать для обозначения языка и достоверного упоминания проекта, включая научные, образовательные, информационные и критические материалы.',
      nameUseText2: 'Запрещается регистрация сходного доменного имени, названия аккаунта, если создаётся смешение или имитация официального проекта.',
      download: 'Скачать'
    },
    en: {
      title: 'Logo and name',
      descriptionTitle: 'Logo description',
      descriptionText: 'The Interal logo is a golden figure consisting of a circle, four waves, and an eight-pointed star at the top. The circle means the unity of people who speak Indo-European languages. The waves symbolize speech. The star is the spread of Indo-European languages in all parts of the world. The golden color expresses prosperity and is associated with the sun. In turn, the sun symbolizes the light of knowledge and openness to the world.',
      logoUseTitle: 'Logo use',
      logoUseText1: 'The unchanged logo may be used for informational mention of the project, placement of links to its official website, publication of reviews, scientific and educational materials, and distribution of official Interal materials.',
      logoUseText2: 'Use of the logo on any media to create a false impression of an official connection with the project or its representation is prohibited.',
      logoUseText3: 'Without prior permission, the following are not allowed:<br>— changing the shape, proportions, colors, or elements of the logo;<br>— placing the logo on products intended for sale.',
      colorsTitle: 'Colors',
      goldName: 'Golden amber',
      blackName: 'Black',
      whiteName: 'White',
      nameUseTitle: 'Name use',
      nameUseText1: 'The name “Интераль”/Interal and all derivatives of it may be used freely to designate the language and make accurate mention of the project, including scientific, educational, informational, and critical materials.',
      nameUseText2: 'Registration of a similar domain name or account name is prohibited if it creates confusion or imitation of the official project.',
      download: 'Download'
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
  function variantClass(file) { return file.includes(' w.') ? 'logo-preview--white' : file.includes(' b.') ? 'logo-preview--black' : 'logo-preview--gold'; }
  function href(file) { return `../elements/${encodeURIComponent(file).replace(/%20/g, '%20')}`; }

  function renderLogos() {
    const files = format === 'svg' ? logoSets.svg.default : logoSets.png[size];
    const t = text[currentLang()];
    sizeGroup.hidden = format === 'svg';
    grid.innerHTML = files.map((file) => `
      <article class="logo-variant">
        <div class="logo-preview ${variantClass(file)}">
          <div class="logo-preview-inset"><img src="${href(file)}" alt="${file}"></div>
        </div>
        <div class="logo-meta">
          <div class="logo-file-name">${file}</div>
          <a class="logo-download-btn" href="${href(file)}" download aria-label="${t.download} ${file}"><img src="../elements/Download.svg" alt="" aria-hidden="true"></a>
        </div>
      </article>`).join('');
  }

  function syncButtons() {
    document.querySelectorAll('[data-format]').forEach((btn) => {
      const active = btn.dataset.format === format;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-checked', String(active));
    });
    document.querySelectorAll('[data-size]').forEach((btn) => {
      const active = btn.dataset.size === size;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-checked', String(active));
    });
  }

  function applyLanguage(lang) {
    const t = text[lang === 'en' ? 'en' : 'ru'];
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      node.innerHTML = t[node.dataset.i18n];
    });
    document.title = t.title;
    renderLogos();
  }

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
