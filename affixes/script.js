const API_BASE = location.hostname === 'landquart.github.io' ? 'https://interal.vercel.app' : '';
const MORPHEME_TYPES = ['suffix', 'prefix'];
const AFFIXES_SHARE_PATH = '/interal/affixes/';
const AFFIXES_STORAGE_KEYS = ['affixes-state-v1', 'interal_affixes_state'];
const hadShortShareParamOnLoad = new URLSearchParams(location.search).has('s');

const UI_TEXT = {
  ru: {
    pageTitle: 'Affixes',
    formTitle: 'Анализ аффиксов',
    formLabel: 'Аффикс',
    meaningLabel: 'Значение',
    typeLabel: 'Тип аффикса',
    commentLabel: 'Комментарий (необязательно)',
    suffix: 'Суффикс',
    prefix: 'Префикс',
    check: 'Проверить',
    checking: 'Проверка…',
    affixPlaceholder: 'Например: -ion, re-, -ilo',
    meaningPlaceholder: 'Например: действие, результат действия',
    modalTitle: 'Карточка аффикса',
    completed: 'Проверка выполнена',
    copyJson: 'Копировать JSON',
    copiedJson: 'JSON скопирован',
    close: 'Закрыть',
    required: 'Введите аффикс и значение.',
    apiError: 'Не удалось проверить аффикс.',
    reset: 'Сбросить',
    resetConfirm: 'Сбросить введённые данные? Это действие нельзя отменить.',
    restoreSuccess: 'Данные восстановлены из ссылки.',
    restoreError: 'Не удалось восстановить данные из ссылки.'
  },
  en: {
    pageTitle: 'Affixes',
    formTitle: 'Affix analysis',
    formLabel: 'Affix',
    meaningLabel: 'Meaning',
    typeLabel: 'Affix type',
    commentLabel: 'Comment (optional)',
    suffix: 'Suffix',
    prefix: 'Prefix',
    check: 'Check',
    checking: 'Checking…',
    affixPlaceholder: 'For example: -ion, re-, -ilo',
    meaningPlaceholder: 'For example: action, result of an action',
    modalTitle: 'Affix card',
    completed: 'Check completed',
    copyJson: 'Copy JSON',
    copiedJson: 'JSON copied',
    close: 'Close',
    required: 'Enter an affix and a meaning.',
    apiError: 'Could not check the affix.',
    reset: 'Reset',
    resetConfirm: 'Reset entered data? This action cannot be undone.',
    restoreSuccess: 'Data restored from link.',
    restoreError: 'Could not restore data from link.'
  }
};

const $ = (id) => document.getElementById(id);
const lang = () => document.documentElement.lang?.startsWith('en') ? 'en' : 'ru';
const t = () => UI_TEXT[lang()];
let lastCard = null;
let modalOpener = null;

function showNotice(message, type = 'error') {
  const box = $('noticeBox');
  box.textContent = message;
  box.className = `notice-box ${type}`;
  box.hidden = false;
  clearTimeout(showNotice._timer);
  showNotice._timer = setTimeout(() => { box.hidden = true; }, 3600);
}

function applyI18n() {
  const u = t();
  document.title = `${u.pageTitle} — Interal`;
  $('pageTitle').textContent = u.pageTitle;
  $('formLabel').textContent = u.formLabel;
  $('meaningLabel').textContent = u.meaningLabel;
  $('typeLabel').textContent = u.typeLabel;
  $('commentLabel').textContent = u.commentLabel;
  $('checkButton').textContent = u.check;
  $('formInput').placeholder = u.affixPlaceholder;
  $('meaningInput').placeholder = u.meaningPlaceholder;
  $('commentInput').removeAttribute('placeholder');
  const current = $('morphemeTypeInput').value || 'suffix';
  $('morphemeTypeInput').innerHTML = MORPHEME_TYPES.map((value) => `<option value="${value}">${u[value]}</option>`).join('');
  $('morphemeTypeInput').value = MORPHEME_TYPES.includes(current) ? current : 'suffix';
  $('jsonCardTitle').textContent = u.modalTitle;
  $('jsonCardStatus').textContent = u.completed;
  $('copyJsonCardBtn').setAttribute('aria-label', u.copyJson);
  $('copyJsonCardBtn').setAttribute('title', u.copyJson);
  $('closeJsonCardBtn').setAttribute('aria-label', u.close);
  $('closeJsonCardTextBtn').textContent = u.close;
  $('resetBtn')?.setAttribute('aria-label', u.reset);
  $('resetBtn')?.setAttribute('title', u.reset);
}

function sanitizeLastCard(card) {
  if (!card || typeof card !== 'object' || Array.isArray(card)) return null;
  if (card.card_type !== 'affix_card') return null;
  const allowedKeys = ['id', 'status', 'form', 'morphemeType', 'procedure', 'version', 'card_type', 'vord_type', 'created_at', 'meaning', 'criteria', 'forms'];
  return allowedKeys.reduce((result, key) => {
    if (Object.prototype.hasOwnProperty.call(card, key)) result[key] = card[key];
    return result;
  }, {});
}

function collectShareFields() {
  return {
    formInput: $('formInput').value,
    meaningInput: $('meaningInput').value,
    morphemeTypeInput: $('morphemeTypeInput').value,
    commentInput: $('commentInput').value
  };
}

function collectAffixesState() {
  return {
    form: $('formInput').value.trim(),
    meaningInput: $('meaningInput').value.trim(),
    morphemeType: $('morphemeTypeInput').value,
    comment: $('commentInput').value.trim(),
    lastCard: sanitizeLastCard(lastCard)
  };
}

