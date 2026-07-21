import { en } from './en.js'; import { de } from './de.js'; import { fr } from './fr.js'; import { es } from './es.js'; import { it } from './it.js'; import { ru } from './ru.js';
export const LANGUAGE_CONFIGS = Object.freeze({ en, de, fr, es, it, ru });
export function getLanguageConfig(language) { return LANGUAGE_CONFIGS[String(language || 'en').toLowerCase()] || en; }
