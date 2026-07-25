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

function replaceRequiredSection(template, startHeading, endHeading, replacement) {
  const startIndex = template.indexOf(startHeading);
  const endIndex = template.indexOf(endHeading, startIndex + startHeading.length);
  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
    throw new Error(`Missing prompt section boundary: ${startHeading} -> ${endHeading}`);
  }
  return `${template.slice(0, startIndex)}${replacement.trim()}\n\n${template.slice(endIndex)}`;
}

export function buildAltervordesSystemPrompt(interfaceLanguage, derivationContext) {
  const language = normalizeInterfaceLanguage(interfaceLanguage);
  const boundaries = DERIVATIVE_SECTION_BOUNDARIES[language];
  const revisedTemplate = replaceRequiredSection(
    SYSTEM_PROMPTS[language],
    boundaries.start,
    boundaries.end,
    DERIVATIVE_VALIDATION_SECTIONS[language]
  );
  return replaceRequiredPlaceholder(
    revisedTemplate,
    '{{INTERAL_DERIVATION_CONTEXT}}',
    JSON.stringify(derivationContext, null, 2)
  );
}

export function buildAltervordesUserPrompt(input) {
  const language = normalizeInterfaceLanguage(input?.interfaceLanguage);
  return replaceRequiredPlaceholder(
    USER_PROMPTS[language],
    '{{INPUT_JSON}}',
    JSON.stringify(input, null, 2)
  );
}
