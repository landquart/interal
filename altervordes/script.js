const API_BASE = location.hostname === 'landquart.github.io' ? 'https://interal.vercel.app' : '';
const CARD_SECTION = 'altervordes';
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
    pageTitle: 'Alter vordes', paramsTitle: 'Параметры', translationLabel: 'Перевод', candidateLabel: 'Форма в Интерaле', partOfSpeechLabel: 'Часть речи', commentLabel: 'Комментарий (необязательно)', check: 'Проверить', checking: 'Проверка…', loading: 'Qwen анализирует форму и переводит значение на контрольные и вспомогательные языки.', createJson: 'Сформировать JSON-карточку', copyJson: 'Скопировать JSON-карточку', copiedJson: 'JSON-карточка скопирована.', downloadJson: 'Скачать JSON-карточку', generateJson: 'Сгенерировать карточку', outputJson: 'Готовый JSON', useAuthor: 'Указать авторство', authorName: 'Имя или ник', contactType: 'Тип контакта', contact: 'Контакт', rememberAuthor: 'Запомнить для следующих карточек', clearSavedAuthor: 'Удалить сохранённые данные', resultTitle: 'Решение', controlLanguages: 'Контрольные языки', auxiliaryLanguages: 'Вспомогательные языки', recommendedForm: 'Рекомендуемая форма', analysis: 'Анализ', risks: 'Риски', conclusion: 'Вывод', noRisks: 'Существенные риски не указаны.', eligible: 'Слово соответствует критериям Alter vordes. Можно сформировать JSON-карточку.', rejected: 'Слово не соответствует критериям Alter vordes. JSON-карточку сформировать нельзя.', review: 'Требуется ручная проверка. JSON-карточку пока нельзя сформировать.', required: 'Заполните перевод, форму и часть речи.', invalidPos: 'Выберите корректную часть речи.', apiError: 'Не удалось выполнить анализ.', cardBlocked: 'JSON-карточку можно сформировать только после положительного анализа.', jsonTitle: 'JSON-карточка', closeJson: 'Закрыть JSON-карточку', evaluating: 'Qwen: оценка...', processingAnalysis: 'Обработка анализа...', done: 'Готово', error: 'Ошибка', generating: 'Генерация...', buildingCard: 'Сборка карточки...', emptyJson: 'Сначала сгенерируйте JSON-карточку.', jsonUnavailable: 'JSON-карточка доступна только после успешной проверки.', jsonModuleUnavailable: 'Модуль создания JSON-карточек не загружен. Перезагрузите страницу.', invalidCardId: 'Некорректный идентификатор карточки',
    pos: { noun:'Существительное', adjective:'Прилагательное', verb:'Глагол', adverb:'Наречие', pronoun:'Местоимение', numeral:'Числительное', interjection:'Междометие', function_word:'Служебное слово', other:'Другое' },
    labels: { brevity:'Краткость', pronounceability:'Произносимость', conflicts:'Конфликты', neutrality:'Нейтральность', controlAndAuxiliaryEvidence:'Контрольные и вспомогательные языки', partOfSpeechSuitability:'Соответствие части речи', derivationalPotential:'Деривационный потенциал', interalRuleCompatibility:'Правила Интераля' }
  },
  en: {
    pageTitle: 'Alter vordes', paramsTitle: 'Parameters', translationLabel: 'Translation', candidateLabel: 'Interal form', partOfSpeechLabel: 'Part of speech', commentLabel: 'Comment (optional)', check: 'Check', checking: 'Checking…', loading: 'Qwen is analysing the form and translating the meaning into control and auxiliary languages.', createJson: 'Generate JSON card', copyJson: 'Copy JSON card', copiedJson: 'JSON card copied.', downloadJson: 'Download JSON card', generateJson: 'Generate card', outputJson: 'Generated JSON', useAuthor: 'Add authorship', authorName: 'Name or nickname', contactType: 'Contact type', contact: 'Contact', rememberAuthor: 'Remember for future cards', clearSavedAuthor: 'Delete saved data', resultTitle: 'Decision', controlLanguages: 'Control languages', auxiliaryLanguages: 'Auxiliary languages', recommendedForm: 'Recommended form', analysis: 'Analysis', risks: 'Risks', conclusion: 'Conclusion', noRisks: 'No significant risks were specified.', eligible: 'The word meets the Alter vordes criteria. A JSON card can be created.', rejected: 'The word does not meet the Alter vordes criteria. A JSON card cannot be created.', review: 'Manual review is required. A JSON card cannot be created yet.', required: 'Fill in translation, form, and part of speech.', invalidPos: 'Select a valid part of speech.', apiError: 'Could not complete the analysis.', cardBlocked: 'A JSON card can be created only after a positive analysis.', jsonTitle: 'JSON card', closeJson: 'Close JSON card', evaluating: 'Qwen: evaluating...', processingAnalysis: 'Processing analysis...', done: 'Done', error: 'Error', generating: 'Generating...', buildingCard: 'Building card...', emptyJson: 'Generate the JSON card first.', jsonUnavailable: 'The JSON card is available only after a successful check.', jsonModuleUnavailable: 'The JSON card module is unavailable. Reload the page.', invalidCardId: 'Invalid card id',
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
function compactAlterAnalysis(value){ return value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : null; }
function collectState(){ const analysis = compactAlterAnalysis(lastAnalysis); const accepted = canCreateCard(analysis); return { version: 2, page: location.pathname, fields: { translation:$('translationInput').value.trim(), candidate:$('candidateInput').value.trim(), partOfSpeech:$('posInput').value, comment:$('commentInput').value.trim() }, result: analysis, flags: { checked: Boolean(hasSuccessfulCheck || analysis), accepted }, savedCard: lastCard ? { id:lastCard.id, status:lastCard.status } : null, savedAt: new Date().toISOString(), translation:$('translationInput').value.trim(), interfaceLanguage:lang(), partOfSpeech:$('posInput').value, candidate:$('candidateInput').value.trim(), comment:$('commentInput').value.trim(), lastAnalysis: analysis }; }
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
async function evaluateAlterWord(){ const state=collectState(); validateState(state); hasSuccessfulCheck = false; setButtonStatus('#checkBtn', t().checking, true); showNotice(t().loading,'info'); setJsonEnabled(false); try { const { lastAnalysis: _omit, ...payload } = state; setButtonStatus('#checkBtn', t().evaluating, true); const res=await fetch(`${API_BASE}/api/qwen-analyze`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task:'altervordes',payload,interfaceLanguage:lang()})}); setButtonStatus('#checkBtn', t().processingAnalysis, true); const data=await res.json().catch(()=>null); if(!res.ok || !data?.ok) throw Error(data?.error || t().apiError); lastAnalysis=data.analysis || data.result; hasSuccessfulCheck = canCreateCard(lastAnalysis); renderAnalysis(lastAnalysis); setJsonEnabled(canCreateCard(lastAnalysis)); window.InteralFormDraft?.save?.(); setTimeout(() => window.InteralFormDraft?.save?.(), 120); hideNotice(); updateResetVisibility(); setButtonStatus('#checkBtn', t().done, true); } catch (error) { setButtonStatus('#checkBtn', t().error, false); throw error; } finally { setTimeout(()=>setButtonStatus('#checkBtn', t().check, false), 800); } }
function statusText(r){ if(r?.eligible) return ['ok',t().eligible]; if(r?.decision==='needs_manual_review') return ['review',t().review]; return ['bad',t().rejected]; }
function langRows(list, values={}){ return `<div class="language-table-wrap"><table><tbody>${list.map(l=>`<tr><th>${escapeHtml(l[lang()])}</th><td>${escapeHtml(values[l.code]||'—')}</td></tr>`).join('')}</tbody></table></div>`; }
function renderAnalysis(r){ lastAnalysis=r; $('resultSection').hidden=false; const u=t(); const [cls,msg]=statusText(r); const a=r?.analysis||{}; const risks=Array.isArray(r?.risks)&&r.risks.length?r.risks:[u.noRisks]; const form=r?.recommendedForm||r?.selectedForm||$('candidateInput').value.trim()||'—'; const conclusion=r?.shortConclusion||'—'; $('resultBox').innerHTML=`<div class="decision-card"><div class="status ${cls}">${escapeHtml(msg)}</div><div class="decision-main"><div class="decision-main-item"><span class="decision-label">${u.recommendedForm}</span><strong class="decision-form">${escapeHtml(form)}</strong></div><div class="decision-main-item"><span class="decision-label">${u.conclusion}</span><p>${escapeHtml(conclusion)}</p></div></div><details open><summary>${u.controlLanguages}</summary>${langRows(CONTROL_LANGUAGES,r?.translations?.controlLanguages)}</details><details open><summary>${u.auxiliaryLanguages}</summary>${langRows(AUXILIARY_LANGUAGES,r?.translations?.auxiliaryLanguages)}</details><details open><summary>${u.analysis}</summary><ul class="analysis-list">${Object.keys(u.labels).map(k=>`<li><b>${escapeHtml(u.labels[k])}:</b> ${escapeHtml(a[k]||'—')}</li>`).join('')}</ul></details><details><summary>${u.risks}</summary><ul class="risk-list">${risks.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></details></div>`; }
function canCreateCard(r){ return r?.eligible === true; }
function normalizeDerivation(d={}){ return { possible_forms:Array.isArray(d.possibleDerivations)?d.possibleDerivations.map(String):[], rule_version:String(d.ruleSourceVersion||'') }; }
function normalizeAlterCriteria(a={}){ return { brevity:Boolean(a.brevity), pronounceability:Boolean(a.pronounceability), conflicts:Boolean(a.conflicts), neutrality:Boolean(a.neutrality), part_of_speech_suitability:Boolean(a.partOfSpeechSuitability ?? a.part_of_speech_suitability), interal_rule_compatibility:Boolean(a.interalRuleCompatibility ?? a.interal_rule_compatibility) }; }
async function createJsonCard(author = null, { onProgress } = {}){ if(!hasSuccessfulCheck || !canCreateCard(lastAnalysis)) throw Error(t().cardBlocked); onProgress?.(t().buildingCard); const state=collectState(); const base={ version:'1.0', card_type:'vord_card', vord_type:'al', interal:{ word:lastAnalysis.recommendedForm||state.candidate, part_of_speech:lastAnalysis.partOfSpeech||state.partOfSpeech }, translation:{ language:'ru', word:lastAnalysis.inputTranslation||state.translation }, procedure:'alter_word', translations:lastAnalysis.translations||{controlLanguages:{},auxiliaryLanguages:{}}, criteria:normalizeAlterCriteria(lastAnalysis.analysis||{}), derivation:normalizeDerivation(lastAnalysis.derivation||{}) };
  if (Array.isArray(lastAnalysis.risks) && lastAnalysis.risks.length) base.risks=lastAnalysis.risks;
  if (lastAnalysis.shortConclusion) base.short_conclusion=lastAnalysis.shortConclusion;
  if (author) base.author=author;
  let card=base;
  card = await window.InteralJsonCards.createCardOnServer(base, { section:CARD_SECTION, title:base.interal.word, category:'al', endpoint:`${API_BASE}/api/cards`, onProgress });
  if(!/^al_[0-9A-Za-z]{12}$/.test(card.id)) throw Error(t().invalidCardId); lastCard=card; $('jsonCardOutput').value=JSON.stringify(card,null,2); return card; }
