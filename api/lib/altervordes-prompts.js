import { readFileSync } from 'node:fs';
import { normalizeInterfaceLanguage } from './interface-language.js';

function readPrompt(filename) {
  return readFileSync(new URL(`../prompts/${filename}`, import.meta.url), 'utf8').trim();
}

const SYSTEM_PROMPTS = Object.freeze({
  ru: readPrompt('altervordes-system-ru.txt'),
  en: readPrompt('altervordes-system-en.txt')
});

const DERIVATIVE_VALIDATION_SECTIONS = Object.freeze({
  ru: readPrompt('altervordes-derivative-validation-ru.txt'),
  en: readPrompt('altervordes-derivative-validation-en.txt')
});

const DERIVATIVE_SECTION_BOUNDARIES = Object.freeze({
  ru: {
    start: 'VII. СУЩЕСТВИТЕЛЬНЫЕ И ПРИЛАГАТЕЛЬНЫЕ БЕЗ УКАЗАННЫХ СУФФИКСОВ',
    end: 'VIII. СУЩЕСТВИТЕЛЬНЫЕ ОТ ОСНОВ НА D И R'
  },
  en: {
    start: 'VII. NOUNS AND ADJECTIVES WITHOUT THE LISTED SUFFIXES',
    end: 'VIII. NOUNS FROM STEMS ENDING IN D AND R'
  }
});

const SHORT_CONCLUSION_SCHEMA = `"shortConclusion": {
    "en": "",
    "de": "",
    "fr": "",
    "es": "",
    "it": "",
    "ru": ""
  }`;

const SHORT_CONCLUSION_GUIDANCE = Object.freeze({
  ru: `Поле \`shortConclusion\` должно содержать шесть кратких, естественных и семантически эквивалентных версий вывода на английском, немецком, французском, испанском, итальянском и русском языках.

Каждое из полей \`en\`, \`de\`, \`fr\`, \`es\`, \`it\` и \`ru\` обязательно и должно содержать непустую строку.

Сначала сформулируй один точный вывод по результатам анализа, затем передай его без изменения смысла на всех шести языках. Все версии должны выражать одно и то же решение, одни и те же основания, одинаковую степень уверенности и одинаковые ограничения. Не добавляй в одну языковую версию сведения, отсутствующие в других. Не смешивай языки и не оставляй непереведённые фрагменты.

Переводи смысл естественно, а не механически слово в слово. Названия форм Интераля, морфемы, условные обозначения и примеры слов сохраняй без перевода, когда они являются объектом анализа.

Каждая версия должна быть краткой и не повторять все предыдущие разделы.`,
  en: `The \`shortConclusion\` field must contain six concise, natural, and semantically equivalent versions of the conclusion in English, German, French, Spanish, Italian, and Russian.

Each of the \`en\`, \`de\`, \`fr\`, \`es\`, \`it\`, and \`ru\` fields is required and must contain a non-empty string.

First formulate one precise conclusion from the analysis, then express it without changing its meaning in all six languages. Every version must communicate the same decision, grounds, degree of certainty, and limitations. Do not add information to one language version that is absent from the others. Do not mix languages or leave untranslated fragments.

Translate the meaning naturally rather than mechanically word for word. Preserve Interal forms, morphemes, notation, and example words unchanged when they are the object of analysis.

Keep every version concise and do not repeat all preceding sections.`
});

const SHORT_CONCLUSION_USER_REQUIREMENT = Object.freeze({
  ru: 'Поле shortConclusion обязательно заполни на всех шести контрольных языках: en, de, fr, es, it, ru. Все шесть версий должны быть семантически эквивалентны.',
  en: 'Populate shortConclusion in all six control languages: en, de, fr, es, it, ru. All six versions must be semantically equivalent.'
});

const USER_PROMPTS = Object.freeze({
  ru: readPrompt('altervordes-user-ru.txt'),
  en: readPrompt('altervordes-user-en.txt')
});

function replaceRequiredPlaceholder(template, placeholder, value) {
  if (!template.includes(placeholder)) {
    throw new Error(`Missing prompt placeholder: ${placeholder}`);
  }
  return template.replace(placeholder, value);
}

function replaceRequiredText(template, original, replacement) {
  if (!template.includes(original)) {
    throw new Error(`Missing required prompt text: ${original}`);
  }
  return template.replace(original, replacement);
}

function replaceRequiredSection(template, startHeading, endHeading, replacement) {
  const startIndex = template.indexOf(startHeading);
  const endIndex = template.indexOf(endHeading, startIndex + startHeading.length);
  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
    throw new Error(`Missing prompt section boundary: ${startHeading} -> ${endHeading}`);
  }
  return `${template.slice(0, startIndex)}${replacement.trim()}\n\n${template.slice(endIndex)}`;
}

function applyMultilingualShortConclusion(template, language) {
  const oldGuidance = language === 'ru'
    ? '`shortConclusion` должно содержать краткий итог без повторения всех разделов.'
    : 'Keep `shortConclusion` concise and do not repeat all previous sections.';
  return replaceRequiredText(
    replaceRequiredText(template, '"shortConclusion": ""', SHORT_CONCLUSION_SCHEMA),
    oldGuidance,
    SHORT_CONCLUSION_GUIDANCE[language]
  );
}

export function buildAltervordesSystemPrompt(interfaceLanguage, derivationContext, options = {}) {
  const language = normalizeInterfaceLanguage(interfaceLanguage);
  const boundaries = DERIVATIVE_SECTION_BOUNDARIES[language];
  const revisedTemplate = replaceRequiredSection(
    SYSTEM_PROMPTS[language],
    boundaries.start,
    boundaries.end,
    DERIVATIVE_VALIDATION_SECTIONS[language]
  );
  const finalTemplate = options.multilingualShortConclusion === true
    ? applyMultilingualShortConclusion(revisedTemplate, language)
    : revisedTemplate;
  return replaceRequiredPlaceholder(
    finalTemplate,
    '{{INTERAL_DERIVATION_CONTEXT}}',
    JSON.stringify(derivationContext, null, 2)
  );
}

export function buildAltervordesUserPrompt(input, options = {}) {
  const language = normalizeInterfaceLanguage(input?.interfaceLanguage);
  const rendered = replaceRequiredPlaceholder(
    USER_PROMPTS[language],
    '{{INPUT_JSON}}',
    JSON.stringify(input, null, 2)
  );
  return options.multilingualShortConclusion === true
    ? `${rendered}\n\n${SHORT_CONCLUSION_USER_REQUIREMENT[language]}`
    : rendered;
}
