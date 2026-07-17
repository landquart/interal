import { classifyScore, normalizeLanguageStatus } from './association-analyzer.js';
export function formatMetric(value, digits = 1) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return Number(value).toFixed(digits);
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function matchTypeLabel(type, lang = 'ru') {
  const labels = lang === 'en' ? { exact: 'exact', special: 'special match', fuzzy: 'fuzzy' } : { exact: 'точное', special: 'специальное соответствие', fuzzy: 'нечёткое' };
  return labels[type] || '—';
}

export function categoryLabel(category, lang = 'ru') {
  const labels = lang === 'en' ? {
    subtitles: 'subtitles', normative: 'normative corpus', web: 'web corpus', mixed: 'mixed corpus'
  } : {
    subtitles: 'субтитры', normative: 'нормативный корпус', web: 'веб-корпус', mixed: 'смешанный корпус'
  };
  return labels[category] || (category || '—');
}

export function warningLabel(code, lang = 'ru') {
  const labels = lang === 'en' ? {
    candidate_found_but_frequency_zero: 'Candidate was found, but its frequency is zero.',
    duplicate_runtime_entry: 'Duplicate runtime entry was ignored.',
    partial_source_data: 'Source metadata is incomplete.',
    qwen_partial_failure: 'Qwen analysis partially failed.',
    missing_category: 'Source category is missing.'
  } : {
    candidate_found_but_frequency_zero: 'Кандидат найден, но частотность равна нулю.',
    duplicate_runtime_entry: 'Дубликат runtime-записи был пропущен.',
    partial_source_data: 'Метаданные источника неполные.',
    qwen_partial_failure: 'Анализ Qwen частично не выполнен.',
    missing_category: 'Не указана категория источника.'
  };
  return labels[code] || (lang === 'en' ? 'Diagnostic warning.' : 'Диагностическое предупреждение.');
}

function sourceFileName(source) {
  const value = source?.file ?? source?.filename ?? source?.path ?? source?.source ?? source?.id ?? '';
  const normalized = String(value || '').replace(/\\/g, '/');
  return normalized.split('/').filter(Boolean).pop() || normalized || '—';
}

function sourceCategory(source) {
  return source?.category ?? null;
}

function sourceIpm(source) {
  return typeof source?.ipm === 'number' && Number.isFinite(source.ipm) ? source.ipm : null;
}

export function summarizeCandidateSources(sources = []) {
  const safeSources = Array.isArray(sources) ? sources : [];
  const categories = new Set();
  const ipmByCategory = {};
  const ids = [];
  const details = [];
  const warnings = [];
  for (const source of safeSources) {
    const file = sourceFileName(source);
    const category = sourceCategory(source);
    const ipm = sourceIpm(source);
    ids.push(file);
    details.push({ file, category, ipm });
    if (category) categories.add(category); else warnings.push('missing_category');
    if (!category || file === '—' || ipm == null) warnings.push('partial_source_data');
    if (category && ipm != null) ipmByCategory[category] = (ipmByCategory[category] || 0) + ipm;
  }
  return { count: safeSources.length, ids, details, categories: [...categories], ipmByCategory, warnings: [...new Set(warnings)] };
}

export function formatSimilarity(value, digits = 1) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `${(Number(value) * 100).toFixed(digits)}%`;
}

