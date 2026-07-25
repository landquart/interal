const BASE_VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
const STRESS_VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y']);

const U_AS_VOWEL_EXCEPTIONS = [
  'authentic',
  'pausa',
  'haus',
  'audir',
  'aura',
  'fauna',
  'sauna',
  'caus',
  'applaudir',
  'laudar'
];

const X_AS_KZ_WORDS = ['examen', 'exemple', 'exercise', 'exister'];

function parseOrthography(input) {
  const chars = [];
  let explicitStress = -1;
  const graveIndices = new Set();
  const normalized = String(input || '').trim().toLowerCase().normalize('NFD');

  for (const symbol of normalized) {
    if (/^[a-z]$/.test(symbol)) {
      chars.push(symbol);
      continue;
    }

    if ((symbol === '\u0301' || symbol === '\u0300') && chars.length) {
      explicitStress = chars.length - 1;
      if (symbol === '\u0300') graveIndices.add(chars.length - 1);
    }
  }

  return { chars, explicitStress, graveIndices };
}

function isStressVowel(char) {
  return STRESS_VOWELS.has(char);
}

function vowelIndices(chars) {
  const result = [];
  chars.forEach((char, index) => {
    if (isStressVowel(char)) result.push(index);
  });
  return result;
}

function previousVowel(chars, beforeIndex) {
  for (let index = beforeIndex - 1; index >= 0; index -= 1) {
    if (isStressVowel(chars[index])) return index;
  }
  return -1;
}

function findStressIndex(chars, explicitStress, partOfSpeech = '') {
  const vowels = vowelIndices(chars);
  if (vowels.length <= 1) return -1;
  if (explicitStress >= 0 && isStressVowel(chars[explicitStress])) return explicitStress;

  const word = chars.join('');
  const lastVowel = vowels[vowels.length - 1];

  if (/(?:ita|ite|eta|ete|yer)$/.test(word)) return lastVowel;
  if (word.endsWith('abil')) return word.length - 4;
  if (word.endsWith('ibil')) return word.length - 4;
  if (word.endsWith('eria')) return vowels[vowels.length - 2];

  const shiftedEnding = word.match(/(?:ic|er|or|ing|im|um|us|is|ul|ix)$/)?.[0];
  if (shiftedEnding && !(shiftedEnding === 'er' && partOfSpeech === 'verb')) {
    const index = previousVowel(chars, word.length - shiftedEnding.length);
    if (index >= 0) return index;
  }

  for (let index = chars.length - 1; index >= 0; index -= 1) {
    if (!isStressVowel(chars[index])) {
      if (chars[index] === 'u' && index > 0 && BASE_VOWELS.has(chars[index - 1])) {
        return index - 1;
      }
      const indexBeforeLastConsonant = previousVowel(chars, index);
      if (indexBeforeLastConsonant >= 0) return indexBeforeLastConsonant;
    }
  }

  return vowels[Math.max(0, vowels.length - 2)];
}

function findSyllableStart(chars, stressIndex) {
  if (stressIndex < 0) return -1;
  const previous = previousVowel(chars, stressIndex);
  return previous < 0 ? 0 : previous + 1;
}

function isVowelForContext(chars, index) {
  const char = chars[index];
  if (BASE_VOWELS.has(char)) return true;
  if (char !== 'y') return false;

  const previous = chars[index - 1];
  const next = chars[index + 1];
  return !(BASE_VOWELS.has(previous) && next);
}

function usesRegularU(word) {
  return U_AS_VOWEL_EXCEPTIONS.some((root) => word.startsWith(root));
}

function usesKzForX(word) {
  return X_AS_KZ_WORDS.some((root) => word.startsWith(root));
}

export function transcribeInteral(input, options = {}) {
  const { chars, explicitStress, graveIndices } = parseOrthography(input);
  if (!chars.length) return '';

  const word = chars.join('');
  const stressIndex = findStressIndex(
    chars,
    explicitStress,
    String(options.partOfSpeech || '')
  );
  const stressStart = findSyllableStart(chars, stressIndex);
  const regularU = usesRegularU(word);
  const xAsKz = usesKzForX(word);
  const output = [];

  for (let index = 0; index < chars.length; index += 1) {
    if (index === stressStart) output.push('ˈ');

    const char = chars[index];
    const next = chars[index + 1];
    const next2 = chars[index + 2];
    const previous = chars[index - 1];

    if (char === 'q' && next === 'u') {
      output.push('kw');
      index += 1;
      continue;
    }

    if (char === 'g' && next === 'u' && isVowelForContext(chars, index + 2)) {
      output.push('gw');
      index += 1;
      continue;
    }

    if (char === 's' && next === 'h') {
      output.push('ʂ');
      index += 1;
      continue;
    }

    if (char === 'c' && next === 'h') {
      output.push(graveIndices.has(index + 2) ? 'k' : 't͡ɕ');
      index += 1;
      continue;
    }

    if (char === 'z' && next === 'z') {
      output.push('t͡s');
      index += 1;
      continue;
    }

    if (char === 'p' && next === 'h') {
      output.push('f');
      index += 1;
      continue;
    }

    if (char === 'r' && next === 'h') {
      output.push('r');
      index += 1;
      continue;
    }

    if (char === 't' && next === 'h') {
      output.push('t');
      index += 1;
      continue;
    }

    if (char === 't' && next === 'i' && ['a', 'e', 'o', 'u'].includes(next2)) {
      output.push('t͡s');
      continue;
    }

    if (char === 'c') {
      output.push(['i', 'e', 'y'].includes(next) ? 't͡s' : 'k');
    } else if (char === 's') {
      output.push(
        isVowelForContext(chars, index - 1) && isVowelForContext(chars, index + 1)
          ? 'z'
          : 's'
      );
    } else if (char === 'u' && !regularU && ['a', 'e'].includes(previous)) {
      output.push('w');
    } else if (char === 'x') {
      output.push(xAsKz ? 'kz' : 'ks');
    } else if (char === 'y') {
      output.push(isVowelForContext(chars, index - 1) && Boolean(next) ? 'j' : 'i');
    } else {
      output.push({
        a: 'a',
        b: 'b',
        d: 'd',
        e: 'e',
        f: 'f',
        g: 'g',
        h: 'x',
        i: 'i',
        j: 'ʒ',
        k: 'k',
        l: 'l',
        m: 'm',
        n: 'n',
        o: 'o',
        p: 'p',
        q: 'k',
        r: 'r',
        t: 't',
        u: 'u',
        v: 'v',
        w: 'w',
        z: 'z'
      }[char] || char);
    }
  }

  return output.join('');
}