function saveAffixesDraft() {
  const payload = {
    version: 1,
    source: 'interal-form-draft',
    path: AFFIXES_SHARE_PATH,
    fields: collectShareFields(),
    pageState: collectAffixesState()
  };
  try {
    AFFIXES_STORAGE_KEYS.forEach((key) => localStorage.setItem(key, JSON.stringify(payload)));
  } catch (error) {
    console.warn('Could not save Affixes draft:', error);
  }
}

function hasShareableState() {
  return Boolean(
    $('formInput').value.trim() ||
    $('meaningInput').value.trim() ||
    $('commentInput').value.trim() ||
    $('morphemeTypeInput').value === 'prefix' ||
    lastCard
  );
}

function updateStateControls() {
  const hasState = hasShareableState();
  $('resetBtn')?.classList.toggle('is-hidden', !hasState);
  document.querySelectorAll('[data-copy-state="true"]').forEach((button) => {
    button.disabled = !hasState;
    button.classList.toggle('is-hidden', !hasState);
  });
}

function applyAffixesState(state = {}) {
  if (!state || typeof state !== 'object') return false;
  $('formInput').value = state.form ?? state.formInput ?? '';
  $('meaningInput').value = state.meaningInput ?? '';
  $('morphemeTypeInput').value = MORPHEME_TYPES.includes(state.morphemeType || state.morphemeTypeInput) ? (state.morphemeType || state.morphemeTypeInput) : 'suffix';
  $('commentInput').value = state.comment ?? state.commentInput ?? '';
  lastCard = sanitizeLastCard(state.lastCard);
  if (lastCard) $('jsonCardOutput').textContent = JSON.stringify(lastCard, null, 2);
  saveAffixesDraft();
  updateStateControls();
  return true;
}

window.InteralPageStateExport = collectAffixesState;
window.InteralPageStateImport = applyAffixesState;

function collectPayload() {
  return {
    form: $('formInput').value.trim(),
    meaningInput: $('meaningInput').value.trim(),
    morphemeType: $('morphemeTypeInput').value,
    comment: $('commentInput').value.trim()
  };
}

function validatePayload(payload) {
  if (!payload.form || !payload.meaningInput || !MORPHEME_TYPES.includes(payload.morphemeType)) {
    throw new Error(t().required);
  }
}

function openModal(card) {
  lastCard = card;
  modalOpener = document.activeElement;
  $('jsonCardOutput').textContent = JSON.stringify(card, null, 2);
  const modal = $('jsonCardModal');
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('json-card-modal-open');
  $('copyJsonCardBtn').focus();
}

function closeModal() {
  const modal = $('jsonCardModal');
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('json-card-modal-open');
  if (modalOpener?.focus) modalOpener.focus();
}

async function checkAffix(event) {
  event.preventDefault();
  const payload = collectPayload();
  saveAffixesDraft();
  try {
    validatePayload(payload);
  } catch (error) {
    showNotice(error.message, 'error');
    return;
  }

  const button = $('checkButton');
  button.disabled = true;
  button.textContent = t().checking;
  $('noticeBox').hidden = true;

  try {
    const response = await fetch(`${API_BASE}/api/qwen-analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'affixes_check', payload, interfaceLanguage: lang() })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.card) throw new Error(data?.error || t().apiError);
    openModal(data.card);
    saveAffixesDraft();
    updateStateControls();
  } catch (error) {
    console.error(error);
    showNotice(t().apiError, 'error');
  } finally {
    button.disabled = false;
    button.textContent = t().check;
  }
}

async function copyJson() {
  if (!lastCard) return;
  await navigator.clipboard.writeText(JSON.stringify(lastCard, null, 2));
  const button = $('copyJsonCardBtn');
  button.classList.add('is-copied');
  button.setAttribute('title', t().copiedJson);
  setTimeout(() => {
    button.classList.remove('is-copied');
    button.setAttribute('title', t().copyJson);
  }, 1500);
}

document.addEventListener('DOMContentLoaded', () => {
  applyI18n();
  updateStateControls();
  $('affixForm').addEventListener('submit', checkAffix);
  $('closeJsonCardBtn').addEventListener('click', closeModal);
  $('closeJsonCardTextBtn').addEventListener('click', closeModal);
  $('jsonCardModal').addEventListener('click', (event) => { if (event.target === $('jsonCardModal')) closeModal(); });
  $('copyJsonCardBtn').addEventListener('click', () => copyJson().catch(() => showNotice(t().apiError, 'error')));
  $('resetBtn')?.addEventListener('click', () => window.InteralUI?.resetPageState?.({ message: t().resetConfirm }));
  ['formInput', 'meaningInput', 'commentInput'].forEach((id) => $(id).addEventListener('input', () => { saveAffixesDraft(); updateStateControls(); }));
  $('morphemeTypeInput').addEventListener('change', () => { saveAffixesDraft(); updateStateControls(); });
  document.addEventListener('interal:formdraftrestore', () => {
    updateStateControls();
    if (hadShortShareParamOnLoad) showNotice(t().restoreSuccess, 'success');
  });
  setTimeout(() => {
    if (hadShortShareParamOnLoad && new URLSearchParams(location.search).has('s')) showNotice(t().restoreError, 'error');
    updateStateControls();
  }, 1800);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });
  document.addEventListener('interal:languagechange', () => { applyI18n(); updateStateControls(); });
});