export function renderCandidateEvidenceDetails(item = {}, labels = {}, lang = 'ru', { sourceLimit = 5, developerDiagnostics = false } = {}) {
  const match = item.match || null;
  const analysisWarnings = Array.isArray(item.analysis?.warnings) ? item.analysis.warnings : [];
  const itemWarnings = Array.isArray(item.warnings) ? item.warnings : [];
  const sourceSummary = summarizeCandidateSources(item.sources);
  const warnings = [...new Set([...itemWarnings, ...sourceSummary.warnings, ...analysisWarnings])];
  const shownSources = sourceSummary.details.slice(0, sourceLimit);
  const more = Math.max(0, sourceSummary.count - shownSources.length);
  const t = lang === 'en' ? {
    matchType: 'Match type', fragment: 'Fragment', distance: 'Distance', similarity: 'Similarity', frequencyScore: 'frequency_score', sourceCount: 'Sources', shown: 'Shown', more: 'More', sourceIds: 'Source files', categories: 'Categories', ipmByCategory: 'IPM by category', categoryScore: 'category_score', categoryWeight: 'category_weight', warnings: 'Warnings', warningCodes: 'Warning codes'
  } : {
    matchType: 'Тип совпадения', fragment: 'Фрагмент', distance: 'Distance', similarity: 'Similarity', frequencyScore: 'frequency_score', sourceCount: 'Источники', shown: 'Показано', more: 'Ещё', sourceIds: 'Файлы источников', categories: 'Категории', ipmByCategory: 'IPM по категориям', categoryScore: 'category_score', categoryWeight: 'category_weight', warnings: 'Предупреждения', warningCodes: 'Коды предупреждений'
  };
  const sourceEntries = shownSources.map(source => `${escapeHtml(source.file)} <span class="muted">— ${escapeHtml(categoryLabel(source.category, lang))} · IPM ${formatMetric(source.ipm, 3)}</span>`);
  const categoryEntries = sourceSummary.categories.map(category => `${escapeHtml(categoryLabel(category, lang))} <span class="mono">(${escapeHtml(category)})</span>`);
  const ipmEntries = Object.entries(sourceSummary.ipmByCategory).map(([category, ipm]) => `${escapeHtml(categoryLabel(category, lang))}: ${formatMetric(ipm, 3)}`);
  const warningText = warnings.length ? warnings.map(code => escapeHtml(warningLabel(code, lang))).join('<br>') : '—';
  const warningCodes = developerDiagnostics && warnings.length ? `<dt>${t.warningCodes}</dt><dd class="mono">${warnings.map(escapeHtml).join('<br>')}</dd>` : '';
  return `
                <dt>${t.matchType}</dt><dd>${escapeHtml(matchTypeLabel(match?.type, lang))}</dd>
                <dt>${t.fragment}</dt><dd>${escapeHtml(match?.fragment ?? '—')}</dd>
                <dt>${t.distance}</dt><dd>${formatMetric(match?.distance, 0)}</dd>
                <dt>${t.similarity}</dt><dd>${formatSimilarity(match?.similarity, 1)}</dd>
                <dt>${t.frequencyScore}</dt><dd>${formatMetric(item.analysis?.frequency?.frequency_score ?? item.frequency_score, 2)}</dd>
                <dt>${t.sourceCount}</dt><dd>${sourceSummary.count}<br><span class="muted">${t.shown}: ${shownSources.length}; ${t.more}: ${more}</span></dd>
                <dt>${t.sourceIds}</dt><dd>${sourceEntries.length ? sourceEntries.join('<br>') : '—'}</dd>
                <dt>${t.categories}</dt><dd>${categoryEntries.length ? categoryEntries.join('<br>') : '—'}</dd>
                <dt>${t.ipmByCategory}</dt><dd>${ipmEntries.length ? ipmEntries.join('<br>') : '—'}</dd>
                <dt>${t.categoryScore}</dt><dd>${formatMetric(item.category_score ?? item.frequencyProfile?.category_score, 3)}</dd>
                <dt>${t.categoryWeight}</dt><dd>${formatMetric(item.category_weight ?? item.frequencyProfile?.category_weight, 3)}</dd>
                <dt>${t.warnings}</dt><dd>${warningText}</dd>
                ${warningCodes}`;
}


export function thresholdStatusLabel(status, lang = 'ru') {
  const labels = lang === 'en' ? {
    passed_threshold: 'threshold passed',
    below_threshold: 'below the 35% threshold',
    unavailable: 'unavailable'
  } : {
    passed_threshold: 'порог пройден',
    below_threshold: 'ниже порога 35%',
    unavailable: 'нет данных'
  };
  return labels[status] || labels.unavailable;
}

export function thresholdStatusForResult(result) {
  return classifyScore(result?.final_score);
}

export function semanticWarningLabel(lang = 'ru') {
  return lang === 'en' ? 'semantic correspondence is not confirmed' : 'семантическое соответствие не подтверждено';
}

export function languageStatusLabel(statusEntry, lang = 'ru', { short = false } = {}) {
  const status = normalizeLanguageStatus(statusEntry).status;
  const labels = lang === 'en' ? {
    idle: short ? '—' : 'Not started',
    loading_index: short ? 'loading…' : 'Loading index…',
    no_candidates: short ? 'no candidates' : 'No candidates found.',
    analyzing: short ? 'analyzing…' : 'Analyzing…',
    completed: short ? 'completed' : 'Completed',
    index_error: short ? 'index error' : 'The language index is unavailable.',
    qwen_error: short ? 'Qwen error' : 'Qwen analysis is unavailable.',
    incomplete: short ? 'incomplete' : 'The calculation is incomplete.',
    aborted: short ? 'aborted' : 'The calculation was aborted.'
  } : {
    idle: short ? '—' : 'Не начато',
    loading_index: short ? 'загрузка…' : 'Загрузка индекса…',
    no_candidates: short ? 'нет кандидатов' : 'Кандидаты не найдены.',
    analyzing: short ? 'анализ…' : 'Анализируется…',
    completed: short ? 'готово' : 'Завершено',
    index_error: short ? 'ошибка индекса' : 'Индекс языка недоступен.',
    qwen_error: short ? 'ошибка Qwen' : 'Анализ Qwen недоступен.',
    incomplete: short ? 'не завершён' : 'Расчёт не завершён.',
    aborted: short ? 'прерван' : 'Расчёт был прерван.'
  };
  return labels[status] || labels.idle;
}

export function swowLabel(swow) {
  if (swow?.target_to_word?.found || swow?.word_to_target?.found) return 'SWOW direct';
  return 'no direct SWOW';
}

export function resultRowClasses(result) {
  return [
    Number(result.final_score) >= 70 ? 'is-high-final' : '',
    Number(result.association?.domain_shift) >= 65 ? 'is-high-domain-shift' : '',
    result.association?.directness == null ? 'is-qwen-missing' : '',
    (!result.swow?.target_to_word?.found && !result.swow?.word_to_target?.found) ? 'is-swow-missing' : ''
  ].filter(Boolean).join(' ');
}
