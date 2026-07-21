(function () {
  const BUTTON_LOADER_FILENAME = 'loader_video_fitted_0_1s_triangle_fixed_centered.svg';
  const currentScript = document.currentScript;
  const buttonLoaderUrl = currentScript
    ? new URL(`../elements/${BUTTON_LOADER_FILENAME}`, currentScript.src).href
    : `/elements/${BUTTON_LOADER_FILENAME}`;

  function installButtonLoaderStyles() {
    if (document.getElementById('interal-button-loader-styles')) return;

    const style = document.createElement('style');
    style.id = 'interal-button-loader-styles';
    style.textContent = `
      button.interal-btn,
      button.tool-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
      }

      button.interal-btn > .btn-loader,
      button.tool-btn > .btn-loader {
        display: none;
        width: 22px;
        height: 22px;
        flex: 0 0 22px;
        object-fit: contain;
        pointer-events: none;
      }

      button.interal-btn.is-loading,
      button.tool-btn.is-loading {
        cursor: wait;
      }

      button.interal-btn.is-loading > .btn-loader,
      button.tool-btn.is-loading > .btn-loader,
      button.interal-btn[aria-busy="true"] > .btn-loader,
      button.tool-btn[aria-busy="true"] > .btn-loader {
        display: block;
      }

      button.interal-btn--primary > .btn-loader {
        filter: var(--button-loader-filter, brightness(0) invert(1));
      }

      button.interal-btn > .btn-text,
      button.tool-btn > .btn-text {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      @media (max-width: 640px) {
        button.interal-btn > .btn-loader,
        button.tool-btn > .btn-loader {
          width: 20px;
          height: 20px;
          flex-basis: 20px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureButtonStructure(button) {
    if (!(button instanceof HTMLButtonElement)) return null;

    let loader = button.querySelector(':scope > .btn-loader');
    if (!loader) {
      loader = document.createElement('img');
      loader.className = 'btn-loader';
      loader.alt = '';
      loader.setAttribute('aria-hidden', 'true');
      loader.decoding = 'async';
      loader.src = buttonLoaderUrl;
      button.prepend(loader);
    } else if (!loader.getAttribute('src')) {
      loader.src = buttonLoaderUrl;
    }

    let label = button.querySelector(':scope > .btn-text');
    if (!label) {
      label = document.createElement('span');
      label.className = 'btn-text';

      const text = Array.from(button.childNodes)
        .filter((node) => node !== loader && node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent || '')
        .join('')
        .trim();

      Array.from(button.childNodes).forEach((node) => {
        if (node !== loader && node.nodeType === Node.TEXT_NODE) node.remove();
      });

      label.textContent = text;
      button.appendChild(label);
    }

    return { loader, label };
  }

  function prepareExistingButtonLoaders(root = document) {
    root.querySelectorAll('.btn-loader').forEach((loader) => {
      const button = loader.closest('button');
      if (button) ensureButtonStructure(button);
    });
  }

  function setButtonStatus(selector, text, disabled = true, options = {}) {
    const button = typeof selector === 'string'
      ? document.querySelector(selector)
      : selector;

    if (!button) return false;

    installButtonLoaderStyles();
    const structure = ensureButtonStructure(button);
    const label = structure?.label || button.querySelector('.btn-text');
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

  installButtonLoaderStyles();

  window.InteralButtonStatus = {
    setButtonStatus,
    createButtonStatusController,
    ensureButtonStructure
  };
  window.InteralAssociativeCardCompat = Object.freeze({
    normalizeAssociativeCard,
    normalizeAssociativeJsonText
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      prepareExistingButtonLoaders();
      installAssociativeCardOutputNormalizer();
      installAssociativeCardsFetchNormalizer();
    }, { once: true });
  } else {
    prepareExistingButtonLoaders();
    installAssociativeCardOutputNormalizer();
    installAssociativeCardsFetchNormalizer();
  }
})();
