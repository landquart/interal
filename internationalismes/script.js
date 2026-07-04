const LANGUAGES = [
  { code: 'en', name: { ru: 'Английский', en: 'English' }, group: 'Germanic' },
  { code: 'de', name: { ru: 'Немецкий', en: 'German' }, group: 'Germanic' },
  { code: 'fr', name: { ru: 'Французский', en: 'French' }, group: 'Romance' },
  { code: 'es', name: { ru: 'Испанский', en: 'Spanish' }, group: 'Romance' },
  { code: 'it', name: { ru: 'Итальянский', en: 'Italian' }, group: 'Romance' },
  { code: 'ru', name: { ru: 'Русский', en: 'Russian' }, group: 'Slavic' }
];

const FREQUENCY_SOURCES = {
  en: [
    '../associativvordes/frequency%20lists/en/bnc-clean2.lemmatized_spacy_ipm6.json',
    '../associativvordes/frequency%20lists/en/hermit_2018_en_full_lemmatized_ipm6_spacy_lookup_cleaned_v8.json',
    '../associativvordes/frequency%20lists/en/sorted.uk.lemma.unigrams.cleaned_recommended_min100_ipm6.json'
  ],
  de: [
    '../associativvordes/frequency%20lists/de/deu_lemma_rank_word_ipm_corrected.json',
    '../associativvordes/frequency%20lists/de/hermit_2018_de_full_lemmatized_ipm6_spacy_lookup_cleaned_v8.json',
    '../associativvordes/frequency%20lists/de/sorted.de.lemma.unigrams.cleaned_recommended_min100_ipm6.json'
  ],
  fr: [
    '../associativvordes/frequency%20lists/fr/hermit_2018_fr_full_lemmatized_ipm6_spacy_lookup_cleaned_v8.json',
    '../associativvordes/frequency%20lists/fr/sorted.fr.lemma.unigrams.cleaned_recommended_min100_ipm6.json'
  ],
  es: [
    '../associativvordes/frequency%20lists/es/es_wordlist.lemmatized_stanza_ipm6.json',
    '../associativvordes/frequency%20lists/es/hermit_2018_es_full_lemmatized_ipm6_spacy_lookup_cleaned_v8.json'
  ],
  it: [
    '../associativvordes/frequency%20lists/it/hermit_2018_it_full_lemmatized_ipm6_spacy_lookup_cleaned_v8.json',
    '../associativvordes/frequency%20lists/it/sorted.it.lemma.unigrams.cleaned_recommended_min100_ipm6.json'
  ],
  ru: [
    '../associativvordes/frequency%20lists/ru/hermit_2018_ru_full_lemmatized_pymorphy3_ipm6.json',
    '../associativvordes/frequency%20lists/ru/rnc-orig.out.lpos-clean2-biwt.cleaned_ipm6.json',
    '../associativvordes/frequency%20lists/ru/ruwac.out.gz.lpos-clean2-biwt.cleaned_recommended_min100_ipm6.json'
  ]
};

