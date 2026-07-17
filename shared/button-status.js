(function () {
  function setButtonStatus(selector, text, disabled = true, options = {}) {
    const button = typeof selector === 'string'
      ? document.querySelector(selector)
      : selector;

    if (!button) return false;

    const label = button.querySelector('.btn-text');
    const loading = options.loading === true;

    button.classList.toggle('is-loading', loading);
    button.disabled = Boolean(disabled);
    button.setAttribute('aria-busy', loading ? 'true' : 'false');

    if (label) label.textContent = text || '';
    else button.textContent = text || '';

    return true;
  }

  function createButtonStatusController(options = {}) {
    const setStatus = options.setStatus
      || ((text, disabled, statusOptions) => setButtonStatus(options.selector, text, disabled, statusOptions));
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

    function scheduleRestore(token) {
      restoreTimer = schedule(() => {
        restoreTimer = null;
        restore(token);
      }, delayMs);
    }

    function success(token, text = getSuccessText()) {
      if (!isCurrent(token)) return false;
      clearRestoreTimer();
      setStatus(text, true, { loading: false });
      scheduleRestore(token);
      return true;
    }

    function error(token, text = getErrorText()) {
      if (!isCurrent(token)) return false;
      clearRestoreTimer();
      setStatus(text, false, { loading: false });
      scheduleRestore(token);
      return true;
    }

    function abort(token) {
      return restore(token);
    }

    return { start, progress, success, error, abort, restore, isCurrent };
  }

  const ASSOCIATIVE_LANGUAGE_GROUPS = Object.freeze({
    en: 'Germanic',
    de: 'Germanic',
    fr: 'Romance',
    es: 'Romance',
    it: 'Romance',
    ru: 'Slavic'
  });
  const ASSOCIATIVE_GROUP_ORDER = Object.freeze(['Germanic', 'Romance', 'Slavic']);

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function associativeLanguageCode(item) {
    return String(item?.language || item?.code || '').trim().toLowerCase();
  }

  function normalizeAssociativeCard(card) {
    if (!isPlainObject(card) || card.vord_type !== 'av') return card;
    const next = typeof structuredClone === 'function'
      ? structuredClone(card)
      : JSON.parse(JSON.stringify(card));
    const evidence = Array.isArray(next.language_evidence)
      ? next.language_evidence
      : (Array.isArray(next.language_results) ? next.language_results : []);
    const languageCodes = [...new Set(evidence.map(associativeLanguageCode).filter(code => ASSOCIATIVE_LANGUAGE_GROUPS[code]))];
    const groups = [...new Set(languageCodes.map(code => ASSOCIATIVE_LANGUAGE_GROUPS[code]))]
      .sort((a, b) => ASSOCIATIVE_GROUP_ORDER.indexOf(a) - ASSOCIATIVE_GROUP_ORDER.indexOf(b));

    next.supported_groups = groups;
    if (isPlainObject(next.calculation)) {
      next.calculation.represented_languages = languageCodes.length;
      next.calculation.represented_groups = groups.length;
    }
    if (isPlainObject(next.result)) {
      next.result.represented_languages = languageCodes.length;
      next.result.represented_groups = groups.length;
    }
    return next;
  }

  function normalizeAssociativeJsonText(value) {
    const text = String(value ?? '');
    const wrapped = /^\s*\/card\s*\n([\s\S]*)\n\/done\s*$/m.exec(text);
    const jsonText = wrapped ? wrapped[1] : text;
    let card;
    try {
      card = JSON.parse(jsonText);
    } catch {
      return text;
    }
    const normalized = normalizeAssociativeCard(card);
    const serialized = JSON.stringify(normalized, null, 2);
    return wrapped ? `/card\n${serialized}\n/done` : serialized;
  }

  function isAssociativePage() {
    return String(globalThis.location?.pathname || '').includes('/associativvordes/');
  }

  function installAssociativeCardOutputNormalizer() {
    if (!isAssociativePage()) return;
    const output = document.getElementById('jsonCardOutput');
    if (!output || output.__interalAssociativeValuePatched) return;
    const TextareaConstructor = globalThis.HTMLTextAreaElement;
    if (typeof TextareaConstructor !== 'function') return;
    const descriptor = Object.getOwnPropertyDescriptor(TextareaConstructor.prototype, 'value');
    if (!descriptor?.get || !descriptor?.set) return;
    Object.defineProperty(output, 'value', {
      configurable: true,
      enumerable: descriptor.enumerable,
      get() { return descriptor.get.call(this); },
      set(value) { descriptor.set.call(this, normalizeAssociativeJsonText(value)); }
    });
    Object.defineProperty(output, '__interalAssociativeValuePatched', { value: true });
  }

  function installAssociativeCardsFetchNormalizer() {
    if (!isAssociativePage()) return;
    if (window.__INTERAL_ASSOCIATIVE_CARD_FETCH_PATCHED__) return;
    const originalFetch = window.fetch?.bind(window);
    if (typeof originalFetch !== 'function') return;
    window.fetch = function patchedFetch(input, init = {}) {
      const url = typeof input === 'string' ? input : input?.url;
      if (String(url || '').includes('/api/cards') && typeof init.body === 'string') {
        try {
          const request = JSON.parse(init.body);
          if (isPlainObject(request?.payload) && request.payload.vord_type === 'av') {
            init = { ...init, body: JSON.stringify({ ...request, payload: normalizeAssociativeCard(request.payload) }) };
          }
        } catch {
          // Preserve the original request; the API will return its normal validation error.
        }
      }
      return originalFetch(input, init);
    };
    window.__INTERAL_ASSOCIATIVE_CARD_FETCH_PATCHED__ = true;
  }

  window.InteralButtonStatus = {
    setButtonStatus,
    createButtonStatusController
  };
  window.InteralAssociativeCardCompat = Object.freeze({
    normalizeAssociativeCard,
    normalizeAssociativeJsonText
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      installAssociativeCardOutputNormalizer();
      installAssociativeCardsFetchNormalizer();
    }, { once: true });
  } else {
    installAssociativeCardOutputNormalizer();
    installAssociativeCardsFetchNormalizer();
  }
})();
