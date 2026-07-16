
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
async function createCardOnServer(card) {
  if (!window.InteralJsonCards) throw new Error(t('jsonModuleUnavailable'));
  return window.InteralJsonCards.createCardOnServer(card, { section: 'vordesofcommunites', title: card?.interal?.word || card?.title, category: card?.vord_type || 'vc', endpoint: CARDS_API_ENDPOINT });
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

const QUESTIONS = {
  ru: [
    'Слово принадлежит конкретной профессиональной, научной, культурной, субкультурной, юридической, технической или социальной области?',
    'Эта форма используется международно внутри этой области или сообщества?',
    'Потеряется ли узнаваемость, точность или связь с областью, если заменить форму обычной адаптированной формой?'
  ],
  en: [
    'Does the word belong to a specific professional, scientific, cultural, subcultural, legal, technical, or social domain?',
    'Is this form used internationally within that domain or community?',
    'Would recognizability, precision, or connection to the domain be lost if the form were replaced with a regular adapted form?'
  ]
};
const I18N = {
  ru: { title:'Vordes of communités', lead:'', params:'Параметры слова', word:'Слово в Интерaле', pos:'Часть речи', domain:'Область / сообщество', translations:'Переводы', criteria:'Критерии', result:'Итог', card:'JSON-карточка', adverb:'наречие', noun:'существительное', adjective:'прилагательное', expression:'выражение', check:'Проверить', json:'Сформировать JSON-карточку', copy:'Скопировать', download:'Скачать', passed:'Пройдено', decision:'Решение', accept:'ПРИНЯТО', reject:'НЕ ПРИНЯТО', table:{language:'Язык', translation:'Перевод'}, answer:'Ответ', passes:'Проходит', criterion:'Критерий', passedOne:'пройден', failedOne:'не пройден', formRecommendation:'Рекомендация формы', keepUnchanged:'Сохранить без изменений', lightAdaptation:'Лёгкая адаптация', notCommunityWord:'Не относится к словам сообществ', final:'Итог', answerYes:'да', answerPartially:'частично', answerNo:'нет', reset:'Сбросить', incompleteMode:'Неполный режим', validationRequired:'Заполните слово, область/сообщество, часть речи и переводы либо включите неполный режим.', qwenError:'Автоматическая проверка недоступна. Используйте ручной режим.', jsonModuleUnavailable:'Модуль создания JSON-карточек не загружен. Перезагрузите страницу.' },
  en: { title:'Vordes of communités', lead:'', params:'Word parameters', word:'Interal word', pos:'Part of speech', domain:'Domain / community', translations:'Translations', criteria:'Criteria', result:'Decision', card:'JSON card', adverb:'adverb', noun:'noun', adjective:'adjective', expression:'expression', check:'Check', json:'Generate JSON card', copy:'Copy', download:'Download', passed:'Passed', decision:'Decision', accept:'ACCEPTED', reject:'NOT ACCEPTED', table:{language:'Language', translation:'Translation'}, answer:'Answer', passes:'Passes', criterion:'Criterion', passedOne:'passed', failedOne:'not passed', formRecommendation:'Form recommendation', keepUnchanged:'Keep unchanged', lightAdaptation:'Light adaptation', notCommunityWord:'Not a community word', final:'Result', answerYes:'yes', answerPartially:'partially', answerNo:'no', reset:'Reset', incompleteMode:'Incomplete mode', validationRequired:'Fill word, domain/community, part of speech and translations or enable incomplete mode.', qwenError:'Automatic check is unavailable. Use manual mode.', jsonModuleUnavailable:'The JSON card module is unavailable. Reload the page.' }
};
function getDefaultState() {
  return {
    word: '',
    part_of_speech: 'adverb',
    domain: '',
    translations: { en:'', de:'', fr:'', es:'', it:'', ru:'' },
    criteria: [false, false, false],
    answers: ['', '', ''],
    checked: false, incompleteMode: false, qwenError: ''
  };
}
function setButtonStatus(selector, text, disabled = true, options = {}) { return window.InteralButtonStatus?.setButtonStatus(selector, text, disabled, options) ?? false; }
let state = getDefaultState();
function readState() { state.word=byId('wordInput')?.value.trim()||''; state.part_of_speech=byId('posInput')?.value||'adverb'; state.domain=byId('domainInput')?.value.trim()||''; for(const lang of LANGUAGES) state.translations[lang.code]=byId(`tr_${lang.code}`)?.value.trim()||''; const questions = QUESTIONS[currentLang()]; state.answers = questions.map((_,i)=>byId(`ans_${i}`)?.value||'yes'); state.criteria = state.answers.map((answer,i)=> i === 0 ? answer === 'yes' : i === 1 ? answer === 'yes' : answer === 'yes' || answer === 'partially'); state.incompleteMode=Boolean(byId('incompleteMode')?.checked); }


function hasUserInputForReset() {
  const hasText = ['wordInput', 'domainInput', ...LANGUAGES.map(lang => `tr_${lang.code}`)].some(id => byId(id)?.value.trim());
  const hasCriteria = QUESTIONS[currentLang()].some((_, i) => Boolean(byId(`ans_${i}`)?.value && byId(`ans_${i}`)?.value !== 'yes')) || Boolean(byId('incompleteMode')?.checked);
  return hasText || hasCriteria || (byId('posInput')?.value || 'adverb') !== 'adverb';
}
function updateResetButtonVisibility() { const resetBtn = byId('resetBtn'); if (resetBtn) resetBtn.classList.toggle('is-hidden', !hasUserInputForReset()); }
async function resetState() {
  await window.InteralUI.resetPageState({
    message: t('reset')
  });
}

function getFormRecommendation(){ const answer = state.answers[2] || 'yes'; if (answer === 'yes') return 'keep_unchanged'; if (answer === 'partially') return 'light_adaptation'; return 'not_applicable'; }
function recommendationLabel(value){ return value === 'keep_unchanged' ? t('keepUnchanged') : value === 'light_adaptation' ? t('lightAdaptation') : t('notCommunityWord'); }
function result(){ const criteria=[state.answers[0] === 'yes', state.answers[1] === 'yes', state.answers[2] === 'yes' || state.answers[2] === 'partially']; const n=criteria.filter(Boolean).length; return { passed:n, total:3, criteria, formRecommendation:getFormRecommendation(), accepted:criteria[0]&&criteria[1]&&criteria[2] }; }
function validateForm(){ return Boolean(state.word && state.domain && state.part_of_speech && (state.incompleteMode || LANGUAGES.some(lang => state.translations[lang.code]))); }
function makeCardDraft(author = null){ const criteriaIds=['domain_specificity','international_use_in_community','recognizability_loss_after_adaptation']; const card = { version:'1.0', card_type:'vord_card', vord_type:'vc', interal:{word:state.word, part_of_speech:state.part_of_speech}, domain:state.domain, translations:Object.fromEntries(LANGUAGES.map(lang=>[lang.code,state.translations[lang.code]||'']).filter(([,word])=>word)), procedure:'community_word', criteria:Object.fromEntries(criteriaIds.map((id,i)=>[id,state.answers[i]||'no'])), form_recommendation:getFormRecommendation() }; if (author) card.author = author; return card; }
function makeCard(author){ return makeCardDraft(author); }
function generateJson(){ openJsonModal(); }
function renderCriteria(){ const questions = QUESTIONS[currentLang()]; return `<div class="criteria-list">${questions.map((q,i)=>`<div class="criterion"><p>${escapeHtml(q)}</p><select class="interal-select js-custom-select" id="ans_${i}"><option value="yes">${t('answerYes')}</option>${i===2?`<option value="partially">${t('answerPartially')}</option>`:''}<option value="no">${t('answerNo')}</option></select></div>`).join('')}</div>`; }

async function autoCheckWithQwen() {
  state.qwenError='';
  try {
    const response = await fetch('/api/qwen-analyze', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ task:'community_word_check', interfaceLanguage: currentLang(), payload:{ candidate:state.word, domain:state.domain, partOfSpeech:state.part_of_speech, translations:state.translations, questions:QUESTIONS[currentLang()] } }) });
    const data = await response.json().catch(()=>null);
    const answers = data?.analysis?.answers;
    if (response.ok && Array.isArray(answers)) {
      answers.slice(0,3).forEach((entry,i)=>{ if (['yes','partially','no'].includes(entry.answer)) state.answers[i]=entry.answer; });
      state.criteria = state.answers.map((answer,i)=> i === 0 ? answer === 'yes' : i === 1 ? answer === 'yes' : answer === 'yes' || answer === 'partially');
      return true;
    }
    throw new Error(data?.error || `HTTP ${response.status}`);
  } catch (error) { state.qwenError=t('qwenError'); console.warn('community_word_check unavailable; manual mode remains active', error); return false; }
}

