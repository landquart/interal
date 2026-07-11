
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
      body: JSON.stringify({ section: 'grammaticebrevivordes', title, category: card?.vord_type || 'gv', payload: card })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP ${response.status}`);
    return data.card?.payload || { ...card, id: data.id, discussionId: data.discussionId || `card-${data.id}` };
  } catch (error) {
    if (!isDatabaseLimitError(error)) throw error;
    console.warn('Supabase insert failed; using fallback sequential card id');
    return createFallbackCard(card, 'grammaticebrevivordes');
  }
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
  ru: { title:'Grammatic e brevi vordes', lead:'', params:'Параметры слова', word:'Слово в Интерaле', pos:'Часть речи', meaning:'Значение', translations:'Переводы', criteria:'Критерии', arguments:'Обоснование', result:'Итог', card:'JSON-карточка', preposition:'предлог', conjunction:'союз', particle:'частица', adverb:'наречие', check:'Проверить', json:'Сформировать JSON-карточку', copy:'Скопировать', download:'Скачать', passed:'Пройдено', decision:'Решение', accept:'ПРИНЯТО', reject:'НЕ ПРИНЯТО', table:{language:'Язык', translation:'Перевод'}, comment:'Комментарий', criterionDecision:'Оценка', criterionPass:'Соответствует', criterionFail:'Не соответствует', requiredForAcceptance:'Минимум для принятия', recogNote:'Распознаваемость/когнативность может отсутствовать, если выполнены остальные три критерия.', reset:'Сбросить', validationRequired:'Заполните слово, значение и часть речи.' },
  en: { title:'Grammatic e brevi vordes', lead:'', params:'Word parameters', word:'Interal word', pos:'Part of speech', meaning:'Meaning', translations:'Translations', criteria:'Criteria', arguments:'Justification', result:'Decision', card:'JSON card', preposition:'preposition', conjunction:'conjunction', particle:'particle', adverb:'adverb', check:'Check', json:'Generate JSON card', copy:'Copy', download:'Download', passed:'Passed', decision:'Decision', accept:'ACCEPTED', reject:'NOT ACCEPTED', table:{language:'Language', translation:'Translation'}, comment:'Comment', criterionDecision:'Evaluation', criterionPass:'Passes', criterionFail:'Does not pass', requiredForAcceptance:'Required for acceptance', recogNote:'Recognizability/cognateness may be absent if the other three criteria are satisfied.', reset:'Reset', validationRequired:'Fill word, meaning and part of speech.' }
};
const CRITERIA = [{ id: 'brevity', ru: 'Краткость', en: 'Brevity' }, { id: 'pronounceability', ru: 'Легкопроизносимость', en: 'Pronounceability' }, { id: 'recognizability', ru: 'Распознаваемость / когнативность', en: 'Recognizability / cognateness' }, { id: 'no_conflict', ru: 'Отсутствие конфликта', en: 'Absence of conflict' }];
const CRITERIA_NAMES = CRITERIA.map(item => item.ru);
const REQUIRED_CRITERIA_COUNT = 3;
function getDefaultState() {
  return {
    word: '',
    part_of_speech: 'preposition',
    meaning: '',
    translations: { en:'', de:'', fr:'', es:'', it:'', ru:'' },
    arguments: '',
    criteria: [false, false, false, false],
    comments: ['', '', '', ''],
    checked: false, aiChecked: false, manuallyEdited: false, finalized: false
  };
}
function setButtonStatus(selector, text, disabled = true, options = {}) { window.InteralButtonStatus?.setButtonStatus(selector, text, disabled, options); }
let state = getDefaultState();
function readState(){ state.word=byId('wordInput')?.value.trim()||''; state.part_of_speech=byId('posInput')?.value||'preposition'; state.meaning=byId('meaningInput')?.value.trim()||''; state.arguments=byId('argumentsInput')?.value.trim()||''; for(const lang of LANGUAGES) state.translations[lang.code]=byId(`tr_${lang.code}`)?.value.trim()||''; state.criteria=CRITERIA.map((_,i)=>Boolean(byId(`crit_${i}`)?.checked)); state.comments=CRITERIA.map((_,i)=>(byId(`comment_${i}`)?.value.trim()||'')); }


function hasUserInputForReset() {
  const hasText = ['wordInput', 'meaningInput', 'argumentsInput', 'comment_2', ...LANGUAGES.map(lang => `tr_${lang.code}`)].some(id => byId(id)?.value.trim());
  const hasCriteria = CRITERIA_NAMES.some((_, i) => Boolean(byId(`crit_${i}`)?.checked));
  return hasText || hasCriteria || (byId('posInput')?.value || 'preposition') !== 'preposition';
}
function clearDomFields() {
  byId('wordInput').value = ''; byId('posInput').value = 'preposition'; byId('meaningInput').value = ''; byId('argumentsInput').value = '';
  LANGUAGES.forEach(lang => { const input = byId(`tr_${lang.code}`); if (input) input.value = ''; });
  CRITERIA_NAMES.forEach((_, i) => { const checkbox = byId(`crit_${i}`); const comment = byId(`comment_${i}`); if (checkbox) checkbox.checked = false; if (comment) comment.value = ''; });
  const output = byId('jsonCardOutput'); if (output) output.value = '';
}
function updateResetButtonVisibility() { const resetBtn = byId('resetBtn'); if (resetBtn) resetBtn.classList.toggle('is-hidden', !hasUserInputForReset()); }
async function resetState() {
  await window.InteralUI.resetPageState({
    message: t('reset')
  });
}

function countPassedCriteria() { return state.criteria.filter(Boolean).length; }
function isGrammarShortWordAccepted() { return countPassedCriteria() >= REQUIRED_CRITERIA_COUNT; }
function validateForm(){ return Boolean(state.word && state.meaning && state.part_of_speech); }
function result(){ const n=countPassedCriteria(); return {passed:n,total:CRITERIA_NAMES.length,required:REQUIRED_CRITERIA_COUNT,accepted:isGrammarShortWordAccepted()}; }
function makeCardDraft(author = null){ const r=result(); const card = { version:'1.0', card_type:'vord_card', vord_type:'gv', procedure:'grammar_short_word', status:'draft', interal:{word:state.word, part_of_speech:state.part_of_speech}, translations:LANGUAGES.map(lang=>({language:lang.code, word:state.translations[lang.code]||''})), function:{meaning:state.meaning}, criteria:CRITERIA.map((criterion,i)=>({id:criterion.id, passed:Boolean(state.criteria[i]), explanation:state.comments[i]||''})), decision:{accepted:r.accepted, required_criteria:r.required, passed_criteria:r.passed, total_criteria:r.total} }; if (author) card.author = author; return card; }
function makeCard(author){ return makeCardDraft(author); }
function generateJson(){ openJsonModal(); }
function renderCriteria(){ return `<div class="criteria-list grammar-criteria-list">${CRITERIA.map((criterion,i)=>`<div class="criterion grammar-criterion"><div class="criterion-head"><strong>${escapeHtml(criterion[currentLang()])}</strong></div><label class="criterion-check"><input id="crit_${i}" type="checkbox" ${state.criteria[i] ? 'checked' : ''}><span>${t('criterionPass')}</span></label><label class="field criterion-comment"><span>${t('comment')}</span><textarea class="interal-textarea" id="comment_${i}">${escapeHtml(state.comments[i])}</textarea></label></div>`).join('')}</div>`; }

async function autoCheckWithQwen() {
  try {
    const response = await fetch('/api/qwen-analyze', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ task:'grammar_short_word_check', interfaceLanguage: currentLang(), payload:{ candidate:state.word, meaning:state.meaning, partOfSpeech:state.part_of_speech, translations:state.translations, criteria:CRITERIA, comment:state.arguments, explanations:state.comments } }) });
    const data = await response.json().catch(()=>null);
    const criteria = data?.analysis?.criteria;
    if (response.ok && criteria && typeof criteria === 'object') {
      CRITERIA.forEach((criterion,i)=>{ const item=criteria[criterion.id]; if (item && typeof item.passed === 'boolean') { state.criteria[i]=item.passed; state.comments[i]=String(item.explanation||state.comments[i]||''); } }); state.aiChecked=true; state.finalized=true;
    }
  } catch (error) { console.warn('grammar_short_word_check unavailable; manual mode remains active', error); }
}

function renderResult() { const r = result(); const checked = Boolean(state.checked); const accepted = checked && r.accepted; byId('resultBox').innerHTML = `<span class="status-pill ${r.accepted?'ok':'bad'}">${r.accepted?t('accept'):t('reject')}</span><dl><div><dt>${t('passed')}</dt><dd>${r.passed} ${currentLang()==='en'?'of':'из'} ${r.total}</dd></div><div><dt>${t('requiredForAcceptance')}</dt><dd>${r.required}</dd></div></dl><p class="muted">${t('recogNote')}</p>`; ['evidenceSection', 'criteriaSection', 'resultSection'].forEach(id => { const element = byId(id); if (element) element.hidden = !checked; }); const jsonBtn = byId('jsonBtn'); if (jsonBtn) { jsonBtn.hidden = !accepted; jsonBtn.disabled = !accepted; } }
function render(){ renderChrome(); document.title=t('title'); byId('pageTitle').textContent=t('title'); byId('pageLead').textContent=t('lead'); byId('paramsTitle').textContent=t('params'); byId('wordLabel').textContent=t('word'); byId('posLabel').textContent=t('pos'); byId('meaningLabel').textContent=t('meaning'); byId('argumentsLabel').textContent=t('arguments'); setButtonStatus('#checkBtn', t('check'), false); byId('translationsTitle').textContent=t('translations'); byId('criteriaTitle').textContent=t('criteria'); byId('decisionTitle').textContent=t('decision'); byId('jsonBtn').textContent=t('json'); byId('resetBtn').title=t('reset'); byId('resetBtn').setAttribute('aria-label', t('reset')); byId('posInput').innerHTML=`<option value="preposition">${t('preposition')}</option><option value="conjunction">${t('conjunction')}</option><option value="particle">${t('particle')}</option><option value="adverb">${t('adverb')}</option>`; byId('posInput').value=state.part_of_speech; byId('posInput')._customSelectRefresh?.(); byId('translationsBox').innerHTML=renderTranslations(state.translations); byId('criteriaBox').innerHTML=renderCriteria(); renderResult(); updateResetButtonVisibility(); }


const jsonFilename = 'grammar-short-word-card.json';
function getJsonCardTexts() {
  return { close: currentLang() === 'en' ? 'Close JSON card' : 'Закрыть JSON-карточку', title: t('card'), useAuthor: currentLang() === 'en' ? 'Add authorship' : 'Указать авторство', authorName: currentLang() === 'en' ? 'Name or nickname' : 'Имя или ник', contactType: currentLang() === 'en' ? 'Contact type' : 'Тип контакта', contact: currentLang() === 'en' ? 'Contact' : 'Контакт', generate: currentLang() === 'en' ? 'Generate card' : 'Сгенерировать карточку', generating: currentLang() === 'en' ? 'Generating...' : 'Генерация...', output: currentLang() === 'en' ? 'Generated JSON' : 'Готовый JSON', copy: currentLang() === 'en' ? 'Copy JSON card' : 'Скопировать JSON-карточку', copied: currentLang() === 'en' ? 'JSON card copied' : 'JSON-карточка скопирована', copiedTitle: currentLang() === 'en' ? 'Copied' : 'Скопировано', download: currentLang() === 'en' ? 'Download JSON card' : 'Скачать JSON-карточку', empty: currentLang() === 'en' ? 'Generate the JSON card first.' : 'Сначала сгенерируйте JSON-карточку.', unavailable: currentLang() === 'en' ? 'The JSON card is available only after a successful check.' : 'JSON-карточка доступна только после успешной проверки.' };
}
function bindJsonModal() {
  window.InteralJsonCardModal?.init({
    getLanguage: currentLang,
    getTexts: getJsonCardTexts,
    buildCard: async ({ author, onProgress } = {}) => { onProgress?.(currentLang() === 'en' ? 'Reading data...' : 'Чтение данных...'); readState(); if (!state.checked || !result().accepted) throw new Error(getJsonCardTexts().unavailable); onProgress?.(currentLang() === 'en' ? 'Saving card...' : 'Сохранение карточки...'); return makeCard(author); },
    createCardOnServer: (card, ctx) => window.InteralJsonCards.createCardOnServer(card, { section: 'grammaticebrevivordes', title: card?.interal?.word, category: 'gv', onProgress: ctx?.onProgress }),
    formatCard: (card) => JSON.stringify(card, null, 2),
    getFilename: () => jsonFilename
  });
  document.addEventListener('interal:languagechange', () => { document.documentElement.lang = currentLang(); readState(); render(); });
  byId('resetBtn')?.addEventListener('click', resetState);
  byId('checkBtn')?.addEventListener('click', async () => { readState(); if(!validateForm()){ alert(t('validationRequired')); return; } await autoCheckWithQwen(); state.checked = true; state.finalized = true; render(); updateResetButtonVisibility(); });
  byId('app')?.addEventListener('input', () => { if(state.checked){ readState(); state.manuallyEdited=true; state.finalized=true; renderResult(); } updateResetButtonVisibility();  });
  byId('app')?.addEventListener('change', () => { if(state.checked){ readState(); state.manuallyEdited=true; state.finalized=true; renderResult(); } updateResetButtonVisibility();  });
}
bindJsonModal();
render();
updateResetButtonVisibility();
