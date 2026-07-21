const COMBINING_MARK = /\p{M}/u;
const LATIN_ALLOWED = /[a-z0-9'-]/;
const RUSSIAN_ALLOWED = /[\p{L}\p{N}'-]/u;

function normalizeChar(char, language) {
  const lower = char.toLocaleLowerCase(language === 'ru' ? 'ru' : undefined);
  if (language === 'ru') return lower.replace(/ё/g, 'е').normalize('NFC');
  return lower.normalize('NFD').replace(/\p{M}+/gu, '').normalize('NFC');
}

export function normalizeForMorphology(value, language = 'en') {
  const original = String(value || '').normalize('NFC');
  const code = String(language || 'en').toLowerCase();
  let normalized = '';
  const normalizedToOriginalMap = [];
  let originalOffset = 0;
  for (const sourceChar of original) {
    const transformed = normalizeChar(sourceChar, code);
    for (const outputChar of transformed) {
      if (COMBINING_MARK.test(outputChar)) continue;
      const allowed = code === 'ru' ? RUSSIAN_ALLOWED.test(outputChar) : LATIN_ALLOWED.test(outputChar);
      if (!allowed) continue;
      normalized += outputChar;
      normalizedToOriginalMap.push(originalOffset);
    }
    originalOffset += sourceChar.length;
  }
  return { original, normalized, normalizedToOriginalMap };
}

export function mapNormalizedRangeToOriginal(normalizedResult, start, end) {
  const map = normalizedResult?.normalizedToOriginalMap || [];
  const original = normalizedResult?.original || '';
  const safeStart = Math.max(0, Math.min(Number(start) || 0, map.length));
  const safeEnd = Math.max(safeStart, Math.min(Number(end) || safeStart, map.length));
  if (!map.length || safeStart === safeEnd) {
    const offset = safeStart < map.length ? map[safeStart] : original.length;
    return { start: offset, end: offset };
  }
  const originalStart = map[safeStart];
  const lastMapped = map[safeEnd - 1];
  const sourceChar = [...original.slice(lastMapped)][0] || '';
  return { start: originalStart, end: Math.min(original.length, lastMapped + sourceChar.length) };
}
