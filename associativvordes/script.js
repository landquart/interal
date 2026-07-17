import { analyzeAssociativeWord, THRESHOLDS, passesWordThreshold, finalAssociationPassesThreshold, calculateLanguageScore, calculateFinalAssociation, buildDecisionReasons, decisionStatusForResult, canCreateAssociativeJsonCard, normalizeLanguageStatus, summarizeLanguageStatuses } from './js/association-analyzer.js';
import { QWEN_RUNTIME_CONFIG, QWEN_ERROR_CODES } from './js/qwen-client.js';
import { escapeHtml, formatMetric, renderCandidateEvidenceDetails, resultRowClasses, swowLabel, thresholdStatusLabel, thresholdStatusForResult, semanticWarningLabel, languageStatusLabel } from './js/render-results.js';
import { normalizeText, stripDiacritics, includesRoot, fuzzyIncludesRoot, specialRootMatch } from './js/root-matcher.js';
import { createCandidateIndexLoader } from './js/candidate-index-loader.js';
import { findCandidatesForRoot } from './js/candidate-finder.js';

// Persistence compatibility markers: status: 'no_candidates', candidates: [] ; status: 'index_error', errorCode:
const TEXT_I18N = {
      ru: {
        headerLead: 'Инструмент отбора ассоциативных слов: поиск дериватов по локальной базе, группировка по моделям, частотные баллы и итоговый процент ассоциации.',
        searchTitle: 'Параметры поиска',
        searchNote: 'Сначала задайте корень и тип элемента, затем запустите расчёт.',
        rootLabel: 'Кандидатный корень / предлог',
        rootPlaceholder: 'например: ocul, regul, inter',
        meaningLabel: 'Перевод / значение',
        meaningPlaceholder: 'например: глаз, правило, между',
        elementTypeLabel: 'Тип элемента',
        rootOption: 'корень',
        prepositionOption: 'предлог',
        searchBtn: 'Рассчитать',
        showExampleBtn: 'Показать пример',
        jsonCardBtn: 'Сформировать JSON-карточку',
        resultTitle: 'Итог',
        languagesTitle: 'Языки и дериваты',
        reset: 'Сбросить',
        resetConfirm: 'Сбросить введённые данные? Это действие нельзя отменить.',
        jsonModuleUnavailable: 'Модуль создания JSON-карточек не загружен. Перезагрузите страницу.',
        rankJsonObjectError: 'JSON должен быть объектом формата { \"word\": rank }',
        manual: 'ручная',
        languages: {
          en: 'Английский', de: 'Немецкий', fr: 'Французский', es: 'Испанский', it: 'Итальянский', ru: 'Русский'
        },
        groups: {
          Germanic: 'Германская', Romance: 'Романская', Slavic: 'Славянская'
        },
        panel: {
          group: 'Группа', languageScore: 'Балл языка', weightSum: 'сумма весов', addWord: 'Добавить слово', use: 'Учитывать', word: 'Слово', model: 'Модель', frequencyPercent: 'F — частотность', directness: 'Di — прямота связи', fieldRelatedness: 'Pr — близость поля', domainShift: 'Sh — сдвиг области', swowBonus: 'Бонус SWOW, 0–15', associationPercent: 'A — ассоциация', finalPercent: 'P — вес деривата', status: 'Статус', explanation: 'Объяснение', warnings: 'Предупреждения', details: 'Детали', analyze: 'Анализировать', delete: 'Удалить', association: 'Ассоциация', rank: 'Ранг', frequency: 'Частота', weightP: 'Вес P'
        },
        results: {
          finalAssociation: 'FA — конечная ассоциация', totalAssociation: 'TA — общая сумма баллов языков', languagesRepresented: 'языков представлено', languageGroups: 'языковых групп', accept: 'ПРИНЯТЬ', reject: 'НЕ ПРИНИМАТЬ', insufficientData: 'Недостаточно данных', noCalculatedData: 'Нет рассчитанных данных.', noCandidates: 'Кандидаты не найдены.', indexUnavailable: 'Индекс языка недоступен.', qwenUnavailable: 'Анализ Qwen недоступен.', calculationAborted: 'Расчёт был прерван.', calculationIncomplete: 'Расчёт не завершён.', partialErrors: 'Часть языков рассчитана с ошибками.', fewerLanguages: 'Представлено меньше 3 языков.', fewerGroups: 'Представлено меньше 2 языковых групп.', belowThreshold: 'FA ниже 35%.', semanticUnconfirmed: 'Семантическое соответствие не подтверждено.', reasons: 'Причины', warnings: 'Предупреждения', allMet: 'Все условия выполнены.'
        },
        alerts: {
          jsonCardUnavailable: 'Сначала выполните расчёт.',
          jsonCardCopied: 'JSON-карточка скопирована',
          jsonCardCopiedTitle: 'Скопировано',
          jsonCardEmpty: 'Сначала сгенерируйте JSON-карточку.',
          jsonCardGenerating: 'Генерация...',
          jsonCardThresholdUnavailable: 'JSON-карточку можно сформировать только после прохождения главного порога.'
        },
        errors: { indexLoadFailed: 'Не удалось загрузить индекс', noCandidates: 'Кандидаты не найдены', qwenUnavailable: 'Qwen недоступен', partialLanguages: 'Часть языков не рассчитана', calculationAborted: 'Расчёт отменён', completedWithWarnings: 'Расчёт завершён с предупреждениями' },
        jsonCard: {
          close: 'Закрыть JSON-карточку', title: 'JSON-карточка', useAuthor: 'Указать авторство', authorName: 'Имя или ник', contactType: 'Тип контакта', contact: 'Контакт', rememberAuthor: 'Запомнить для следующих карточек', clearSavedAuthor: 'Удалить сохранённые данные', generate: 'Сгенерировать карточку', output: 'Готовый JSON', copy: 'Скопировать JSON-карточку', download: 'Скачать JSON-карточку'
        }
      },
      en: {
        headerLead: 'Tool for selecting associative words: derivative search in a local database, grouping by models, frequency scores, and final association percentage.',
        searchTitle: 'Search parameters',
        searchNote: 'First enter the root and element type, then run the calculation.',
        rootLabel: 'Candidate root / preposition',
        rootPlaceholder: 'for example: ocul, regul, inter',
        meaningLabel: 'Translation / meaning',
        meaningPlaceholder: 'for example: eye, rule, between',
        elementTypeLabel: 'Element type',
        rootOption: 'root',
        prepositionOption: 'preposition',
        searchBtn: 'Calculate',
        showExampleBtn: 'Show example',
        jsonCardBtn: 'Generate JSON card',
        resultTitle: 'Result',
        languagesTitle: 'Languages and derivatives',
        reset: 'Reset',
        resetConfirm: 'Reset entered data? This action cannot be undone.',
        jsonModuleUnavailable: 'The JSON card module is unavailable. Reload the page.',
        rankJsonObjectError: 'JSON must be an object formatted as { \"word\": rank }',
        manual: 'manual',
        languages: {
          en: 'English', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian', ru: 'Russian'
        },
        groups: {
          Germanic: 'Germanic', Romance: 'Romance', Slavic: 'Slavic'
        },
        panel: {
          group: 'Group', languageScore: 'Language score', weightSum: 'weight sum', addWord: 'Add word', use: 'Use', word: 'Word', model: 'Model', frequencyPercent: 'F — frequency', directness: 'Di — directness', fieldRelatedness: 'Pr — field proximity', domainShift: 'Sh — domain shift', swowBonus: 'SWOW bonus — 0–15', associationPercent: 'A — association', finalPercent: 'P — derivative weight', status: 'Status', explanation: 'Explanation', warnings: 'Warnings', details: 'Details', analyze: 'Analyze', delete: 'Delete', association: 'Association', rank: 'Rank', frequency: 'Frequency', weightP: 'Weight P'
        },
        results: {
          finalAssociation: 'FA — final association', totalAssociation: 'TA — total language score', languagesRepresented: 'languages represented', languageGroups: 'language groups', accept: 'ACCEPT', reject: 'DO NOT ACCEPT', insufficientData: 'Insufficient data', noCalculatedData: 'No calculated data.', noCandidates: 'No candidates found.', indexUnavailable: 'The language index is unavailable.', qwenUnavailable: 'Qwen analysis is unavailable.', calculationAborted: 'The calculation was aborted.', calculationIncomplete: 'The calculation is incomplete.', partialErrors: 'Some languages were calculated with errors.', fewerLanguages: 'Fewer than 3 languages are represented.', fewerGroups: 'Fewer than 2 language groups are represented.', belowThreshold: 'FA is below 35%.', semanticUnconfirmed: 'Semantic correspondence is not confirmed.', reasons: 'Reasons', warnings: 'Warnings', allMet: 'All conditions are met.'
        },
        alerts: {
          jsonCardUnavailable: 'Run a calculation first.',
          jsonCardCopied: 'JSON card copied',
          jsonCardCopiedTitle: 'Copied',
          jsonCardEmpty: 'Generate the JSON card first.',
          jsonCardGenerating: 'Generating...',
          jsonCardThresholdUnavailable: 'The JSON card can be generated only after passing the main threshold.'
        },
        errors: { indexLoadFailed: 'Could not load the index', noCandidates: 'No candidates found', qwenUnavailable: 'Qwen is unavailable', partialLanguages: 'Some languages were not calculated', calculationAborted: 'Calculation canceled', completedWithWarnings: 'Calculation completed with warnings' },
        jsonCard: {
          close: 'Close JSON card', title: 'JSON card', useAuthor: 'Add authorship', authorName: 'Name or nickname', contactType: 'Contact type', contact: 'Contact', rememberAuthor: 'Remember for future cards', clearSavedAuthor: 'Delete saved data', generate: 'Generate card', output: 'Generated JSON', copy: 'Copy JSON card', download: 'Download JSON card'
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


    function setCalculateButtonStatus(text, disabled = true, options = {}) {
      window.InteralButtonStatus?.setButtonStatus('#calculateBtn', text, disabled, options);
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

    const candidateIndexLoader = createCandidateIndexLoader();
    let state = emptyState();
    let activeRunId = 0;
    let activeRunAbortController = null;
    function nextRunId() { activeRunId += 1; activeRunAbortController?.abort?.(); activeRunAbortController = new AbortController(); return activeRunId; }
    function invalidateActiveRuns() { activeRunId += 1; activeRunAbortController?.abort?.(); activeRunAbortController = null; }
    function isCurrentRun(runId) { return runId === activeRunId; }
    let activeLang = 'en';

    function emptyState() {
      const langs = {};
      LANGUAGES.forEach(l => langs[l.code] = []);
      return {
        root: '',
        meaning: '',
        elementType: 'root',
        maxModels: 5,
        languages: langs,
        checked: false,
        languageStatuses: Object.fromEntries(LANGUAGES.map(l => [l.code, createLanguageStatus()])),
        globalStatus: 'idle'
      };
    }

    function createLanguageStatus(status = 'idle', extra = {}) {
      return normalizeLanguageStatus({ status, ...extra });
    }


    function nowMs() {
      return globalThis.performance?.now ? performance.now() : 0;
    }

    const loadedShardMetricKey = 'loaded' + 'Shards';

    const diagnosticsState = {
      enabled: false,
      activeRunId: null,
      cache: { indexFetchCount: 0, indexCacheHits: 0, indexCacheMisses: 0 },
      run: createRunDiagnostics()
    };

    function createRunDiagnostics() {
      return {
        manifestVersion: null,
        normalizerVersion: null,
        [loadedShardMetricKey]: [],
        inspectedCandidates: 0,
        matchedCandidates: 0,
        rejectedCandidates: 0,
        rejectedByReason: {},
        qwenPrimaryRequestCount: 0,
        qwenReviewRequestCount: 0,
        qwenFailedRequestCount: 0,
        abortedRequestCount: 0,
        durationByStage: {},
        activeRunId: null
      };
    }

    function resetRunDiagnostics(runId) {
      diagnosticsState.run = createRunDiagnostics();
      diagnosticsState.run.activeRunId = runId;
      diagnosticsState.activeRunId = runId;
    }

    function incrementDiagnostic(key, amount = 1) {
      if (!diagnosticsState.enabled) return;
      diagnosticsState.run[key] = (diagnosticsState.run[key] || 0) + amount;
    }

    function addDuration(stage, startedAt) {
      if (!diagnosticsState.enabled) return;
      const duration = Math.max(0, nowMs() - startedAt);
      diagnosticsState.run.durationByStage[stage] = (diagnosticsState.run.durationByStage[stage] || 0) + duration;
    }

    function mergeRejectedByReason(reasons = {}) {
      if (!diagnosticsState.enabled) return;
      Object.entries(reasons).forEach(([reason, count]) => {
        diagnosticsState.run.rejectedByReason[reason] = (diagnosticsState.run.rejectedByReason[reason] || 0) + count;
      });
    }

    function cloneSnapshot() {
      const index = candidateIndexLoader.getCandidateIndexDiagnostics?.() || {};
      const run = diagnosticsState.run;
      return JSON.parse(JSON.stringify({
        enabled: diagnosticsState.enabled,
        manifestVersion: run.manifestVersion ?? index.manifestVersion ?? null,
        normalizerVersion: run.normalizerVersion ?? index.normalizerVersion ?? null,
        [loadedShardMetricKey]: run[loadedShardMetricKey].length ? run[loadedShardMetricKey] : (index[loadedShardMetricKey] || []),
        indexFetchCount: diagnosticsState.cache.indexFetchCount,
        indexCacheHits: diagnosticsState.cache.indexCacheHits,
        indexCacheMisses: diagnosticsState.cache.indexCacheMisses,
        inspectedCandidates: run.inspectedCandidates,
        matchedCandidates: run.matchedCandidates,
        rejectedCandidates: run.rejectedCandidates,
        rejectedByReason: run.rejectedByReason,
        qwenPrimaryRequestCount: run.qwenPrimaryRequestCount,
        qwenReviewRequestCount: run.qwenReviewRequestCount,
        qwenFailedRequestCount: run.qwenFailedRequestCount,
        abortedRequestCount: run.abortedRequestCount,
        durationByStage: run.durationByStage,
        activeRunId: run.activeRunId
      }));
    }

    function setDiagnosticsEnabled(value) {
      diagnosticsState.enabled = Boolean(value);
      window.__INTERAL_ASSOCIATIVE_DIAGNOSTICS__ = diagnosticsState.enabled;
      renderAll?.();
      return diagnosticsState.enabled;
    }

    window.__INTERAL_ASSOCIATIVE_DIAGNOSTICS__ = window.__INTERAL_ASSOCIATIVE_DIAGNOSTICS__ === true;
    diagnosticsState.enabled = window.__INTERAL_ASSOCIATIVE_DIAGNOSTICS__;
    window.InteralAssociativeDiagnostics = Object.freeze({
      getSnapshot: cloneSnapshot,
      clear: () => { resetRunDiagnostics(diagnosticsState.activeRunId); return cloneSnapshot(); },
      enable: () => setDiagnosticsEnabled(true),
      disable: () => setDiagnosticsEnabled(false)
    });

    function getFrequencyScore(item) {
      const score = typeof item === 'object' ? item?.analysis?.frequency?.frequency_score ?? item?.frequency_score : item;
      return Number.isFinite(Number(score)) ? Number(score) : 0;
    }

    function currentLocale() {
      return currentLang() === 'en' ? 'en-US' : 'ru-RU';
    }

    function formatFixed(value, digits) {
      if (value == null || value === '' || !Number.isFinite(Number(value))) return '—';
      value = Number(value);
      return new Intl.NumberFormat(currentLocale(), {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      }).format(value);
    }

    function formatPercent(value, digits = 0) {
      if (value == null || value === '' || !Number.isFinite(Number(value))) return '—';
      return `${formatFixed(value, digits)}%`;
    }

    function getManualModelLabel() {
      return textValue('manual');
    }


        function getResetConfirmMessage() {
      return textValue('resetConfirm');
    }

    function inferModel(word, root, elementType, item = {}) {
      const original = String(word || '').trim();
      const r = stripDiacritics(root);
      const searchForm = String(item.search_form || original);
      const w = stripDiacritics(searchForm);
      const matchIndex = Number.isInteger(item.match?.index) ? item.match.index : null;
      const idx = matchIndex != null && matchIndex >= 0 ? matchIndex : w.indexOf(r);
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
          selected: passesWordThreshold(wordWeight(x))
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
          frequency: item.frequencyProfile || { frequency_score: null, category_breakdown: {}, warnings: [] },
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
          warnings: [message],
          errorCode: error.code || 'ANALYSIS_ERROR',
          status: 'error'
        },
        frequency_score: null,
        association_score: null,
        final_score: null,
        selected: false
      };
    }

    function isValidRuntimeCandidate(item, root, langCode, seenWords = new Set()) {
      const wordKey = normalizeText(item?.word);
      if (!wordKey || seenWords.has(wordKey)) return false;
      if (!Array.isArray(item.sources) || item.sources.length === 0) return false;
      if (!Number.isFinite(Number(item.frequency_score))) return false;
      if (!item.match) return false;
      if (!(includesRoot(item.search_form || item.word, root) || fuzzyIncludesRoot(item.search_form || item.word, root) || specialRootMatch(langCode, item.search_form || item.word, root))) return false;
      seenWords.add(wordKey);
      return true;
    }

    async function analyzeCandidateItem(langCode, item, onProgress, runId) {
      if (!isCurrentRun(runId)) return item;
      try {
        const languageName = textGroup('languages')[langCode] || langCode;
        onProgress?.(`SWOW: ${languageName} — ${item.word}`);
        incrementDiagnostic('qwenPrimaryRequestCount');
        const analysis = await analyzeAssociativeWord({
          language: langCode,
          targetMeaning: state.meaning || state.root,
          word: item.word,
          frequencyProfile: item.frequencyProfile,
          onProgress: text => { if (isCurrentRun(runId)) onProgress?.(text.replace(`${langCode} —`, `${languageName} —`)); },
          onReviewRequest: () => incrementDiagnostic('qwenReviewRequestCount'),
          signal: activeRunAbortController?.signal
        });
        if (!isCurrentRun(runId)) return item;
        return {
          ...item,
          analysis,
          frequency_score: analysis.frequency.frequency_score,
          association_score: analysis.association.association_score,
          final_score: analysis.final_score,
          selected: passesWordThreshold(analysis.final_score)
        };
      } catch (error) {
        if (!isCurrentRun(runId)) return item;
        if (error.code === QWEN_ERROR_CODES.ABORTED) incrementDiagnostic('abortedRequestCount');
        else incrementDiagnostic('qwenFailedRequestCount');
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

    function frequencyProfileFromCandidate(candidate) {
      return {
        frequency_score: candidate.frequency_score,
        category_breakdown: candidate.category_breakdown || {},
        rank: candidate.rank ?? null,
        sources: Array.isArray(candidate.sources) ? candidate.sources : [],
        warnings: []
      };
    }

    async function getLanguageCandidates(langCode, root, { signal } = {}) {
      const beforeIndex = candidateIndexLoader.getCandidateIndexDiagnostics?.() || {};
      const indexStartedAt = nowMs();
      const entries = await candidateIndexLoader.loadCandidateEntries(langCode, root, { signal });
      addDuration('candidate_index', indexStartedAt);
      const afterIndex = candidateIndexLoader.getCandidateIndexDiagnostics?.() || beforeIndex;
      diagnosticsState.cache.indexFetchCount += Math.max(0, (afterIndex.fetchCount || 0) - (beforeIndex.fetchCount || 0));
      diagnosticsState.cache.indexCacheHits += Math.max(0, (afterIndex.cacheHits || 0) - (beforeIndex.cacheHits || 0));
      diagnosticsState.cache.indexCacheMisses += Math.max(0, (afterIndex.cacheMisses || 0) - (beforeIndex.cacheMisses || 0));
      if (diagnosticsState.enabled) {
        diagnosticsState.run.manifestVersion = afterIndex.manifestVersion || null;
        diagnosticsState.run.normalizerVersion = afterIndex.normalizerVersion || null;
        diagnosticsState.run[loadedShardMetricKey] = Array.isArray(afterIndex[loadedShardMetricKey]) ? [...afterIndex[loadedShardMetricKey]] : [];
      }
      const finderStartedAt = nowMs();
      const { candidates, diagnostics: finderDiagnostics } = findCandidatesForRoot({
        entries,
        root,
        language: langCode,
        maxCandidates: QWEN_RUNTIME_CONFIG.maxCandidatesPerLanguage
      });
      addDuration('candidate_finder', finderStartedAt);
      incrementDiagnostic('inspectedCandidates', finderDiagnostics.inspected);
      incrementDiagnostic('matchedCandidates', finderDiagnostics.matched);
      incrementDiagnostic('rejectedCandidates', finderDiagnostics.rejected);
      mergeRejectedByReason(finderDiagnostics.rejectedByReason);

      return candidates.map(candidate => ({
        word: candidate.word,
        normalized: candidate.normalized,
        search_form: candidate.search_form,
        match: candidate.match,
        rank: candidate.rank,
        frequency_score: candidate.frequency_score,
        category_breakdown: candidate.category_breakdown || {},
        sources: candidate.sources,
        warnings: Array.isArray(candidate.warnings) ? candidate.warnings : [],
        category_score: candidate.category_score ?? null,
        category_weight: candidate.category_weight ?? null,
        model: inferModel(candidate.word, root, state.elementType, candidate),
        selected: false,
        frequencyProfile: frequencyProfileFromCandidate(candidate)
      }));
    }

    async function runCalculation({ runId, onProgress } = {}) {
      const root = normalizeText(document.getElementById('rootInput').value);
      const meaning = document.getElementById('meaningInput').value.trim();
      const elementType = document.getElementById('elementType').value;

      if (!root) {
        alert(textGroup('alerts').rootRequired);
        return;
      }

      state.root = root;
      state.meaning = meaning;
      state.elementType = elementType;
      state.maxModels = 5;
      const nextLangs = {};

      onProgress?.(currentLang() === 'en' ? 'Loading frequency lists...' : 'Загрузка частотных списков...');
      for (const lang of LANGUAGES) {
        if (!isCurrentRun(runId)) return;
        const languageName = textGroup('languages')[lang.code] || lang.name;
        onProgress?.(`${currentLang() === 'en' ? 'Searching similar roots' : 'Поиск похожих корней'}: ${languageName}`);
        state.languageStatuses[lang.code] = createLanguageStatus('loading_index');
        let candidates;
        try {
          candidates = await getLanguageCandidates(lang.code, root, { signal: activeRunAbortController?.signal });
        } catch (error) {
          if (!isCurrentRun(runId)) return;
          nextLangs[lang.code] = [];
          state.languageStatuses[lang.code] = createLanguageStatus('index_error', { errorCode: error.code || error.name || 'INDEX_ERROR' });
          continue;
        }
        incrementDiagnostic('candidateCount', candidates.length);
        if (!candidates.length) {
          nextLangs[lang.code] = [];
          state.languageStatuses[lang.code] = createLanguageStatus('no_candidates');
          continue;
        }
        const seenWords = new Set();
        const validCandidates = candidates.filter(candidate => isValidRuntimeCandidate(candidate, root, lang.code, seenWords));
        if (!validCandidates.length) {
          nextLangs[lang.code] = candidates.map(item => ({ ...item, selected: false, analysisStatus: 'skipped' }));
          state.languageStatuses[lang.code] = createLanguageStatus('no_candidates');
          continue;
        }
        state.languageStatuses[lang.code] = createLanguageStatus('analyzing', { candidateCount: validCandidates.length });
        if (!isCurrentRun(runId)) return;
        onProgress?.(`Qwen3.6: оценка слов — ${languageName}`);
        const analyzed = await mapWithConcurrency(
          validCandidates,
          QWEN_RUNTIME_CONFIG.maxConcurrentQwenRequests,
          item => analyzeCandidateItem(lang.code, item, onProgress, runId)
        );

        if (!isCurrentRun(runId)) return;
        onProgress?.(`Расчёт языковых баллов: ${languageName}`);
        nextLangs[lang.code] = groupByBestModel(analyzed, state.maxModels);
        const failedCount = analyzed.filter(item => item.analysis?.status === 'error').length;
        {
          const successfulCount = analyzed.length - failedCount;
          state.languageStatuses[lang.code] = createLanguageStatus(
            successfulCount === 0 ? 'qwen_error' : 'completed',
            { errorCode: failedCount ? (successfulCount === 0 ? 'QWEN_FAILED' : 'QWEN_PARTIAL_FAILURE') : null, candidateCount: validCandidates.length, analyzedCount: analyzed.length, successfulCount, failedCount }
          );
        }
      }
      if (!isCurrentRun(runId)) return;
      onProgress?.(currentLang() === 'en' ? 'Calculating final percentage...' : 'Расчёт итогового процента...');
      state.languages = { ...state.languages, ...nextLangs };
      calculateFinal();
    }

    async function searchDerivatives() {
      const runId = nextRunId();
      resetRunDiagnostics(runId);
      try {
        setCalculateButtonStatus(currentLang() === 'en' ? 'Calculating...' : 'Расчёт...', true, { loading: true });
        await runCalculation({
          runId,
          onProgress: text => { if (isCurrentRun(runId)) setCalculateButtonStatus(text, true, { loading: true }); }
        });
        if (!isCurrentRun(runId)) return;
        state.checked = true;
        {
          const summary = summarizeLanguageStatuses(state.languageStatuses);
          state.globalStatus = summary.allTerminal ? (summary.warnings.length ? 'completed_with_warnings' : 'completed') : 'loading';
        }
        renderAll();
        window.InteralFormDraft?.save?.();
        setCalculateButtonStatus(state.globalStatus === 'completed_with_warnings' ? textGroup('errors').completedWithWarnings : (currentLang() === 'en' ? 'Done' : 'Готово'), true, { loading: true });
        setTimeout(() => {
          if (isCurrentRun(runId)) setCalculateButtonStatus(defaultCalculateButtonText(), false, { loading: false });
        }, 800);
      } catch (error) {
        if (!isCurrentRun(runId)) return;
        console.error(error);
        setCalculateButtonStatus(currentLang() === 'en' ? 'Calculation error' : 'Ошибка расчёта', false, { loading: false });
      } finally {
        if (isCurrentRun(runId)) {
          setCalculateButtonStatus(defaultCalculateButtonText(), false, { loading: false });
          renderAll();
        }
      }
    }

    function calculateLanguage(langCode) {
      return calculateLanguageScore(state.languages[langCode] || [], { maxModels: state.maxModels, scoreGetter: wordWeight });
    }

    function calculateFinal() {
      const languageResults = LANGUAGES.map(l => {
        const score = calculateLanguage(l.code);
        const semanticConfirmed = Number.isFinite(Number(score.normalized)) && (state.languages[l.code] || [])
          .filter(item => item.selected)
          .some(item => item.analysis?.association?.semantic_confirmed === true);
        return { ...score, semanticConfirmed };
      });
      return calculateFinalAssociation({ languages: LANGUAGES, languageResults, languageStatuses: state.languageStatuses });
    }

    function renderTabs() {
      const tabs = document.getElementById('tabs');
      tabs.innerHTML = '';
      for (const lang of LANGUAGES) {
        const score = calculateLanguage(lang.code);
        const btn = document.createElement('button');
        btn.className = `tab ${activeLang === lang.code ? 'active' : ''}`;
        {
          const status = state.languageStatuses[lang.code] || createLanguageStatus();
          const label = score.normalized == null ? languageStatusLabel(status, currentLang(), { short: true }) : formatPercent(score.normalized, 1);
          btn.textContent = `${textGroup('languages')[lang.code] || lang.name} (${label})`;
        }
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
            <p class="muted">${labels.group}: ${textGroup('groups')[lang.group] || lang.group}. ${labels.languageScore}: <strong>${formatFixed(score.normalized, 2)}%</strong>; ${labels.weightSum}: <strong>${formatFixed(score.sum, 2)}</strong>. ${labels.status}: <strong>${languageStatusLabel(state.languageStatuses[activeLang], currentLang())}</strong></p>
          </div>
          <button class="tool-btn interal-btn interal-btn--secondary fit short" onclick="addRow('${activeLang}')">${labels.addWord}</button>
        </div>
        <div class="derivatives-table-wrap">
          <table class="derivatives-table">
            <thead>
              <tr>
                <th class="col-word sticky-word">${labels.word}</th>
                <th class="col-score">${labels.finalPercent}</th>
                <th class="col-score">${labels.status}</th>
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
      const assoc = analysis.association || {};
      const labels = textGroup('panel');
      const warningList = analysis.warnings || [];
      const warnings = warningList.join('; ');
      return `
        <tr class="${[resultRowClasses(analysis), item.selected ? 'is-selected' : ''].filter(Boolean).join(' ')}" title="${escapeHtml(warnings)}">
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
          <td class="col-score">${thresholdStatusLabel(thresholdStatusForResult({ final_score: analysis.final_score ?? item.final_score }), currentLang())}${assoc.semantic_confirmed === false ? `<br><span class="muted">${semanticWarningLabel(currentLang())}</span>` : ''}</td>
          <td class="col-score">${formatMetric(assoc.association_score ?? item.association_score, 1)}</td>
          <td class="col-score">${formatMetric(analysis.frequency?.frequency_score ?? item.frequency_score, 2)}</td>
          <td class="col-score">${formatMetric(analysis.swow?.bonus, 1)}</td>
          <td class="col-details">
            <details class="derivative-details">
              <summary>${labels.details}</summary>
              <dl>
                <dt>${labels.model}</dt><dd><input class="interal-input derivative-model-input" value="${escapeHtml(item.model)}" onchange="updateItem('${lang}', ${idx}, 'model', this.value)"></dd>
${renderCandidateEvidenceDetails(item, labels, currentLang(), { developerDiagnostics: diagnosticsState.enabled })}
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
      const resultBox = document.getElementById('resultBox');
      resultBox.classList.remove('is-updated');
      void resultBox.offsetWidth;
      resultBox.innerHTML = `
        <div class="metric is-updated"><strong>${formatPercent(result.finalAssociation, 1)}</strong><span>${labels.finalAssociation}</span></div>
        <div class="metric"><strong>${formatFixed(result.totalAssociation, 3)}</strong><span>${labels.totalAssociation}</span></div>
        <div class="metric"><strong>${result.representedLangs}/${LANGUAGES.length}</strong><span>${labels.languagesRepresented}</span></div>
        <div class="metric"><strong>${result.groups}/${new Set(LANGUAGES.map(l => l.group)).size}</strong><span>${labels.languageGroups}</span></div>
      `;
      resultBox.classList.add('is-updated');

      const decision = decisionStatusForResult(result);
      const statusClass = decision === 'accept' ? 'ok' : (decision === 'insufficient_data' ? 'warn' : 'bad');
      const statusText = decision === 'accept' ? labels.accept : (decision === 'insufficient_data' ? labels.insufficientData : labels.reject);
      const reasonLabels = {
        no_calculated_data: labels.noCalculatedData,
        fewer_than_3_languages: labels.fewerLanguages,
        fewer_than_2_groups: labels.fewerGroups,
        final_association_below_35: labels.belowThreshold,
        semantic_not_confirmed: labels.semanticUnconfirmed,
        some_languages_no_candidates: labels.noCandidates,
        some_languages_index_error: labels.indexUnavailable,
        some_languages_qwen_error: labels.qwenUnavailable,
        calculation_incomplete: labels.calculationIncomplete
      };
      const { critical, warnings } = buildDecisionReasons(result);
      const criticalText = critical.map(reason => reasonLabels[reason]).filter(Boolean);
      const warningText = warnings.map(reason => reasonLabels[reason] || labels.partialErrors).filter(Boolean);
      const parts = [];
      if (criticalText.length) parts.push(`${labels.reasons}: ${criticalText.join(', ')}`);
      if (warningText.length) parts.push(`${labels.warnings}: ${warningText.join(', ')}`);

      document.getElementById('decisionBox').innerHTML = `
        <span class="status ${statusClass}">${statusText}</span>
        <span class="muted" style="margin-left:8px;">${parts.length ? parts.join(' · ') : labels.allMet}</span>
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
      Object.entries({ jsonCardTitle: jsonCardText.title, useAuthorBlockLabel: jsonCardText.useAuthor, authorDisplayNameLabel: jsonCardText.authorName, authorContactTypeLabel: jsonCardText.contactType, authorContactValueLabel: jsonCardText.contact, rememberAuthorDataLabel: jsonCardText.rememberAuthor, clearSavedAuthorData: jsonCardText.clearSavedAuthor, generateJsonCardBtn: jsonCardText.generate, jsonCardOutputLabel: jsonCardText.output }).forEach(([id, value]) => { const element = document.getElementById(id); if (element) element.textContent = value; });
      document.getElementById('closeJsonCardBtn')?.setAttribute('aria-label', jsonCardText.close);
      document.getElementById('copyJsonCardBtn')?.setAttribute('aria-label', jsonCardText.copy);
      document.getElementById('copyJsonCardBtn')?.setAttribute('title', jsonCardText.copy);
      document.getElementById('downloadJsonCardBtn')?.setAttribute('aria-label', jsonCardText.download);
      document.getElementById('downloadJsonCardBtn')?.setAttribute('title', jsonCardText.download);
      window.InteralJsonCardModal?.applyContactTypeLabels?.('authorContactType', currentLang());
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
    }

    function shouldSkipAssociativeInvalidation() {
      return window.InteralFormDraft?.isRestoring?.() || isImportingAssociativeState;
    }

    function invalidateSearchResult() {
      if (shouldSkipAssociativeInvalidation()) return;
      invalidateActiveRuns();
      state.checked = false;
      state.languages = emptyState().languages;
      state.languageStatuses = emptyState().languageStatuses;
      state.globalStatus = 'idle';
      syncCheckedVisibility();
      syncJsonCardButtonVisibility();
      window.InteralFormDraft?.save?.();
    }

    function invalidateFinalCalculation() {
      if (shouldSkipAssociativeInvalidation()) return;
      state.checked = false;
      state.globalStatus = 'idle';
      syncCheckedVisibility();
      syncJsonCardButtonVisibility();
      window.InteralFormDraft?.save?.();
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
        invalidateFinalCalculation();
        renderAll();
        if (normalizeText(value)) analyzeItem(lang, idx);
        return;
      }

      invalidateFinalCalculation();
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
          word: item.word,
          frequencyProfile: item.frequencyProfile,
          onReviewRequest: () => incrementDiagnostic('qwenReviewRequestCount')
        });
        item.frequency_score = item.analysis.frequency.frequency_score;
        item.association_score = item.analysis.association.association_score;
        item.final_score = item.analysis.final_score;
        item.selected = passesWordThreshold(item.analysis.final_score);
        item.analysisStatus = null;
      } catch (error) {
        const failed = failedAnalysis(lang, item, error);
        Object.assign(item, failed, { analysisStatus: 'error' });
      }
      renderAll();
      window.InteralFormDraft?.save?.();
    }

    function deleteItem(lang, idx) {
      state.languages[lang].splice(idx, 1);
      invalidateFinalCalculation();
      renderAll();
    }

    function addRow(lang) {
      state.languages[lang].push({ word: '', model: '', analysis: null, frequency_score: null, association_score: null, final_score: null, selected: false });
      invalidateFinalCalculation();
      renderAll();
    }




    const JSON_CARD_WRAPPER_LIMIT = 4096;
    const JSON_CARD_START_MARKER = "/card";
    const JSON_CARD_END_MARKER = "/done";
    const CREATED_AT_ENDPOINT = "/api/created_at";

    function finiteOrNull(value) {
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    }

    const CARDS_API_ENDPOINT = location.hostname === 'landquart.github.io' ? 'https://interal.vercel.app/api/cards' : '/api/cards';

    async function createCardOnServer(card) {
      if (!window.InteralJsonCards) throw new Error(textValue('jsonModuleUnavailable'));
      return window.InteralJsonCards.createCardOnServer(card, { section: 'associativvordes', title: card?.interal?.word || card?.title, category: card?.vord_type || 'av', endpoint: CARDS_API_ENDPOINT });
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
      if (document.getElementById('rememberAuthorData')?.checked) window.InteralJsonCardModal?.saveAuthorData?.({ displayName, contactType, contactValue: rawContact });
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


    function getJsonByteSize(value) { return new TextEncoder().encode(JSON.stringify(value)).length; }
    function compactAssociativeLanguageResult(item) {
      const a = item?.association || {};
      const s = item?.swow || {};
      const word = item?.word || '';
      if (!word) return null;
      return {
        language: item?.code || '',
        word,
        F: finiteOrNull(item?.frequency?.score ?? a.F),
        Di: finiteOrNull(a.Di),
        Pr: finiteOrNull(a.Pr),
        Sh: finiteOrNull(a.Sh),
        swow_bonus: finiteOrNull(a.swow_bonus ?? s.bonus ?? 0),
        A: finiteOrNull(a.A_final ?? a.A_base),
        P: finiteOrNull(a.P ?? item?.final_score)
      };
    }
    function compactAssociativeCard(card) {
      return {
        version: card.version,
        card_type: card.card_type,
        vord_type: card.vord_type,
        procedure: card.procedure,
        interal: card.interal,
        translation: card.translation,
        ...(card.author ? { author: card.author } : {}),
        supported_groups: card.supported_groups,
        result: {
          TA: finiteOrNull(card.calculation?.TA),
          FA: finiteOrNull(card.calculation?.FA),
          represented_languages: finiteOrNull(card.calculation?.represented_languages),
          represented_groups: finiteOrNull(card.calculation?.represented_groups)
        },
        language_evidence: (card.language_results || []).map(compactAssociativeLanguageResult).filter(Boolean)
      };
    }
    function prepareAssociativeCardForPersistence(card) {
      return compactAssociativeCard(card);
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
      window.InteralJsonCardModal?.restoreAuthorData?.();
      const clearSaved = document.getElementById('clearSavedAuthorData');
      if (clearSaved) { const hidden = !window.InteralJsonCardModal?.hasSavedAuthorData?.(); clearSaved.hidden = hidden; clearSaved.closest('.author-data-actions')?.toggleAttribute('hidden', hidden); }
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
      const r = calculateFinal(); return canCreateAssociativeJsonCard(r);
    }

    function syncCheckedVisibility() {
      const checked = Boolean(state.checked);
      ['resultSection', 'languagesSection'].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.hidden = !checked;
      });
    }

    function syncJsonCardButtonVisibility() {
      syncCheckedVisibility();
      const jsonCardBtn = document.getElementById('jsonCardBtn');
      if (jsonCardBtn) jsonCardBtn.hidden = !state.checked || !hasPassedJsonCardThreshold();
    }

    function syncResetButtonVisibility() {
      document.getElementById('resetBtn').classList.toggle('is-hidden', !hasUserInputForReset());
    }

    async function resetAll() {
      await window.InteralUI.resetPageState({
        message: getResetConfirmMessage()
      });
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


    const PAGE_STATE_VERSION = 1;
    const PAGE_STATE_NAME = 'associativvordes';
    const MAX_STATE_CANDIDATES_PER_LANGUAGE = 80;
    const MAX_STATE_SOURCES_PER_CANDIDATE = 12;
    const MAX_STATE_WARNING_LENGTH = 240;
    const MAX_STATE_EXPLANATION_LENGTH = 1200;
    let isImportingAssociativeState = false;

    function truncateStateText(value, limit) {
      const text = String(value || '');
      return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
    }

    function sourceFileNameForState(value) {
      const normalized = String(value || '').replace(/\\/g, '/');
      return normalized.split('/').filter(Boolean).pop() || '';
    }

    function compactStateSource(source) {
      if (!source || typeof source !== 'object') return null;
      const id = String(source.id || source.reference || source.ref || '').trim();
      const file = sourceFileNameForState(source.file || source.filename || source.path || source.source || source.reference || source.ref);
      const category = String(source.category || source.corpus_category || source.type || source.name || '').trim();
      const ipm = finiteOrNull(source.ipm ?? source.IPM ?? source.frequency_ipm ?? source.value ?? source.score ?? source.frequency ?? source.count);
      if (!id || !file || !category || ipm == null) return null;
      return { id, file, category, ipm };
    }

    function compactStateSources(sources) {
      const sourceList = Array.isArray(sources) ? sources : [];
      return {
        sources: sourceList.slice(0, MAX_STATE_SOURCES_PER_CANDIDATE).map(compactStateSource).filter(Boolean),
        source_count: sourceList.length,
        sources_truncated: sourceList.length > MAX_STATE_SOURCES_PER_CANDIDATE
      };
    }

    function compactStateMatch(match) {
      if (!match || typeof match !== 'object' || Array.isArray(match)) return null;
      const type = String(match.type || '').trim();
      if (!['exact', 'special', 'fuzzy'].includes(type)) return null;
      const distance = finiteOrNull(match.distance);
      const similarity = finiteOrNull(match.similarity);
      const fragment = typeof match.fragment === 'string' ? match.fragment : '';
      const index = Number(match.index);
      if (distance == null || similarity == null || !fragment || !Number.isInteger(index) || index < 0) return null;
      return { type, distance, similarity, fragment, index };
    }

    function normalizeRestoredLanguageStatuses(statuses = {}) {
      return Object.fromEntries(LANGUAGES.map(lang => {
        const restored = statuses?.[lang.code] && typeof statuses[lang.code] === 'object' ? statuses[lang.code] : createLanguageStatus();
        const interrupted = ['loading_index', 'analyzing'].includes(restored.status) || (restored.status === 'idle' && Boolean(state?.checked));
        const status = interrupted ? 'aborted' : (restored.status || 'idle');
        const message = currentLang() === 'en'
          ? 'The previous calculation was interrupted. Run it again.'
          : 'Предыдущий расчёт был прерван. Запустите его повторно.';
        return [lang.code, {
          ...createLanguageStatus(status),
          ...restored,
          status,
          errorCode: status === 'aborted' ? 'RESTORE_INTERRUPTED' : (restored.errorCode || null),
          message: status === 'aborted' ? message : (restored.message || null)
        }];
      }));
    }

    function normalizeGlobalStatusForRestore(status, checked) {
      if (['loading_index', 'analyzing', 'loading'].includes(status) || (status === 'idle' && checked)) return 'aborted';
      if (['completed', 'completed_with_warnings', 'no_candidates', 'index_error', 'qwen_error', 'aborted', 'idle'].includes(status)) return status;
      return checked ? 'completed' : 'idle';
    }

    function compactAssociativeLanguages(languages) {
      const output = {};
      LANGUAGES.forEach((lang) => {
        output[lang.code] = (Array.isArray(languages?.[lang.code]) ? languages[lang.code] : [])
          .filter((item) => item && (item.selected || item.word))
          .slice(0, MAX_STATE_CANDIDATES_PER_LANGUAGE)
          .map((item) => {
            const sourceState = compactStateSources(item.sources);
            return {
              word: String(item.word || ''),
              normalized: String(item.normalized || ''),
              search_form: String(item.search_form || ''),
              match: compactStateMatch(item.match),
              rank: finiteOrNull(item.rank),
              frequency_score: finiteOrNull(item.frequency_score),
              category_breakdown: item.category_breakdown && typeof item.category_breakdown === 'object' ? JSON.parse(JSON.stringify(item.category_breakdown)) : {},
              sources: sourceState.sources,
              source_count: sourceState.source_count,
              sources_truncated: sourceState.sources_truncated,
              warnings: Array.isArray(item.warnings) ? item.warnings.slice(0, 8).map(w => truncateStateText(w, MAX_STATE_WARNING_LENGTH)) : [],
              category_score: finiteOrNull(item.category_score),
              category_weight: finiteOrNull(item.category_weight),
              frequencyProfile: item.frequencyProfile && typeof item.frequencyProfile === 'object' ? {
                frequency_score: finiteOrNull(item.frequencyProfile.frequency_score),
                rank: finiteOrNull(item.frequencyProfile.rank),
                category_score: finiteOrNull(item.frequencyProfile.category_score),
                category_weight: finiteOrNull(item.frequencyProfile.category_weight)
              } : null,
              model: String(item.model || ''),
              selected: Boolean(item.selected),
              association_score: finiteOrNull(item.association_score),
              final_score: finiteOrNull(item.final_score),
              analysisStatus: item.analysisStatus || null,
              analysis: item.analysis ? {
                final_score: finiteOrNull(item.analysis.final_score),
                frequency: item.analysis.frequency ? { frequency_score: finiteOrNull(item.analysis.frequency.frequency_score) } : null,
                swow: item.analysis.swow ? { bonus: finiteOrNull(item.analysis.swow.bonus) } : null,
                association: item.analysis.association ? {
                  association_score: finiteOrNull(item.analysis.association.association_score),
                  directness: finiteOrNull(item.analysis.association.directness),
                  field_relatedness: finiteOrNull(item.analysis.association.field_relatedness),
                  domain_shift: finiteOrNull(item.analysis.association.domain_shift),
                  semantic_confirmed: item.analysis.association.semantic_confirmed === true,
                  explanation: truncateStateText(item.analysis.association.explanation, MAX_STATE_EXPLANATION_LENGTH)
                } : null,
                warnings: Array.isArray(item.analysis.warnings) ? item.analysis.warnings.slice(0, 8).map(w => truncateStateText(w, MAX_STATE_WARNING_LENGTH)) : []
              } : null
            };
          });
      });
      return output;
    }

    function collectAssociativePageState() {
      const r = calculateFinal();
      const checked = Boolean(state.checked);
      const payload = {
        version: PAGE_STATE_VERSION,
        page: PAGE_STATE_NAME,
        state: {
          root: state.root || document.getElementById('rootInput').value,
          meaning: state.meaning || document.getElementById('meaningInput').value,
          elementType: state.elementType || document.getElementById('elementType').value,
          maxModels: state.maxModels,
          activeLang,
          languages: compactAssociativeLanguages(state.languages),
          languageStatuses: state.languageStatuses,
          globalStatus: state.globalStatus,
          checked,
          result: checked ? {
            finalAssociation: r.finalAssociation,
            totalAssociation: r.totalAssociation,
            representedLanguages: r.representedLangs,
            representedGroups: r.groups,
            semanticConfirmed: r.semanticConfirmed,
            accepted: r.accepted
          } : null
        }
      };
      return JSON.parse(JSON.stringify(payload));
    }

    function unwrapAssociativePageState(saved = {}) {
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return null;
      if (saved.version === PAGE_STATE_VERSION && saved.page === PAGE_STATE_NAME && saved.state && typeof saved.state === 'object') return saved.state;
      if (saved.version === 2 && saved.fields && typeof saved.fields === 'object') {
        return { ...saved.fields, activeLang: saved.ui?.activeLanguageTab, checked: Boolean(saved.flags?.checked || saved.checked || saved.result), result: saved.result || null };
      }
      console.warn('Associativ vordes state version is incompatible; using defaults.');
      return null;
    }

    function importAssociativePageState(saved = {}) {
      const fields = unwrapAssociativePageState(saved);
      if (!fields) return false;
      if (fields.languages && typeof fields.languages !== 'object') return false;
      if (fields.languageStatuses && typeof fields.languageStatuses !== 'object') return false;

      isImportingAssociativeState = true;
      try {
        state = emptyState();
        state.root = typeof fields.root === 'string' ? fields.root : '';
        state.meaning = typeof fields.meaning === 'string' ? fields.meaning : '';
        state.elementType = fields.elementType === 'preposition' ? 'preposition' : 'root';
        state.maxModels = Number.isFinite(Number(fields.maxModels)) ? Math.max(1, Math.min(20, Number(fields.maxModels))) : 5;
        state.languages = compactAssociativeLanguages(fields.languages || fields.selectedLanguageResults || {});
        state.checked = Boolean(fields.checked || fields.result);
        state.languageStatuses = normalizeRestoredLanguageStatuses(fields.languageStatuses);
        state.globalStatus = normalizeGlobalStatusForRestore(fields.globalStatus || (fields.result ? 'completed' : 'idle'), state.checked);
        if (state.globalStatus === 'aborted') state.checked = true;
        activeLang = LANGUAGES.some(lang => lang.code === fields.activeLang) ? fields.activeLang : (LANGUAGES.some(lang => lang.code === fields.activeLanguageTab) ? fields.activeLanguageTab : activeLang || 'en');
        document.getElementById('rootInput').value = state.root;
        document.getElementById('meaningInput').value = state.meaning;
        document.getElementById('elementType').value = state.elementType;
        renderAll();
        syncCheckedVisibility();
        syncJsonCardButtonVisibility();
        setCalculateButtonStatus(defaultCalculateButtonText(), false, { loading: false });
        return true;
      } finally {
        isImportingAssociativeState = false;
      }
    }

    function resetAssociativePageState() {
      invalidateActiveRuns();
      state = emptyState();
      activeLang = 'en';
      ['rootInput', 'meaningInput'].forEach(id => { const element = document.getElementById(id); if (element) element.value = ''; });
      const type = document.getElementById('elementType');
      if (type) type.value = 'root';
      renderAll();
      setCalculateButtonStatus(defaultCalculateButtonText(), false, { loading: false });
    }
    window.InteralPageStateExport = collectAssociativePageState;
    window.InteralPageStateImport = importAssociativePageState;
    window.InteralPageReset = resetAssociativePageState;

    document.getElementById('rootInput').addEventListener('input', () => { state.root = document.getElementById('rootInput').value; invalidateSearchResult(); renderAll(); });
    document.getElementById('meaningInput').addEventListener('input', () => { state.meaning = document.getElementById('meaningInput').value; invalidateSearchResult(); renderAll(); });
    document.getElementById('elementType').addEventListener('change', () => { state.elementType = document.getElementById('elementType').value; invalidateSearchResult(); renderAll(); });
    document.getElementById('calculateBtn').addEventListener('click', () => searchDerivatives());
    document.getElementById('showExampleBtn').addEventListener('click', showExample);
    document.getElementById('jsonCardBtn').addEventListener('click', openJsonCardModal);
    document.getElementById('resetBtn').addEventListener('click', resetAll);
    document.addEventListener('interal:languagechange', () => { document.documentElement.lang = currentLang(); renderAll(); });
    window.addEventListener('resize', syncTabWidths);

    window.updateItem = updateItem;
    window.deleteItem = deleteItem;
    window.addRow = addRow;
    window.analyzeItem = analyzeItem;
    window.QWEN_RUNTIME_CONFIG = QWEN_RUNTIME_CONFIG;
    window.InteralAssociativDiagnostics = () => window.InteralAssociativeDiagnostics.getSnapshot();

    document.getElementById('closeJsonCardBtn').addEventListener('click', closeJsonCardModal);
    document.getElementById('jsonCardModal').addEventListener('click', (event) => {
      if (event.target === document.getElementById('jsonCardModal')) closeJsonCardModal();
    });
    document.getElementById('useAuthorBlock').addEventListener('change', (event) => {
      document.getElementById('jsonAuthorFields').style.display = event.target.checked ? 'block' : 'none';
    });
    document.getElementById('rememberAuthorData')?.addEventListener('change', (event) => {
      if (!event.target.checked) {
        window.InteralJsonCardModal?.clearSavedAuthorData?.();
        const clearSaved = document.getElementById('clearSavedAuthorData');
        if (clearSaved) { clearSaved.hidden = true; clearSaved.closest('.author-data-actions')?.setAttribute('hidden', ''); }
      }
    });
    document.getElementById('clearSavedAuthorData')?.addEventListener('click', () => {
      window.InteralJsonCardModal?.clearSavedAuthorData?.();
      const remember = document.getElementById('rememberAuthorData');
      if (remember) remember.checked = false;
      const clearSaved = document.getElementById('clearSavedAuthorData');
      if (clearSaved) { clearSaved.hidden = true; clearSaved.closest('.author-data-actions')?.setAttribute('hidden', ''); }
    });
    document.getElementById('generateJsonCardBtn').addEventListener('click', async () => {
      const btn = document.getElementById('generateJsonCardBtn');
      const output = document.getElementById('jsonCardOutput');
      const original = textGroup('jsonCard').generate;
      let draftCard = null;
      try {
        btn.disabled = true;
        btn.textContent = textGroup('alerts').jsonCardGenerating;
        draftCard = prepareAssociativeCardForPersistence(makeAssociativeCard(await getCreatedAt(), getAuthorBlock()));
        output.value = formatGeneratedJsonCard({ ...draftCard, persistence: { saved: false, status: 'local' } });
        const size = getJsonByteSize(draftCard);
        if (size > 50000) throw new Error(currentLang() === 'en' ? 'The card was generated locally but is too large to save on the server.' : 'Карточка сформирована локально, но слишком велика для сохранения на сервере.');
        output.value = formatGeneratedJsonCard(await createCardOnServer(draftCard));
      } catch (error) {
        console.error('Associative card generation failed:', error);
        const warning = error.message || (currentLang() === 'en' ? 'Could not save the JSON card.' : 'Не удалось сохранить JSON-карточку.');
        if (draftCard) output.value = formatGeneratedJsonCard({ ...draftCard, persistence: { saved: false, status: 'local', warning } });
        alert(warning);
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
      return await fetch('/api/qwen-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'associative_word_score', interfaceLanguage: currentLang(), payload: { language: 'en', targetMeaning: 'test', word: 'test', swow: {}, review: false } })
      }).then(r => r.json());
    };

    async function init() {
      renderAll();
    }

    document.documentElement.lang = currentLang();
    init();
