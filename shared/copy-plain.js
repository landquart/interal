document.addEventListener("copy", function (event) {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) return;

  const plainText = selection.toString();

  if (!plainText.trim()) return;

  event.preventDefault();
  event.clipboardData.setData("text/plain", plainText);
});

(function loadDeterminatorPageFixes() {
  if (!/\/determinatorofvalentyp\//.test(window.location.pathname)) return;
  if (document.querySelector('script[data-determinator-page-fixes]')) return;

  const script = document.createElement('script');
  script.src = 'page-fixes.js?v=3';
  script.defer = true;
  script.dataset.determinatorPageFixes = 'true';
  document.head.appendChild(script);
})();
