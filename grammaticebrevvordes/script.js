
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
  return `<div class="table-wrap"><table><thead><tr><th>${t('table.language')}</th><th>${t('table.translation')}</th></tr></thead><tbody>${LANGUAGES.map(lang => `<tr><td>${langName(lang.code)}</td><td><input class="interal-input" id="tr_${lang.code}" autocomplete="off" value="${escapeHtml(defaults[lang.code] || '')}"></td></tr>`).join('')}</tbody></table></div>`;
}

const I18N = {
  ru: { title:'Grammatic e brev vordes', lead:'', params:'Параметры слова', word:'Слово в Интерaле', pos:'Часть речи', meaning:'Значение', translations:'Переводы', criteria:'Критерии', arguments:'Обоснование', result:'Итог', card:'JSON-карточка', preposition:'предлог', conjunction:'союз', particle:'частица', adverb:'наречие', check:'Проверить', json:'Сформировать JSON-карточку', copy:'Скопировать', download:'Скачать', passed:'Пройдено', decision:'Решение', accept:'ПРИНЯТО', reject:'НЕ ПРИНЯТО', table:{language:'Язык', translation:'Перевод'}, comment:'Комментарий', criterionDecision:'Оценка', criterionPass:'Соответствует', criterionFail:'Не соответствует', reset:'Сбросить' },
  en: { title:'Grammatic e brev vordes', lead:'', params:'Word parameters', word:'Interal word', pos:'Part of speech', meaning:'Meaning', translations:'Translations', criteria:'Criteria', arguments:'Justification', result:'Decision', card:'JSON card', preposition:'preposition', conjunction:'conjunction', particle:'particle', adverb:'adverb', check:'Check', json:'Generate JSON card', copy:'Copy', download:'Download', passed:'Passed', decision:'Decision', accept:'ACCEPTED', reject:'NOT ACCEPTED', table:{language:'Language', translation:'Translation'}, comment:'Comment', criterionDecision:'Evaluation', criterionPass:'Passes', criterionFail:'Does not pass', reset:'Reset' }
};
const CRITERIA_NAMES = ['Краткость','Легкопроизносимость','Распознаваемость/когнативность','Отсутствие конфликта'];
const REQUIRED_CRITERIA_COUNT = 3;
function getDefaultState() {
  return {
    word: '',
    part_of_speech: 'preposition',
    meaning: '',
    translations: { en:'', de:'', fr:'', es:'', it:'', ru:'' },
    arguments: '',
    criteria: [false, false, false, false],
    comments: ['', '', '', '']
  };
}
let state = getDefaultState();
function readState(){ state.word=byId('wordInput')?.value.trim()||''; state.part_of_speech=byId('posInput')?.value||'preposition'; state.meaning=byId('meaningInput')?.value.trim()||''; state.arguments=byId('argumentsInput')?.value.trim()||''; for(const lang of LANGUAGES) state.translations[lang.code]=byId(`tr_${lang.code}`)?.value.trim()||''; state.criteria=CRITERIA_NAMES.map((_,i)=>Boolean(byId(`crit_${i}`)?.checked)); state.comments=CRITERIA_NAMES.map((_,i)=>i === 2 ? (byId(`comment_${i}`)?.value.trim()||'') : ''); }


function hasUserInputForReset() {
  const hasText = ['wordInput', 'meaningInput', 'argumentsInput', 'comment_2', ...LANGUAGES.map(lang => `tr_${lang.code}`)].some(id => byId(id)?.value.trim());
  const hasCriteria = CRITERIA_NAMES.some((_, i) => Boolean(byId(`crit_${i}`)?.checked));
  return hasText || hasCriteria || (byId('posInput')?.value || 'preposition') !== 'preposition';
}
function clearDomFields() {
  byId('wordInput').value = ''; byId('posInput').value = 'preposition'; byId('meaningInput').value = ''; byId('argumentsInput').value = '';
  LANGUAGES.forEach(lang => { const input = byId(`tr_${lang.code}`); if (input) input.value = ''; });
  CRITERIA_NAMES.forEach((_, i) => { const checkbox = byId(`crit_${i}`); const comment = byId(`comment_${i}`); if (checkbox) checkbox.checked = false; if (comment) comment.value = ''; });
  const output = byId('jsonOutput'); if (output) output.value = '';
}
function updateResetButtonVisibility() { const resetBtn = byId('resetBtn'); if (resetBtn) resetBtn.classList.toggle('is-hidden', !hasUserInputForReset()); }
async function resetState() {
  await window.InteralUI.resetPageState({
    message: t('reset')
  });
}

