(() => {
  "use strict";

  const DOWNLOAD_BUTTON_ID = "downloadJsonCardBtn";

  const TEXT = {
    ru: {
      download: "Скачать JSON-карточку",
      empty: "Сначала сгенерируйте JSON-карточку.",
      invalid: "JSON-карточка содержит ошибку и не может быть скачана как корректный JSON.",
      success: "JSON-карточка скачана"
    },
    en: {
      download: "Download JSON card",
      empty: "Generate the JSON card first.",
      invalid: "The JSON card contains invalid JSON and cannot be downloaded.",
      success: "JSON card downloaded"
    }
  };

  function getCurrentLanguage() {
    return localStorage.getItem("interal.lang") === "en" ? "en" : "ru";
  }

  function getText(key) {
    return TEXT[getCurrentLanguage()][key];
  }

  function sanitizeFilePart(value) {
    return String(value || "")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
  }

  function getCardFileName(card) {
    const word = sanitizeFilePart(card?.interal?.word);
    if (word) return `${word}.json`;

    const id = sanitizeFilePart(card?.id);
    if (id) return `${id}.json`;

    return "indoeuropan-card.json";
  }

  function makeDownloadButton() {
    const button = document.createElement("button");
    button.id = DOWNLOAD_BUTTON_ID;
    button.className = "json-card-icon-btn";
    button.type = "button";
    button.setAttribute("aria-label", getText("download"));
    button.title = getText("download");

    const icon = document.createElement("img");
    icon.className = "menu-copy-icon";
    icon.src = "../elements/Download.svg";
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");

    button.appendChild(icon);
    return button;
  }

  function downloadTextFile(text, fileName) {
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function updateButtonText(button) {
    button.setAttribute("aria-label", getText("download"));
    button.title = getText("download");
  }

  function initJsonCardDownload() {
    const output = document.getElementById("jsonCardOutput");
    const actions = document.querySelector(".json-card-actions");
    const copyButton = document.getElementById("copyJsonCardBtn");

    if (!output || !actions || !copyButton) return;

    const existingButton = document.getElementById(DOWNLOAD_BUTTON_ID);
    const button = existingButton || makeDownloadButton();
    updateButtonText(button);

    if (!existingButton) {
      copyButton.insertAdjacentElement("afterend", button);
    }

    button.addEventListener("click", () => {
      const jsonText = output.value.trim();

      if (!jsonText) {
        alert(getText("empty"));
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonText);
      } catch (error) {
        alert(getText("invalid"));
        return;
      }

      downloadTextFile(jsonText, getCardFileName(parsed));
      button.setAttribute("aria-label", getText("success"));
      button.title = getText("success");
      window.setTimeout(() => updateButtonText(button), 1500);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initJsonCardDownload, { once: true });
  } else {
    initJsonCardDownload();
  }
})();