function renderResult() { const r = result(); byId('resultBox').innerHTML = `<span class="status-pill ${r.accepted?'ok':'bad'}">${r.accepted?t('accept'):t('reject')}</span><dl>${r.criteria.map((passed,i)=>`<div><dt>${t('criterion')} ${i+1}</dt><dd>${passed?t('passedOne'):t('failedOne')}</dd></div>`).join('')}<div><dt>${t('formRecommendation')}</dt><dd>${recommendationLabel(r.formRecommendation)}</dd></div><div><dt>${t('final')}</dt><dd>${r.accepted?t('accept'):t('reject')}</dd></div></dl>`; }
function updateCheckedVisibility() { const checked = Boolean(state.checked); const accepted = checked && result().accepted; ['evidenceSection', 'criteriaSection', 'resultSection'].forEach(id => { const element = byId(id); if (element) element.hidden = !checked; }); const jsonActions = byId('jsonActions'); if (jsonActions) jsonActions.hidden = !accepted; const jsonBtn = byId('jsonBtn'); if (jsonBtn) { jsonBtn.hidden = !accepted; jsonBtn.disabled = !accepted; } }
function render(){ renderChrome(); document.title=t('title'); byId('pageTitle').textContent=t('title'); byId('pageLead').textContent=t('lead'); byId('paramsTitle').textContent=t('params'); byId('wordLabel').textContent=t('word'); byId('posLabel').textContent=t('pos'); byId('domainLabel').textContent=t('domain'); setButtonStatus('#checkBtn', t('check'), false); byId('translationsTitle').textContent=t('translations'); byId('criteriaTitle').textContent=t('criteria'); byId('decisionTitle').textContent=t('decision'); byId('jsonBtn').textContent=t('json'); byId('resetBtn').title=t('reset'); byId('resetBtn').setAttribute('aria-label', t('reset')); byId('posInput').innerHTML=`<option value="adverb">${t('adverb')}</option><option value="noun">${t('noun')}</option><option value="adjective">${t('adjective')}</option><option value="expression">${t('expression')}</option>`; byId('posInput').value=state.part_of_speech; byId('posInput')._customSelectRefresh?.(); byId('translationsBox').innerHTML=renderTranslations(state.translations); byId('criteriaBox').innerHTML=`<label class="checkbox-line"><input type="checkbox" id="incompleteMode" ${state.incompleteMode?'checked':''}> ${t('incompleteMode')}</label>`+renderCriteria(); window.initCustomSelects?.(byId('criteriaBox')); state.answers.forEach((ans,i)=>{ if(byId(`ans_${i}`)) byId(`ans_${i}`).value=ans; }); renderResult(); if(state.qwenError) byId('resultBox').insertAdjacentHTML('beforeend', `<p class="muted">${escapeHtml(state.qwenError)}</p>`); updateCheckedVisibility(); updateResetButtonVisibility(); }


