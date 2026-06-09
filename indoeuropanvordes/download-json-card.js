(() => {
  "use strict";

  function getText(key) {
    const isEn = localStorage.getItem("interal.lang") === "en";
    const ru = {
      download: "Скачать JSON-карточку",
      empty: "Сначала сгенерируйте JSON-карточку.",
      invalid: "JSON-карточка содержит ошибку и не может быть скачана как корректный JSON.",
      done: "JSON-карточка скачана"
    };
    const en = {
      download: