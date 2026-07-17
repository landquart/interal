(function () {
  function setButtonStatus(selector, text, disabled = true, options = {}) {
    const button =
      typeof selector === 'string'
        ? document.querySelector(selector)
        : selector;

    if (!button) return false;

    const label = button.querySelector('.btn-text');
    const loading = options.loading === true;

    button.classList.toggle('is-loading', loading);
    button.disabled = Boolean(disabled);
    button.setAttribute('aria-busy', loading ? 'true' : 'false');

    if (label) {
      label.textContent = text || '';
    } else {
      button.textContent = text || '';
    }

    return true;
  }


  function createButtonStatusController(options = {}) {
    const setStatus = options.setStatus || ((text, disabled, statusOptions) => setButtonStatus(options.selector, text, disabled, statusOptions));
    const getDefaultText = options.getDefaultText || (() => '');
    const getSuccessText = options.getSuccessText || (() => 'Done');
    const getErrorText = options.getErrorText || (() => 'Error');
    const delayMs = Number.isFinite(options.successDelayMs) ? options.successDelayMs : 800;
    const schedule = options.setTimeout || window.setTimeout.bind(window);
    const cancel = options.clearTimeout || window.clearTimeout.bind(window);
    let activeToken = 0;
    let restoreTimer = null;

    function clearRestoreTimer() {
      if (restoreTimer !== null) {
        cancel(restoreTimer);
        restoreTimer = null;
      }
    }

    function isCurrent(token) {
      return token === activeToken;
    }

    function restore(token = activeToken) {
      if (!isCurrent(token)) return false;
      clearRestoreTimer();
      setStatus(getDefaultText(), false, { loading: false });
      return true;
    }

    function start(text) {
      activeToken += 1;
      const token = activeToken;
      clearRestoreTimer();
      setStatus(text, true, { loading: true });
      return token;
    }

    function progress(token, text) {
      if (!isCurrent(token)) return false;
      setStatus(text, true, { loading: true });
      return true;
    }

    function success(token, text = getSuccessText()) {
      if (!isCurrent(token)) return false;
      clearRestoreTimer();
      setStatus(text, true, { loading: true });
      restoreTimer = schedule(() => {
        restoreTimer = null;
        restore(token);
      }, delayMs);
      return true;
    }

    function error(token, text = getErrorText()) {
      if (!isCurrent(token)) return false;
      clearRestoreTimer();
      setStatus(text, false, { loading: false });
      restoreTimer = schedule(() => {
        restoreTimer = null;
        restore(token);
      }, delayMs);
      return true;
    }

    function abort(token) {
      return restore(token);
    }

    return { start, progress, success, error, abort, restore, isCurrent };
  }

  window.InteralButtonStatus = {
    setButtonStatus,
    createButtonStatusController
  };
})();