function collectCommunityPageState() { readState(); const r = result(); return { version: 2, page: location.pathname, fields: { word: state.word, partOfSpeech: state.part_of_speech, domain: state.domain, translations: { ...state.translations }, answers: [...state.answers], incompleteMode: Boolean(state.incompleteMode) }, result: state.checked ? { criteria: [...r.criteria], formRecommendation: r.formRecommendation, accepted: r.accepted } : null, flags: { checked: Boolean(state.checked), accepted: Boolean(state.checked && r.accepted) }, ui: { activeTab: null, selectedLanguage: null }, savedAt: new Date().toISOString() }; }
function importCommunityPageState(saved = {}) { const fields = saved.version === 2 && saved.fields ? saved.fields : saved; state = getDefaultState(); state.word = fields.word || ''; state.part_of_speech = fields.partOfSpeech || fields.part_of_speech || 'adverb'; state.domain = fields.domain || ''; state.translations = { ...state.translations, ...(fields.translations || {}) }; state.answers = Array.isArray(fields.answers) ? fields.answers.slice(0,3) : state.answers; state.incompleteMode = Boolean(fields.incompleteMode); state.checked = Boolean(saved.flags?.checked || saved.checked || saved.result); state.criteria = state.answers.map((answer,i)=> i === 0 ? answer === 'yes' : i === 1 ? answer === 'yes' : answer === 'yes' || answer === 'partially'); render(); return true; }
window.InteralPageStateExport = collectCommunityPageState;
window.InteralPageStateImport = importCommunityPageState;

