(() => {
  "use strict";

  function currentLanguage() {
    const stored = localStorage.getItem("interal.lang");
    if (stored === "en" || stored === "ru") return stored;
    return document.documentElement.lang === "en" ? "en" : "ru";
  }

  function label(key) {
    const lang = currentLanguage();
    const dictionary = {
      ru: {
        download: "Скачать JSON-карточку",
        empty