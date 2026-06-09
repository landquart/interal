(() => {
  "use strict";

  const outputId = "jsonCardOutput";
  const copyButtonId = "copyJsonCardBtn";
  const downloadButtonId = "downloadJsonCardBtn";

  function lang() {
    const saved = localStorage.getItem("interal.lang");
    return saved === "en" ? "en" : "ru";
  }

  function text(key) {
    const dict = {
      ru: {
        download: "Скачать JSON-карточку",
        empty: "Сначала сгенерируйте JSON-карточку.",