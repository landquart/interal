(() => {
  "use strict";

  const OUTPUT_ID = "jsonCardOutput";
  const COPY_BUTTON_ID = "copyJsonCardBtn";
  const DOWNLOAD_BUTTON_ID = "downloadJsonCardBtn";

  function currentLanguage() {
    const stored = localStorage.getItem("interal.lang");
    if (stored === "en" || stored === "ru") return stored;
    return document.documentElement.lang === "en" ? "en" : "ru";
 