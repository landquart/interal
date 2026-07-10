const API_BASE = location.hostname === 'landquart.github.io' ? 'https://interal.vercel.app' : '';
const CARD_SECTION = 'altervordes';
const CARD_PREFIX = 'al_';
const MODEL_NAME = 'qwen3-235b-a22b-fp8/latest';
const POS_VALUES = ['noun','adjective','verb','adverb','pronoun','numeral','interjection','function_word','other'];
const CONTROL_LANGUAGES = [
  { code: 'en', ru: 'Английский', en: 'English' }, { code: 'de', ru: 'Немецкий', en: 'German' },
  { code: 'fr', ru: 'Французский', en: 'French' }, { code: 'es', ru: 'Испанский', en: 'Spanish' },
  { code: 'it', ru: 'Итальянский', en: 'Italian' }, { code: 'ru', ru: 'Русский', en: 'Russian' },
  { code: 'el', ru: 'Греческий', en: 'Greek' }
];
const AUXILIARY_LANGUAGES = [
  { code: 'pl', ru: 'Польский', en: 'Polish' }, { code: 'sv', ru: 'Шведский', en: 'Swedish' },
  { code: 'ca', ru: 'Каталанский', en: 'Catalan' }, { code: 'oc', ru: 'Окситанский', en: 'Occitan' },
  { code: 'ro', ru: 'Румынский', en: 'Romanian' }
];
const UI_TEXT = {
  ru: {
    pageTitle: 'Alter vordes', paramsTitle: 'Параметры', translationLabel: 'Перевод', candidateLabel: 'Форма в Интерaле', partOfSpeechLabel: 'Часть речи', commentLabel: 'Комментарий (необязательно)', check: 'Проверить', checking: 'Проверка…', loading: 'Qwen анализирует форму и переводит значение на контрольные и вспомогательные языки.', createJson: 'Сформировать JSON-карточку', copyJson: 'Скопировать JSON-карточку', copiedJson: 'JSON-карточка скопирована.', downloadJson: 'Скачать JSON-карточку', generateJson: 'Сгенерировать карточку', outputJson: 'Готовый JSON', useAuthor: 'Указать авторство', authorName: 'Имя или ник', contactType: 'Тип контакта', contact: 'Контакт', resultTitle: 'Решение', controlLanguages: 'Контрольные языки', auxiliaryLanguages: 'Вспомогательные языки', recommendedForm: 'Рекомендуемая форма', analysis: 'Анализ', risks: 'Риски', conclusion: 'Вывод', noRisks: 'Существенные риски не указаны.', eligible: 'Слово соответствует критериям Alter vordes. Можно сформировать JSON-карточку.', rejected: 'Слово не соответствует критериям Alter vordes. JSON-карточку сформировать нельзя.', review: 'Требуется ручная проверка. JSON-карточку пока нельзя сформировать.', required: 'Заполните перевод, форму и часть речи.', invalidPos: 'Выберите корректную часть речи.', apiError: 'Не удалось выполнить анализ.', cardBlocked: 'JSON-карточку можно сформировать только после положительного анализа.', jsonTitle: 'JSON-карточка', closeJson: 'Закрыть JSON-карточку',
    pos: { noun:'Существительное', adjective:'Прилагательное', verb:'Глагол', adverb:'Наречие', pronoun:'Местоимение', numeral:'Числительное', interjection:'Междометие', function_word:'Служебное слово', other:'Другое' },
    labels: { brevity:'Краткость', pronounceability:'Произносимость', conflicts:'Конфликты', neutrality:'Нейтральность', controlAndAuxiliaryEvidence:'Контрольные и вспомогательные языки', partOfSpeechSuitability:'Соответствие части речи', derivationalPotential:'Деривационный потенциал', interalRuleCompatibility:'Правила Интераля' }
  },
  en: {
    pageTitle: 'Alter vordes', paramsTitle: 'Parameters', translationLabel: 'Translation', candidateLabel: 'Interal form', partOfSpeechLabel: 'Part of speech', commentLabel: 'Comment (optional)', check: 'Check', checking: 'Checking…', loading: 'Qwen is analysing the form and translating the meaning into control and auxiliary languages.', createJson: 'Generate JSON card', copyJson: 'Copy JSON card', copiedJson: 'JSON card copied.', downloadJson: 'Download JSON card', generateJson: 'Generate card', outputJson: 'Generated JSON', useAuthor: 'Add authorship', authorName: 'Name or nickname', contactType: 'Contact type', contact: 'Contact', resultTitle: 'Decision', controlLanguages: 'Control languages', auxiliaryLanguages: 'Auxiliary languages', recommendedForm: 'Recommended form', analysis: 'Analysis', risks: 'Risks', conclusion: 'Conclusion', noRisks: 'No significant risks were specified.', eligible: 'The word meets the Alter vordes criteria. A JSON card can be created.', rejected: 'The word does not meet the Alter vordes criteria. A JSON card cannot be created.', review: 'Manual review is required. A JSON card cannot be created yet.', required: 'Fill in translation, form, and part of speech.', invalidPos: 'Select a valid part of speech.', apiError: 'Could not complete the analysis.', cardBlocked: 'A JSON card can be created only after a positive analysis.', jsonTitle: 'JSON card', closeJson: 'Close JSON card',
    pos: { noun:'Noun', adjective:'Adjective', verb:'Verb', adverb:'Adverb', pronoun:'Pronoun', numeral:'Numeral', interjection:'Interjection', function_word:'Function word', other:'Other' },
    labels: { brevity:'Brevity', pronounceability:'Pronounceability', conflicts:'Conflicts', neutrality:'Neutrality', controlAndAuxiliaryEvidence:'Control and auxiliary evidence', partOfSpeechSuitability:'Part-of-speech suitability', derivationalPotential:'Derivational potential', interalRuleCompatibility:'Interal rule compatibility' }
  }
};
let lastAnalysis = null;
let lastCard = null;
let hasSuccessfulCheck = false;
function setButtonStatus(selector, text, disabled = true, options = {}) { window.InteralButtonStatus?.setButtonStatus(selector, text, disabled, options); }
const $ = (id) => document.getElementById(id);
function currentLang() { return localStorage.getItem('interal.lang') === 'en' ? 'en' : 'ru'; }
function lang(){ return currentLang(); }
function t(){ return UI_TEXT[lang()]; }
function escapeHtml(v){ return String(v ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function applyI18n(){ const u=t(); $('pageTitle').textContent=u.pageTitle; $('paramsTitle').textContent=u.paramsTitle; $('translationLabel').textContent=u.translationLabel; $('candidateLabel').textContent=u.candidateLabel; $('posLabel').textContent=u.partOfSpeechLabel; $('commentLabel').textContent=u.commentLabel; setButtonStatus('#checkBtn', u.check, false); $('jsonBtn').textContent=u.createJson; $('decisionTitle').textContent=u.resultTitle; $('jsonCardTitle').textContent=u.jsonTitle; $('useAuthorBlockLabel').textContent=u.useAuthor; $('authorDisplayNameLabel').textContent=u.authorName; $('authorContactTypeLabel').textContent=u.contactType; $('authorContactValueLabel').textContent=u.contact; $('jsonCardOutputLabel').textContent=u.outputJson; $('closeJsonCardBtn').setAttribute('aria-label',u.closeJson); $('copyJsonCardBtn').setAttribute('aria-label',u.copyJson); $('copyJsonCardBtn').setAttribute('title',u.copyJson); $('downloadJsonCardBtn').setAttribute('aria-label',u.downloadJson); $('downloadJsonCardBtn').setAttribute('title',u.downloadJson); $('resetBtn').setAttribute('aria-label', lang()==='ru'?'Сбросить':'Reset'); $('resetBtn').setAttribute('title', lang()==='ru'?'Сбросить':'Reset'); const current=$('posInput').value||'noun'; $('posInput').innerHTML=POS_VALUES.map(v=>`<option value="${v}">${escapeHtml(u.pos[v])}</option>`).join(''); $('posInput').value=POS_VALUES.includes(current)?current:'noun'; window.refreshCustomSelect?.($('posInput')); if(lastAnalysis) renderAnalysis(lastAnalysis); setJsonEnabled(canCreateCard(lastAnalysis)); }
function collectState(){ return { translation:$('translationInput').value.trim(), interfaceLanguage:lang(), partOfSpeech:$('posInput').value, candidate:$('candidateInput').value.trim(), comment:$('commentInput').value.trim(), lastAnalysis }; }
function validateState(s){ if(!s.translation || !s.candidate || !s.partOfSpeech) throw Error(t().required); if(!POS_VALUES.includes(s.partOfSpeech)) throw Error(t().invalidPos); }
function setJsonEnabled(enabled){
  const allowed = enabled === true && hasSuccessfulCheck;
  const jsonActions = $('jsonActions');
  if (jsonActions) jsonActions.hidden = !allowed;
  $('jsonBtn').hidden = !allowed;
  $('jsonBtn').disabled = !allowed;
  const generateBtn = $('generateJsonCardBtn');
  if (generateBtn) {
    generateBtn.hidden = !allowed;
    generateBtn.disabled = !allowed;
  }
}
function showNotice(message, type = 'info') { const box = $('noticeBox'); if (!box) return; box.textContent = message; box.className = `notice-box ${type}`; box.hidden = false; clearTimeout(showNotice._timer); if (type !== 'info') showNotice._timer = setTimeout(() => { box.hidden = true; }, 3200); }
function hideNotice(){ const box=$('noticeBox'); if(box) box.hidden=true; }
function invalidateAnalysis(){
  lastAnalysis = null;
  lastCard = null;
  hasSuccessfulCheck = false;
  setJsonEnabled(false);
  $('resultSection').hidden = true;
  $('resultBox').innerHTML = '';
  if ($('jsonCardOutput')) $('jsonCardOutput').value = '';
}
function hasUserInputForReset() { return Boolean($('translationInput').value.trim() || $('candidateInput').value.trim() || $('commentInput').value.trim() || lastAnalysis || $('jsonCardOutput').value.trim()); }
function updateResetVisibility() { $('resetBtn').classList.toggle('is-hidden', !hasUserInputForReset()); }
async function resetState() {
  const message = lang() === 'ru'
    ? 'Сбросить введённые данные? Это действие нельзя отменить.'
    : 'Reset entered data? This action cannot be undone.';

  if (!window.InteralUI?.resetPageState) {
    showNotice(
      lang() === 'ru'
        ? 'Глобальный сброс недоступен. Перезагрузите страницу.'
        : 'Global reset is unavailable. Reload the page.',
      'error'
    );
    return;
  }

  await window.InteralUI.resetPageState({
    message,
    storageKeys: [
      'altervordes-state-v1',
      'interal_altervordes_state'
    ]
  });
}
async function evaluateAlterWord(){ const state=collectState(); validateState(state); hasSuccessfulCheck = false; setButtonStatus('#checkBtn', t().checking, true); showNotice(t().loading,'info'); setJsonEnabled(false); try { const { lastAnalysis: _omit, ...payload } = state; setButtonStatus('#checkBtn', lang()==='en'?'Qwen: evaluating...':'Qwen: оценка...', true); const res=await fetch(`${API_BASE}/api/qwen-analyze`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task:'altervordes',payload,interfaceLanguage:lang()})}); setButtonStatus('#checkBtn', lang()==='en'?'Processing analysis...':'Обработка анализа...', true); const data=await res.json().catch(()=>null); if(!res.ok || !data?.ok) throw Error(data?.error || t().apiError); lastAnalysis=data.analysis || data.result; hasSuccessfulCheck = canCreateCard(lastAnalysis); renderAnalysis(lastAnalysis); setJsonEnabled(canCreateCard(lastAnalysis)); window.InteralFormDraft?.save?.(); setTimeout(() => window.InteralFormDraft?.save?.(), 120); hideNotice(); updateResetVisibility(); setButtonStatus('#checkBtn', lang()==='en'?'Done':'Готово', true); } catch (error) { setButtonStatus('#checkBtn', lang()==='en'?'Error':'Ошибка', false); throw error; } finally { setTimeout(()=>setButtonStatus('#checkBtn', t().check, false), 800); } }
function statusText(r){ if(r?.eligible) return ['ok',t().eligible]; if(r?.decision==='needs_manual_review') return ['review',t().review]; return ['bad',t().rejected]; }
function langRows(list, values={}){ return `<div class="language-table-wrap"><table><tbody>${list.map(l=>`<tr><th>${escapeHtml(l[lang()])}</th><td>${escapeHtml(values[l.code]||'—')}</td></tr>`).join('')}</tbody></table></div>`; }
function renderAnalysis(r){ lastAnalysis=r; $('resultSection').hidden=false; const u=t(); const [cls,msg]=statusText(r); const a=r?.analysis||{}; const risks=Array.isArray(r?.risks)&&r.risks.length?r.risks:[u.noRisks]; const form=r?.recommendedForm||r?.selectedForm||$('candidateInput').value.trim()||'—'; const conclusion=r?.shortConclusion||'—'; $('resultBox').innerHTML=`<div class="decision-card"><div class="status ${cls}">${escapeHtml(msg)}</div><div class="decision-main"><div class="decision-main-item"><span class="decision-label">${u.recommendedForm}</span><strong class="decision-form">${escapeHtml(form)}</strong></div><div class="decision-main-item"><span class="decision-label">${u.conclusion}</span><p>${escapeHtml(conclusion)}</p></div></div><details open><summary>${u.controlLanguages}</summary>${langRows(CONTROL_LANGUAGES,r?.translations?.controlLanguages)}</details><details open><summary>${u.auxiliaryLanguages}</summary>${langRows(AUXILIARY_LANGUAGES,r?.translations?.auxiliaryLanguages)}</details><details open><summary>${u.analysis}</summary><ul class="analysis-list">${Object.keys(u.labels).map(k=>`<li><b>${escapeHtml(u.labels[k])}:</b> ${escapeHtml(a[k]||'—')}</li>`).join('')}</ul></details><details><summary>${u.risks}</summary><ul class="risk-list">${risks.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></details></div>`; }
function canCreateCard(r){ return r?.eligible === true; }
function normalizeDerivation(d={}){ return { canFormVerb:Boolean(d.canFormVerb), canFormNoun:Boolean(d.canFormNoun), canFormAdjective:Boolean(d.canFormAdjective), possibleDerivations:Array.isArray(d.possibleDerivations)?d.possibleDerivations.map(String):[], appliedRules:Array.isArray(d.appliedRules)?d.appliedRules.map(String):[], deWahlRuleNotes:String(d.deWahlRuleNotes||''), suffixAndEndingNotes:String(d.suffixAndEndingNotes||''), ruleSourceVersion:String(d.ruleSourceVersion||'') }; }
function uuid12(){ const alphabet='0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'; const bytes=new Uint8Array(12); crypto.getRandomValues(bytes); return Array.from(bytes,b=>alphabet[b%alphabet.length]).join(''); }
async function createJsonCard(author = null, { onProgress } = {}){ if(!hasSuccessfulCheck || !canCreateCard(lastAnalysis)) throw Error(t().cardBlocked); onProgress?.(lang()==='en'?'Building card...':'Сборка карточки...'); const state=collectState(); const now=new Date().toISOString(); const base={ id:CARD_PREFIX+uuid12(), section:CARD_SECTION, type:'alter-vordes', algorithmStep:6, title:lastAnalysis.recommendedForm||state.candidate, selectedForm:lastAnalysis.recommendedForm||state.candidate, translation:lastAnalysis.inputTranslation||state.translation, partOfSpeech:lastAnalysis.partOfSpeech||state.partOfSpeech, status:'candidate', translations:lastAnalysis.translations||{controlLanguages:{},auxiliaryLanguages:{}}, analysis:lastAnalysis.analysis||{}, derivation:normalizeDerivation(lastAnalysis.derivation||{}), risks:Array.isArray(lastAnalysis.risks)?lastAnalysis.risks:[], shortConclusion:lastAnalysis.shortConclusion||'', model:{name:MODEL_NAME,role:'advisory evaluator',finalDecisionByHuman:true}, createdAt:now, updatedAt:now };
  if (author) base.author=author;
  base.discussionId=`card-${base.id}`; let card=base;
  try { onProgress?.(lang()==='en'?'Saving card...':'Сохранение карточки...'); const res=await fetch(`${API_BASE}/api/cards`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({section:CARD_SECTION,title:base.title,category:'alter-vordes',payload:base})}); const data=await res.json().catch(()=>null); if(!res.ok||!data?.ok) throw Error(data?.error||res.status); card=window.InteralJsonCardModal?.parseCardsApiResponse?.(data, base, CARD_SECTION)||(data?.card?.payload??data?.payload??{...base,id:data.id,section:data.section||CARD_SECTION,discussionId:data.discussionId||`card-${data.id}`,status:data.status||'pending'}); }
  catch { const res=await fetch(`${API_BASE}/api/cards-next-id?section=${CARD_SECTION}`); const data=await res.json().catch(()=>null); if(data?.id) card={...base,id:data.id,discussionId:`card-${data.id}`}; }
  if(!/^al_[0-9A-Za-z]{12}$/.test(card.id)) throw Error('Invalid card id'); lastCard=card; $('jsonCardOutput').value=JSON.stringify(card,null,2); return card; }
