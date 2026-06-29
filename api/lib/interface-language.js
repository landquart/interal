export function normalizeInterfaceLanguage(value) {
  return value === 'en' ? 'en' : 'ru';
}

export function getAnswerLanguageName(interfaceLanguage) {
  return normalizeInterfaceLanguage(interfaceLanguage) === 'en' ? 'English' : 'Russian';
}

export function getQwenLanguageInstruction(interfaceLanguage) {
  const lang = normalizeInterfaceLanguage(interfaceLanguage);
  const answerLanguage = getAnswerLanguageName(lang);

  return `
The interface language is: ${lang}.
Write ALL human-readable response values in ${answerLanguage}.
Do not mix languages.
Keep JSON keys exactly as requested in English.
Only translate values, explanations, conclusions, risks, notes, comments, labels, and analysis text.
If the input contains words from another language, do not switch the explanation language because of the input.
`;
}
