(function () {
  const DRAFT_PREFIX = 'interal.explicitPageState:';
  const SAVE_DELAY = 150;
  const RESTORE_DELAYS = [0, 80, 250, 600];

  let saveTimer = null;
  let isRestoring = false;
  let lastSerialized = '';

  function isInstrumentPage() {
    return /\/(indoeuropanvordes|associativvordes|determinatorofvalentyp|internationalismes|vordesofcommunites|grammaticebrevvordes)\//.test(window.location.pathname);
  }

  if (!isInstrumentPage()) return;

  function storageKey() {
    return `${DRAFT_PREFIX}${window.location.pathname}`;
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
    if (isRestoring) return;

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
    if (isRestoring) return;

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

  function restoreDraft() {
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

  function clearCurrentDraft() {
    try {
      localStorage.removeItem(storageKey());
    } catch (_) {}
  }

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

    scheduleSaveDraft();
  }, true);

  RESTORE_DELAYS.forEach((delay) => setTimeout(restoreDraft, delay));

  window.addEventListener('load', () => {
    restoreDraft();
    setTimeout(restoreDraft, 250);
  });

  window.addEventListener('beforeunload', saveDraftNow);

  window.InteralFormDraft = Object.assign(window.InteralFormDraft || {}, {
    save: saveDraftNow,
    restore: restoreDraft,
    clear: clearCurrentDraft,
    key: storageKey
  });
})();