let jsonOpener = null;
function openJsonModal(){ jsonOpener=document.activeElement; $('jsonCardOutput').value=''; const modal=$('jsonCardModal'); modal.classList.add('show'); modal.setAttribute('aria-hidden','false'); document.body.classList.add('json-card-modal-open'); $('generateJsonCardBtn')?.focus(); }
function closeJsonModal(){ const modal=$('jsonCardModal'); modal.classList.remove('show'); modal.setAttribute('aria-hidden','true'); document.body.classList.remove('json-card-modal-open'); if(jsonOpener?.focus) jsonOpener.focus(); }
async function encodeState(payload){ return btoa(unescape(encodeURIComponent(JSON.stringify(payload)))); }
async function decodeState(text){ return JSON.parse(decodeURIComponent(escape(atob(text)))); }
function fill(s={}){ $('translationInput').value=s.translation||''; $('candidateInput').value=s.candidate||''; $('posInput').value=POS_VALUES.includes(s.partOfSpeech)?s.partOfSpeech:'noun'; $('commentInput').value=s.comment||''; hasSuccessfulCheck = false; setJsonEnabled(false); if(s.lastAnalysis){ renderAnalysis(s.lastAnalysis); } updateResetVisibility(); }
function importPageState(s={}){ fill(s); return true; }
window.InteralPageStateExport = collectState;
window.InteralPageStateImport = importPageState;
async function restoreStateFromUrl(){ const p=new URLSearchParams(location.search); if(p.get('s')){ try{ const res=await fetch(`${API_BASE}/api/share-state?id=${encodeURIComponent(p.get('s'))}`); const data=await res.json(); if(data?.ok) fill(data.payload?.pageState||data.payload?.fields||data.payload); }catch{} return; } if(p.get('state')){ try{ const payload=await decodeState(p.get('state')); fill(payload?.pageState||payload); }catch{} } }
document.addEventListener('DOMContentLoaded',()=>{ document.documentElement.lang = currentLang(); applyI18n(); setJsonEnabled(false); updateResetVisibility(); $('checkBtn').onclick=()=>evaluateAlterWord().catch(e=>showNotice(e.message||t().apiError,'error')); window.InteralJsonCardModal?.init({ openButtonId:'jsonBtn', getLanguage: lang, getTexts: () => ({ close:t().closeJson, title:t().jsonTitle, useAuthor:t().useAuthor, authorName:t().authorName, contactType:t().contactType, contact:t().contact, generate:t().generateJson, generating: lang()==='en'?'Generating...':'Генерация...', output:t().outputJson, copy:t().copyJson, copied:t().copiedJson, copiedTitle:lang()==='en'?'Copied':'Скопировано', download:t().downloadJson, empty:lang()==='en'?'Generate the JSON card first.':'Сначала сгенерируйте JSON-карточку.', unavailable:lang()==='en'?'The JSON card is available only after a successful check.':'JSON-карточка доступна только после успешной проверки.' }), buildCard: async ({author, onProgress}={})=>{ if(!hasSuccessfulCheck || !canCreateCard(lastAnalysis)) throw Error(t().cardBlocked); onProgress?.(lang()==='en'?'Building card...':'Сборка карточки...'); return createJsonCard(author, { onProgress }); }, formatCard:(card)=>JSON.stringify(card,null,2), getFilename:()=> 'altervord-card.json' }); $('resetBtn').onclick=()=>resetState().catch(e=>showNotice(e.message||t().apiError,'error')); ['translationInput','candidateInput','commentInput'].forEach(id=>$(id).addEventListener('input',()=>{ invalidateAnalysis(); updateResetVisibility(); })); $('posInput').addEventListener('change',()=>{ invalidateAnalysis(); updateResetVisibility(); }); document.addEventListener('interal:languagechange',()=>{ document.documentElement.lang = currentLang(); applyI18n(); }); restoreStateFromUrl(); });
