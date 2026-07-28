function text(value) {
  return typeof value === 'string' ? value : '';
}

export function languageTranslations(card) {
  const translations = {};
  const addTranslations = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    for (const [code, word] of Object.entries(value)) {
      if (typeof word === 'string' && code.trim() && word.trim()) {
        translations[code.trim()] = word.trim();
      }
    }
  };

  if (card.translation && typeof card.translation === 'object') {
    const code = text(card.translation.language);
    const word = text(card.translation.word);
    if (code && word) translations[code] = word;
  }

  if (card.translations && typeof card.translations === 'object' && !Array.isArray(card.translations)) {
    addTranslations(card.translations);
    addTranslations(card.translations.controlLanguages);
    addTranslations(card.translations.auxiliaryLanguages);
  }

  return translations;
}
