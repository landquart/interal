document.addEventListener("copy", function (event) {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) return;

  const plainText = selection.toString();

  if (!plainText.trim()) return;

  event.preventDefault();
  event.clipboardData.setData("text/plain", plainText);
});
