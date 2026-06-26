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
        jsonCardBtn: 'Сформировать JSON-карточку',
        resultTitle: '2) Итог',
        languagesTitle: '3) Языки и дериваты',
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
          group: 'Группа', languageScore: 'Балл языка', weightSum: 'сумма весов', addWord: 'Добавить слово', use: 'Учитывать', word: 'Слово', model: 'Модель', frequencyPercent: 'Частотность %', directness: 'Прямота связи', fieldRelatedness: 'Близость поля', domainShift: 'Сдвиг области', swowBonus: 'Бонус SWOW', associationPercent: 'Ассоциация %', finalPercent: 'Итог %', status: 'Статус', explanation: 'Объяснение', warnings: 'Предупреждения', details: 'Детали', analyze: 'Анализировать', delete: 'Удалить', association: 'Ассоциация', rank: 'Ранг', frequency: 'Частота', weightP: 'Вес P'
        },
        results: {
          finalAssociation: 'FA — конечная ассоциация', totalAssociation: 'TA — вся ассоциация', languagesRepresented: 'языков представлено', languageGroups: 'языковых групп', accept: 'ПРИНЯТЬ', reject: 'НЕ ПРИНИМАТЬ', fewerLanguages: 'меньше 3 языков', fewerGroups: 'меньше 2 языковых групп', belowThreshold: 'ниже главного порога', reasons: 'Причины', allMet: 'Все условия выполнены.'
        },
        alerts: {
          jsonCardUnavailable: 'Сначала выполните расчёт.',
          jsonCardCopied: 'JSON-карточка скопирована',
          jsonCardCopiedTitle: 'Скопировано',
          jsonCardEmpty: 'Сначала сгенерируйте JSON-карточку.',
          jsonCardGenerating: 'Генерация...',
          jsonCardThresholdUnavailable: 'JSON-карточку можно сформировать только после прохождения главного порога.'
        },
        jsonCard: {
          close: 'Закрыть JSON-карточку', title: 'JSON-карточка', useAuthor: 'Указать авторство', authorName: 'Имя или ник', contactType: 'Тип контакта', contact: 'Контакт', generate: 'Сгенерировать карточку', output: 'Готовый JSON', copy: 'Скопировать JSON-карточку', download: 'Скачать JSON-карточку'
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
        jsonCardBtn: 'Generate JSON card',
        resultTitle: '2) Result',
        languagesTitle: '3) Languages and derivatives',
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
          group: 'Group', languageScore: 'Language score', weightSum: 'weight sum', addWord: 'Add word', use: 'Use', word: 'Word', model: 'Model', frequencyPercent: 'Frequency %', directness: 'Directness', fieldRelatedness: 'Field relatedness', domainShift: 'Domain shift', swowBonus: 'SWOW bonus', associationPercent: 'Association %', finalPercent: 'Final %', status: 'Status', explanation: 'Explanation', warnings: 'Warnings', details: 'Details', analyze: 'Analyze', delete: 'Delete', association: 'Association', rank: 'Rank', frequency: 'Frequency', weightP: 'Weight P'
        },
        results: {
          finalAssociation: 'FA — final association', totalAssociation: 'TA — total association', languagesRepresented: 'languages represented', languageGroups: 'language groups', accept: 'ACCEPT', reject: 'DO NOT ACCEPT', fewerLanguages: 'fewer than 3 languages', fewerGroups: 'fewer than 2 language groups', belowThreshold: 'below the main threshold', reasons: 'Reasons', allMet: 'All conditions are met.'
        },
        alerts: {
          jsonCardUnavailable: 'Run a calculation first.',
          jsonCardCopied: 'JSON card copied',
          jsonCardCopiedTitle: 'Copied',
          jsonCardEmpty: 'Generate the JSON card first.',
          jsonCardGenerating: 'Generating...',
          jsonCardThresholdUnavailable: 'The JSON card can be generated only after passing the main threshold.'
        },
        jsonCard: {
          close: 'Close JSON card', title: 'JSON card', useAuthor: 'Add authorship', authorName: 'Name or nickname', contactType: 'Contact type', contact: 'Contact', generate: 'Generate card', output: 'Generated JSON', copy: 'Copy JSON card', download: 'Download JSON card'
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


    function setCalculateButtonStatus(text, disabled = true) {
      const button = document.querySelector('#calculateBtn');
      if (!button) return;

      const textEl = button.querySelector('.btn-text') || button;

      textEl.textContent = text;
      button.disabled = disabled;
      button.classList.toggle('is-loading', disabled);
    }

    function defaultCalculateButtonText() {
      return textValue('searchBtn');
    }

    const LANGUAGES = [
      { code: 'en', name: 'English', group: 'Germanic', speakers: 1493000 },
      { code: 'de', name: 'German', group: 'Germanic', speakers: 133000 },
      { code: 'fr', name: 'French', group: 'Romance', speakers: 334000 },
      { code: 'es', name: 'Spanish', group: 'Romance', speakers: 561000 },
      { code: 'it', name: 'Italian', group: 'Romance', speakers: 66000 },
      { code: 'ru', name: 'Russian', group: 'Slavic', speakers: 210000 }
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

    function levenshtein(a, b) {
      const left = String(a || '');
      const right = String(b || '');

      const dp = Array.from({ length: left.length + 1 }, () =>
        Array(right.length + 1).fill(0)
      );

      for (let i = 0; i <= left.length; i++) dp[i][0] = i;
      for (let j = 0; j <= right.length; j++) dp[0][j] = j;

      for (let i = 1; i <= left.length; i++) {
        for (let j = 1; j <= right.length; j++) {
          const cost = left[i - 1] === right[j - 1] ? 0 : 1;
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,
            dp[i][j - 1] + 1,
            dp[i - 1][j - 1] + cost
          );
        }
      }

      return dp[left.length][right.length];
    }

    function allowedRootDistance(root) {
      const len = stripDiacritics(root).length;
      if (len <= 3) return 1;
      return 2;
    }

    function fuzzyRootMatch(word, root) {
      const w = stripDiacritics(word);
      const r = stripDiacritics(root);

      if (!w || !r || r.length < 4) return null;

      const exactIndex = w.indexOf(r);
      if (exactIndex !== -1) {
        return { type: 'exact', distance: 0, fragment: r, index: exactIndex };
      }

      const maxDistance = allowedRootDistance(r);
      const minLen = Math.max(3, r.length - maxDistance);
      const maxLen = r.length + maxDistance;
      const maxStart = Math.min(w.length - 1, 3);
      let best = null;

      for (let i = 0; i <= maxStart; i++) {
        for (let len = minLen; len <= maxLen; len++) {
          const part = w.slice(i, i + len);
          if (part.length < minLen) continue;

          const distance = levenshtein(part, r);
          if (distance <= maxDistance && (!best || distance < best.distance)) {
            best = { type: 'fuzzy', distance, fragment: part, index: i };
            if (distance === 1) return best;
          }
        }
      }

      return best;
    }

    function fuzzyIncludesRoot(word, root) {
      return Boolean(fuzzyRootMatch(word, root));
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
      return includesRoot(w, root) || fuzzyIncludesRoot(w, root) || specialRootMatch('any', w, root) ? 1 : 0;
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
        const itemScore = wordWeight(item);
        if (!Number.isFinite(itemScore)) continue;

        const current = byModel.get(item.model);
        const currentScore = current ? wordWeight(current) : null;

        if (
          !current ||
          itemScore > currentScore ||
          (itemScore === currentScore && Number(item.rank) < Number(current.rank))
        ) {
          byModel.set(item.model, item);
        }
      }

      return Array.from(byModel.values())
        .sort((a, b) => wordWeight(b) - wordWeight(a) || a.word.localeCompare(b.word))
        .slice(0, maxModels)
        .map(x => ({
          ...x,
          selected: true
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

    async function analyzeCandidateItem(langCode, item, onProgress) {
      try {
        const languageName = textGroup('languages')[langCode] || langCode;
        onProgress?.(`SWOW: ${languageName} — ${item.word}`);
        const analysis = await analyzeAssociativeWord({
          language: langCode,
          targetMeaning: state.meaning || state.root,
          word: item.word,
          onProgress: text => onProgress?.(text.replace(`${langCode} —`, `${languageName} —`))
        });
        return {
          ...item,
          analysis,
          frequency_score: analysis.frequency.frequency_score,
          association_score: analysis.association.association_score,
          final_score: analysis.final_score,
          selected: true
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
        .map(word => {
          const fuzzyMatch = fuzzyRootMatch(word, root);
          if (fuzzyMatch) return { word, match: fuzzyMatch };
          if (specialRootMatch(langCode, word, root)) {
            return { word, match: { type: 'special', distance: null, fragment: stripDiacritics(root), index: null } };
          }
          return null;
        })
        .filter(Boolean)
        .slice(0, 30)
        .forEach(({ word, match }) => add(word, { match }));

      return Array.from(byWord.values()).slice(0, QWEN_RUNTIME_CONFIG.maxCandidatesPerLanguage);
    }

    async function runCalculation({ onProgress } = {}) {
      onProgress?.('Подготовка...');
      state.root = normalizeText(document.getElementById('rootInput').value);
      state.meaning = document.getElementById('meaningInput').value.trim();
      state.elementType = document.getElementById('elementType').value;
      state.maxModels = 5;

      const root = state.root;
      const nextLangs = {};

      onProgress?.('Загрузка частотных списков...');
      for (const lang of LANGUAGES) {
        const languageName = textGroup('languages')[lang.code] || lang.name;
        onProgress?.(`Поиск похожих корней: ${languageName}`);
        const candidates = await getLanguageCandidates(lang.code, root);
        onProgress?.(`Qwen3.6: оценка слов — ${languageName}`);
        const analyzed = await mapWithConcurrency(
          candidates,
          QWEN_RUNTIME_CONFIG.maxConcurrentQwenRequests,
          item => analyzeCandidateItem(lang.code, item, onProgress)
        );

        onProgress?.(`Расчёт языковых баллов: ${languageName}`);
        nextLangs[lang.code] = groupByBestModel(analyzed, state.maxModels);
      }
      onProgress?.('Расчёт итогового процента...');
      state.languages = nextLangs;
      calculateFinal();
    }

    async function searchDerivatives() {
      try {
        setCalculateButtonStatus('Подготовка...', true);
        await runCalculation({
          onProgress: text => setCalculateButtonStatus(text, true)
        });
        renderAll();
        setCalculateButtonStatus('Готово', true);
        setTimeout(() => {
          setCalculateButtonStatus(defaultCalculateButtonText(), false);
        }, 800);
      } catch (error) {
        console.error(error);
        setCalculateButtonStatus('Ошибка расчёта', false);
      } finally {
        renderAll();
      }
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
        <div class="derivatives-table-wrap">
          <table class="derivatives-table">
            <thead>
              <tr>
                <th class="col-word sticky-word">${labels.word}</th>
                <th class="col-score">${labels.finalPercent}</th>
                <th class="col-score">${labels.associationPercent}</th>
                <th class="col-score">${labels.frequencyPercent}</th>
                <th class="col-score">SWOW</th>
                <th class="col-details">${labels.details}</th>
                <th class="col-actions"></th>
              </tr>
            </thead>
            <tbody>${items.map((item, idx) => rowHtml(activeLang, item, idx)).join('')}</tbody>
          </table>
        </div>
      `;
    }

    function statusLabel(status) {
      const labels = currentLang() === 'ru' ? {
        accepted: 'принято',
        strong: 'сильный',
        needs_review: 'нужна проверка',
        rejected: 'отклонено',
        accepted_after_review: 'принято после проверки',
        rejected_after_review: 'отклонено после проверки',
        unavailable: 'нет данных',
        analyzing: 'анализируется...',
        error: 'ошибка'
      } : {
        analyzing: 'analyzing...',
        error: 'error'
      };
      return labels[status] || status || (currentLang() === 'ru' ? 'нет данных' : 'unavailable');
    }

    function rowHtml(lang, item, idx) {
      const analysis = item.analysis || {};
      const assoc = analysis.review || analysis.association || {};
      const labels = textGroup('panel');
      const warningList = analysis.warnings || [];
      const warnings = warningList.join('; ');
      return `
        <tr class="${resultRowClasses(analysis)}" title="${escapeHtml(warnings)}">
          <td class="col-word word-cell sticky-word">
            <label class="word-with-check">
              <input
                type="checkbox"
                class="word-select"
                data-action="toggle-word"
                data-lang="${escapeHtml(lang)}"
                data-index="${idx}"
                ${item.selected ? 'checked' : ''}
                onchange="updateItem('${lang}', ${idx}, 'selected', this.checked)"
              >
              <input class="interal-input derivative-word-input word-input" value="${escapeHtml(item.word)}" onchange="updateItem('${lang}', ${idx}, 'word', this.value)">
            </label>
          </td>
          <td class="col-score"><strong>${formatMetric(analysis.final_score ?? item.final_score, 2)}</strong></td>
          <td class="col-score">${formatMetric(assoc.association_score ?? item.association_score, 1)}</td>
          <td class="col-score">${formatMetric(analysis.frequency?.frequency_score ?? item.frequency_score, 2)}</td>
          <td class="col-score">${formatMetric(analysis.swow?.bonus, 1)}</td>
          <td class="col-details">
            <details class="derivative-details">
              <summary>${labels.details}</summary>
              <dl>
                <dt>${labels.model}</dt><dd><input class="interal-input derivative-model-input" value="${escapeHtml(item.model)}" onchange="updateItem('${lang}', ${idx}, 'model', this.value)"></dd>
                <dt>${labels.directness}</dt><dd>${formatMetric(assoc.directness, 0)}</dd>
                <dt>${labels.fieldRelatedness}</dt><dd>${formatMetric(assoc.field_relatedness, 0)}</dd>
                <dt>${labels.domainShift}</dt><dd>${formatMetric(assoc.domain_shift, 0)}</dd>
                <dt>${labels.swowBonus}</dt><dd>${formatMetric(analysis.swow?.bonus, 1)}</dd>
                <dt>${labels.explanation}</dt><dd>${escapeHtml(assoc.explanation || '—')}</dd>
                <dt>${labels.warnings}</dt><dd>${escapeHtml(warnings || '—')}</dd>
              </dl>
            </details>
          </td>
          <td class="col-actions"><button class="word-remove-btn" title="${labels.delete}" aria-label="${labels.delete}" onclick="deleteItem('${lang}', ${idx})">×</button></td>
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
        showExampleBtn: textValue('showExampleBtn'),
        jsonCardBtn: textValue('jsonCardBtn'),
        resultTitle: textValue('resultTitle'),
        languagesTitle: textValue('languagesTitle')
      };
      Object.entries(mappings).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
      });
      if (!document.getElementById('calculateBtn')?.disabled) {
        setCalculateButtonStatus(defaultCalculateButtonText(), false);
      }
      document.getElementById('rootInput').setAttribute('placeholder', textValue('rootPlaceholder'));
      document.getElementById('meaningInput').setAttribute('placeholder', textValue('meaningPlaceholder'));
      const jsonCardText = textGroup('jsonCard');
      Object.entries({ jsonCardTitle: jsonCardText.title, useAuthorBlockLabel: jsonCardText.useAuthor, authorDisplayNameLabel: jsonCardText.authorName, authorContactTypeLabel: jsonCardText.contactType, authorContactValueLabel: jsonCardText.contact, generateJsonCardBtn: jsonCardText.generate, jsonCardOutputLabel: jsonCardText.output }).forEach(([id, value]) => { const element = document.getElementById(id); if (element) element.textContent = value; });
      document.getElementById('closeJsonCardBtn')?.setAttribute('aria-label', jsonCardText.close);
      document.getElementById('copyJsonCardBtn')?.setAttribute('aria-label', jsonCardText.copy);
      document.getElementById('copyJsonCardBtn')?.setAttribute('title', jsonCardText.copy);
      document.getElementById('downloadJsonCardBtn')?.setAttribute('aria-label', jsonCardText.download);
      document.getElementById('downloadJsonCardBtn')?.setAttribute('title', jsonCardText.download);
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
      syncJsonCardButtonVisibility();
      saveLocal();
    }

    function updateItem(lang, idx, key, value) {
      const item = state.languages[lang][idx];
      item[key] = value;
      if (key === 'word') {
        item.model = inferModel(value, state.root, state.elementType);
        item.analysisStatus = normalizeText(value) ? 'analyzing' : 'unavailable';
        item.analysis = null;
        item.frequency_score = null;
        item.association_score = null;
        item.final_score = null;
        renderAll();
        if (normalizeText(value)) analyzeItem(lang, idx);
        return;
      }

      renderAll();
    }

    async function analyzeItem(lang, idx) {
      const item = state.languages[lang][idx];
      if (!item || !normalizeText(item.word)) return;
      item.model = item.model || inferModel(item.word, state.root, state.elementType);
      item.analysisStatus = 'analyzing';
      renderAll();
      try {
        item.analysis = await analyzeAssociativeWord({
          language: lang,
          targetMeaning: state.meaning || state.root,
          word: item.word
        });
        item.frequency_score = item.analysis.frequency.frequency_score;
        item.association_score = item.analysis.association.association_score;
        item.final_score = item.analysis.final_score;
        item.selected = true;
        item.analysisStatus = null;
      } catch (error) {
        const failed = failedAnalysis(lang, item, error);
        Object.assign(item, failed, { analysisStatus: 'error' });
      }
      renderAll();
    }

    function deleteItem(lang, idx) {
      state.languages[lang].splice(idx, 1);
      renderAll();
    }

    function addRow(lang) {
      state.languages[lang].push({ word: '', model: '', analysis: null, frequency_score: null, association_score: null, final_score: null, selected: true });
      renderAll();
    }




    const JSON_CARD_WRAPPER_LIMIT = 4096;
    const JSON_CARD_START_MARKER = "/card";
    const JSON_CARD_END_MARKER = "/done";
    const CREATED_AT_ENDPOINT = "/api/created-at";

    function finiteOrNull(value) {
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    }

    function createCardId(prefix = 'av') {
      return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
    }

    async function getCreatedAt() {
      try {
        const response = await fetch(CREATED_AT_ENDPOINT, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const value = typeof data === 'string' ? data : data?.created_at || data?.createdAt || data?.now || data?.timestamp;
        const date = new Date(value);
        if (!value || Number.isNaN(date.getTime())) throw new Error('Invalid server timestamp');
        return { created_at: String(value), created_at_source: 'server' };
      } catch (error) {
        console.warn('created_at server fallback:', error);
        return { created_at: new Date().toISOString(), created_at_source: 'device' };
      }
    }

    function normalizeTelegramContact(value) {
      const raw = String(value || '').trim();
      if (!raw) return '';
      const noProtocol = raw.replace(/^https?:\/\//i, '').replace(/^t\.me\//i, '').replace(/^@/, '').replace(/\/$/, '');
      return `https://t.me/${noProtocol}`;
    }

    function normalizeEmailContact(value) {
      const raw = String(value || '').trim();
      if (!raw) return '';
      return raw.toLowerCase().startsWith('mailto:') ? raw : `mailto:${raw}`;
    }

    function getAuthorBlock() {
      if (!document.getElementById('useAuthorBlock').checked) return null;
      const displayName = document.getElementById('authorDisplayName').value.trim();
      const contactType = document.getElementById('authorContactType').value;
      const rawContact = document.getElementById('authorContactValue').value.trim();
      const url = contactType === 'telegram' ? normalizeTelegramContact(rawContact) : contactType === 'email' ? normalizeEmailContact(rawContact) : rawContact;
      return {
        ...(displayName ? { display_name: displayName } : {}),
        contacts: url ? [{ type: contactType, url }] : []
      };
    }

    function formatGeneratedJsonCard(card) {
      const json = JSON.stringify(card, null, 2);
      return json.length <= JSON_CARD_WRAPPER_LIMIT ? json : `${JSON_CARD_START_MARKER}\n${json}\n${JSON_CARD_END_MARKER}`;
    }

    function makeAssociativeCard(timeMeta, author = null) {
      const result = calculateFinal();
      const supportedGroups = [...new Set(result.languageScores.filter((x) => Number.isFinite(Number(x.normalized))).map((x) => x.lang.group))];
      return {
        id: createCardId('av'),
        version: '1.0',
        card_type: 'vord_card',
        vord_type: 'av',
        status: 'draft',
        created_at: timeMeta.created_at,
        created_at_source: timeMeta.created_at_source,
        interal: { word: state.root || '', part_of_speech: state.elementType || 'root' },
        translation: { language: 'ru', word: state.meaning || '' },
        ...(author ? { author } : {}),
        supported_groups: supportedGroups,
        calculation: {
          association_percent: finiteOrNull(result.finalAssociation),
          weighted_sum: finiteOrNull(result.totalAssociation),
          total_speakers_thousands: LANGUAGES.reduce((sum, lang) => sum + (Number(lang.speakers) || 0), 0),
          represented_languages: result.representedLangs,
          represented_groups: result.groups,
          thresholds: { strong: 55, accept: THRESHOLDS.main, review_min: THRESHOLDS.reviewMin, review_max: THRESHOLDS.reviewMax, reject_below: THRESHOLDS.rejectBelow },
          weights: { association_score: 0.65, frequency_score: 0.35 }
        },
        language_results: LANGUAGES.map((lang) => {
          const selected = (state.languages[lang.code] || []).filter((item) => item.selected);
          const best = selected.sort((a, b) => (wordWeight(b) || -1) - (wordWeight(a) || -1))[0];
          if (!best) {
            return { code: lang.code, name: lang.name, group: lang.group, speakers_thousands: finiteOrNull(lang.speakers), word: '', normalized_graphic: '', selected: false, match: null, frequency: { score: null, ipm: null, category_breakdown: {} }, association: null, swow: null, final_score: null, status: 'unavailable', supports_group: false };
          }
          const analysis = best.analysis || {};
          const association = analysis.review || analysis.association || {};
          return {
            code: lang.code,
            name: lang.name,
            group: lang.group,
            speakers_thousands: finiteOrNull(lang.speakers),
            word: best.word || '',
            normalized_graphic: stripDiacritics(best.word || ''),
            selected: true,
            match: best.match ? { type: best.match.type, root: state.root || '', fragment: best.match.fragment || '', distance: finiteOrNull(best.match.distance) } : null,
            frequency: { score: finiteOrNull(analysis.frequency?.frequency_score ?? best.frequency_score), ipm: null, category_breakdown: analysis.frequency?.category_breakdown || {} },
            association: { directness: finiteOrNull(association.directness), field_relatedness: finiteOrNull(association.field_relatedness), domain_shift: finiteOrNull(association.domain_shift), swow_bonus: finiteOrNull(analysis.swow?.bonus || 0), score_base: finiteOrNull(association.association_score_base), score: finiteOrNull(association.association_score), explanation: association.explanation || '' },
            swow: { found: Boolean(analysis.swow?.bonus), bonus: finiteOrNull(analysis.swow?.bonus || 0), target_to_word: analysis.swow?.target_to_word || null, word_to_target: analysis.swow?.word_to_target || null },
            final_score: finiteOrNull(analysis.final_score ?? best.final_score),
            status: Number.isFinite(Number(analysis.final_score ?? best.final_score)) ? 'scored' : 'unavailable',
            supports_group: Number.isFinite(Number(analysis.final_score ?? best.final_score))
          };
        })
      };
    }

    function openJsonCardModal() {
      if (!hasPassedJsonCardThreshold()) {
        alert(textGroup('alerts').jsonCardThresholdUnavailable);
        return;
      }
      if (!Object.values(state.languages || {}).some((items) => items.some((item) => item.selected))) {
        alert(textGroup('alerts').jsonCardUnavailable);
        return;
      }
      document.getElementById('jsonCardOutput').value = '';
      document.getElementById('jsonCardModal').classList.add('show');
    }

    function closeJsonCardModal() {
      document.getElementById('jsonCardModal').classList.remove('show');
    }

    function hasUserInputForReset() {
      const hasRoot = normalizeText(document.getElementById('rootInput').value).length > 0;
      const hasMeaning = String(document.getElementById('meaningInput').value || '').trim().length > 0;
      const hasTypeChange = document.getElementById('elementType').value !== 'root';
      const hasLanguageRows = Object.values(state.languages || {}).some((items) => Array.isArray(items) && items.length > 0);
      return hasRoot || hasMeaning || hasTypeChange || hasLanguageRows;
    }

    function hasPassedJsonCardThreshold() {
      return calculateFinal().finalAssociation >= THRESHOLDS.main;
    }

    function syncJsonCardButtonVisibility() {
      const jsonCardBtn = document.getElementById('jsonCardBtn');
      if (jsonCardBtn) jsonCardBtn.hidden = !hasPassedJsonCardThreshold();
    }

    function syncResetButtonVisibility() {
      document.getElementById('resetBtn').classList.toggle('is-hidden', !hasUserInputForReset());
    }

    async function resetAll() {
      const confirmed = await (
        window.InteralUI?.confirmReset?.({ message: getResetConfirmMessage() })
        ?? Promise.resolve(window.confirm(getResetConfirmMessage()))
      );

      if (!confirmed) return;

      window.InteralUI?.clearCurrentPageState?.({ clearUrlState: true });
      document.dispatchEvent(new CustomEvent('interal:page-reset'));

      try {
        localStorage.removeItem('interal_associative_state');
      } catch (_) {}

      state = emptyState();
      document.getElementById('rootInput').value = state.root;
      document.getElementById('meaningInput').value = state.meaning;
      document.getElementById('elementType').value = state.elementType;
      renderAll();
      syncResetButtonVisibility?.();
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
    document.getElementById('calculateBtn').addEventListener('click', () => searchDerivatives());
    document.getElementById('showExampleBtn').addEventListener('click', showExample);
    document.getElementById('jsonCardBtn').addEventListener('click', openJsonCardModal);
    document.getElementById('resetBtn').addEventListener('click', resetAll);
    document.addEventListener('interal:languagechange', renderAll);
    window.addEventListener('resize', syncTabWidths);

    window.updateItem = updateItem;
    window.deleteItem = deleteItem;
    window.addRow = addRow;
    window.analyzeItem = analyzeItem;
    window.QWEN_RUNTIME_CONFIG = QWEN_RUNTIME_CONFIG;

    document.getElementById('closeJsonCardBtn').addEventListener('click', closeJsonCardModal);
    document.getElementById('jsonCardModal').addEventListener('click', (event) => {
      if (event.target === document.getElementById('jsonCardModal')) closeJsonCardModal();
    });
    document.getElementById('useAuthorBlock').addEventListener('change', (event) => {
      document.getElementById('jsonAuthorFields').style.display = event.target.checked ? 'block' : 'none';
    });
    document.getElementById('generateJsonCardBtn').addEventListener('click', async () => {
      const btn = document.getElementById('generateJsonCardBtn');
      const original = textGroup('jsonCard').generate;
      try {
        btn.disabled = true;
        btn.textContent = textGroup('alerts').jsonCardGenerating;
        document.getElementById('jsonCardOutput').value = formatGeneratedJsonCard(makeAssociativeCard(await getCreatedAt(), getAuthorBlock()));
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    });
    document.getElementById('copyJsonCardBtn').addEventListener('click', async () => {
      const output = document.getElementById('jsonCardOutput');
      if (!output.value.trim()) { alert(textGroup('alerts').jsonCardEmpty); return; }
      await navigator.clipboard.writeText(output.value);
      const btn = document.getElementById('copyJsonCardBtn');
      btn.classList.add('is-copied');
      btn.title = textGroup('alerts').jsonCardCopiedTitle;
      window.setTimeout(() => { btn.classList.remove('is-copied'); btn.title = textGroup('jsonCard').copy; }, 1500);
    });
    document.getElementById('downloadJsonCardBtn').addEventListener('click', () => {
      const output = document.getElementById('jsonCardOutput');
      if (!output.value.trim()) { alert(textGroup('alerts').jsonCardEmpty); return; }
      const blob = new Blob([output.value], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.root || 'associativ'}-vord-card.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

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
