import { readFileSync } from 'node:fs';
import { normalizeInterfaceLanguage } from './interface-language.js';

function readPrompt(filename) {
  return readFileSync(new URL(`../prompts/${filename}`, import.meta.url), 'utf8').trim();
}

const SYSTEM_PROMPTS = Object.freeze({
  ru: readPrompt('altervordes-system-ru.txt'),
  en: readPrompt('altervordes-system-en.txt')
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

export function buildAltervordesSystemPrompt(interfaceLanguage, derivationContext) {
  const language = normalizeInterfaceLanguage(interfaceLanguage);
  return replaceRequiredPlaceholder(
    SYSTEM_PROMPTS[language],
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
