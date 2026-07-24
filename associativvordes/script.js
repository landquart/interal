import { analyzeAssociativeWord, finalAssociationPassesThreshold, calculateLanguageScore, calculateFinalAssociation, buildDecisionReasons, decisionStatusForResult, canCreateAssociativeJsonCard, normalizeLanguageStatus, summarizeLanguageStatuses, deriveGlobalStatusFromLanguageStatuses } from './js/association-analyzer.js';
import { QWEN_RUNTIME_CONFIG, QWEN_ERROR_CODES, createReviewBudget, refineCandidatesWithQwenAudit, selectBestFinalModels, compareFinalModelCandidates, finalizeCandidateOrdering, isAbortError, normalizeAbortError } from './js/qwen-client.js';
import { escapeHtml, formatMetric, renderCandidateEvidenceDetails, resultRowClasses, swowLabel, thresholdStatusLabel, thresholdStatusForResult, semanticWarningLabel, languageStatusLabel } from './js/render-results.js';
import { normalizeText, stripDiacritics, includesRoot, fuzzyIncludesRoot, findRootMatch, specialRootMatch } from './js/root-matcher.js';
import { acceptAffixBoundaryMatch } from './js/affix-boundary-index.js';
import { createCandidateIndexLoader } from './js/candidate-index-loader.js';
import { findCandidatesForRoot, isReliableFuzzyMorphemeAnalysis } from './js/candidate-finder.js';
import { lexicalModelDescriptor, selectHighestFrequencyPerModel } from './js/candidate-model-family.js';
import { registerLexicalRootsFromEntries } from './js/morphology/lexical-root-index.js';
import { getLanguageConfig } from './js/morphology/languages/index.js';
import { clearTargetMeaningTranslationCache, translateTargetMeaning, TARGET_TRANSLATION_LANGUAGES } from './js/target-meaning-translator.js';
import { MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE, createEmptyAssociativeState, resetAssociativeRunState, invalidateSearchResult as invalidateAssociativeSearchResult, invalidateFinalCalculation as invalidateAssociativeFinalCalculation, addManualCandidate, updateCandidate, deleteCandidate, compactAssociativeState, restoreAssociativeState, addRunWarning, addLanguageWarning, addCandidateWarning, hasAnyAssociativeWarnings, hasLanguageAssociativeWarnings } from './js/associative-state.js';
import { runAssociativeCalculation } from './js/associative-calculation-runner.js';

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
          rootRequired: 'Введите кандидатный корень или предлог.',
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
          rootRequired: 'Enter a candidate root or preposition.',
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

    let calculateButtonController = null;

    function getCalculateButtonController() {
      if (!calculateButtonController) {
        calculateButtonController = window.InteralButtonStatus?.createButtonStatusController?.({
          setStatus: setCalculateButtonStatus,
          getDefaultText: defaultCalculateButtonText,
          getSuccessText: () => currentLang() === 'en' ? 'Done' : 'Готово',
          getErrorText: () => currentLang() === 'en' ? 'Calculation error' : 'Ошибка расчёта',
          successDelayMs: 800
        });
      }
      return calculateButtonController;
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
    let activeReviewBudget = null;
    function nextRunId() { activeRunAbortController?.abort?.(normalizeAbortError(null, { stage: 'new_run', runId: activeRunId })); activeRunId += 1; activeRunAbortController = new AbortController(); return activeRunId; }
    function invalidateActiveRuns() { activeRunAbortController?.abort?.(normalizeAbortError(null, { stage: 'reset', runId: activeRunId })); activeRunId += 1; activeRunAbortController = null; activeReviewBudget = null; }
    function isCurrentRun(runId) { return runId === activeRunId; }
    function currentRunSignal() { return activeRunAbortController?.signal; }
    function throwIfStaleRun(runId, stage, signal = currentRunSignal()) {
      if (!isCurrentRun(runId) || signal?.aborted) throw normalizeAbortError(signal?.reason, { stage, runId });
    }
    let activeLang = 'en';
    // Static associative search runtime v2
    const SEARCH_RESULTS_PAGE_SIZE = 100;
    const visibleCandidateCounts = Object.fromEntries(LANGUAGES.map(lang => [lang.code, SEARCH_RESULTS_PAGE_SIZE]));

    function resetVisibleCandidateCounts() {
      for (const lang of LANGUAGES) visibleCandidateCounts[lang.code] = SEARCH_RESULTS_PAGE_SIZE;
    }

    function showMoreCandidates(langCode) {
      visibleCandidateCounts[langCode] = (visibleCandidateCounts[langCode] || SEARCH_RESULTS_PAGE_SIZE) + SEARCH_RESULTS_PAGE_SIZE;
      renderLanguagePanel();
    }

    function emptyState() {
      return createEmptyAssociativeState({ languages: LANGUAGES, createLanguageStatus });
    }

    function createLanguageStatus(status = 'idle', extra = {}) {
      return normalizeLanguageStatus({ status, ...extra });
    }

    function deriveGlobalStatus(statusSummary = summarizeLanguageStatuses(state.languageStatuses)) {
      const status = deriveGlobalStatusFromLanguageStatuses(statusSummary.statuses || state.languageStatuses);
      return hasAnyAssociativeWarnings(state.warnings) && status === 'completed' ? 'completed_with_warnings' : status;
    }

    function warningCode(value) {
      return String(value || '').split(':')[0].trim();
    }

    function candidateWarningId(candidate) {
      return candidate?.model_key || candidate?.model_family_key || candidate?.model || candidate?.word || candidate?.normalized || 'unknown_candidate';
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
        reviewEligibleCount: 0,
        reviewStartedCount: 0,
        reviewCompletedCount: 0,
        reviewFailedCount: 0,
        reviewAbortedCount: 0,
        reviewSkippedDisabledCount: 0,
        reviewSkippedBudgetCount: 0,
        reviewBudgetLimit: QWEN_RUNTIME_CONFIG.maxReviewRequestsPerSearch,
        qwenFailedRequestCount: 0,
        qwenUsedModels: [],
        abortedRequestCount: 0,
        targetTranslationRequestCount: 0,
        candidateAuditSuggestedCount: 0,
        candidateAuditDuplicateWordCount: 0,
        candidateAuditDuplicateModelCount: 0,
        candidateAuditLocallyMissingCount: 0,
        candidateAuditVerifiedNewModelCount: 0,
        candidateAuditRejectedInvalidCount: 0,
        candidateAuditStatus: null,
        candidateAuditBackendErrorCode: null,
        durationByStage: {},
        activeRunId: null
      };
    }

    function resetRunDiagnostics(runId) {
      diagnosticsState.run = createRunDiagnostics();
      diagnosticsState.run.activeRunId = runId;
      diagnosticsState.run.reviewBudgetLimit = QWEN_RUNTIME_CONFIG.maxReviewRequestsPerSearch;
      diagnosticsState.activeRunId = runId;
      activeReviewBudget = createReviewBudget({ enabled: QWEN_RUNTIME_CONFIG.enableReviewModel === true, maxRequests: QWEN_RUNTIME_CONFIG.maxReviewRequestsPerSearch });
    }

    function incrementDiagnostic(key, amount = 1) {
      if (!diagnosticsState.enabled) return;
      diagnosticsState.run[key] = (diagnosticsState.run[key] || 0) + amount;
    }


    function recordQwenUsedModels(analysis) {
      if (!diagnosticsState.enabled || !analysis) return;
      const models = [analysis.primary?.model, analysis.review?.model, analysis.association?.model].filter(Boolean);
      diagnosticsState.run.qwenUsedModels = [...new Set([...(diagnosticsState.run.qwenUsedModels || []), ...models])];
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
        reviewEligibleCount: run.reviewEligibleCount,
        reviewStartedCount: run.reviewStartedCount,
        reviewCompletedCount: run.reviewCompletedCount,
        reviewFailedCount: run.reviewFailedCount,
        reviewAbortedCount: run.reviewAbortedCount,
        reviewSkippedDisabledCount: run.reviewSkippedDisabledCount,
        reviewSkippedBudgetCount: run.reviewSkippedBudgetCount,
        reviewBudgetLimit: run.reviewBudgetLimit,
        qwenFailedRequestCount: run.qwenFailedRequestCount,
        qwenUsedModels: run.qwenUsedModels,
        abortedRequestCount: run.abortedRequestCount,
        targetTranslationRequestCount: run.targetTranslationRequestCount,
        candidateAuditSuggestedCount: run.candidateAuditSuggestedCount,
        candidateAuditDuplicateWordCount: run.candidateAuditDuplicateWordCount,
        candidateAuditDuplicateModelCount: run.candidateAuditDuplicateModelCount,
        candidateAuditLocallyMissingCount: run.candidateAuditLocallyMissingCount,
        candidateAuditVerifiedNewModelCount: run.candidateAuditVerifiedNewModelCount,
        candidateAuditRejectedInvalidCount: run.candidateAuditRejectedInvalidCount,
        candidateAuditStatus: run.candidateAuditStatus,
        candidateAuditBackendErrorCode: run.candidateAuditBackendErrorCode,
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

    function inferModel(word, root, elementType, item = {}, language = 'en') {
      // Compatibility marker: lexicalModelDescriptor({ ...item, word }, root, language) now delegates to the morpheme parser with elementType.
      return lexicalModelDescriptor({ ...item, word }, root, language, elementType).label || getManualModelLabel();
    }

    function withModelIdentity(item, root, langCode) {
      const descriptor = lexicalModelDescriptor(item, root, langCode, state.elementType);
      return {
        ...item,
        model_family_key: descriptor.key || item.model_family_key || '',
        model_key: descriptor.key || item.model_key || '',
        model_label: descriptor.label || item.model_label || item.model || '',
        model: descriptor.label || item.model || getManualModelLabel(),
        morpheme_analysis: descriptor.analysis || item.morpheme_analysis || null,
        parser_version: descriptor.analysis?.parser_version || item.parser_version || item.morpheme_analysis?.parser_version || null
      };
    }

    function reconcileModelRepresentatives(items, root, langCode) {
      const prepared = (Array.isArray(items) ? items : []).map(item => withModelIdentity(item, root, langCode));
      const selection = selectHighestFrequencyPerModel(prepared, root, langCode, state.elementType);
      return selection.groups.map(group => {
        const representative = group.representative;
        const selectedInGroup = group.members.some(item => item.selected);
        const hasScore = Number.isFinite(wordWeight(representative));
        return { ...representative, selected: hasScore ? (representative.selected || selectedInGroup) : Boolean(representative.selected) };
      });
    }

    function reconcileLanguageModels(langCode) {
      state.languages[langCode] = reconcileModelRepresentatives(state.languages[langCode], state.root, langCode);
      return state.languages[langCode];
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

    function groupByBestModel(items, maxModels = MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE, langCode = 'en') {
      return reconcileModelRepresentatives(items, state.root, langCode)
        .filter(item => Number.isFinite(wordWeight(item)))
        .slice(0, maxModels)
        .map(item => ({ ...item, selected: true }));
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
        frequency_score: Number.isFinite(Number(item.frequency_score)) ? Number(item.frequency_score) : null,
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
      const verifiedMatch = findRootMatch(item.search_form || item.word, root, langCode);
      if (!acceptAffixBoundaryMatch(verifiedMatch, root)) return false;
      if ((item.match.type === 'fuzzy' || verifiedMatch.type === 'fuzzy') && !isReliableFuzzyMorphemeAnalysis(item.morpheme_analysis)) return false;
      seenWords.add(wordKey);
      return true;
    }

    async function analyzeCandidateItem(langCode, item, onProgress, runId, localizedTargetMeaning) {
      throwIfStaleRun(runId, 'candidate_analysis_start');
      try {
        const languageName = textGroup('languages')[langCode] || langCode;
        onProgress?.(`SWOW: ${languageName} — ${item.word}`);
        incrementDiagnostic('qwenPrimaryRequestCount');
        const analysis = await analyzeAssociativeWord({
          language: langCode,
          targetMeaning: state.meaning || state.root,
          localizedTargetMeaning,
          word: item.word,
          frequencyProfile: item.frequencyProfile,
          onProgress: text => { if (isCurrentRun(runId)) onProgress?.(text.replace(`${langCode} —`, `${languageName} —`)); },
          reviewBudget: activeReviewBudget,
          onReviewEvent: key => incrementDiagnostic(key),
          onReviewRequest: () => {
            throwIfStaleRun(runId, 'review_request');
            incrementDiagnostic('qwenReviewRequestCount');
            state.languageStatuses[langCode] = createLanguageStatus('reviewing', state.languageStatuses[langCode]);
          },
          signal: currentRunSignal(),
          runId
        });
        throwIfStaleRun(runId, 'candidate_analysis_after_qwen');
        recordQwenUsedModels(analysis);
        if (analysis.warnings?.some?.(warning => String(warning).startsWith('review_failed'))) incrementDiagnostic('qwenFailedRequestCount');
        for (const warning of (analysis.warnings || [])) addCandidateWarning(state, langCode, candidateWarningId(item), warningCode(warning), warning);
        return {
          ...item,
          analysis,
          frequency_score: analysis.frequency.frequency_score,
          association_score: analysis.association.association_score,
          final_score: analysis.final_score,
          selected: Number.isFinite(Number(analysis.final_score))
        };
      } catch (error) {
        if (isAbortError(error, currentRunSignal()) || !isCurrentRun(runId)) {
          incrementDiagnostic('abortedRequestCount');
          throw normalizeAbortError(error, { stage: error?.stage || 'candidate_analysis', runId });
        }
        if (error.code === QWEN_ERROR_CODES.ABORTED) incrementDiagnostic('abortedRequestCount');
        else incrementDiagnostic('qwenFailedRequestCount');
        return failedAnalysis(langCode, item, error);
      }
    }

    async function mapWithConcurrency(items, limit, mapper, { signal, runId, stage = 'concurrency' } = {}) {
      const results = [];
      let index = 0;
      const safeLimit = Math.max(1, Number(limit) || 1);

      async function worker() {
        while (index < items.length) {
          if (!isCurrentRun(runId) || signal?.aborted) throw normalizeAbortError(signal?.reason, { stage, runId });
          const currentIndex = index++;
          results[currentIndex] = await mapper(items[currentIndex], currentIndex);
          if (!isCurrentRun(runId) || signal?.aborted) throw normalizeAbortError(signal?.reason, { stage, runId });
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
      registerLexicalRootsFromEntries(langCode, entries, { prefix: state.elementType === 'preposition' ? root : '', config: getLanguageConfig(langCode) });
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
        elementType: state.elementType,
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
        morpheme_analysis: candidate.morpheme_analysis || null,
        parser_version: candidate.parser_version || candidate.morpheme_analysis?.parser_version || null,
        category_score: candidate.category_score ?? null,
        category_weight: candidate.category_weight ?? null,
        model_key: candidate.model_key || candidate.model_family_key || '',
        model: candidate.model_label || inferModel(candidate.word, root, state.elementType, candidate, langCode),
        selected: false,
        frequencyProfile: frequencyProfileFromCandidate(candidate)
      }));
    }


    async function getRunTargetTranslations(targetMeaning, runId, onProgress) {
      if (!targetMeaning) return {};
      onProgress?.(currentLang() === 'en' ? 'Translating target meaning...' : 'Перевод значения...');
      incrementDiagnostic('targetTranslationRequestCount');
      try {
        const result = await translateTargetMeaning({
          targetMeaning,
          sourceLanguage: 'ru',
          targetLanguages: TARGET_TRANSLATION_LANGUAGES,
          signal: currentRunSignal(),
          runId
        });
        throwIfStaleRun(runId, 'target_translation_after_await');
        return result.translations || {};
      } catch (error) {
        if (isAbortError(error, currentRunSignal()) || !isCurrentRun(runId)) { incrementDiagnostic('abortedRequestCount'); throw normalizeAbortError(error, { stage: 'target_translation', runId }); }
        console.warn('Target meaning translation unavailable; SWOW will be skipped for untranslated languages.', error);
        return {};
      }
    }

    async function runCalculation({ runId } = {}) {
      const root = normalizeText(document.getElementById('rootInput').value);
      const meaning = document.getElementById('meaningInput').value.trim();
      const elementType = document.getElementById('elementType').value;
      if (!root) {
        alert(textGroup('alerts').rootRequired);
        return false;
      }
      const signal = currentRunSignal();
      clearTargetMeaningTranslationCache();
      const languageScore = (language, candidates) => {
        const selected = candidates
          .filter(item => item.selected && Number.isFinite(wordWeight(item)))
          .sort(compareFinalModelCandidates)
          .slice(0, MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE);
        return calculateLanguageScore(selected, { maxModels: MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE, scoreGetter: wordWeight });
      };
      const result = await runAssociativeCalculation({
        input: { root, meaning, targetMeaning: meaning || root, elementType, maxModels: MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE },
        state,
        runId,
        signal,
        dependencies: {
          languages: LANGUAGES,
          isCurrentRun,
          buttonStatusController: getCalculateButtonController(),
          buttonTexts: {
            start: currentLang() === 'en' ? 'Calculating...' : 'Расчёт...',
            done: currentLang() === 'en' ? 'Done' : 'Готово',
            warnings: textGroup('errors').completedWithWarnings,
            error: currentLang() === 'en' ? 'Calculation error' : 'Ошибка расчёта'
          },
          targetTranslator: {
            translate: async (_input, context) => getRunTargetTranslations(meaning || root, runId, context.onProgress)
          },
          candidateIndexLoader: {
            load: async (language, _input, context) => {
              const languageName = textGroup('languages')[language.code] || language.name;
              context.onProgress?.(`${currentLang() === 'en' ? 'Searching similar roots' : 'Поиск похожих корней'}: ${languageName}`);
              const candidates = await getLanguageCandidates(language.code, root, { signal: context.signal });
              throwIfStaleRun(runId, 'candidate_index_after_await', context.signal);
              const seenWords = new Set();
              const valid = candidates.filter(candidate => isValidRuntimeCandidate(candidate, root, language.code, seenWords));
              return reconcileModelRepresentatives(valid, root, language.code).map(item => ({ ...item, selected: false, analysisStatus: 'pending' }));
            }
          },
          candidateAudit: {
            audit: async (payload, context) => {
              const auditWarnings = [];
              const response = await refineCandidatesWithQwenAudit({
                root,
                targetMeaning: meaning || root,
                candidatesByLanguage: payload.candidatesByLanguage,
                loader: candidateIndexLoader,
                signal: context.signal,
                elementType,
                onProgress: context.onProgress,
                onWarning: warning => auditWarnings.push(warning),
                languages: LANGUAGES.map(language => language.code)
              });
              if (response.diagnostics) {
                state.candidateAuditDiagnostics = response.diagnostics;
                Object.assign(diagnosticsState.run, {
                  candidateAuditSuggestedCount: response.diagnostics.suggestedCount || 0,
                  candidateAuditDuplicateWordCount: response.diagnostics.duplicateWordCount || 0,
                  candidateAuditDuplicateModelCount: response.diagnostics.duplicateModelCount || 0,
                  candidateAuditLocallyMissingCount: response.diagnostics.locallyMissingCount || 0,
                  candidateAuditVerifiedNewModelCount: response.diagnostics.verifiedNewModelCount || 0,
                  candidateAuditRejectedInvalidCount: response.diagnostics.rejectedInvalidCount || 0,
                  candidateAuditStatus: response.diagnostics.status || null,
                  candidateAuditBackendErrorCode: response.diagnostics.backendErrorCode || null
                });
              }
              return { ...response, warnings: [...(response.warnings || []), ...auditWarnings] };
            }
          },
          candidateFinalizer: {
            finalize: (language, candidates) => finalizeCandidateOrdering(reconcileModelRepresentatives(candidates, root, language.code), MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE)
              .map(item => ({ ...item, analysisStatus: item.selected ? 'pending' : item.analysisStatus || 'pending' }))
          },
          candidateAnalyzer: {
            analyze: async (language, candidate, context) => {
              const analyzed = await analyzeCandidateItem(language.code, candidate, context.onProgress, runId, context.translation);
              if (analyzed.analysis?.review) {
                context.onReviewStart?.();
                context.onReviewEnd?.();
              }
              return analyzed;
            }
          },
          languageScore: { calculate: languageScore },
          finalScore: {
            calculate: current => {
              const languageResults = LANGUAGES.map(language => {
                const candidates = (current.languages[language.code] || []).filter(item => item.selected && Number.isFinite(wordWeight(item)));
                const score = calculateLanguageScore(candidates, { maxModels: current.maxModels, scoreGetter: wordWeight });
                const semanticConfirmed = Number.isFinite(Number(score.normalized)) && candidates.some(item => item.analysis?.association?.semantic_confirmed === true);
                return { ...score, semanticConfirmed };
              });
              return calculateFinalAssociation({ languages: LANGUAGES, languageResults, languageStatuses: current.languageStatuses });
            }
          },
          renderer: { renderFinal: async () => renderAll() },
          stateStorage: { save: async () => Promise.resolve(window.InteralFormDraft?.save?.()) }
        },
        onProgress: text => { if (isCurrentRun(runId)) getCalculateButtonController()?.progress?.(undefined, text); }
      });
      state = result.state;
      return true;
    }

    async function searchDerivatives() {
      const runId = nextRunId();
      resetRunDiagnostics(runId);
      try {
        await runCalculation({ runId });
      } catch (error) {
        if (isAbortError(error, currentRunSignal()) || !isCurrentRun(runId)) return;
        console.error(error);
      }
    }

    function scoringCandidates(langCode) {
      return (state.languages[langCode] || [])
        .filter(item => item.selected && Number.isFinite(wordWeight(item)))
        .sort(compareFinalModelCandidates)
        .slice(0, state.maxModels || MAX_ASSOCIATIVE_MODELS_PER_LANGUAGE);
    }

    function calculateLanguage(langCode) {
      return calculateLanguageScore(scoringCandidates(langCode), { maxModels: state.maxModels, scoreGetter: wordWeight });
    }

    function calculateFinal() {
      const languageResults = LANGUAGES.map(l => {
        const candidates = scoringCandidates(l.code);
        const score = calculateLanguageScore(candidates, { maxModels: state.maxModels, scoreGetter: wordWeight });
        const semanticConfirmed = Number.isFinite(Number(score.normalized))
          && candidates.some(item => item.analysis?.association?.semantic_confirmed === true);
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
      const visibleCount = Math.min(visibleCandidateCounts[activeLang] || SEARCH_RESULTS_PAGE_SIZE, items.length);
      const visibleItems = items.slice(0, visibleCount);
      const score = calculateLanguage(activeLang);
      const labels = textGroup('panel');
      const resultCountText = currentLang() === 'en'
        ? `Showing ${visibleCount} of ${items.length} candidates`
        : `Показано ${visibleCount} из ${items.length} кандидатов`;
      const showMoreText = currentLang() === 'en' ? 'Show 100 more' : 'Показать ещё 100';
      panel.innerHTML = `
        <div class="row" style="margin-bottom:12px;">
          <div>
            <h3>${textGroup('languages')[lang.code] || lang.name}</h3>
            <p class="muted">${labels.group}: ${textGroup('groups')[lang.group] || lang.group}. ${labels.languageScore}: <strong>${formatFixed(score.normalized, 2)}%</strong>; ${labels.weightSum}: <strong>${formatFixed(score.sum, 2)}</strong>. ${labels.status}: <strong>${languageStatusLabel(state.languageStatuses[activeLang], currentLang())}</strong></p>
            <p class="muted">${resultCountText}</p>
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
            <tbody>${visibleItems.map((item, idx) => rowHtml(activeLang, item, idx)).join('')}</tbody>
          </table>
        </div>
        ${visibleCount < items.length ? `<div class="row" style="justify-content:center;margin-top:12px;"><button class="tool-btn interal-btn interal-btn--secondary fit" onclick="showMoreCandidates('${activeLang}')">${showMoreText}</button></div>` : ''}
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
      const pendingLabel = currentLang() === 'en' ? 'not analyzed' : 'не анализировалось';
      const displayStatus = item.analysisStatus === 'analyzing'
        ? statusLabel('analyzing')
        : item.analysisStatus === 'pending'
          ? pendingLabel
          : item.analysisStatus === 'error'
            ? statusLabel('error')
            : `${thresholdStatusLabel(thresholdStatusForResult({ final_score: analysis.final_score ?? item.final_score }), currentLang())}${assoc.semantic_confirmed === false ? `<br><span class="muted">${semanticWarningLabel(currentLang())}</span>` : ''}`;
      const analysisButton = item.analysisStatus === 'analyzing'
        ? `<button class="tool-btn interal-btn interal-btn--secondary fit short" disabled>${statusLabel('analyzing')}</button>`
        : (!analysis.association || item.analysisStatus === 'pending' || item.analysisStatus === 'error')
          ? `<button class="tool-btn interal-btn interal-btn--secondary fit short" onclick="analyzeItem('${lang}', ${idx})">${labels.analyze}</button>`
          : '';
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
          <td class="col-score">${displayStatus}</td>
          <td class="col-score">${formatMetric(assoc.association_score ?? item.association_score, 1)}</td>
          <td class="col-score">${formatMetric(analysis.frequency?.frequency_score ?? item.frequency_score, 2)}</td>
          <td class="col-score">${formatMetric(analysis.swow?.bonus, 1)}</td>
          <td class="col-details">
            <details class="derivative-details">
              <summary>${labels.details}</summary>
              <dl>
                <dt>${labels.model}</dt><dd><span class="mono">${escapeHtml(item.model || item.model_key || '—')}</span></dd>
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
          <td class="col-actions">${analysisButton}<button class="word-remove-btn" title="${labels.delete}" aria-label="${labels.delete}" onclick="deleteItem('${lang}', ${idx})">×</button></td>
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
      const changed = invalidateAssociativeSearchResult(state, {
        createEmptyState: emptyState,
        shouldSkip: shouldSkipAssociativeInvalidation,
        onInvalidateActiveRuns: invalidateActiveRuns
      });
      if (!changed) return;
      syncCheckedVisibility();
      syncJsonCardButtonVisibility();
      window.InteralFormDraft?.save?.();
    }

    function invalidateFinalCalculation() {
      const changed = invalidateAssociativeFinalCalculation(state, { shouldSkip: shouldSkipAssociativeInvalidation });
      if (!changed) return;
      syncCheckedVisibility();
      syncJsonCardButtonVisibility();
      window.InteralFormDraft?.save?.();
    }

    function updateItem(lang, idx, key, value) {
      updateCandidate(state, lang, idx, key, value, { inferModel, normalizeText });
      invalidateFinalCalculation();
      renderAll();
      if (key === 'word' && normalizeText(value)) analyzeItem(lang, idx);
    }

    async function analyzeItem(lang, idx) {
      const item = state.languages[lang][idx];
      if (!item || !normalizeText(item.word)) return;
      Object.assign(item, withModelIdentity(item, state.root, lang));
      item.analysisStatus = 'analyzing';
      renderAll();
      try {
        const targetTranslations = await getRunTargetTranslations(state.meaning || state.root, activeRunId, null);
        incrementDiagnostic('qwenPrimaryRequestCount');
        item.analysis = await analyzeAssociativeWord({
          language: lang,
          targetMeaning: state.meaning || state.root,
          localizedTargetMeaning: targetTranslations[lang] || '',
          word: item.word,
          frequencyProfile: item.frequencyProfile,
          reviewBudget: createReviewBudget({ enabled: QWEN_RUNTIME_CONFIG.enableReviewModel === true, maxRequests: QWEN_RUNTIME_CONFIG.maxReviewRequestsPerSearch }),
          onReviewEvent: key => incrementDiagnostic(key),
          onReviewRequest: () => incrementDiagnostic('qwenReviewRequestCount')
        });
        recordQwenUsedModels(item.analysis);
        if (item.analysis.warnings?.some?.(warning => String(warning).startsWith('review_failed'))) incrementDiagnostic('qwenFailedRequestCount');
        item.frequency_score = item.analysis.frequency.frequency_score;
        item.association_score = item.analysis.association.association_score;
        item.final_score = item.analysis.final_score;
        item.selected = Number.isFinite(Number(item.analysis.final_score));
        item.analysisStatus = null;
      } catch (error) {
        const failed = failedAnalysis(lang, item, error);
        Object.assign(item, failed, { analysisStatus: 'error' });
      }
      state.languages[lang] = reconcileModelRepresentatives(state.languages[lang], state.root, lang);
      const languageItems = state.languages[lang] || [];
      const analyzedItems = languageItems.filter(candidate => candidate.analysis);
      const failedCount = analyzedItems.filter(candidate => candidate.analysis?.status === 'error').length;
      const successfulCount = analyzedItems.length - failedCount;
      state.languageStatuses[lang] = createLanguageStatus(
        analyzedItems.length > 0 && successfulCount === 0 ? 'qwen_error' : 'completed',
        { candidateCount: languageItems.length, analyzedCount: analyzedItems.length, successfulCount, failedCount, errorCode: failedCount ? (successfulCount === 0 ? 'QWEN_FAILED' : 'QWEN_PARTIAL_FAILURE') : null }
      );
      renderAll();
      window.InteralFormDraft?.save?.();
    }

    function deleteItem(lang, idx) {
      deleteCandidate(state, lang, idx);
      invalidateFinalCalculation();
      renderAll();
    }

    function addRow(lang) {
      addManualCandidate(state, lang);
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


    function makeAssociativeCard(timestamp = {}, author = null) {
      const result = calculateFinal();
      const selectedLanguages = LANGUAGES.flatMap(({ code }) =>
        scoringCandidates(code).map(item => ({ code, ...item }))
      );
      return {
        version: '1.0',
        card_type: 'vord_card',
        vord_type: 'av',
        procedure: 'associative_word',
        status: 'draft',
        ...timestamp,
        interal: { word: state.root, type: state.elementType || 'root' },
        translation: state.meaning,
        ...(author ? { author } : {}),
        supported_groups: [...new Set(selectedLanguages.map(item => item.group).filter(Boolean))],
        calculation: {
          TA: result.totalAssociation,
          FA: result.finalAssociation,
          represented_languages: result.languagesRepresented,
          represented_groups: result.languageGroups
        },
        language_results: selectedLanguages.map(item => ({
          code: item.code,
          word: item.word,
          parser_version: item.parser_version || item.morpheme_analysis?.parser_version || null,
          model_key: item.model_key || item.model_family_key || null,
          model_label: item.model_label || item.model || null,
          final_score: item.final_score,
          frequency: { score: item.frequency_score },
          association: item.analysis?.association || {}
        }))
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


    function compactStateSwowStrength(value) {
      if (value == null || value === '') return null;
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    }

    function compactStateSwowSide(side) {
      const source = side && typeof side === 'object' && !Array.isArray(side) ? side : {};
      return {
        found: source.found === true,
        r1_strength: compactStateSwowStrength(source.r1_strength),
        r123_strength: compactStateSwowStrength(source.r123_strength)
      };
    }

    function compactStateSwowEvidence(swow) {
      const source = swow && typeof swow === 'object' && !Array.isArray(swow) ? swow : {};
      const bonus = compactStateSwowStrength(source.bonus);
      return {
        bonus: bonus ?? 0,
        target_to_word: compactStateSwowSide(source.target_to_word),
        word_to_target: compactStateSwowSide(source.word_to_target)
      };
    }

    function normalizeRestoredLanguageStatuses(statuses = {}) {
      return Object.fromEntries(LANGUAGES.map(lang => {
        const restored = statuses?.[lang.code] && typeof statuses[lang.code] === 'object' ? statuses[lang.code] : createLanguageStatus();
        const interrupted = ['loading_index', 'grouping_candidates', 'candidate_audit', 'analyzing', 'reviewing', 'loading'].includes(restored.status) || (restored.status === 'idle' && Boolean(state?.checked));
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
      if (['loading_index', 'grouping_candidates', 'candidate_audit', 'analyzing', 'reviewing', 'loading'].includes(status) || (status === 'idle' && checked)) return 'aborted';
      if (['completed', 'completed_with_warnings', 'no_candidates', 'index_error', 'qwen_error', 'incomplete', 'aborted', 'idle'].includes(status)) return status;
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
              model_key: String(item.model_key || item.model_family_key || ''),
              selected: Boolean(item.selected),
              association_score: finiteOrNull(item.association_score),
              final_score: finiteOrNull(item.final_score),
              analysisStatus: item.analysisStatus || null,
              analysis: item.analysis ? {
                final_score: finiteOrNull(item.analysis.final_score),
                frequency: item.analysis.frequency ? { frequency_score: finiteOrNull(item.analysis.frequency.frequency_score) } : null,
                swow: item.analysis.swow ? compactStateSwowEvidence(item.analysis.swow) : null,
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
      return compactAssociativeState(state, {
        languages: LANGUAGES,
        activeLang,
        calculateResult: () => {
          const r = calculateFinal();
          return {
            finalAssociation: r.finalAssociation,
            totalAssociation: r.totalAssociation,
            representedLanguages: r.representedLangs,
            representedGroups: r.groups,
            semanticConfirmed: r.semanticConfirmed,
            accepted: r.accepted
          };
        }
      });
    }

    function importAssociativePageState(saved = {}) {
      const restored = restoreAssociativeState(saved, {
        languages: LANGUAGES,
        createLanguageStatus,
        currentLang,
        activeLang
      });
      if (!restored) {
        console.warn('Associativ vordes state version is incompatible; using defaults.');
        return false;
      }

      isImportingAssociativeState = true;
      try {
        state = restored.state;
        for (const lang of LANGUAGES) {
          state.languages[lang.code] = reconcileModelRepresentatives(state.languages[lang.code], state.root, lang.code);
        }
        activeLang = restored.activeLang;
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
      resetVisibleCandidateCounts();
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
    window.showMoreCandidates = showMoreCandidates;
    window.QWEN_RUNTIME_CONFIG = QWEN_RUNTIME_CONFIG;
    window.InteralAssociativeModels = {
      reconcile: (language) => reconcileLanguageModels(language),
      descriptor: (language, candidate) => lexicalModelDescriptor(candidate, state.root, language, state.elementType),
      findRepresentative: (language, modelKey) => (state.languages[language] || []).find(item => (item.model_key || lexicalModelDescriptor(item, state.root, language, state.elementType).key) === modelKey) || null,
      findIndexByWord: (language, word) => {
        const key = normalizeText(word);
        return (state.languages[language] || []).findIndex(item => normalizeText(item.word) === key);
      },
      findIndexByModel: (language, modelKey) => (state.languages[language] || []).findIndex(item => (item.model_key || lexicalModelDescriptor(item, state.root, language, state.elementType).key) === modelKey),
      candidateAt: (language, index) => (state.languages[language] || [])[index] || null,
      allCandidates: (language) => state.languages[language] || []
    };
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