const frequencyCache = new Map();
const MAX_FREQUENCY_ENTRIES_PER_SOURCE = 100000;
const I18N = {
  ru: {
    title: 'Internationalismes', lead: '', params: 'Параметры слова', word: 'Слово в Интерaле', pos: 'Часть речи', noun: 'существительное', adjective: 'прилагательное', verb: 'глагол', adverb: 'наречие',
    evidence: 'Языковое покрытие', result: 'Итог', card: 'JSON-карточка', check: 'Проверить', json: 'Сформировать JSON-карточку', copy: 'Скопировать', download: 'Скачать',
    table: { language: 'Язык', form: 'Форма', distance: 'Дистанция', passed: 'Проходит', translation: 'Перевод', source: 'Источник', match: 'Тип' },
    coverage: 'Покрытие', required: 'Минимум', decision: 'Решение', accept: 'ПРИНЯТО', reject: 'НЕ ПРИНЯТО', reasonOk: 'Критерий 5/6 выполнен.', reasonBad: 'Недостаточное покрытие контрольных языков.',
    loadingLists: 'Загрузка частотных списков...', searching: 'Поиск форм...', frequencySource: 'frequency list', manualSource: 'manual', noForm: 'not found', searchError: 'Не удалось загрузить частотные списки. Формы можно ввести вручную.', manualMode: 'ручное переопределение', autoMode: 'авто', resetAria: 'Сбросить', resetConfirm: 'Сбросить введённые данные? Это действие нельзя отменить.',
    jsonCard: { close: 'Закрыть JSON-карточку', title: 'JSON-карточка', useAuthor: 'Указать авторство', authorName: 'Имя или ник', contactType: 'Тип контакта', contact: 'Контакт', generate: 'Сгенерировать карточку', generating: 'Генерация...', output: 'Готовый JSON', copy: 'Скопировать JSON-карточку', copied: 'JSON-карточка скопирована', copiedTitle: 'Скопировано', download: 'Скачать JSON-карточку', empty: 'Сначала сгенерируйте JSON-карточку.', unavailable: 'JSON-карточка доступна только после успешной проверки.' }
  },
  en: {
    title: 'Internationalismes', lead: '', params: 'Word parameters', word: 'Interal word', pos: 'Part of speech', noun: 'noun', adjective: 'adjective', verb: 'verb', adverb: 'adverb',
    evidence: 'Language coverage', result: 'Decision', card: 'JSON card', check: 'Check', json: 'Generate JSON card', copy: 'Copy', download: 'Download',
    table: { language: 'Language', form: 'Form', distance: 'Distance', passed: 'Passes', translation: 'Translation', source: 'Source', match: 'Match' },
    coverage: 'Coverage', required: 'Required', decision: 'Decision', accept: 'ACCEPTED', reject: 'NOT ACCEPTED', reasonOk: 'The 5/6 criterion is met.', reasonBad: 'Insufficient control-language coverage.',
    loadingLists: 'Loading frequency lists...', searching: 'Searching forms...', frequencySource: 'frequency list', manualSource: 'manual', noForm: 'not found', searchError: 'Could not load frequency lists. Forms can be entered manually.', manualMode: 'manual override', autoMode: 'auto', resetAria: 'Reset', resetConfirm: 'Reset entered data? This action cannot be undone.',
    jsonCard: { close: 'Close JSON card', title: 'JSON card', useAuthor: 'Add authorship', authorName: 'Name or nickname', contactType: 'Contact type', contact: 'Contact', generate: 'Generate card', generating: 'Generating...', output: 'Generated JSON', copy: 'Copy JSON card', copied: 'JSON card copied', copiedTitle: 'Copied', download: 'Download JSON card', empty: 'Generate the JSON card first.', unavailable: 'The JSON card is available only after a successful check.' }
  }
};

