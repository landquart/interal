document.addEventListener("copy", function (event) {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) return;

  const plainText = selection.toString();

  if (!plainText.trim()) return;

  event.preventDefault();
  event.clipboardData.setData("text/plain", plainText);
});

(function loadInteralFormDraft() {
  if (window.__interalFormDraftLoaderReady) return;
  window.__interalFormDraftLoaderReady = true;

  const currentScript = document.currentScript;
  const scriptUrl = currentScript
    ? new URL('form-draft.js?v=reset-simple-20260626', currentScript.src).toString()
    : '../shared/form-draft.js?v=reset-simple-20260626';

  const script = document.createElement('script');
  script.src = scriptUrl;
  script.defer = true;
  document.head.appendChild(script);
})();