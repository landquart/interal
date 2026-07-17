import { classifyScore, normalizeLanguageStatus } from './association-analyzer.js';
export function formatMetric(value, digits = 1) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return Number(value).toFixed(digits);
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
