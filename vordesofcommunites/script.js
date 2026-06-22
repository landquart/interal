
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
  ru: { title:'Vordes of communités', lead:'', params:'Параметры слова', word:'Слово в Интерaле', pos:'Часть речи', domain:'Область / сообщество', translations:'Переводы', criteria:'Критерии', result:'Итог', card:'JSON-карточка', adverb:'наречие', noun:'существительное', adjective:'прилагательное', expression:'выражение', check:'Проверить', json:'Сформировать JSON-карточку', copy:'Скопировать', download:'Скачать', passed:'Пройдено', decision:'Решение', accept:'ПРИНЯТО', reject:'НЕ ПРИНЯТО', table:{language:'Язык', translation:'Перевод'}, answer:'Ответ', passes:'Проходит', answerYes:'да', answerPartially:'частично', answerNo:'нет' },
  en: { title:'Vordes of communités', lead:'', params:'Word parameters', word:'Interal word', pos:'Part of speech', domain:'Domain / community', translations:'Translations', criteria:'Criteria', result:'Decision', card:'JSON card', adverb:'adverb', noun:'noun', adjective:'adjective', expression:'expression', check:'Check', json:'Generate JSON card', copy:'Copy', download:'Download', passed:'Passed', decision:'Decision', accept:'ACCEPTED', reject:'NOT ACCEPTED', table:{language:'Language', translation:'Translation'}, answer:'Answer', passes:'Passes', answerYes:'yes', answerPartially:'partially', answerNo:'no' }
};
let state = {
  word: '',
  part_of_speech: 'adverb',
  domain: '',
  translations: { en:'', de:'', fr:'', es:'', it:'', ru:'' },
  criteria: [false, false, false],
  answers: ['', '', '']
};
function readState() { state.word=byId('wordInput')?.value.trim()||''; state.part_of_speech=byId('posInput')?.value||'adverb'; state.domain=byId('domainInput')?.value.trim()||''; for(const lang of LANGUAGES) state.translations[lang.code]=byId(`tr_${lang.code}`)?.value.trim()||''; const questions = QUESTIONS[currentLang()]; state.criteria = questions.map((_,i)=>Boolean(byId(`crit_${i}`)?.checked)); state.answers = questions.map((_,i)=>byId(`ans_${i}`)?.value||'yes'); }
function result(){ const n=state.criteria.filter(Boolean).length; return { passed:n, total:3, accepted:n===3 }; }
function makeCard(){ const r=result(); return { id:createId('vc'), version:'1.0', card_type:'vord_card', vord_type:'community_word', status:'draft', interal:{word:state.word, part_of_speech:state.part_of_speech}, translations: LANGUAGES.map(lang=>({language:lang.code, word:state.translations[lang.code]||''})), domain:state.domain, criteria: QUESTIONS[currentLang()].map((q,i)=>({id:`question_${i+1}`, question:q, answer:state.answers[i]||'yes', passed:Boolean(state.criteria[i])})), decision:{accepted:r.accepted} }; }
function generateJson(){ openJsonModal(); }
function renderCriteria(){ const questions = QUESTIONS[currentLang()]; return `<div class="criteria-list">${questions.map((q,i)=>`<div class="criterion"><p>${escapeHtml(q)}</p><select class="interal-select" id="ans_${i}"><option value="yes">${t('answerYes')}</option><option value="partially">${t('answerPartially')}</option><option value="no">${t('answerNo')}</option></select><input id="crit_${i}" type="checkbox" ${state.criteria[i]?'checked':''}></div>`).join('')}</div>`; }
function render(){ renderChrome(); document.title=t('title'); byId('pageTitle').textContent=t('title'); byId('pageLead').textContent=t('lead'); const r=result(); byId('app').innerHTML=`<section class="card vord-panel"><h2>${t('params')}</h2><div class="field"><label>${t('word')}</label><input class="interal-input" id="wordInput" value="${escapeHtml(state.word)}"></div><div class="field"><label>${t('pos')}</label><select class="interal-select" id="posInput"><option value="adverb">${t('adverb')}</option><option value="noun">${t('noun')}</option><option value="adjective">${t('adjective')}</option><option value="expression">${t('expression')}</option></select></div><div class="field"><label>${t('domain')}</label><input class="interal-input" id="domainInput" value="${escapeHtml(state.domain)}"></div><div class="actions"><button class="interal-btn interal-btn--primary" onclick="readState();render()">${t('check')}</button></div></section><section class="card vord-panel"><h2>${t('translations')}</h2>${renderTranslations(state.translations)}</section><section class="card vord-panel"><h2>${t('criteria')}</h2>${renderCriteria()}</section><section class="card vord-panel decision-summary"><h2>${t('decision')}</h2><span class="status-pill ${r.accepted?'ok':'bad'}">${r.accepted?t('accept'):t('reject')}</span><dl><div><dt>${t('passed')}</dt><dd>${r.passed}/${r.total}</dd></div></dl></section><div class="actions json-card-bottom-actions"><button class="interal-btn interal-btn--secondary" onclick="generateJson()">${t('json')}</button></div>`; byId('posInput').value=state.part_of_speech; state.answers.forEach((ans,i)=>{ if(byId(`ans_${i}`)) byId(`ans_${i}`).value=ans; }); }

const jsonFilename = 'community-word-card.json';
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