const jsonFilename = 'community-word-card.json';
function getJsonCardTexts() {
  return { close: currentLang() === 'en' ? 'Close JSON card' : 'Закрыть JSON-карточку', title: t('card'), useAuthor: currentLang() === 'en' ? 'Add authorship' : 'Указать авторство', authorName: currentLang() === 'en' ? 'Name or nickname' : 'Имя или ник', contactType: currentLang() === 'en' ? 'Contact type' : 'Тип контакта', contact: currentLang() === 'en' ? 'Contact' : 'Контакт', rememberAuthor: currentLang() === 'en' ? 'Remember for future cards' : 'Запомнить для следующих карточек', clearSavedAuthor: currentLang() === 'en' ? 'Delete saved data' : 'Удалить сохранённые данные', generate: currentLang() === 'en' ? 'Generate card' : 'Сгенерировать карточку', generating: currentLang() === 'en' ? 'Generating...' : 'Генерация...', output: currentLang() === 'en' ? 'Generated JSON' : 'Готовый JSON', copy: currentLang() === 'en' ? 'Copy JSON card' : 'Скопировать JSON-карточку', copied: currentLang() === 'en' ? 'JSON card copied' : 'JSON-карточка скопирована', copiedTitle: currentLang() === 'en' ? 'Copied' : 'Скопировано', download: currentLang() === 'en' ? 'Download JSON card' : 'Скачать JSON-карточку', empty: currentLang() === 'en' ? 'Generate the JSON card first.' : 'Сначала сгенерируйте JSON-карточку.', unavailable: currentLang() === 'en' ? 'The JSON card is available only after a successful check.' : 'JSON-карточка доступна только после успешной проверки.' };
}
function bindJsonModal() {
  if (!window.InteralJsonCardModal) throw new Error(t('jsonModuleUnavailable')); if (!window.InteralJsonCards) throw new Error(t('jsonModuleUnavailable')); window.InteralJsonCardModal.init({
    getLanguage: currentLang,
    getTexts: getJsonCardTexts,
    buildCard: async ({ author, onProgress } = {}) => { onProgress?.(currentLang() === 'en' ? 'Reading data...' : 'Чтение данных...'); readState(); onProgress?.(currentLang() === 'en' ? 'Saving card...' : 'Сохранение карточки...'); return makeCard(author); },
    createCardOnServer: (card, ctx) => window.InteralJsonCards.createCardOnServer(card, { section: 'vordesofcommunites', title: card?.interal?.word, category: 'vc', onProgress: ctx?.onProgress }),
    formatCard: (card) => JSON.stringify(card, null, 2),
    getFilename: () => jsonFilename
  });
  document.addEventListener('interal:languagechange', () => { document.documentElement.lang = currentLang(); readState(); render(); });
  byId('resetBtn')?.addEventListener('click', resetState);
  byId('checkBtn')?.addEventListener('click', async () => { readState(); if(!validateForm()){ alert(t('validationRequired')); render(); return; } setButtonStatus('#checkBtn', currentLang() === 'en' ? 'Calculating...' : 'Расчёт...', true, { loading: true }); try { const ok=await autoCheckWithQwen(); if(ok) state.checked = true; render(); updateCheckedVisibility(); updateResetButtonVisibility(); window.InteralFormDraft?.save?.(); } finally { setButtonStatus('#checkBtn', t('check'), false, { loading: false }); } });
  byId('app')?.addEventListener('input', () => { updateResetButtonVisibility(); if (state.checked && !window.InteralFormDraft?.isRestoring?.()) { state.checked = false; readState(); render(); window.InteralFormDraft?.save?.(); return; } if (state.checked) { readState(); renderResult(); if(state.qwenError) byId('resultBox').insertAdjacentHTML('beforeend', `<p class="muted">${escapeHtml(state.qwenError)}</p>`); updateCheckedVisibility(); window.InteralFormDraft?.save?.(); } });
  byId('app')?.addEventListener('change', () => { updateResetButtonVisibility(); if (state.checked && !window.InteralFormDraft?.isRestoring?.()) { state.checked = false; readState(); render(); window.InteralFormDraft?.save?.(); return; } if (state.checked) { readState(); renderResult(); if(state.qwenError) byId('resultBox').insertAdjacentHTML('beforeend', `<p class="muted">${escapeHtml(state.qwenError)}</p>`); updateCheckedVisibility(); window.InteralFormDraft?.save?.(); } });
}
try { bindJsonModal(); } catch (error) { console.error('Could not initialize JSON card module:', error); alert(currentLang() === 'en' ? 'Could not load the JSON card module. Reload the page.' : 'Не удалось загрузить модуль JSON-карточек. Обновите страницу.'); }
render();
updateResetButtonVisibility();
