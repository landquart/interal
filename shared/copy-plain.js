document.addEventListener("copy", function (event) {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) return;

  const plainText = selection.toString();

  if (!plainText.trim()) return;

  event.preventDefault();
  event.clipboardData.setData("text/plain", plainText);
});

(function loadIndoeuropanJsonDownloadHelper() {
  const path = window.location.pathname.replace(/\/+$/, "");
  if (!path.endsWith("/indoeuropanvordes")) return;
  if (document.querySelector('script[data-indoeuropan-json-download-helper="true"]')) return;

  const script = document.createElement("script");
  script.src = "download-json-card.js?v=5";
  script.defer = true;
  script.dataset.indoeuropanJsonDownloadHelper = "true";
  document.head.appendChild(script);
})();
