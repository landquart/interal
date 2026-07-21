import { buildSearchForm } from '../search-normalizer.js';

export function normalizeForMorphology(value, language = 'en') {
  const original = String(value || '').normalize('NFC');
  const normalized = String(language).toLowerCase() === 'ru'
    ? original.toLowerCase().normalize('NFC').replace(/ё/g, 'е').replace(/[^\p{L}\p{N}'-]+/gu, '')
    : buildSearchForm(original).normalize('NFC').replace(/[^a-z0-9'-]+/g, '');
  const normalizedToOriginalMap = [];
  let originalIndex = 0;
  for (let index = 0; index < normalized.length; index += 1) normalizedToOriginalMap.push(Math.min(originalIndex++, Math.max(0, original.length - 1)));
  return { original, normalized, normalizedToOriginalMap };
}
