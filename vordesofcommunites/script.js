
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
      body: JSON.stringify({ section: 'vordesofcommunites', title, category: card?.vord_type || 'community_word', payload: card })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP ${response.status}`);
    return data.card?.payload || { ...card, id: data.id, discussionId: data.discussionId || `card-${data.id}` };
  } catch (error) {
    if (!isDatabaseLimitError(error)) throw error;
    console.warn('Supabase insert failed; using fallback sequential card id');
    return createFallbackCard(card, 'vordesofcommunites');
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
  ru: { title:'Vordes of communités', lead:'', params:'Параметры слова', word:'Слово в Интерaле', pos:'Часть речи', domain:'Область / сообщество', translations:'Переводы', criteria:'Критерии', result:'Итог', card:'JSON-карточка', adverb:'наречие', noun:'существительное', adjective:'прилагательное', expression:'выражение', check:'Проверить', json:'Сформировать JSON-карточку', copy:'Скопировать', download:'Скачать', passed:'Пройдено', decision:'Решение', accept:'ПРИНЯТО', reject:'НЕ ПРИНЯТО', table:{language:'Язык', translation:'Перевод'}, answer:'Ответ', passes:'Проходит', answerYes:'да', answerPartially:'частично', answerNo:'нет', reset:'Сбросить' },
  en: { title:'Vordes of communités', lead:'', params:'Word parameters', word:'Interal word', pos:'Part of speech', domain:'Domain / community', translations:'Translations', criteria:'Criteria', result:'Decision', card:'JSON card', adverb:'adverb', noun:'noun', adjective:'adjective', expression:'expression', check:'Check', json:'Generate JSON card', copy:'Copy', download:'Download', passed:'Passed', decision:'Decision', accept:'ACCEPTED', reject:'NOT ACCEPTED', table:{language:'Language', translation:'Translation'}, answer:'Answer', passes:'Passes', answerYes:'yes', answerPartially:'partially', answerNo:'no', reset:'Reset' }
};
function getDefaultState() {
  return {
    word: '',
    part_of_speech: 'adverb',
    domain: '',
    translations: { en:'', de:'', fr:'', es:'', it:'', ru:'' },
    criteria: [false, false, false],
    answers: ['', '', ''],
    checked: false
  };
}
let state = getDefaultState();
function readState() { state.word=byId('wordInput')?.value.trim()||''; state.part_of_speech=byId('posInput')?.value||'adverb'; state.domain=byId('domainInput')?.value.trim()||''; for(const lang of LANGUAGES) state.translations[lang.code]=byId(`tr_${lang.code}`)?.value.trim()||''; const questions = QUESTIONS[currentLang()]; state.criteria = questions.map((_,i)=>Boolean(byId(`crit_${i}`)?.checked)); state.answers = questions.map((_,i)=>byId(`ans_${i}`)?.value||'yes'); }


function hasUserInputForReset() {
  const hasText = ['wordInput', 'domainInput', ...LANGUAGES.map(lang => `tr_${lang.code}`)].some(id => byId(id)?.value.trim());
  const hasCriteria = QUESTIONS[currentLang()].some((_, i) => Boolean(byId(`crit_${i}`)?.checked) || Boolean(byId(`ans_${i}`)?.value && byId(`ans_${i}`)?.value !== 'yes'));
  return hasText || hasCriteria || (byId('posInput')?.value || 'adverb') !== 'adverb';
}
function updateResetButtonVisibility() { const resetBtn = byId('resetBtn'); if (resetBtn) resetBtn.classList.toggle('is-hidden', !hasUserInputForReset()); }
async function resetState() {
  await window.InteralUI.resetPageState({
    message: t('reset')
  });
}

function result(){ const n=state.criteria.filter(Boolean).length; return { passed:n, total:3, accepted:n===3 }; }
function makeCardDraft(){ const r=result(); return { version:'1.0', card_type:'vord_card', vord_type:'community_word', status:'draft', interal:{word:state.word, part_of_speech:state.part_of_speech}, translations: LANGUAGES.map(lang=>({language:lang.code, word:state.translations[lang.code]||''})), domain:state.domain, criteria: QUESTIONS[currentLang()].map((q,i)=>({id:`question_${i+1}`, question:q, answer:state.answers[i]||'yes', passed:Boolean(state.criteria[i])})), decision:{accepted:r.accepted} }; }
async function makeCard(){ return createCardOnServer(makeCardDraft()); }
function generateJson(){ openJsonModal(); }
function renderCriteria(){ const questions = QUESTIONS[currentLang()]; return `<div class="criteria-list">${questions.map((q,i)=>`<div class="criterion"><p>${escapeHtml(q)}</p><select class="interal-select" id="ans_${i}"><option value="yes">${t('answerYes')}</option><option value="partially">${t('answerPartially')}</option><option value="no">${t('answerNo')}</option></select><input id="crit_${i}" type="checkbox" ${state.criteria[i]?'checked':''}></div>`).join('')}</div>`; }
function renderResult() { const r = result(); byId('resultBox').innerHTML = `<span class="status-pill ${r.accepted?'ok':'bad'}">${r.accepted?t('accept'):t('reject')}</span><dl><div><dt>${t('passed')}</dt><dd>${r.passed}/${r.total}</dd></div></dl>`; }
function updateCheckedVisibility() { const checked = Boolean(state.checked); const accepted = checked && result().accepted; ['evidenceSection', 'criteriaSection', 'resultSection'].forEach(id => { const element = byId(id); if (element) element.hidden = !checked; }); const jsonActions = byId('jsonActions'); if (jsonActions) jsonActions.hidden = !accepted; const jsonBtn = byId('jsonBtn'); if (jsonBtn) { jsonBtn.hidden = !accepted; jsonBtn.disabled = !accepted; } }
function render(){ renderChrome(); document.title=t('title'); byId('pageTitle').textContent=t('title'); byId('pageLead').textContent=t('lead'); byId('paramsTitle').textContent=t('params'); byId('wordLabel').textContent=t('word'); byId('posLabel').textContent=t('pos'); byId('domainLabel').textContent=t('domain'); byId('checkBtn').textContent=t('check'); byId('translationsTitle').textContent=t('translations'); byId('criteriaTitle').textContent=t('criteria'); byId('decisionTitle').textContent=t('decision'); byId('jsonBtn').textContent=t('json'); byId('resetBtn').title=t('reset'); byId('resetBtn').setAttribute('aria-label', t('reset')); byId('posInput').innerHTML=`<option value="adverb">${t('adverb')}</option><option value="noun">${t('noun')}</option><option value="adjective">${t('adjective')}</option><option value="expression">${t('expression')}</option>`; byId('posInput').value=state.part_of_speech; byId('translationsBox').innerHTML=renderTranslations(state.translations); byId('criteriaBox').innerHTML=renderCriteria(); state.answers.forEach((ans,i)=>{ if(byId(`ans_${i}`)) byId(`ans_${i}`).value=ans; }); renderResult(); updateCheckedVisibility(); updateResetButtonVisibility(); }

const jsonFilename = 'community-word-card.json';
function currentJsonText() {
  const existing = byId('jsonOutput')?.value;
  return existing || '';
}
async function openJsonModal() {
  if (typeof readState === 'function') readState();
  if (typeof readEvidence === 'function') readEvidence();
  const output = byId('jsonOutput');
  if (output) output.value = JSON.stringify(await makeCard(), null, 2);
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
  byId('checkBtn')?.addEventListener('click', () => { readState(); state.checked = true; renderResult(); updateCheckedVisibility(); updateResetButtonVisibility(); });
  byId('jsonBtn')?.addEventListener('click', generateJson);
  byId('app')?.addEventListener('input', () => { updateResetButtonVisibility(); if (state.checked) { readState(); renderResult(); updateCheckedVisibility(); } });
  byId('app')?.addEventListener('change', () => { updateResetButtonVisibility(); if (state.checked) { readState(); renderResult(); updateCheckedVisibility(); } });
}
bindJsonModal();
render();
updateResetButtonVisibility();
