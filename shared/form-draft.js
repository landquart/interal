(function () {
  const DRAFT_PREFIX = 'interal.explicitPageState:';
  const RESET_PREFIX = 'interal.resetPage:';
  const SAVE_DELAY = 80;
  const RESTORE_DELAYS = [0, 80, 250, 600];
  const RESET_CLEAR_DELAYS = [0, 80, 250, 600, 1000];
  const SHARE_API_URL = 'https://interal.vercel.app/api/share-state';
  const SEQUENCE_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const FALLBACK_SID_KEY = 'interal.fallbackShareSid';

  let saveTimer = null;
  let isRestoring = false;
  let isResetting = false;
  let lastSerialized = '';

  function isInstrumentPage() {
    return /\/(indoeuropanvordes|associativvordes|determinatorofvalentyp|internationalismes|vordesofcommunites|grammaticebrevivordes)\//.test(window.location.pathname);
  }

  if (!isInstrumentPage()) return;

  function storageKey() {
    return `${DRAFT_PREFIX}${window.location.pathname}`;
  }

  function resetKey() {
    return `${RESET_PREFIX}${window.location.pathname}`;
  }

  function setResetFlag() {
    try {
      sessionStorage.setItem(resetKey(), '1');
    } catch (_) {}
  }

  function hasResetFlag() {
    try {
      return sessionStorage.getItem(resetKey()) === '1';
    } catch (_) {
      return false;
    }
  }

  function clearResetFlag() {
    try {
      sessionStorage.removeItem(resetKey());
    } catch (_) {}
  }

  function shouldSkipElement(element) {
    if (!element || !element.id) return true;
    if (element.disabled || element.readOnly) return true;
    if (element.closest('.side-menu, .top-nav, .menu-lang-modal')) return true;
    if (element.matches('[data-no-draft], [data-no-draft] *')) return true;
    if (['file', 'button', 'submit', 'reset'].includes(element.type)) return true;
    return false;
  }

  function getDraftFields() {
    return Array.from(document.querySelectorAll('input, textarea, select')).filter((element) => !shouldSkipElement(element));
  }

  function readElementValue(element) {
    if (element.type === 'checkbox' || element.type === 'radio') return Boolean(element.checked);
    return element.value;
  }

  function writeElementValue(element, value) {
    if (element.type === 'checkbox' || element.type === 'radio') {
      element.checked = Boolean(value);
      return;
    }

    element.value = value == null ? '' : String(value);
  }

  function encodeBase64Url(value) {
    const json = JSON.stringify(value);
    const bytes = new TextEncoder().encode(json);
    let binary = '';

    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  function decodeBase64Url(value) {
    const normalized = String(value || '')
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function resetElementValue(element) {
    if (element.type === 'checkbox' || element.type === 'radio') {
      element.checked = false;
      return;
    }

    if (element.tagName === 'SELECT') {
      element.selectedIndex = 0;
      return;
    }

    element.value = '';
  }

  function getSharePath() {
    const path = window.location.pathname;

    if (path.startsWith('/interal/')) {
      return path;
    }

    return `/interal${path.startsWith('/') ? path : `/${path}`}`;
  }

  function collectDraft() {
    const fields = {};

    getDraftFields().forEach((element) => {
      fields[element.id] = readElementValue(element);
    });

    return {
      version: 1,
      path: getSharePath(),
      fields
    };
  }

  function createSharePayload() {
    const draft = collectDraft();

    return {
      version: 1,
      source: 'interal-form-draft',
      path: getSharePath(),
      fields: draft.fields
    };
  }

  function encodeBase62Padded(value, length = 12) {
    let number = BigInt(value);
    const base = BigInt(SEQUENCE_ALPHABET.length);
    let encoded = '';
    do {
      encoded = SEQUENCE_ALPHABET[Number(number % base)] + encoded;
      number /= base;
    } while (number > 0n);
    return encoded.padStart(length, '0');
  }

  function decodeBase62(value) {
    return String(value || '').split('').reduce((total, char) => {
      const index = SEQUENCE_ALPHABET.indexOf(char);
      if (index < 0) throw new Error('Invalid sequence');
      return total * 62n + BigInt(index);
    }, 0n);
  }

  function nextFallbackSid() {
    try {
      const current = localStorage.getItem(FALLBACK_SID_KEY);
      const next = current && /^[0-9A-Za-z]{12}$/.test(current) ? decodeBase62(current) + 1n : 1n;
      const sid = encodeBase62Padded(next);
      localStorage.setItem(FALLBACK_SID_KEY, sid);
      return sid;
    } catch (_) {
      return encodeBase62Padded(BigInt(Date.now()));
    }
  }

  function isDatabaseLimitError(error) {
    const message = String(error?.message || error?.error || '').toLowerCase();
    if (/invalid|validation|payload too large|path|section/.test(message)) return false;
    return message.includes('quota') || message.includes('storage') || message.includes('database size') || message.includes('disk') || message.includes('no space') || message.includes('insert') || message.includes('could not create share state') || message.includes('write');
  }

  function createShareUrl() {
    const payload = createSharePayload();
    const encoded = encodeBase64Url(payload);
    const url = new URL(window.location.href);

    url.searchParams.delete('s');
    url.searchParams.delete('sid');
    url.searchParams.delete('state');
    url.searchParams.set('sid', nextFallbackSid());
    url.searchParams.set('state', encoded);

    if (/state=/.test(url.hash)) {
      url.hash = '';
    }

    return url.toString();
  }

  async function createShortShareUrl() {
    const payload = createSharePayload();

    const response = await fetch(SHARE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: getSharePath(),
        payload
      })
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(data?.error || 'Could not create short share link');
      error.status = response.status;
      throw error;
    }

    if (!data || !data.ok || !data.id || !/^[0-9a-zA-Z]{12}$/.test(data.id)) {
      throw new Error('Invalid share id');
    }

    if (typeof data.url !== 'string' || !data.url) {
      throw new Error('Invalid share URL');
    }

    return data.url;
  }

  async function writeClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    let copied = false;

    try {
      copied = document.execCommand('copy');
    } finally {
      textarea.remove();
    }

    if (!copied) {
      throw new Error('Clipboard copy failed');
    }

    return true;
  }

  function getCopyTexts() {
    const lang = localStorage.getItem('interal.lang') === 'en' ? 'en' : 'ru';

    return lang === 'en'
      ? {
          copy: 'Copy link with data',
          copied: 'Link copied',
          failed: 'Could not copy link'
        }
      : {
          copy: 'Скопировать ссылку с данными',
          copied: 'Ссылка скопирована',
          failed: 'Не удалось скопировать ссылку'
        };
  }

  function setCopyButtonState(button, state) {
    const texts = getCopyTexts();
    const label = button.querySelector('.menu-copy-label, .top-desktop-copy-label');
    const text = state === 'copied'
      ? texts.copied
      : state === 'failed'
        ? texts.failed
        : texts.copy;

    button.classList.toggle('is-copied', state === 'copied');
    button.classList.toggle('is-failed', state === 'failed');

    if (label) {
      label.textContent = text;
    }

    button.setAttribute('aria-label', text);
  }

  async function copyShareUrl(button) {
    try {
      const url = await createShortShareUrl();

      await writeClipboard(url);
      setCopyButtonState(button, 'copied');

      clearTimeout(button._interalCopyStateTimer);
      button._interalCopyStateTimer = setTimeout(() => {
        setCopyButtonState(button, 'idle');
      }, 1600);

      return true;
    } catch (error) {
      if (isDatabaseLimitError(error)) {
        console.warn('Supabase insert failed; using fallback self-contained link');
        const url = createShareUrl();
        await writeClipboard(url);
        setCopyButtonState(button, 'copied');
        clearTimeout(button._interalCopyStateTimer);
        button._interalCopyStateTimer = setTimeout(() => {
          setCopyButtonState(button, 'idle');
        }, 1600);
        return true;
      }

      console.warn('Could not copy short share URL:', error);

      setCopyButtonState(button, 'failed');

      clearTimeout(button._interalCopyStateTimer);
      button._interalCopyStateTimer = setTimeout(() => {
        setCopyButtonState(button, 'idle');
      }, 1800);

      return false;
    }
  }

  function saveDraftNow() {
    if (isRestoring || isResetting || hasResetFlag()) return;

    try {
      const payload = collectDraft();
      const serialized = JSON.stringify(payload);

      if (serialized === lastSerialized) return;

      localStorage.setItem(storageKey(), serialized);
      lastSerialized = serialized;
    } catch (error) {
      console.warn('Could not save form draft:', error);
    }
  }

  function scheduleSaveDraft() {
    if (isRestoring || isResetting || hasResetFlag()) return;

    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveDraftNow();
    }, SAVE_DELAY);
  }

  function dispatchFieldEvents(element) {
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function clearCurrentDraft() {
    clearTimeout(saveTimer);
    saveTimer = null;
    lastSerialized = '';

    try {
      localStorage.removeItem(storageKey());
    } catch (_) {}
  }

  function clearAllResetStorage() {
    try {
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const key = localStorage.key(i);
        if (!key) continue;

        if (
          key.startsWith(DRAFT_PREFIX) ||
          key.startsWith('interal.pageState:') ||
          key === 'interal_associative_state' ||
          key === 'determinator-valentyp-state-v1'
        ) {
          localStorage.removeItem(key);
        }
      }
    } catch (_) {}
  }

  function clearDraftFields() {
    isRestoring = true;

    try {
      getDraftFields().forEach((element) => {
        resetElementValue(element);
        dispatchFieldEvents(element);
      });
    } finally {
      isRestoring = false;
    }

    if (typeof window.initCustomSelects === 'function') window.initCustomSelects();
  }

  function cleanResetUrl() {
    const url = new URL(window.location.href);

    url.searchParams.delete('s');
    url.searchParams.delete('state');
    url.searchParams.delete('sid');

    if (/state=/.test(url.hash)) {
      url.hash = '';
    }

    return `${url.pathname}${url.search}${url.hash}`;
  }

  function getSharePayloadFromUrl() {
    const url = new URL(window.location.href);
    const encoded = url.searchParams.get('state');

    if (!encoded) return null;

    try {
      const payload = decodeBase64Url(encoded);

      if (!payload || typeof payload !== 'object') return null;
      if (payload.source !== 'interal-form-draft') return null;
      if (!payload.fields || typeof payload.fields !== 'object') return null;

      return payload;
    } catch (error) {
      console.warn('Could not decode shared form state:', error);
      return null;
    }
  }

  function removeShareStateFromUrl() {
    const url = new URL(window.location.href);

    url.searchParams.delete('s');
    url.searchParams.delete('state');

    if (/state=/.test(url.hash)) {
      url.hash = '';
    }

    const cleanUrl = `${url.pathname}${url.search}${url.hash}`;

    try {
      window.history.replaceState(null, '', cleanUrl);
    } catch (_) {}
  }

  function applyFields(fields) {
    let applied = false;

    isRestoring = true;

    try {
      Object.entries(fields).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (!element || shouldSkipElement(element)) return;

        writeElementValue(element, value);
        dispatchFieldEvents(element);
        applied = true;
      });
    } finally {
      isRestoring = false;
    }

    if (applied) {
      if (typeof window.initCustomSelects === 'function') {
        window.initCustomSelects();
      }

      lastSerialized = JSON.stringify(collectDraft());
      localStorage.setItem(storageKey(), lastSerialized);
      window.dispatchEvent(new CustomEvent('interal:formdraftrestore', { detail: { key: storageKey() } }));
    }

    return applied;
  }

  function restoreSharedStateFromUrl() {
    if (isResetting || hasResetFlag()) return false;

    const payload = getSharePayloadFromUrl();

    if (!payload) return false;

    const applied = applyFields(payload.fields);

    if (applied) {
      removeShareStateFromUrl();
    }

    return applied;
  }

  async function restoreShortStateFromUrl() {
    if (isResetting || hasResetFlag()) return false;

    const url = new URL(window.location.href);
    const id = url.searchParams.get('s');

    if (!id) return false;

    if (!/^[0-9a-zA-Z]{12}$/.test(id)) {
      return false;
    }

    try {
      const response = await fetch(`${SHARE_API_URL}?id=${encodeURIComponent(id)}`, {
        method: 'GET'
      });

      if (!response.ok) {
        console.warn('Could not load short shared state:', response.status);
        return false;
      }

      const data = await response.json();

      if (!data || !data.ok || !data.payload) {
        return false;
      }

      if (data.path !== getSharePath()) {
        return false;
      }

      if (data.payload.source !== 'interal-form-draft') {
        return false;
      }

      if (!data.payload.fields || typeof data.payload.fields !== 'object') {
        return false;
      }

      const applied = applyFields(data.payload.fields);

      if (applied) {
        url.searchParams.delete('s');
        url.searchParams.delete('state');
        url.searchParams.delete('sid');

        try {
          window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
        } catch (_) {}
      }

      return applied;
    } catch (error) {
      console.warn('Could not restore short shared state:', error);
      return false;
    }
  }

  function currentLang() {
    return localStorage.getItem('interal.lang') === 'en' ? 'en' : 'ru';
  }

  function resetConfirmTitle() {
    return currentLang() === 'en'
      ? 'Reset data?'
      : 'Сбросить данные?';
  }

  function resetConfirmOkLabel() {
    return currentLang() === 'en'
      ? 'Reset'
      : 'Сбросить';
  }

  function resetConfirmCancelLabel() {
    return currentLang() === 'en'
      ? 'Cancel'
      : 'Отмена';
  }

  function resetConfirmMessage(button) {
    const fallback = currentLang() === 'en'
      ? 'Reset entered data? This action cannot be undone.'
      : 'Сбросить введённые данные? Это действие нельзя отменить.';

    return button?.dataset?.resetMessage || button?.getAttribute('data-reset-message') || fallback;
  }

  function waitForConfirmReset(timeout = 600) {
    if (window.InteralUI?.confirmReset) {
      return Promise.resolve(window.InteralUI.confirmReset);
    }

    return new Promise((resolve) => {
      const startedAt = Date.now();

      const check = () => {
        if (window.InteralUI?.confirmReset) {
          resolve(window.InteralUI.confirmReset);
          return;
        }

        if (Date.now() - startedAt >= timeout) {
          resolve(null);
          return;
        }

        setTimeout(check, 40);
      };

      check();
    });
  }

  async function performDirectReset(button) {
    const message = resetConfirmMessage(button);
    const confirmReset = await waitForConfirmReset();
    const confirmed = confirmReset
      ? await confirmReset({
        title: resetConfirmTitle(),
        message,
        confirmLabel: resetConfirmOkLabel(),
        cancelLabel: resetConfirmCancelLabel()
      })
      : window.confirm(message);

    if (!confirmed) return false;

    isResetting = true;
    setResetFlag();
    clearCurrentDraft();
    clearAllResetStorage();
    clearDraftFields();

    const cleanUrl = cleanResetUrl();
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    try {
      window.history.replaceState(null, '', cleanUrl);
    } catch (_) {}

    if (currentUrl === cleanUrl) {
      window.location.reload();
    } else {
      window.location.replace(cleanUrl);
    }

    setTimeout(() => {
      window.location.href = cleanUrl;
    }, 150);

    return true;
  }

  function restoreDraft() {
    if (isResetting) return false;

    if (hasResetFlag()) {
      clearCurrentDraft();
      clearAllResetStorage();
      clearDraftFields();
      return false;
    }

    let payload = null;

    try {
      const raw = localStorage.getItem(storageKey());
      if (!raw) return false;

      payload = JSON.parse(raw);
    } catch (error) {
      console.warn('Could not read form draft:', error);
      return false;
    }

    if (!payload || payload.path !== getSharePath() || !payload.fields || typeof payload.fields !== 'object') {
      return false;
    }

    return applyFields(payload.fields);
  }

  function clearResetStateAfterLoad() {
    if (!hasResetFlag()) return;

    RESET_CLEAR_DELAYS.forEach((delay) => {
      setTimeout(() => {
        clearCurrentDraft();
        clearAllResetStorage();
        clearDraftFields();
      }, delay);
    });

    setTimeout(clearResetFlag, RESET_CLEAR_DELAYS[RESET_CLEAR_DELAYS.length - 1] + 150);
  }

  async function restoreInitialState() {
    if (hasResetFlag()) {
      clearResetStateAfterLoad();
      return false;
    }

    if (await restoreShortStateFromUrl()) {
      return true;
    }

    if (restoreSharedStateFromUrl()) {
      return true;
    }

    return restoreDraft();
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('#resetBtn, .interal-reset-btn');
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    performDirectReset(button).catch((error) => {
      console.error('Reset failed:', error);
    });
  }, true);

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-copy-state="true"]');
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();

    copyShareUrl(button);
  }, true);

  document.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.matches('input, textarea, select')) return;
    if (shouldSkipElement(target)) return;

    scheduleSaveDraft();
  }, true);

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.matches('input, textarea, select')) return;
    if (shouldSkipElement(target)) return;

    saveDraftNow();
  }, true);

  clearResetStateAfterLoad();
  RESTORE_DELAYS.forEach((delay) => {
    setTimeout(() => {
      restoreInitialState();
    }, delay);
  });

  window.addEventListener('load', () => {
    clearResetStateAfterLoad();
    restoreInitialState();
    setTimeout(restoreInitialState, 250);
  });

  window.InteralFormDraft = Object.assign(window.InteralFormDraft || {}, {
    save: saveDraftNow,
    restore: restoreDraft,
    restoreInitial: restoreInitialState,
    clear: clearCurrentDraft,
    reset: performDirectReset,
    createShareUrl,
    createShortShareUrl,
    getSharePath,
    key: storageKey
  });
})();
