document.addEventListener("copy", function (event) {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) return;

  const plainText = selection.toString();

  if (!plainText.trim()) return;

  event.preventDefault();
  event.clipboardData.setData("text/plain", plainText);
});

(function prepareInteralPageStateBridge() {
  const instrumentPath = /\/(indoeuropanvordes|associativvordes|determinatorofvalentyp|internationalismes|vordesofcommunites|grammaticebrevivordes|altervordes|affixes)\//;
  if (!instrumentPath.test(window.location.pathname)) return;

  const importDescriptor = Object.getOwnPropertyDescriptor(window, 'InteralPageStateImport');
  const exportDescriptor = Object.getOwnPropertyDescriptor(window, 'InteralPageStateExport');
  if (importDescriptor && !importDescriptor.configurable) return;
  if (exportDescriptor && !exportDescriptor.configurable) return;

  let realImport = typeof window.InteralPageStateImport === 'function'
    ? window.InteralPageStateImport
    : null;
  let realExport = typeof window.InteralPageStateExport === 'function'
    ? window.InteralPageStateExport
    : null;
  let pendingPageState = null;

  const schedule = typeof window.queueMicrotask === 'function'
    ? window.queueMicrotask.bind(window)
    : (callback) => Promise.resolve().then(callback);

  const bufferedImport = (state) => {
    if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
    pendingPageState = state;
    return true;
  };

  const bufferedExport = () => pendingPageState;

  function applyPendingPageState() {
    if (!realImport || !pendingPageState) return;
    const state = pendingPageState;

    schedule(() => {
      if (!realImport || pendingPageState !== state) return;

      try {
        if (realImport(state) !== false) {
          pendingPageState = null;
        }
      } catch (error) {
        console.warn('Could not apply buffered page state:', error);
      }
    });
  }

  Object.defineProperty(window, 'InteralPageStateImport', {
    configurable: true,
    enumerable: true,
    get() {
      return realImport || bufferedImport;
    },
    set(value) {
      realImport = typeof value === 'function' ? value : null;
      applyPendingPageState();
    }
  });

  Object.defineProperty(window, 'InteralPageStateExport', {
    configurable: true,
    enumerable: true,
    get() {
      if (pendingPageState) return bufferedExport;
      return realExport || bufferedExport;
    },
    set(value) {
      realExport = typeof value === 'function' ? value : null;
    }
  });

  applyPendingPageState();
})();

(function loadInteralFormDraft() {
  if (window.__interalFormDraftLoaderReady) return;
  window.__interalFormDraftLoaderReady = true;

  const loaderScriptSrc = document.currentScript?.src || document.baseURI;

  function loadFallback() {
    if (window.InteralFormDraft) return;

    const declaredFormDraft = Array.from(document.scripts || []).some((candidate) => {
      try {
        return /(?:^|\/)form-draft\.js$/.test(new URL(candidate.src, document.baseURI).pathname);
      } catch (_) {
        return false;
      }
    });

    // Pages that explicitly include form-draft.js must use that one copy only.
    if (declaredFormDraft) return;

    const scriptUrl = new URL('form-draft.js?v=ui-polish-20260704', loaderScriptSrc).toString();
    const script = document.createElement('script');
    script.src = scriptUrl;
    document.head.appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadFallback, { once: true });
  } else {
    loadFallback();
  }
})();
