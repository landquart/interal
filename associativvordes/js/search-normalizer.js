const RUSSIAN_SEARCH_MAP = Object.freeze({
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'jo', ж: 'zh', з: 'z', и: 'i', й: 'j',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '-', ы: 'y', ь: '', э: 'e', ю: 'ju', я: 'ja'
});

export const SEARCH_NORMALIZER_VERSION = '4';

export function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase().normalize('NFC');
}

export function normalizeSearchPunctuation(value) {
  return normalizeText(value)
    .replace(/[’‘‛ʼ`´]/g, "'")
    .replace(/[‐‑‒–—―−﹘﹣－]/g, '-');
}

export function transliterateRussianForSearch(value) {
  return Array.from(normalizeSearchPunctuation(value))
    .map(char => RUSSIAN_SEARCH_MAP[char] ?? char)
    .join('');
}

export function stripDiacritics(value) {
  return normalizeText(value)
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC');
}

export function buildSearchForm(value) {
  return stripDiacritics(transliterateRussianForSearch(value))
    .replace(/\s+/g, ' ')
    .trim();
}

export function isUsableSearchForm(value) {
  return /[a-z0-9]/i.test(String(value ?? ''));
}
