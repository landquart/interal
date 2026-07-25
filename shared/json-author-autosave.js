(function () {
  const IDS = Object.freeze({
    remember: 'rememberAuthorData',
    name: 'authorDisplayName',
    contactType: 'authorContactType',
    contactValue: 'authorContactValue',
    clearButton: 'clearSavedAuthorData'
  });

  const $ = (id) => document.getElementById(id);

  function authorStorage() {
    return window.InteralJsonAuthorStorage || window.InteralJsonCardModal || null;
  }

  function currentAuthorData() {
    return {
      displayName: $(IDS.name)?.value?.trim() || '',
      contactType: $(IDS.contactType)?.value || 'telegram',
      contactValue: $(IDS.contactValue)?.value?.trim() || ''
    };
  }

  function syncClearButton() {
    const storage = authorStorage();
    const clearButton = $(IDS.clearButton);
    if (!storage || !clearButton) return;
    const hidden = !storage.hasSavedAuthorData?.();
    clearButton.hidden = hidden;
    const actions = clearButton.closest('.author-data-actions');
    if (actions) actions.hidden = hidden;
  }

  function persistRememberedAuthor() {
    const remember = $(IDS.remember);
    const storage = authorStorage();
    if (!remember?.checked || !storage) return false;

    const data = currentAuthorData();
    const hasData = Boolean(data.displayName || data.contactValue);
    if (hasData) storage.saveAuthorData?.(data);
    else storage.clearSavedAuthorData?.();
    syncClearButton();
    return hasData;
  }

  function initAuthorAutosave() {
    const remember = $(IDS.remember);
    if (!remember || remember.dataset.authorAutosaveReady === 'true') return;
    remember.dataset.authorAutosaveReady = 'true';

    const name = $(IDS.name);
    const contactType = $(IDS.contactType);
    const contactValue = $(IDS.contactValue);

    remember.addEventListener('change', () => {
      if (remember.checked) persistRememberedAuthor();
      else {
        authorStorage()?.clearSavedAuthorData?.();
        syncClearButton();
      }
    });

    for (const field of [name, contactValue]) {
      field?.addEventListener('input', persistRememberedAuthor);
      field?.addEventListener('change', persistRememberedAuthor);
    }
    contactType?.addEventListener('change', persistRememberedAuthor);

    window.addEventListener('pagehide', persistRememberedAuthor);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') persistRememberedAuthor();
    });

    syncClearButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthorAutosave, { once: true });
  } else {
    initAuthorAutosave();
  }

  window.InteralJsonAuthorAutosave = Object.freeze({
    persist: persistRememberedAuthor,
    init: initAuthorAutosave
  });
})();