function getDefaultState() { return { word: '', part_of_speech: 'noun', evidence: {}, autoPassed: {}, manualOverride: {}, matchMeta: {}, isSearching: false, searchError: '', checked: false }; }
let state = getDefaultState();
let activeRunId = 0;
function setButtonStatus(selector, text, disabled = true, options = {}) { window.InteralButtonStatus?.setButtonStatus(selector, text, disabled, options); }
function nextRunId() { activeRunId += 1; return activeRunId; }
function invalidateActiveRuns() { activeRunId += 1; }
function isCurrentRun(runId) { return runId === activeRunId; }
function currentLang() { return localStorage.getItem('interal.lang') === 'en' ? 'en' : 'ru'; }
function setLang(lang) { localStorage.setItem('interal.lang', lang); render(); }
function currentTheme() { return localStorage.getItem('interal.theme') === 'dark' ? 'dark' : 'light'; }
function toggleTheme() { localStorage.setItem('interal.theme', currentTheme() === 'dark' ? 'light' : 'dark'); render(); }
function t(path) { return path.split('.').reduce((obj, key) => obj?.[key], I18N[currentLang()]) ?? path; }
function langName(code) { return LANGUAGES.find(l => l.code === code)?.name[currentLang()] || code; }
function byId(id) { return document.getElementById(id); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }
const CARDS_API_ENDPOINT = location.hostname === 'landquart.github.io' ? 'https://interal.vercel.app/api/cards' : '/api/cards';
const CARDS_NEXT_ID_ENDPOINT = location.hostname === 'landquart.github.io' ? 'https://interal.vercel.app/api/cards-next-id' : '/api/cards-next-id';
function isDatabaseLimitError(error) { const message = String(error?.message || error?.error || '').toLowerCase(); if (/invalid|validation|payload too large|path|section|title/.test(message)) return false; return message.includes('quota') || message.includes('storage') || message.includes('database size') || message.includes('disk') || message.includes('no space') || message.includes('insert') || message.includes('could not generate unique card id') || message.includes('write'); }
async function createFallbackCard(card, section) { const response = await fetch(`${CARDS_NEXT_ID_ENDPOINT}?section=${encodeURIComponent(section)}`, { cache: 'no-store' }); const data = await response.json().catch(() => null); if (!response.ok || !data?.ok || !data.id) throw new Error(data?.error || `HTTP ${response.status}`); return { ...card, id: data.id, section: data.section || section, discussionId: `card-${data.id}`, fallbackMode: 'fallback-sequential', persistenceRequired: 'Save this card to the GitHub JSON registry or another durable registry; fallback IDs are best-effort read-check-only and are not reserved in Supabase.' }; }
async function createCardOnServer(card) {
  const title = card?.interal?.word || card?.title || 'Untitled card';
  try {
    const response = await fetch(CARDS_API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'internationalismes', title, category: card?.vord_type || 'internationalism', payload: card })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP ${response.status}`);
    return data.card?.payload || { ...card, id: data.id, discussionId: data.discussionId || `card-${data.id}` };
  } catch (error) {
    if (!isDatabaseLimitError(error)) throw error;
    console.warn('Supabase insert failed; using fallback sequential card id');
    return createFallbackCard(card, 'internationalismes');
  }
}
function downloadJson(filename, text) { const blob = new Blob([text], { type: 'application/json;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
function copyText(text) { navigator.clipboard?.writeText(text).catch(() => {}); }

function renderChrome() {}
function levenshtein(a, b) { a = String(a || '').toLowerCase(); b = String(b || '').toLowerCase(); const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) dp[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) { const cost = a[i - 1] === b[j - 1] ? 0 : 1; dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost); } return dp[a.length][b.length]; }
function translitRu(value) { const map = { а:'a', б:'b', в:'v', г:'g', д:'d', е:'e', ё:'e', ж:'zh', з:'z', и:'i', й:'j', к:'k', л:'l', м:'m', н:'n', о:'o', п:'p', р:'r', с:'s', т:'t', у:'u', ф:'f', х:'h', ц:'c', ч:'ch', ш:'sh', щ:'shch', ъ:'', ы:'y', ь:'', э:'e', ю:'yu', я:'ya' }; return String(value || '').toLowerCase().split('').map(ch => map[ch] ?? ch).join('').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function normalizeLatin(value) { return translitRu(value).replace(/[^a-z0-9]/g, ''); }
function formDistance(candidate, form) { return levenshtein(normalizeLatin(candidate), normalizeLatin(form)); }
function isVowel(ch) { return 'aeiouy'.includes(ch); }
function latinToRuCandidates(value) {
  const input = normalizeLatin(value); if (!input) return [];
  const multi = [['sh','ш'], ['ch','ч'], ['zh','ж'], ['ph','ф'], ['th','т'], ['rh','р'], ['ya','я'], ['yu','ю'], ['ts','ц']];
  function build(pos, current, out) {
    if (out.size > 48) return;
    if (pos >= input.length) { out.add(current); return; }
    const rest = input.slice(pos);
    if (rest.startsWith('yo')) { build(pos + 2, current + 'ё', out); build(pos + 2, current + 'е', out); return; }
    const pair = multi.find(([latin]) => rest.startsWith(latin));
    if (pair) { build(pos + pair[0].length, current + pair[1], out); return; }
    const ch = input[pos]; const next = input[pos + 1] || ''; const prev = input[pos - 1] || '';
    const simple = { a:'а', b:'б', d:'д', f:'ф', g:'г', h:'х', i:'и', j:'ж', k:'к', l:'л', m:'м', n:'н', o:'о', p:'п', r:'р', s:'с', t:'т', u:'у', v:'в', z:'з' };
    if (ch === 'c') build(pos + 1, current + ('eiy'.includes(next) ? 'ц' : 'к'), out);
    else if (ch === 'e') { build(pos + 1, current + 'е', out); build(pos + 1, current + 'э', out); }
    else if (ch === 'y') build(pos + 1, current + (isVowel(prev) ? 'й' : 'и'), out);
    else build(pos + 1, current + (simple[ch] ?? ch), out);
  }
  const out = new Set(); build(0, '', out); return [...out];
}
function frequencyFromValue(value) {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const key = ['ipm', 'frequency', 'freq', 'count', 'value'].find(field => Number.isFinite(Number(value[field])));
    return key ? Number(value[key]) : 0;
  }
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}
function pushFrequencyEntry(target, word, frequency = 0) {
  const clean = String(word || '').trim();
  if (!clean || /^\d+$/.test(clean)) return;
  target.push({ word: clean, frequency: Number.isFinite(Number(frequency)) ? Number(frequency) : 0 });
}
function extractFrequencyEntries(json) {
  const entries = [];
  if (Array.isArray(json)) {
    json.forEach(item => {
      if (typeof item === 'string') pushFrequencyEntry(entries, item);
      else if (item && typeof item === 'object') {
        const wordKey = ['word', 'lemma', 'form', 'token', 'vord'].find(key => item[key]);
        pushFrequencyEntry(entries, item[wordKey], frequencyFromValue(item));
      }
    });
  } else if (json && typeof json === 'object') {
    Object.entries(json).forEach(([key, value]) => {
      if (/^\d+$/.test(key) && value && typeof value === 'object' && !Array.isArray(value)) {
        Object.entries(value).forEach(([word, nestedValue]) => pushFrequencyEntry(entries, word, frequencyFromValue(nestedValue)));
      } else {
        pushFrequencyEntry(entries, key, frequencyFromValue(value));
      }
    });
  }
  return entries;
}
function normalizeForLanguage(value, langCode) { return langCode === 'ru' ? String(value || '').toLowerCase().replace(/[^а-яё]/g, '') : normalizeLatin(value); }
function betterEntry(current, next) {
  if (!current) return next;
  if (next.frequency !== current.frequency) return next.frequency > current.frequency ? next : current;
  if (next.word.length !== current.word.length) return next.word.length < current.word.length ? next : current;
  return next.word.localeCompare(current.word) < 0 ? next : current;
}
function buildFrequencyIndex(entries, langCode) {
  const exact = new Map();
  const lengthBuckets = new Map();
  const indexed = [];
  entries.forEach(entry => {
    const word = String(entry.word || '').trim();
    const frequency = Number.isFinite(Number(entry.frequency)) ? Number(entry.frequency) : 0;
    const normalized = normalizeForLanguage(word, langCode);
    const latinNormalized = normalizeLatin(word);
    if (!word || (!normalized && !latinNormalized)) return;
    const item = { word, frequency, normalized, latinNormalized };
    indexed.push(item);
    const length = latinNormalized.length;
    if (length) {
      if (!lengthBuckets.has(length)) lengthBuckets.set(length, []);
      lengthBuckets.get(length).push(item);
    }
    if (normalized) exact.set(normalized, betterEntry(exact.get(normalized), item));
    if (langCode === 'ru' && latinNormalized) exact.set(latinNormalized, betterEntry(exact.get(latinNormalized), item));
  });
  return { entries: indexed, exact, lengthBuckets };
}
async function loadLanguageFrequency(langCode) {
  if (frequencyCache.has(langCode)) return frequencyCache.get(langCode);
  const entries = [];
  for (const source of FREQUENCY_SOURCES[langCode] || []) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`${langCode}: ${response.status}`);
    extractFrequencyEntries(await response.json()).slice(0, MAX_FREQUENCY_ENTRIES_PER_SOURCE).forEach(item => entries.push({ ...item, source }));
  }
  const index = buildFrequencyIndex(entries, langCode);
  frequencyCache.set(langCode, index);
  return index;
}
function matchDistanceLimit(value) { return normalizeLatin(value).length >= 4 ? 2 : 0; }
function emptyMatch(langCode) { return { language: langCode, form: '', distance: null, source: 'frequency_list', match_type: 'not_found', frequency: 0, passed: false }; }
function betterMatch(current, next) {
  if (!current) return next;
  if (next.match_type !== current.match_type) return next.match_type === 'exact' ? next : current;
  if (next.distance !== current.distance) return next.distance < current.distance ? next : current;
  if (next.frequency !== current.frequency) return next.frequency > current.frequency ? next : current;
  if (next.form.length !== current.form.length) return next.form.length < current.form.length ? next : current;
  return next.form.localeCompare(current.form) < 0 ? next : current;
}
function findBestInternationalismMatch(langCode, interalWord, index) {
  const base = normalizeLatin(interalWord);
  if (!base) return emptyMatch(langCode);
  const searchForms = langCode === 'ru' ? [...new Set([interalWord, ...latinToRuCandidates(interalWord)])] : [interalWord];
  let best = null;
  for (const searchForm of searchForms) {
    const keys = langCode === 'ru' ? [normalizeForLanguage(searchForm, 'ru'), normalizeLatin(searchForm)].filter(Boolean) : [normalizeLatin(searchForm)];
    for (const key of keys) {
      const exact = index.exact.get(key);
      if (exact) best = betterMatch(best, { language: langCode, form: exact.word, distance: formDistance(interalWord, exact.word), source: 'frequency_list', match_type: 'exact', frequency: exact.frequency, passed: true });
    }
  }
  if (best?.match_type === 'exact') return best;
  if (base.length < 4) return best || emptyMatch(langCode);
  for (let length = base.length - 2; length <= base.length + 2; length += 1) {
    for (const entry of index.lengthBuckets.get(length) || []) {
      const distance = levenshtein(base, entry.latinNormalized);
      if (distance <= 2) best = betterMatch(best, { language: langCode, form: entry.word, distance, source: 'frequency_list', match_type: 'fuzzy', frequency: entry.frequency, passed: true });
    }
  }
  return best || emptyMatch(langCode);
}
async function searchAllLanguages(runId, { onProgress } = {}) {
  const word = state.word.trim();
  for (const lang of LANGUAGES) {
    onProgress?.(`${currentLang() === 'en' ? 'Loading' : 'Загрузка'}: ${langName(lang.code)}`);
    const index = await loadLanguageFrequency(lang.code);
    if (!isCurrentRun(runId)) return;
    onProgress?.(`${currentLang() === 'en' ? 'Checking' : 'Проверка'}: ${langName(lang.code)}`);
    const match = findBestInternationalismMatch(lang.code, word, index);
    if (!isCurrentRun(runId)) return;
    state.evidence[lang.code] = match.form || '';
    state.autoPassed[lang.code] = Boolean(match.passed);
    state.manualOverride[lang.code] = null;
    state.matchMeta[lang.code] = { distance: match.distance, source: match.source, match_type: match.match_type, frequency: match.frequency || 0 };
  }
}
function effectivePassed(langCode) { if (state.manualOverride[langCode] === true) return true; if (state.manualOverride[langCode] === false) return false; return Boolean(state.autoPassed[langCode]); }
function readEvidence() {
  for (const lang of LANGUAGES) {
    const code = lang.code;
    const old = state.evidence[code] || '';
    const value = byId(`form_${code}`)?.value.trim() || '';
    const pass = byId(`pass_${code}`);
    if (pass) state.manualOverride[code] = pass.indeterminate ? null : Boolean(pass.checked);
    else state.manualOverride[code] = state.manualOverride[code] ?? null;
    state.evidence[code] = value;
    const distance = value ? formDistance(state.word, value) : null;
    if (value !== old) {
      state.autoPassed[code] = distance !== null && distance <= matchDistanceLimit(state.word);
      state.matchMeta[code] = { distance, source: 'manual', match_type: value ? 'manual' : 'not_found', frequency: 0 };
    } else if (!value) {
      state.autoPassed[code] = false;
      state.matchMeta[code] = state.matchMeta[code] || { distance: null, source: 'frequency_list', match_type: 'not_found', frequency: 0 };
    }
  }
}
function readState() { state.word = byId('wordInput')?.value.trim() || ''; state.part_of_speech = byId('posInput')?.value || state.part_of_speech; readEvidence(); }
function syncPosSelectOptions() {
  const select = byId('posInput');
  if (!select) return;

  const allowedValues = ['noun', 'adjective', 'verb', 'adverb'];
  const currentValue = allowedValues.includes(state.part_of_speech)
    ? state.part_of_speech
    : allowedValues.includes(select.value)
      ? select.value
      : 'noun';

  select.innerHTML = `
    <option value="noun">${t('noun')}</option>
    <option value="adjective">${t('adjective')}</option>
    <option value="verb">${t('verb')}</option>
    <option value="adverb">${t('adverb')}</option>
  `;

  select.value = currentValue;
  state.part_of_speech = currentValue;

  window.refreshCustomSelect?.(select);
}
async function analyze() {
  readState();
  if (!state.word.trim()) { render(); return; }
  const runId = nextRunId();
  state.isSearching = true;
  state.searchError = '';
  render();
  setButtonStatus('#checkBtn', currentLang() === 'en' ? 'Preparing...' : 'Подготовка...', true);
  try {
    await searchAllLanguages(runId, { onProgress: text => setButtonStatus('#checkBtn', text, true) });
    if (!isCurrentRun(runId)) return;
  } catch (error) {
    if (!isCurrentRun(runId)) return;
    console.error(error);
    state.searchError = t('searchError');
    setButtonStatus('#checkBtn', currentLang() === 'en' ? 'Error' : 'Ошибка', false);
  } finally {
    if (!isCurrentRun(runId)) return;
    state.isSearching = false;
    state.checked = true;
    setButtonStatus('#checkBtn', currentLang() === 'en' ? 'Calculating result...' : 'Расчёт результата...', true);
    render();
    setTimeout(() => setButtonStatus('#checkBtn', t('check'), false), 800);
  }
}


function hasUserInputForReset() {
  const hasText = Boolean(byId('wordInput')?.value.trim() || LANGUAGES.some(lang => byId(`form_${lang.code}`)?.value.trim()));
  const hasOverride = LANGUAGES.some(lang => { const pass = byId(`pass_${lang.code}`); return pass && !pass.indeterminate; });
  return hasText || hasOverride || (byId('posInput')?.value || 'noun') !== 'noun';
}
function clearDomFields() {
  byId('wordInput').value = ''; byId('posInput').value = 'noun';
  LANGUAGES.forEach(lang => { const input = byId(`form_${lang.code}`); if (input) input.value = ''; const pass = byId(`pass_${lang.code}`); if (pass) { pass.checked = false; pass.indeterminate = true; } });
  const output = byId('jsonCardOutput'); if (output) output.value = '';
}
function updateResetButtonVisibility() { const resetBtn = byId('resetBtn'); if (resetBtn) resetBtn.classList.toggle('is-hidden', !hasUserInputForReset()); }
async function resetAll() {
  await window.InteralUI.resetPageState({
    message: t('resetConfirm')
  });
}

function result() { const passed = LANGUAGES.filter(lang => effectivePassed(lang.code)).length; return { passed, total: 6, accepted: passed >= 5 }; }
function canCreateCard() {
  return Boolean(state.checked && result().accepted);
}
function setJsonEnabled(enabled) {
  const allowed = enabled === true && canCreateCard();

  const jsonActions = byId('jsonActions');
  const jsonBtn = byId('jsonBtn');
  const generateBtn = byId('generateJsonCardBtn');

  if (jsonActions) jsonActions.hidden = !allowed;

  if (jsonBtn) {
    jsonBtn.hidden = !allowed;
    jsonBtn.disabled = !allowed;
  }

  if (generateBtn) {
    generateBtn.hidden = !allowed;
    generateBtn.disabled = !allowed;
  }
}
function resetSuccessfulCheck() {
  state.checked = false;
  setJsonEnabled(false);
  const resultSection = byId('resultSection');
  if (resultSection) resultSection.hidden = true;
}
function getAuthorBlock() { if (!byId('useAuthorBlock')?.checked) return null; const displayName = byId('authorDisplayName')?.value.trim() || ''; const contactType = byId('authorContactType')?.value || 'telegram'; const contactValue = byId('authorContactValue')?.value.trim() || ''; const author = {}; if (displayName) author.display_name = displayName; if (contactValue) author.contacts = [{ type: contactType, url: window.InteralJsonCardModal?.normalizeContact?.(contactType, contactValue) || contactValue }]; return Object.keys(author).length ? author : null; }
function evidenceForCard(lang) { const code = lang.code; const form = state.evidence[code] || ''; const meta = state.matchMeta[code] || {}; return { language: code, form, distance: Number.isFinite(Number(meta.distance)) ? Number(meta.distance) : null, source: meta.source || (form ? 'manual' : 'frequency_list'), match_type: meta.match_type || (form ? 'manual' : 'not_found'), frequency: Number.isFinite(Number(meta.frequency)) ? Number(meta.frequency) : null, passed: effectivePassed(code) }; }
function makeCardDraft() { const r = result(); const card = { version: '1.0', card_type: 'vord_card', vord_type: 'internationalism', status: 'draft', interal: { word: byId('wordInput')?.value.trim() || state.word, part_of_speech: byId('posInput')?.value || state.part_of_speech }, criteria: { required_languages: 5, total_languages: 6, passed_languages: r.passed, max_levenshtein_distance: 2, minimum_word_length_for_fuzzy_match: 4, sources: 'frequency_lists' }, language_evidence: LANGUAGES.map(evidenceForCard), decision: { accepted: r.accepted } }; const author = getAuthorBlock(); if (author) card.author = author; return card; }
async function makeCard() { return createCardOnServer(makeCardDraft()); }
function generateJson() { if (canCreateCard()) openJsonModal(); }
function renderEvidenceRows() {
  return LANGUAGES.map(lang => {
    const code = lang.code;
    const form = state.evidence[code] || '';
    const passed = effectivePassed(code);
    const override = state.manualOverride[code];
    const name = langName(code);
    return `<article class="language-card"><div class="language-card__top"><span class="language-code">${escapeHtml(name)}</span><span class="status-mark ${passed ? 'ok' : 'bad'}">${passed ? '✓' : '×'}</span></div><label class="sr-only" for="form_${code}">${escapeHtml(name)}</label><input class="interal-input" id="form_${code}" value="${escapeHtml(form)}" placeholder="—"><label class="language-card__check"><input id="pass_${code}" type="checkbox" aria-label="${escapeHtml(t('table.passed'))}" data-override="${override === null || override === undefined ? 'auto' : 'manual'}" ${passed ? 'checked' : ''}></label></article>`;
  }).join('');
}
function renderResult() {
  const r = result();
  const checked = Boolean(state.checked);
  const accepted = checked && r.accepted;
  byId('resultBox').innerHTML = `<span class="status-pill ${r.accepted ? 'ok' : 'bad'}">${r.accepted ? t('accept') : t('reject')}</span><dl><div><dt>${t('coverage')}</dt><dd>${r.passed}/${r.total}</dd></div><div><dt>${t('required')}</dt><dd>5/6</dd></div></dl>`;
  const evidenceSection = byId('evidenceSection');
  if (evidenceSection) evidenceSection.hidden = !checked;
  const resultSection = byId('resultSection');
  if (resultSection) resultSection.hidden = !accepted;
  setJsonEnabled(accepted);
}
function render() {
  renderChrome(); applyJsonModalTexts(); document.title = t('title'); byId('pageTitle').textContent = t('title'); byId('pageLead').textContent = t('lead');
  byId('paramsTitle').textContent = t('params'); byId('wordLabel').textContent = t('word'); byId('posLabel').textContent = t('pos'); setButtonStatus('#checkBtn', state.isSearching ? (currentLang() === 'en' ? 'Searching...' : 'Поиск...') : t('check'), state.isSearching); byId('evidenceTitle').textContent = t('evidence'); byId('decisionTitle').textContent = t('decision'); byId('jsonBtn').textContent = t('json'); byId('resetBtn').title = t('resetAria'); byId('resetBtn').setAttribute('aria-label', t('resetAria'));
  const posInput = byId('posInput');
  if (posInput && posInput.value !== state.part_of_speech) {
    posInput.value = state.part_of_speech || 'noun';
    window.refreshCustomSelect?.(posInput);
  }
  byId('noticeBox').innerHTML = `${state.isSearching ? `<div class="notice">${escapeHtml(t('searching'))}</div>` : ''}${state.searchError ? `<div class="notice notice--warning">${escapeHtml(state.searchError)}</div>` : ''}`;
  byId('evidenceBox').innerHTML = `<div class="language-grid">${renderEvidenceRows()}</div>`; LANGUAGES.forEach(lang => { const pass = byId(`pass_${lang.code}`); if (pass && (state.manualOverride[lang.code] === null || state.manualOverride[lang.code] === undefined)) pass.indeterminate = true; });
  renderResult(); updateResetButtonVisibility();
}
const jsonFilename = 'internationalism-card.json';
function bindJsonModal() {
  window.InteralJsonCardModal?.init({ getLanguage: currentLang, getTexts: () => t('jsonCard'), buildCard: async ({ onProgress } = {}) => { readState(); if (!canCreateCard()) throw new Error(t('jsonCard.unavailable')); onProgress?.(currentLang() === 'en' ? 'Building card...' : 'Сборка карточки...'); return makeCard(); }, formatCard: (card) => JSON.stringify(card, null, 2), getFilename: () => jsonFilename });
  document.addEventListener('interal:languagechange', () => { readState(); syncPosSelectOptions(); render(); });
  byId('resetBtn')?.addEventListener('click', resetAll);
  byId('checkBtn')?.addEventListener('click', analyze);
  byId('app')?.addEventListener('input', event => {
    const target = event.target;
    if (target?.id === 'wordInput') { state.word = target.value; resetSuccessfulCheck(); render(); return; }
    if (target?.id === 'posInput') return;
    if (target?.id?.startsWith('form_')) { readState(); resetSuccessfulCheck(); render(); return; }
    updateResetButtonVisibility();
  });
  byId('app')?.addEventListener('change', event => {
    const target = event.target;
    if (target?.id?.startsWith('pass_')) { const code = target.id.replace('pass_', ''); state.manualOverride[code] = Boolean(target.checked); resetSuccessfulCheck(); render(); return; }
    if (target?.id === 'posInput') { state.part_of_speech = target.value || 'noun'; resetSuccessfulCheck(); updateResetButtonVisibility(); window.refreshCustomSelect?.(target); return; }
    readState(); render();
  });
}
bindJsonModal();
syncPosSelectOptions();
applyJsonModalTexts(); render();
