(function () {
  const DRAFT_PREFIX = 'interal.explicitPageState:';
  const RESET_PREFIX = 'interal.resetPage:';
  const SAVE_DELAY = 80;
  const RESTORE_DELAYS = [0, 80, 250, 600];
  const RESET_CLEAR_DELAYS = [0, 80, 250, 600, 1000];

  let saveTimer = null;
  let isRestoring = false;
  let isResetting = false;
  let lastSerialized = '';

  function isInstrumentPage() {
    return /\/(indoeuropanvordes|associativvordes|determinatorofvalentyp|internationalismes|vordesofcommunites|grammaticebrevvordes)\//.test(window.location.pathname);
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

  function collectDraft() {
    const fields = {};

    getDraftFields().forEach((element) => {
      fields[element.id] = readElementValue(element);
    });

    return {
      version: 1,
      path: window.location.pathname,
      fields
    };
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

    if (/state=/.test(url.hash)) {
      url.hash = '';
    }

    return `${url.pathname}${url.search}${url.hash}`;
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

    if (!payload || payload.path !== window.location.pathname || !payload.fields || typeof payload.fields !== 'object') {
      return false;
    }

    let restored = false;
    isRestoring = true;

    try {
      Object.entries(payload.fields).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (!element || shouldSkipElement(element)) return;

        writeElementValue(element, value);
        dispatchFieldEvents(element);
        restored = true;
      });
    } finally {
      isRestoring = false;
    }

    if (restored) {
      if (typeof window.initCustomSelects === 'function') window.initCustomSelects();
      window.dispatchEvent(new CustomEvent('interal:formdraftrestore', { detail: { key: storageKey() } }));
      lastSerialized = JSON.stringify(collectDraft());
    }

    return restored;
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
  RESTORE_DELAYS.forEach((delay) => setTimeout(restoreDraft, delay));

  window.addEventListener('load', () => {
    clearResetStateAfterLoad();
    restoreDraft();
    setTimeout(restoreDraft, 250);
  });

  window.InteralFormDraft = Object.assign(window.InteralFormDraft || {}, {
    save: saveDraftNow,
    restore: restoreDraft,
    clear: clearCurrentDraft,
    reset: performDirectReset,
    key: storageKey
  });
})();