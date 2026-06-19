import { analyzeAssociativeWord, THRESHOLDS } from './js/association-analyzer.js';
import { QWEN_RUNTIME_CONFIG } from './js/qwen-client.js';
import { formatMetric, resultRowClasses, swowLabel } from './js/render-results.js';

const TEXT_I18N = {
      ru: {
        headerLead: 'Инструмент отбора ассоциативных слов: поиск дериватов по локальной базе, группировка по моделям, частотные баллы и итоговый процент ассоциации.',
        searchTitle: '1) Параметры поиска',
        searchNote: 'Сначала задайте корень и тип элемента, затем запустите расчёт.',
        rootLabel: 'Кандидатный корень / предлог',
        rootPlaceholder: 'например: ocul, regul, inter',
        meaningLabel: 'Перевод / значение',
        meaningPlaceholder: 'например: глаз, правило, между',
        elementTypeLabel: 'Тип элемента',
        rootOption: 'корень',
        prepositionOption: 'предлог / приставка',
        searchBtn: 'Найти дериваты и посчитать',
        showExampleBtn: 'Показать пример',
        exportBtn: 'Экспорт JSON',
        importBtn: 'Импорт JSON',
        resultTitle: '2) Итог',
        languagesTitle: '3) Языки и дериваты',
        derivativeDbTitle: '4) Локальная база дериватов',
        derivativeDbNote: 'Можно заменить на реальные JSON-данные из Kaikki/Wiktionary. Формат: язык → массив слов.',
        loadDerivativeDataBtn: 'Загрузить базу дериватов',
        frequencyDbTitle: '5) Локальная база частотных рангов',
        frequencyDbNote: 'Формат: язык → { слово: ранг }. Можно сгенерировать из wordfreq/top_n_list.',
        loadFrequencyDataBtn: 'Загрузить частоты',
        reset: 'Сбросить',
        resetConfirm: 'Сбросить введённые данные? Это действие нельзя отменить.',
        manual: 'ручная',
        languages: {
          en: 'Английский', de: 'Немецкий', fr: 'Французский', es: 'Испанский', it: 'Итальянский', ru: 'Русский'
        },
        groups: {
          Germanic: 'Германская', Romance: 'Романская', Slavic: 'Славянская'
        },
        panel: {
          group: 'Группа', languageScore: 'Балл языка', weightSum: 'сумма весов', addWord: 'Добавить слово', use: 'Учитывать', word: 'Слово', model: 'Модель', association: 'Ассоциация', rank: 'Ранг', frequency: 'Частота', weightP: 'Вес P'
        },
        results: {
          finalAssociation: 'FA — конечная ассоциация', totalAssociation: 'TA — вся ассоциация', languagesRepresented: 'языков представлено', languageGroups: 'языковых групп', accept: 'ПРИНЯТЬ', reject: 'НЕ ПРИНИМАТЬ', fewerLanguages: 'меньше 3 языков', fewerGroups: 'меньше 2 языковых групп', belowThreshold: 'ниже главного порога', reasons: 'Причины', allMet: 'Все условия выполнены.'
        },
        alerts: {
          derivativeLoaded: 'База дериватов загружена.', derivativeJsonError: 'Ошибка JSON в базе дериватов: ', frequencyLoaded: 'База частот загружена.', frequencyJsonError: 'Ошибка JSON в базе частот: ', importError: 'Ошибка импорта: '
        }
      },
      en: {
        headerLead: 'Tool for selecting associative words: derivative search in a local database, grouping by models, frequency scores, and final association percentage.',
        searchTitle: '1) Search parameters',
        searchNote: 'First enter the root and element type, then run the calculation.',
        rootLabel: 'Candidate root / preposition',
        rootPlaceholder: 'for example: ocul, regul, inter',
        meaningLabel: 'Translation / meaning',
        meaningPlaceholder: 'for example: eye, rule, between',
        elementTypeLabel: 'Element type',
        rootOption: 'root',
        prepositionOption: 'preposition / prefix',
        searchBtn: 'Find derivatives and calculate',
        showExampleBtn: 'Show example',
        exportBtn: 'Export JSON',
        importBtn: 'Import JSON',
        resultTitle: '2) Result',
        languagesTitle: '3) Languages and derivatives',
        derivativeDbTitle: '4) Local derivative database',
        derivativeDbNote: 'Can be replaced with real JSON data from Kaikki/Wiktionary. Format: language → array of words.',
        loadDerivativeDataBtn: 'Load derivative database',
        frequencyDbTitle: '5) Local frequency-rank database',
        frequencyDbNote: 'Format: language → { word: rank }. Can be generated from wordfreq/top_n_list.',
        loadFrequencyDataBtn: 'Load frequencies',
        reset: 'Reset',
        resetConfirm: 'Reset entered data? This action cannot be undone.',
        manual: 'manual',
        languages: {
          en: 'English', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian', ru: 'Russian'
        },
        groups: {
          Germanic: 'Germanic', Romance: 'Romance', Slavic: 'Slavic'
        },
        panel: {
          group: 'Group', languageScore: 'Language score', weightSum: 'weight sum', addWord: 'Add word', use: 'Use', word: 'Word', model: 'Model', association: 'Association', rank: 'Rank', frequency: 'Frequency', weightP: 'Weight P'
        },
        results: {
          finalAssociation: 'FA — final association', totalAssociation: 'TA — total association', languagesRepresented: 'languages represented', languageGroups: 'language groups', accept: 'ACCEPT', reject: 'DO NOT ACCEPT', fewerLanguages: 'fewer than 3 languages', fewerGroups: 'fewer than 2 language groups', belowThreshold: 'below the main threshold', reasons: 'Reasons', allMet: 'All conditions are met.'
        },
        alerts: {
          derivativeLoaded: 'Derivative database loaded.', derivativeJsonError: 'JSON error in derivative database: ', frequencyLoaded: 'Frequency database loaded.', frequencyJsonError: 'JSON error in frequency database: ', importError: 'Import error: '
        }
      }
    };

    function currentLang() {
      return localStorage.getItem('interal.lang') === 'en' ? 'en' : 'ru';
    }

    function textGroup(group) {
      return TEXT_I18N[currentLang()][group] || TEXT_I18N.ru[group] || {};
    }

    function textValue(key) {
      return TEXT_I18N[currentLang()][key] || TEXT_I18N.ru[key] || key;
    }

    const LANGUAGES = [
      { code: 'en', name: 'Английский', group: 'Germanic' },
      { code: 'de', name: 'Немецкий', group: 'Germanic' },
      { code: 'fr', name: 'Французский', group: 'Romance' },
      { code: 'es', name: 'Испанский', group: 'Romance' },
      { code: 'it', name: 'Итальянский', group: 'Romance' },
      { code: 'ru', name: 'Русский', group: 'Slavic' }
    ];

    const DEFAULT_DERIVATIVES = {
      en: ['ocular', 'oculist', 'oculus', 'binocular', 'monocular', 'monocle', 'inoculate', 'regulate', 'regulation', 'regulatory', 'regular', 'international', 'internet', 'interaction', 'interactive', 'intercontinental', 'interface'],
      de: ['okular', 'okulist', 'binokular', 'monokel', 'regulieren', 'regulation', 'regulatorisch', 'regel', 'international', 'internet', 'interaktion', 'interkulturell'],
      fr: ['oculaire', 'oculiste', 'binoculaire', 'monocle', 'réguler', 'régulation', 'réglement', 'réglementaire', 'international', 'internet', 'interaction', 'intervenir'],
      es: ['ocular', 'oculista', 'binocular', 'monóculo', 'regular', 'regulación', 'reglamento', 'reglamentario', 'internacional', 'internet', 'interacción'],
      it: ['oculare', 'oculista', 'binoculare', 'monocolo', 'regolare', 'regolazione', 'regolamento', 'regolamentare', 'internazionale', 'internet', 'interazione'],
      ru: ['окулист', 'окуляр', 'очки', 'бинокулярный', 'монокль', 'регулировать', 'регуляция', 'регламент', 'регламентарный', 'регулярный', 'интернациональный', 'интернет', 'интерактивный']
    };

    const DEFAULT_FREQUENCIES = {
      en: { ocular: 39497, oculist: 60000, oculus: 50000, binocular: 30000, monocular: 50000, monocle: 25000, inoculate: 18000, regulate: 6500, regulation: 2600, regulatory: 8400, regular: 850, international: 700, internet: 900, interaction: 4300, interactive: 5400, intercontinental: 21000, interface: 3800 },
      de: { okular: 60000, okulist: 60000, binokular: 60000, monokel: 50000, regulieren: 9000, regulation: 11000, regulatorisch: 25000, regel: 900, international: 800, internet: 700, interaktion: 9000, interkulturell: 17000 },
      fr: { oculaire: 14735, oculiste: 50000, binoculaire: 50000, monocle: 22000, réguler: 14000, régulation: 9000, réglement: 6000, réglementaire: 8500, international: 850, internet: 900, interaction: 5500, intervenir: 1800 },
      es: { ocular: 20219, oculista: 45000, binocular: 35000, monóculo: 45000, regular: 1300, regulación: 7000, reglamento: 7500, reglamentario: 16000, internacional: 900, internet: 1000, interacción: 5800 },
      it: { oculare: 38367, oculista: 50000, binoculare: 50000, monocolo: 45000, regolare: 2200, regolazione: 9500, regolamento: 6000, regolamentare: 12000, internazionale: 900, internet: 950, interazione: 7000 },
      ru: { окулист: 50000, окуляр: 60000, очки: 1200, бинокулярный: 60000, монокль: 39000, регулировать: 5500, регуляция: 13000, регламент: 6500, регламентарный: 30000, регулярный: 2800, интернациональный: 18000, интернет: 600, интерактивный: 9000 }
    };

    let derivativeData = structuredClone(DEFAULT_DERIVATIVES);
    let frequencyData = structuredClone(DEFAULT_FREQUENCIES);
    let state = emptyState();
    let activeLang = 'en';

    async function loadJsonFilesFromDirectory() {
      const loadedFrequencies = {};
      const loadedDerivatives = {};
      const missing = [];

      for (const lang of LANGUAGES) {
        try {
          const response = await fetch(`./${lang.code}.json`, { cache: 'no-store' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const json = await response.json();
          if (!json || typeof json !== 'object' || Array.isArray(json)) {
            throw new Error('JSON должен быть объектом формата { "word": rank }');
          }

          loadedFrequencies[lang.code] = json;
          loadedDerivatives[lang.code] = Object.keys(json);
        } catch (error) {
          missing.push(`${lang.code}: ${error.message}`);
        }
      }

      if (Object.keys(loadedFrequencies).length) {
        frequencyData = {
          ...frequencyData,
          ...loadedFrequencies
        };
      }
      if (Object.keys(loadedDerivatives).length) {
        derivativeData = {
          ...derivativeData,
          ...loadedDerivatives
        };
      }

      renderDataEditors();

      if (missing.length) {
        console.warn(currentLang() === 'en' ? 'Not all JSON files could be loaded; built-in demo data was used:' : 'Не все JSON-файлы удалось загрузить, использованы встроенные демо-данные:', missing.join('; '));
      }
    }

    function emptyState() {
      const langs = {};
      LANGUAGES.forEach(l => langs[l.code] = []);
      return {
        root: '',
        meaning: '',
        elementType: 'root',
        maxModels: 5,
        languages: langs
      };
    }

    function normalizeText(s) {
      return String(s || '').trim().toLowerCase().normalize('NFC');
    }

    function stripDiacritics(s) {
      return normalizeText(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function includesRoot(word, root) {
      const w = stripDiacritics(word);
      const r = stripDiacritics(root);
      return r.length > 0 && w.includes(r);
    }

    function getFrequencyScore(item) {
      const score = typeof item === 'object' ? item?.analysis?.frequency?.frequency_score : item;
      return Number.isFinite(Number(score)) ? Number(score) : 0;
    }

    function currentLocale() {
      return currentLang() === 'en' ? 'en-US' : 'ru-RU';
    }

    function formatFixed(value, digits) {
      if (!Number.isFinite(value)) return '—';
      return new Intl.NumberFormat(currentLocale(), {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      }).format(value);
    }

    function formatPercent(value, digits = 0) {
      return `${formatFixed(value, digits)}%`;
    }

    function getManualModelLabel() {
      return textValue('manual');
    }

    function getResetConfirmMessage() {
      return textValue('resetConfirm');
    }

    function inferModel(word, root, elementType) {
      const original = String(word || '').trim();
      const w = stripDiacritics(original);
      const r = stripDiacritics(root);
      const idx = w.indexOf(r);
      if (idx === -1) return getManualModelLabel();

      const before = w.slice(0, idx);
      const after = w.slice(idx + r.length);

      if (elementType === 'preposition') {
        const next = after.match(/^[a-zа-яёα-ωάέήίόύώϊϋΐΰ]+/i);
        return next ? `${r}+${next[0].slice(0, 6)}` : `${r}+`;
      }

      if (before) return `${before}-`;
      const suffixMatch = after.match(/^[a-zа-яёα-ωάέήίόύώϊϋΐΰ]{1,8}/i);
      if (suffixMatch) return `-${suffixMatch[0]}`;
      return `${r}`;
    }

    function inferAssociation(word, root, meaning) {
      const w = stripDiacritics(word);
      if (!w || !root) return 0;
      return includesRoot(w, root) || specialRootMatch('any', w, root) ? 1 : 0;
    }

    function getRank(lang, word) {
      const key = normalizeText(word);
      const raw = frequencyData[lang] || {};
      return raw[key] || raw[stripDiacritics(key)] || 50001;
    }

    function wordWeight(item) {
      const final = Number(item.final_score);
      if (Number.isFinite(final)) return final;

      const analysisFinal = Number(item.analysis?.final_score);
      if (Number.isFinite(analysisFinal)) return analysisFinal;

      return null;
    }

    function groupByBestModel(items, maxModels) {
      const byModel = new Map();
      for (const item of items) {
        const current = byModel.get(item.model);
        if (!current || wordWeight(item) > wordWeight(current) || (wordWeight(item) === wordWeight(current) && Number(item.rank) < Number(current.rank))) {
          byModel.set(item.model, item);
        }
      }
      return Array.from(byModel.values())
        .sort((a, b) => wordWeight(b) - wordWeight(a) || a.word.localeCompare(b.word))
        .slice(0, maxModels)
        .map(x => ({
          ...x,
          selected: ['accepted', 'accepted_after_review'].includes(x.analysis?.classification)
        }));
    }

    function failedAnalysis(langCode, item, error) {
      const message = `Analysis failed: ${error.message}`;
      return {
        ...item,
        analysis: {
          language: langCode,
          target_meaning: state.meaning || state.root,
          word: item.word,
          frequency: { frequency_score: null, category_breakdown: {}, warnings: [] },
          swow: { target_to_word: null, word_to_target: null, bonus: 0, source: 'local_swow' },
          association: {
            directness: null,
            field_relatedness: null,
            domain_shift: null,
            association_score_base: null,
            association_score: null,
            explanation: message
          },
          final_score: null,
          warnings: [message]
        },
        frequency_score: null,
        association_score: null,
        final_score: null,
        selected: false
      };
    }

    async function analyzeCandidateItem(langCode, item) {
      try {
        const analysis = await analyzeAssociativeWord({
          language: langCode,
          targetMeaning: state.meaning || state.root,
          word: item.word
        });
        return {
          ...item,
          analysis,
          frequency_score: analysis.frequency.frequency_score,
          association_score: analysis.association.association_score,
          final_score: analysis.final_score,
          selected: false
        };
      } catch (error) {
        return failedAnalysis(langCode, item, error);
      }
    }

    async function mapWithConcurrency(items, limit, mapper) {
      const results = [];
      let index = 0;
      const safeLimit = Math.max(1, Number(limit) || 1);

      async function worker() {
        while (index < items.length) {
          const currentIndex = index++;
          results[currentIndex] = await mapper(items[currentIndex], currentIndex);
        }
      }

      const workers = Array.from(
        { length: Math.min(safeLimit, items.length) },
        () => worker()
      );

      await Promise.all(workers);
      return results;
    }

    async function getLanguageCandidates(langCode, root) {
      const localWords = derivativeData[langCode] || [];
      const byWord = new Map();
      const add = (word, extra = {}) => {
        const key = normalizeText(word);
        if (!key || byWord.has(key)) return;
        byWord.set(key, {
          word,
          model: inferModel(word, root, state.elementType),
          selected: false,
          ...extra
        });
      };

      localWords
        .filter(w => includesRoot(w, root) || specialRootMatch(langCode, w, root))
        .slice(0, 30)
        .forEach(word => add(word));

      return Array.from(byWord.values()).slice(0, QWEN_RUNTIME_CONFIG.maxCandidatesPerLanguage);
    }

    async function searchDerivatives() {
      state.root = normalizeText(document.getElementById('rootInput').value);
      state.meaning = document.getElementById('meaningInput').value.trim();
      state.elementType = document.getElementById('elementType').value;
      state.maxModels = 5;

      const searchBtn = document.getElementById('searchBtn');
      searchBtn.disabled = true;
      searchBtn.textContent = currentLang() === 'en' ? 'Calculating…' : 'Расчёт…';

      const root = state.root;
      const nextLangs = {};

      try {
        for (const lang of LANGUAGES) {
          const candidates = await getLanguageCandidates(lang.code, root);
          const analyzed = await mapWithConcurrency(
            candidates,
            QWEN_RUNTIME_CONFIG.maxConcurrentQwenRequests,
            item => analyzeCandidateItem(lang.code, item)
          );

          nextLangs[lang.code] = groupByBestModel(analyzed, state.maxModels);
        }
        state.languages = nextLangs;
      } finally {
        searchBtn.disabled = false;
        applyLocalizedTexts();
      }

      renderAll();
    }

    function specialRootMatch(lang, word, root) {
      // Небольшой демо-словарь для случаев, когда корень адаптирован графически.
      const w = normalizeText(word);
      if (root === 'inter') return w.includes('интер') || w.includes('ίντερ') || w.includes('inter');
      if (root === 'ocul') return w.includes('окул') || w.includes('ocul') || w.includes('okul');
      if (root === 'regul') return w.includes('регул') || w.includes('regul') || w.includes('régul') || w.includes('regol');
      return false;
    }

    function calculateLanguage(langCode) {
      const items = state.languages[langCode] || [];
      const selected = items.filter(x => x.selected).slice(0, state.maxModels);
      const scores = selected
        .map(wordWeight)
        .filter(score => Number.isFinite(Number(score)));
      const sum = scores.reduce((acc, x) => acc + x, 0);
      return {
        sum,
        normalized: scores.length ? sum / scores.length : null,
        count: scores.length
      };
    }

    function calculateFinal() {
      const languageScores = LANGUAGES.map(l => ({ lang: l, ...calculateLanguage(l.code) }));
      const represented = languageScores.filter(x => Number.isFinite(Number(x.normalized)));
      const totalAssociation = represented.reduce((acc, x) => acc + x.normalized, 0);
      const finalAssociation = represented.length ? totalAssociation / represented.length : 0;
      const representedLangs = represented.length;
      const groups = new Set(represented.map(x => x.lang.group));
      const accepted =
        representedLangs >= 3 &&
        groups.size >= 2 &&
        finalAssociation >= THRESHOLDS.main;
      return { languageScores, totalAssociation, finalAssociation, representedLangs, groups: groups.size, accepted };
    }

    function renderTabs() {
      const tabs = document.getElementById('tabs');
      tabs.innerHTML = '';
      for (const lang of LANGUAGES) {
        const score = calculateLanguage(lang.code);
        const btn = document.createElement('button');
        btn.className = `tab ${activeLang === lang.code ? 'active' : ''}`;
        btn.textContent = `${textGroup('languages')[lang.code] || lang.name} (${formatPercent(score.normalized, 1)})`;
        btn.onclick = () => { activeLang = lang.code; renderAll(); };
        tabs.appendChild(btn);
      }
    }

    function syncTabWidths() {
      const tabs = document.getElementById('tabs');
      if (!tabs) return;
      const tabButtons = Array.from(tabs.querySelectorAll('.tab'));
      if (!tabButtons.length) return;

      for (const btn of tabButtons) btn.style.width = "";

      let maxWidth = 0;
      for (const btn of tabButtons) {
        maxWidth = Math.max(maxWidth, Math.ceil(btn.getBoundingClientRect().width));
      }
      for (const btn of tabButtons) {
        btn.style.width = `${maxWidth}px`;
      }
    }

    function renderLanguagePanel() {
      const lang = LANGUAGES.find(l => l.code === activeLang);
      const panel = document.getElementById('languagePanel');
      const items = state.languages[activeLang] || [];
      const score = calculateLanguage(activeLang);
      const labels = textGroup('panel');
      panel.innerHTML = `
        <div class="row" style="margin-bottom:12px;">
          <div>
            <h3>${textGroup('languages')[lang.code] || lang.name}</h3>
            <p class="muted">${labels.group}: ${textGroup('groups')[lang.group] || lang.group}. ${labels.languageScore}: <strong>${formatFixed(score.normalized, 2)}%</strong>; ${labels.weightSum}: <strong>${formatFixed(score.sum, 2)}</strong>.</p>
          </div>
          <button class="tool-btn interal-btn interal-btn--secondary fit short" onclick="addRow('${activeLang}')">${labels.addWord}</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>${labels.use}</th>
              <th>Word</th>
              <th>${labels.model}</th>
              <th>Frequency %</th>
              <th>Directness</th>
              <th>Field relatedness</th>
              <th>Domain shift</th>
              <th>SWOW bonus</th>
              <th>Association %</th>
              <th>Final %</th>
              <th>Status</th>
              <th>Explanation</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${items.map((item, idx) => rowHtml(activeLang, item, idx)).join('')}</tbody>
        </table>
      `;
    }

    function rowHtml(lang, item, idx) {
      const analysis = item.analysis || {};
      const assoc = analysis.review || analysis.association || {};
      const warnings = (analysis.warnings || []).join('; ');
      return `
        <tr class="${resultRowClasses(analysis)}" title="${escapeHtml(warnings)}">
          <td><input class="interal-checkbox" type="checkbox" ${item.selected ? 'checked' : ''} onchange="updateItem('${lang}', ${idx}, 'selected', this.checked)"></td>
          <td><input class="interal-input" value="${escapeHtml(item.word)}" onchange="updateItem('${lang}', ${idx}, 'word', this.value)"></td>
          <td><input class="interal-input" value="${escapeHtml(item.model)}" onchange="updateItem('${lang}', ${idx}, 'model', this.value)"></td>
          <td>${formatMetric(analysis.frequency?.frequency_score ?? item.frequency_score, 2)}</td>
          <td>${formatMetric(assoc.directness, 0)}</td>
          <td>${formatMetric(assoc.field_relatedness, 0)}</td>
          <td>${formatMetric(assoc.domain_shift, 0)}</td>
          <td>${formatMetric(analysis.swow?.bonus, 1)}</td>
          <td>${formatMetric(assoc.association_score ?? item.association_score, 1)}</td>
          <td><strong>${formatMetric(analysis.final_score ?? item.final_score, 2)}</strong></td>
          <td><span class="status">${escapeHtml(analysis.classification || 'unavailable')}</span></td>
          <td>${escapeHtml(assoc.explanation || warnings || '—')}</td>
          <td><button class="tool-btn interal-btn interal-btn--secondary interal-btn--small" onclick="analyzeItem('${lang}', ${idx})">Analyze</button><button class="tool-btn interal-btn interal-btn--secondary interal-btn--small" onclick="deleteItem('${lang}', ${idx})">×</button></td>
        </tr>
      `;
    }

    function renderResults() {
      const result = calculateFinal();
      const labels = textGroup('results');
      document.getElementById('resultBox').innerHTML = `
        <div class="metric"><strong>${formatPercent(result.finalAssociation, 1)}</strong><span>${labels.finalAssociation}</span></div>
        <div class="metric"><strong>${formatFixed(result.totalAssociation, 3)}</strong><span>${labels.totalAssociation}</span></div>
        <div class="metric"><strong>${result.representedLangs}/${LANGUAGES.length}</strong><span>${labels.languagesRepresented}</span></div>
        <div class="metric"><strong>${result.groups}/${new Set(LANGUAGES.map(l => l.group)).size}</strong><span>${labels.languageGroups}</span></div>
      `;

      let statusClass = result.accepted ? 'ok' : (result.finalAssociation >= THRESHOLDS.main ? 'warn' : 'bad');
      let statusText = result.accepted ? labels.accept : labels.reject;
      let reasons = [];
      if (result.representedLangs < 3) reasons.push(labels.fewerLanguages);
      if (result.groups < 2) reasons.push(labels.fewerGroups);
      if (result.finalAssociation < THRESHOLDS.main) {
        reasons.push(labels.belowThreshold);
      }

      document.getElementById('decisionBox').innerHTML = `
        <span class="status ${statusClass}">${statusText}</span>
        <span class="muted" style="margin-left:8px;">${reasons.length ? labels.reasons + ': ' + reasons.join(', ') : labels.allMet}</span>
      `;
    }

    function renderDataEditors() {
      document.getElementById('derivativeDataInput').value = JSON.stringify(derivativeData, null, 2);
      document.getElementById('frequencyDataInput').value = JSON.stringify(frequencyData, null, 2);
    }


    function applyLocalizedTexts() {
      const mappings = {
        headerLead: textValue('headerLead'),
        searchTitle: textValue('searchTitle'),
        searchNote: textValue('searchNote'),
        rootLabel: textValue('rootLabel'),
        meaningLabel: textValue('meaningLabel'),
        elementTypeLabel: textValue('elementTypeLabel'),
        rootOption: textValue('rootOption'),
        prepositionOption: textValue('prepositionOption'),
        searchBtn: textValue('searchBtn'),
        showExampleBtn: textValue('showExampleBtn'),
        exportBtn: textValue('exportBtn'),
        importBtn: textValue('importBtn'),
        resultTitle: textValue('resultTitle'),
        languagesTitle: textValue('languagesTitle'),
        derivativeDbTitle: textValue('derivativeDbTitle'),
        derivativeDbNote: textValue('derivativeDbNote'),
        loadDerivativeDataBtn: textValue('loadDerivativeDataBtn'),
        frequencyDbTitle: textValue('frequencyDbTitle'),
        frequencyDbNote: textValue('frequencyDbNote'),
        loadFrequencyDataBtn: textValue('loadFrequencyDataBtn')
      };
      Object.entries(mappings).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
      });
      document.getElementById('rootInput').setAttribute('placeholder', textValue('rootPlaceholder'));
      document.getElementById('meaningInput').setAttribute('placeholder', textValue('meaningPlaceholder'));
      const resetBtn = document.getElementById('resetBtn');
      resetBtn.setAttribute('aria-label', textValue('reset'));
      resetBtn.setAttribute('title', textValue('reset'));
    }

    function renderAll() {
      applyLocalizedTexts();
      renderTabs();
      syncTabWidths();
      renderLanguagePanel();
      renderResults();
      syncResetButtonVisibility();
      saveLocal();
    }

    function updateItem(lang, idx, key, value) {
      const item = state.languages[lang][idx];
      item[key] = value;
      if (key === 'word') {
        item.model = inferModel(value, state.root, state.elementType);
      }
      
      renderAll();
    }

    async function analyzeItem(lang, idx) {
      const item = state.languages[lang][idx];
      if (!item || !normalizeText(item.word)) return;
      item.model = item.model || inferModel(item.word, state.root, state.elementType);
      item.analysis = await analyzeAssociativeWord({
        language: lang,
        targetMeaning: state.meaning || state.root,
        word: item.word
      });
      item.frequency_score = item.analysis.frequency.frequency_score;
      item.association_score = item.analysis.association.association_score;
      item.final_score = item.analysis.final_score;
      renderAll();
    }

    function deleteItem(lang, idx) {
      state.languages[lang].splice(idx, 1);
      renderAll();
    }

    function addRow(lang) {
      state.languages[lang].push({ word: '', model: '', analysis: null, frequency_score: null, association_score: null, final_score: null, selected: false });
      renderAll();
    }

    function loadDerivativeData() {
      try {
        derivativeData = JSON.parse(document.getElementById('derivativeDataInput').value);
        alert(textGroup('alerts').derivativeLoaded);
      } catch (e) {
        alert(textGroup('alerts').derivativeJsonError + e.message);
      }
    }

    function loadFrequencyData() {
      try {
        frequencyData = JSON.parse(document.getElementById('frequencyDataInput').value);
        alert(textGroup('alerts').frequencyLoaded);
      } catch (e) {
        alert(textGroup('alerts').frequencyJsonError + e.message);
      }
    }

    function exportState() {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `interal-association-${state.root || 'root'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }

    function importState() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const imported = JSON.parse(text);
          state = imported;
          document.getElementById('rootInput').value = state.root || '';
          document.getElementById('meaningInput').value = state.meaning || '';
          document.getElementById('elementType').value = state.elementType || 'root';
          state.maxModels = Number(state.maxModels) || 5;
          renderAll();
        } catch (e) {
          alert(textGroup('alerts').importError + e.message);
        }
      };
      input.click();
    }


    function hasUserInputForReset() {
      const hasRoot = normalizeText(document.getElementById('rootInput').value).length > 0;
      const hasMeaning = String(document.getElementById('meaningInput').value || '').trim().length > 0;
      const hasTypeChange = document.getElementById('elementType').value !== 'root';
      const hasLanguageRows = Object.values(state.languages || {}).some((items) => Array.isArray(items) && items.length > 0);
      return hasRoot || hasMeaning || hasTypeChange || hasLanguageRows;
    }

    function syncResetButtonVisibility() {
      document.getElementById('resetBtn').classList.toggle('is-hidden', !hasUserInputForReset());
    }

    function resetAll() {
      if (!window.confirm(getResetConfirmMessage())) return;
      state = emptyState();
      document.getElementById('rootInput').value = state.root;
      document.getElementById('meaningInput').value = state.meaning;
      document.getElementById('elementType').value = state.elementType;
      renderAll();
    }

    function saveLocal() {
      try { localStorage.setItem('interal_associative_state', JSON.stringify(state)); } catch {}
    }

    function loadLocal() {
      try {
        const raw = localStorage.getItem('interal_associative_state');
        if (raw) {
          state = JSON.parse(raw);
          document.getElementById('rootInput').value = state.root || '';
          document.getElementById('meaningInput').value = state.meaning || '';
          document.getElementById('elementType').value = state.elementType || 'root';
          state.maxModels = 5;
          return true;
        }
      } catch {}
      return false;
    }

    function escapeHtml(s) {
      return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    const examplesByType = {
      root: [
        { root: 'regul', meaning: 'правило', elementType: 'root' }
      ],
      preposition: [
        { root: 'inter', meaning: 'между', elementType: 'preposition' }
      ]
    };

    function showExample() {
      const selectedType = document.getElementById('elementType').value || 'root';
      const examples = examplesByType[selectedType] || examplesByType.root;
      const choice = examples[Math.floor(Math.random() * examples.length)];
      state.root = choice.root;
      state.meaning = choice.meaning;
      state.elementType = selectedType;
      document.getElementById('rootInput').value = state.root;
      document.getElementById('meaningInput').value = state.meaning;
      document.getElementById('elementType').value = state.elementType;
      searchDerivatives();
    }

    document.getElementById('rootInput').addEventListener('input', syncResetButtonVisibility);
    document.getElementById('meaningInput').addEventListener('input', syncResetButtonVisibility);
    document.getElementById('elementType').addEventListener('change', syncResetButtonVisibility);
    document.getElementById('searchBtn').addEventListener('click', () => searchDerivatives());
    document.getElementById('showExampleBtn').addEventListener('click', showExample);
        document.getElementById('exportBtn').addEventListener('click', exportState);
    document.getElementById('importBtn').addEventListener('click', importState);
    document.getElementById('resetBtn').addEventListener('click', resetAll);
    document.getElementById('loadDerivativeDataBtn').addEventListener('click', loadDerivativeData);
    document.getElementById('loadFrequencyDataBtn').addEventListener('click', loadFrequencyData);
    document.addEventListener('interal:languagechange', renderAll);
    window.addEventListener('resize', syncTabWidths);

    window.updateItem = updateItem;
    window.deleteItem = deleteItem;
    window.addRow = addRow;
    window.analyzeItem = analyzeItem;
    window.QWEN_RUNTIME_CONFIG = QWEN_RUNTIME_CONFIG;
    window.testQwenAssociation = async function () {
      return await fetch('/api/qwen-association', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: 'Return only JSON.',
          user: 'Return {"word":"test","target_meaning":"test","directness":80,"field_relatedness":90,"domain_shift":10,"short_explanation":"test"}',
          model: 'qwen3.6-35b-a3b/latest',
          review: false
        })
      }).then(r => r.json());
    };

    async function init() {
      await loadJsonFilesFromDirectory();
      loadLocal();
      renderAll();
    }

    init();
