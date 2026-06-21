
const LANGUAGES = [
  { code: 'en', name: { ru: 'Английский', en: 'English' }, group: 'Germanic' },
  { code: 'de', name: { ru: 'Немецкий', en: 'German' }, group: 'Germanic' },
  { code: 'fr', name: { ru: 'Французский', en: 'French' }, group: 'Romance' },
  { code: 'es', name: { ru: 'Испанский', en: 'Spanish' }, group: 'Romance' },
  { code: 'it', name: { ru: 'Итальянский', en: 'Italian' }, group: 'Romance' },
  { code: 'ru', name: { ru: 'Русский', en: 'Russian' }, group: 'Slavic' }
];

function currentLang() { return localStorage.getItem('interal.lang') === 'en' ? 'en' : 'ru'; }
function setLang(lang) { localStorage.setItem('interal.lang', lang); render(); }
function currentTheme() { return localStorage.getItem('interal.theme') === 'dark' ? 'dark' : 'light'; }
function toggleTheme() { localStorage.setItem('interal.theme', currentTheme() === 'dark' ? 'light' : 'dark'); render(); }
function t(path) {
  const lang = currentLang();
  return path.split('.').reduce((obj, key) => obj?.[key], I18N[lang]) ?? path;
}
function langName(code) { return LANGUAGES.find(l => l.code === code)?.name[currentLang()] || code; }
function byId(id) { return document.getElementById(id); }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}
function createId(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
}
function downloadJson(filename, text) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function copyText(text) {
  navigator.clipboard?.writeText(text).catch(() => {});
}
function renderChrome() {}
function levenshtein(a, b) {
  a = String(a || '').toLowerCase();
  b = String(b || '').toLowerCase();
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}
function translitRu(value) {
  const map = { а:'a', б:'b', в:'v', г:'g', д:'d', е:'e', ё:'e', ж:'zh', з:'z', и:'i', й:'j', к:'k', л:'l', м:'m', н:'n', о:'o', п:'p', р:'r', с:'s', т:'t', у:'u', ф:'f', х:'h', ц:'c', ч:'ch', ш:'sh', щ:'shch', ъ:'', ы:'y', ь:'', э:'e', ю:'ju', я:'ja' };
  return String(value || '').toLowerCase().split('').map(ch => map[ch] ?? ch).join('').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function normalizeLatin(value) { return translitRu(value).replace(/[^a-z0-9]/g, ''); }
function formDistance(candidate, form) { return levenshtein(normalizeLatin(candidate), normalizeLatin(form)); }
function readTranslations() {
  return LANGUAGES.map(lang => ({ language: lang.code, word: byId(`tr_${lang.code}`)?.value.trim() || '' }));
}
function renderTranslations(defaults = {}) {
  return `<div class="table-wrap"><table><thead><tr><th>${t('table.language')}</th><th>${t('table.translation')}</th></tr></thead><tbody>${LANGUAGES.map(lang => `<tr><td>${langName(lang.code)}</td><td><input class="interal-input" id="tr_${lang.code}" value="${escapeHtml(defaults[lang.code] || '')}"></td></tr>`).join('')}</tbody></table></div>`;
}

const I18N = {
  ru: {
    title: 'Internationalismes',
    lead: 'Проверка интернационализмов: близкая форма должна быть представлена минимум в 5 из 6 контрольных языков.',
    params: 'Параметры слова', word: 'Слово в Интерaле', pos: 'Часть речи', noun: 'существительное', adjective: 'прилагательное', verb: 'глагол', adverb: 'наречие',
    evidence: 'Языковое покрытие', result: 'Итог', card: 'JSON-карточка',
    table: { language: 'Язык', form: 'Форма', distance: 'Дистанция', passed: 'Проходит', translation: 'Перевод' },
    check: 'Проверить', example: 'Пример', json: 'Сформировать JSON', copy: 'Скопировать', download: 'Скачать',
    coverage: 'Покрытие', required: 'Минимум', decision: 'Решение', accept: 'ПРИНЯТО', reject: 'НЕ ПРИНЯТО', reasonOk: 'Критерий 5/6 выполнен.', reasonBad: 'Недостаточное покрытие контрольных языков.'
  },
  en: {
    title: 'Internationalismes',
    lead: 'Internationalism check: a close form must be present in at least 5 of 6 control languages.',
    params: 'Word parameters', word: 'Interal word', pos: 'Part of speech', noun: 'noun', adjective: 'adjective', verb: 'verb', adverb: 'adverb',
    evidence: 'Language coverage', result: 'Decision', card: 'JSON card',
    table: { language: 'Language', form: 'Form', distance: 'Distance', passed: 'Passes', translation: 'Translation' },
    check: 'Check', example: 'Example', json: 'Generate JSON', copy: 'Copy', download: 'Download',
    coverage: 'Coverage', required: 'Required', decision: 'Decision', accept: 'ACCEPTED', reject: 'NOT ACCEPTED', reasonOk: 'The 5/6 criterion is met.', reasonBad: 'Insufficient control-language coverage.'
  }
};

let state = {
  word: 'radio',
  part_of_speech: 'noun',
  evidence: { en: 'radio', de: 'Radio', fr: 'radio', es: 'radio', it: 'radio', ru: 'радио' },
  manualPassed: {}
};

function getPassedFor(langCode, form) {
  const word = byId('wordInput')?.value.trim() || state.word;
  const normalizedWord = normalizeLatin(word);
  const normalizedForm = normalizeLatin(form);
  if (!normalizedWord || !normalizedForm) return false;
  const distance = formDistance(word, form);
  if (normalizedWord.length >= 4) return distance <= 2;
  return distance === 0;
}
function readEvidence() {
  const evidence = {};
  const manualPassed = {};
  for (const lang of LANGUAGES) {
    evidence[lang.code] = byId(`form_${lang.code}`)?.value.trim() || '';
    manualPassed[lang.code] = Boolean(byId(`pass_${lang.code}`)?.checked);
  }
  state.evidence = evidence;
  state.manualPassed = manualPassed;
}
function analyze() {
  readEvidence();
  render();
}
function fillExample() {
  state = { word: 'radio', part_of_speech: 'noun', evidence: { en: 'radio', de: 'Radio', fr: 'radio', es: 'radio', it: 'radio', ru: 'радио' }, manualPassed: {} };
  render();
}
function result() {
  const passed = LANGUAGES.filter(lang => state.manualPassed[lang.code] ?? getPassedFor(lang.code, state.evidence[lang.code])).length;
  return { passed, total: 6, accepted: passed >= 5 };
}
function makeCard() {
  const r = result();
  return {
    id: createId('in'),
    version: '1.0',
    card_type: 'vord_card',
    vord_type: 'internationalism',
    status: 'draft',
    interal: { word: byId('wordInput')?.value.trim() || state.word, part_of_speech: byId('posInput')?.value || state.part_of_speech },
    criteria: { required_languages: 5, total_languages: 6, passed_languages: r.passed },
    language_evidence: LANGUAGES.map(lang => ({ language: lang.code, form: state.evidence[lang.code] || '', passed: Boolean(state.manualPassed[lang.code] ?? getPassedFor(lang.code, state.evidence[lang.code])) })),
    decision: { accepted: r.accepted }
  };
}
function generateJson() { openJsonModal(); }
function renderEvidenceRows() {
  const word = byId('wordInput')?.value.trim() || state.word;
  return LANGUAGES.map(lang => {
    const form = state.evidence[lang.code] || '';
    const distance = form ? formDistance(word, form) : null;
    const passed = state.manualPassed[lang.code] ?? getPassedFor(lang.code, form);
    return `<article class="language-card"><div class="language-card__top"><span class="language-code">${lang.code.toUpperCase()}</span><span class="status-mark ${passed ? 'ok' : 'bad'}">${passed ? '✓' : '×'}</span></div><label class="sr-only" for="form_${lang.code}">${langName(lang.code)}</label><input class="interal-input" id="form_${lang.code}" value="${escapeHtml(form)}"><div class="language-card__meta">${t('table.distance')}: ${distance ?? '—'}<label class="language-card__check"><input id="pass_${lang.code}" type="checkbox" ${passed ? 'checked' : ''}> ${t('table.passed')}</label></div></article>`;
  }).join('');
}
function render() {
  renderChrome();
  document.title = t('title'); byId('pageTitle').textContent = t('title'); byId('pageLead').textContent = t('lead');
  const r = result();
  byId('app').innerHTML = `
    <div class="vord-grid">
      <section class="card vord-panel"><h2>${t('params')}</h2><div class="compact-fields">
        <div class="field"><label>${t('word')}</label><input class="interal-input" id="wordInput" value="${escapeHtml(state.word)}" oninput="state.word=this.value"></div>
        <div class="field"><label>${t('pos')}</label><select class="interal-select" id="posInput" onchange="state.part_of_speech=this.value"><option value="noun">${t('noun')}</option><option value="adjective">${t('adjective')}</option><option value="verb">${t('verb')}</option><option value="adverb">${t('adverb')}</option></select></div></div>
        <div class="actions"><button class="interal-btn interal-btn--primary" onclick="analyze()">${t('check')}</button><button class="interal-btn interal-btn--secondary" onclick="fillExample()">${t('example')}</button></div>
      </section>
      <section class="card vord-panel decision-summary"><h2>${t('decision')}</h2><span class="status-pill ${r.accepted ? 'ok' : 'bad'}">${r.accepted ? t('accept') : t('reject')}</span><dl><div><dt>${t('coverage')}</dt><dd>${r.passed}/${r.total}</dd></div><div><dt>${t('required')}</dt><dd>5/6</dd></div></dl></section>
    </div>
    <section class="card vord-panel"><h2>${t('evidence')}</h2><div class="language-grid">${renderEvidenceRows()}</div></section>
    <div class="actions json-card-bottom-actions"><button class="interal-btn interal-btn--secondary" onclick="generateJson()">${t('json')}</button></div>`;
  if (byId('posInput')) byId('posInput').value = state.part_of_speech;
}

const jsonFilename = 'internationalism-card.json';
function currentJsonText() {
  const existing = byId('jsonOutput')?.value;
  return existing || JSON.stringify(makeCard(), null, 2);
}
function openJsonModal() {
  if (typeof readState === 'function') readState();
  if (typeof readEvidence === 'function') readEvidence();
  const output = byId('jsonOutput');
  if (output) output.value = JSON.stringify(makeCard(), null, 2);
  const modal = byId('jsonCardModal');
  modal?.classList.add('show');
  modal?.setAttribute('aria-hidden', 'false');
}
function closeJsonModal() {
  const modal = byId('jsonCardModal');
  modal?.classList.remove('show');
  modal?.setAttribute('aria-hidden', 'true');
}
function bindJsonModal() {
  byId('closeJsonCardBtn')?.addEventListener('click', closeJsonModal);
  byId('jsonCardModal')?.addEventListener('click', (event) => { if (event.target === byId('jsonCardModal')) closeJsonModal(); });
  byId('copyJsonCardBtn')?.addEventListener('click', () => copyText(currentJsonText()));
  byId('downloadJsonCardBtn')?.addEventListener('click', () => downloadJson(jsonFilename, currentJsonText()));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeJsonModal(); });
  document.addEventListener('interal:languagechange', render);
}
bindJsonModal();
render();