let jsonOpener = null;
function openJsonModal(){ jsonOpener=document.activeElement; $('jsonCardOutput').value=''; const modal=$('jsonCardModal'); modal.classList.add('show'); modal.setAttribute('aria-hidden','false'); document.body.classList.add('json-card-modal-open'); $('generateJsonCardBtn')?.focus(); }
function closeJsonModal(){ const modal=$('jsonCardModal'); modal.classList.remove('show'); modal.setAttribute('aria-hidden','true'); document.body.classList.remove('json-card-modal-open'); if(jsonOpener?.focus) jsonOpener.focus(); }
async function encodeState(payload){ return btoa(unescape(encodeURIComponent(JSON.stringify(payload)))); }
async function decodeState(text){ return JSON.parse(decodeURIComponent(escape(atob(text)))); }
function fill(s={}){ const fields = s.version === 2 && s.fields ? s.fields : s; const analysis = s.version === 2 ? s.result : s.lastAnalysis; $('translationInput').value=fields.translation||''; $('candidateInput').value=fields.candidate||''; $('posInput').value=POS_VALUES.includes(fields.partOfSpeech)?fields.partOfSpeech:'noun'; $('commentInput').value=fields.comment||''; hasSuccessfulCheck = Boolean(s.flags?.checked && analysis); setJsonEnabled(false); if(analysis){ renderAnalysis(analysis); hasSuccessfulCheck = Boolean(s.flags?.checked || canCreateCard(analysis)); setJsonEnabled(canCreateCard(analysis)); } updateResetVisibility(); }
function importPageState(s={}){ fill(s); return true; }
window.InteralPageStateExport = collectState;
window.InteralPageStateImport = importPageState;
async function restoreStateFromUrl(){ const p=new URLSearchParams(location.search); if(p.get('s')){ try{ const res=await fetch(`${API_BASE}/api/share-state?id=${encodeURIComponent(p.get('s'))}`); const data=await res.json(); if(data?.ok) fill(data.payload?.pageState||data.payload?.fields||data.payload); }catch{} return; } if(p.get('state')){ try{ const payload=await decodeState(p.get('state')); fill(payload?.pageState||payload); }catch{} } }
document.addEventListener('DOMContentLoaded',()=>{ document.documentElement.lang = currentLang(); applyI18n(); setJsonEnabled(false); updateResetVisibility(); $('checkBtn').onclick=()=>evaluateAlterWord().catch(e=>showNotice(e.message||t().apiError,'error')); try { if (!window.InteralJsonCardModal) throw new Error(t().jsonModuleUnavailable); if (!window.InteralJsonCards) throw new Error(t().jsonModuleUnavailable); window.InteralJsonCardModal.init({ openButtonId:'jsonBtn', getLanguage: lang, getTexts: () => ({ close:t().closeJson, title:t().jsonTitle, useAuthor:t().useAuthor, authorName:t().authorName, contactType:t().contactType, contact:t().contact, rememberAuthor:t().rememberAuthor, clearSavedAuthor:t().clearSavedAuthor, generate:t().generateJson, generating: t().generating, output:t().outputJson, copy:t().copyJson, copied:t().copiedJson, copiedTitle:t().copiedJson, download:t().downloadJson, empty:t().emptyJson, unavailable:t().jsonUnavailable }), buildCard: async ({author, onProgress}={})=>{ if(!hasSuccessfulCheck || !canCreateCard(lastAnalysis)) throw Error(t().cardBlocked); onProgress?.(t().buildingCard); return createJsonCard(author, { onProgress }); }, formatCard:(card)=>JSON.stringify(card,null,2), getFilename:()=> 'altervord-card.json' }); } catch (error) { console.error('Could not initialize JSON card module:', error); showNotice(t().jsonModuleUnavailable,'error'); } $('resetBtn').onclick=()=>resetState().catch(e=>showNotice(e.message||t().apiError,'error')); ['translationInput','candidateInput','commentInput'].forEach(id=>$(id).addEventListener('input',()=>{ invalidateAnalysis(); updateResetVisibility(); })); $('posInput').addEventListener('change',()=>{ invalidateAnalysis(); updateResetVisibility(); }); document.addEventListener('interal:languagechange',()=>{ document.documentElement.lang = currentLang(); applyI18n(); }); restoreStateFromUrl(); });
