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

  window.InteralButtonStatus = {
    setButtonStatus
  };
})();