function countPassedCriteria() { return state.criteria.filter(Boolean).length; }
function isGrammarShortWordAccepted() { return countPassedCriteria() >= REQUIRED_CRITERIA_COUNT; }
function result(){ const n=countPassedCriteria(); return {passed:n,total:CRITERIA_NAMES.length,required:REQUIRED_CRITERIA_COUNT,accepted:isGrammarShortWordAccepted()}; }
function makeCard(){ const r=result(); return { id:createId('gr'), version:'1.0', card_type:'vord_card', vord_type:'grammar_short_word', status:'draft', interal:{word:state.word, part_of_speech:state.part_of_speech}, translations:LANGUAGES.map(lang=>({language:lang.code, word:state.translations[lang.code]||''})), function:{meaning:state.meaning}, criteria:CRITERIA_NAMES.map((name,i)=>({name, value:Boolean(state.criteria[i]), comment:state.comments[i]||''})), decision:{accepted:r.accepted, required_criteria:r.required, passed_criteria:r.passed} }; }
function generateJson(){ openJsonModal(); }
function renderCriteria(){ return `<div class="criteria-list grammar-criteria-list">${CRITERIA_NAMES.map((name,i)=>`<div class="criterion grammar-criterion"><div class="criterion-head"><strong>${escapeHtml(name)}</strong></div><label class="criterion-check"><input id="crit_${i}" type="checkbox" ${state.criteria[i] ? 'checked' : ''}><span>${t('criterionPass')}</span></label>${i === 2 ? `<label class="field criterion-comment"><span>${t('comment')}</span><textarea class="interal-textarea" id="comment_${i}">${escapeHtml(state.comments[i])}</textarea></label>` : ''}</div>`).join('')}</div>`; }
function renderResult() { const r = result(); byId('resultBox').innerHTML = `<span class="status-pill ${r.accepted?'ok':'bad'}">${r.accepted?t('accept'):t('reject')}</span><dl><div><dt>${t('passed')}</dt><dd>${r.passed}/${r.total} (${r.required}+)</dd></div></dl>`; }
function render(){ renderChrome(); document.title=t('title'); byId('pageTitle').textContent=t('title'); byId('pageLead').textContent=t('lead'); byId('paramsTitle').textContent=t('params'); byId('wordLabel').textContent=t('word'); byId('posLabel').textContent=t('pos'); byId('meaningLabel').textContent=t('meaning'); byId('argumentsLabel').textContent=t('arguments'); byId('checkBtn').textContent=t('check'); byId('translationsTitle').textContent=t('translations'); byId('criteriaTitle').textContent=t('criteria'); byId('decisionTitle').textContent=t('decision'); byId('jsonBtn').textContent=t('json'); byId('resetBtn').title=t('reset'); byId('resetBtn').setAttribute('aria-label', t('reset')); byId('posInput').innerHTML=`<option value="preposition">${t('preposition')}</option><option value="conjunction">${t('conjunction')}</option><option value="particle">${t('particle')}</option><option value="adverb">${t('adverb')}</option>`; byId('posInput').value=state.part_of_speech; byId('translationsBox').innerHTML=renderTranslations(state.translations); byId('criteriaBox').innerHTML=renderCriteria(); renderResult(); updateResetButtonVisibility(); }


const jsonFilename = 'grammar-short-word-card.json';
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
  document.addEventListener('interal:languagechange', () => { readState(); render(); });
  byId('resetBtn')?.addEventListener('click', resetState);
  byId('checkBtn')?.addEventListener('click', () => { readState(); renderResult(); updateResetButtonVisibility(); });
  byId('jsonBtn')?.addEventListener('click', generateJson);
  byId('app')?.addEventListener('input', updateResetButtonVisibility);
  byId('app')?.addEventListener('change', updateResetButtonVisibility);
}
bindJsonModal();
render();
updateResetButtonVisibility();
