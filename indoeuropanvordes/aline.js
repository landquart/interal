(function (global) {
  "use strict";

  const DEFAULT_OPTIONS = {
    mergePlainAffricates: true,
    mergeDiphthongs: false,

    keepLength: true,
    keepAspiration: true,
    keepPalatalization: true,
    keepLabialization: true,
    keepVelarization: true,
    keepPharyngealization: true,
    keepNasalization: true,
    keepRhoticity: true,
    keepSyllabicity: true,
    keepVoicingDiacritics: true,
    keepPlaceDiacritics: true,

    gapPenalty: -0.65,
    expansionPenalty: -0.18,

    returnGapsInAlignment: true,
    maxAlignments: 20
  };

  /*
   * Feature model.
   *
   * consonant place:
   *   10 bilabial
   *   15 labiodental
   *   25 dental
   *   30 alveolar
   *   38 retroflex
   *   45 postalveolar / palatoalveolar
   *   55 palatal
   *   70 velar
   *   85 uvular
   *   95 pharyngeal
   *   100 glottal
   *
   * consonant manner:
   *   1 stop
   *   1.5 affricate
   *   2 fricative
   *   3 nasal
   *   4 approximant
   *   4.2 tap/trill/rhotic
   *   4.5 lateral
   *
   * vowel height:
   *   1 close
   *   0.85 near-close
   *   0.72 close-mid
   *   0.5 mid/open-mid
   *   0.25 near-open
   *   0 open
   *
   * vowel backness:
   *   0 front
   *   0.5 central
   *   1 back
   */

  const FEATURE_WEIGHTS = {
    syllabic: 55,
    sonorant: 10,
    place: 38,
    manner: 42,
    voice: 12,
    nasal: 16,
    lateral: 10,
    rhotic: 8,
    retroflex: 8,
    aspirated: 5,
    long: 3,
    height: 30,
    back: 24,
    round: 10
  };

  const FEATURE_RANGES = {
    syllabic: 1,
    sonorant: 1,
    place: 100,
    manner: 5,
    voice: 1,
    nasal: 1,
    lateral: 1,
    rhotic: 1,
    retroflex: 1,
    aspirated: 1,
    long: 1,
    height: 1,
    back: 1,
    round: 1
  };

  const FEATURE_NAMES = Object.keys(FEATURE_WEIGHTS);

  function C(place, manner, voice, extra = {}) {
    const sonorant =
      manner === 3 || manner === 4 || manner === 4.2 || manner === 4.5
        ? 1
        : 0;

    return {
      syllabic: 0,
      sonorant,
      place,
      manner,
      voice,
      nasal: manner === 3 ? 1 : 0,
      lateral: manner === 4.5 ? 1 : 0,
      rhotic: 0,
      retroflex: place === 38 ? 1 : 0,
      aspirated: 0,
      long: 0,
      height: 0,
      back: 0,
      round: 0,
      ...extra
    };
  }

  function V(height, back, round, extra = {}) {
    return {
      syllabic: 1,
      sonorant: 1,
      place: 0,
      manner: 0,
      voice: 1,
      nasal: 0,
      lateral: 0,
      rhotic: 0,
      retroflex: 0,
      aspirated: 0,
      long: 0,
      height,
      back,
      round,
      ...extra
    };
  }

  /*
   * Core segment inventory for the 7 control languages.
   *
   * English:
   *   p b t d k g m n ŋ f v θ ð s z ʃ ʒ h t͡ʃ d͡ʒ
   *   l ɫ r ɹ j w
   *   i ɪ e ɛ æ ə ɜ ɚ ɝ ʌ ɑ ɒ ɔ o ʊ u
   *
   * German:
   *   p b t d k g m n ŋ f v s z ʃ ʒ ç x h pf ts
   *   l r ʁ ɐ j
   *   i ɪ y ʏ e ɛ ø œ ə ɐ a o ɔ u ʊ
   *
   * French:
   *   p b t d k g m n ɲ ŋ f v s z ʃ ʒ ʁ l j w ɥ
   *   i y u e ɛ ə ø œ a ɑ o ɔ + nasal vowels by combining tilde
   *
   * Spanish:
   *   p b t d k g t͡ʃ f θ s x ʝ β ð ɣ m n ɲ l ʎ ɾ r j w
   *   i e a o u
   *
   * Italian:
   *   p b t d k g t͡s d͡z t͡ʃ d͡ʒ f v s z ʃ
   *   m n ɲ l ʎ r j w
   *   i e ɛ a o ɔ u
   *
   * Russian:
   *   p b t d k g f v s z ʂ ʐ ɕ x t͡s t͡ɕ
   *   m n r l j
   *   i ɪ ɨ e ɛ a ɐ ə o u
   *   palatalized consonants by ʲ
   *
   * Modern Greek:
   *   p b t d k g c ɟ f v θ ð s z x ɣ ç ʝ
   *   m n ɲ l r j
   *   i e a o u
   */

  const BASE_FEATURES = {
    // Stops
    "p": C(10, 1, 0),
    "b": C(10, 1, 1),
    "t": C(30, 1, 0),
    "d": C(30, 1, 1),
    "ʈ": C(38, 1, 0, { retroflex: 1 }),
    "ɖ": C(38, 1, 1, { retroflex: 1 }),
    "c": C(55, 1, 0),
    "ɟ": C(55, 1, 1),
    "k": C(70, 1, 0),
    "g": C(70, 1, 1),
    "ɡ": C(70, 1, 1),
    "q": C(85, 1, 0),
    "ɢ": C(85, 1, 1),
    "ʔ": C(100, 1, 0),

    // Nasals
    "m": C(10, 3, 1),
    "ɱ": C(15, 3, 1),
    "n": C(30, 3, 1),
    "ɳ": C(38, 3, 1, { retroflex: 1 }),
    "ɲ": C(55, 3, 1),
    "ŋ": C(70, 3, 1),
    "ɴ": C(85, 3, 1),

    // Fricatives
    "ɸ": C(10, 2, 0),
    "β": C(10, 2, 1),
    "f": C(15, 2, 0),
    "v": C(15, 2, 1),
    "θ": C(25, 2, 0),
    "ð": C(25, 2, 1),
    "s": C(30, 2, 0),
    "z": C(30, 2, 1),
    "ʃ": C(45, 2, 0),
    "ʒ": C(45, 2, 1),
    "ʂ": C(38, 2, 0, { retroflex: 1 }),
    "ʐ": C(38, 2, 1, { retroflex: 1 }),
    "ɕ": C(55, 2, 0),
    "ʑ": C(55, 2, 1),
    "ç": C(55, 2, 0),
    "ʝ": C(55, 2, 1),
    "x": C(70, 2, 0),
    "ɣ": C(70, 2, 1),
    "χ": C(85, 2, 0),
    "ʁ": C(85, 2, 1, { rhotic: 1 }),
    "ħ": C(95, 2, 0),
    "ʕ": C(95, 2, 1),
    "h": C(100, 2, 0, { aspirated: 1 }),
    "ɦ": C(100, 2, 1, { aspirated: 1 }),

    // Approximants, glides, liquids, rhotics
    "ʋ": C(15, 4, 1),
    "ɹ": C(30, 4, 1, { rhotic: 1 }),
    "ɻ": C(38, 4, 1, { rhotic: 1, retroflex: 1 }),
    "j": C(55, 4, 1, { height: 1, back: 0, round: 0 }),
    "ɥ": C(55, 4, 1, { height: 1, back: 0, round: 1 }),
    "ɰ": C(70, 4, 1, { height: 1, back: 1, round: 0 }),
    "w": C(10, 4, 1, { height: 1, back: 1, round: 1 }),

    "r": C(30, 4.2, 1, { rhotic: 1 }),
    "ɾ": C(30, 4.2, 1, { rhotic: 1 }),
    "ɽ": C(38, 4.2, 1, { rhotic: 1, retroflex: 1 }),
    "ʀ": C(85, 4.2, 1, { rhotic: 1 }),

    "l": C(30, 4.5, 1),
    "ɫ": C(30, 4.5, 1, { back: 0.5 }),
    "ɭ": C(38, 4.5, 1, { retroflex: 1 }),
    "ʎ": C(55, 4.5, 1),
    "ʟ": C(70, 4.5, 1),

    // Affricates with tie bar
    "t͡s": C(30, 1.5, 0),
    "d͡z": C(30, 1.5, 1),
    "t͡ʃ": C(45, 1.5, 0),
    "d͡ʒ": C(45, 1.5, 1),
    "t͡ɕ": C(55, 1.5, 0),
    "d͡ʑ": C(55, 1.5, 1),
    "ʈ͡ʂ": C(38, 1.5, 0, { retroflex: 1 }),
    "ɖ͡ʐ": C(38, 1.5, 1, { retroflex: 1 }),
    "p͡f": C(15, 1.5, 0),
    "b͡v": C(15, 1.5, 1),
    "k͡x": C(70, 1.5, 0),
    "g͡ɣ": C(70, 1.5, 1),

    // Affricates with tie below
    "t͜s": C(30, 1.5, 0),
    "d͜z": C(30, 1.5, 1),
    "t͜ʃ": C(45, 1.5, 0),
    "d͜ʒ": C(45, 1.5, 1),
    "t͜ɕ": C(55, 1.5, 0),
    "d͜ʑ": C(55, 1.5, 1),
    "ʈ͜ʂ": C(38, 1.5, 0, { retroflex: 1 }),
    "ɖ͜ʐ": C(38, 1.5, 1, { retroflex: 1 }),
    "p͜f": C(15, 1.5, 0),
    "b͜v": C(15, 1.5, 1),
    "k͜x": C(70, 1.5, 0),
    "g͜ɣ": C(70, 1.5, 1),

    // Plain affricate aliases
    "ts": C(30, 1.5, 0),
    "dz": C(30, 1.5, 1),
    "tʃ": C(45, 1.5, 0),
    "dʒ": C(45, 1.5, 1),
    "tɕ": C(55, 1.5, 0),
    "dʑ": C(55, 1.5, 1),
    "ʈʂ": C(38, 1.5, 0, { retroflex: 1 }),
    "ɖʐ": C(38, 1.5, 1, { retroflex: 1 }),
    "pf": C(15, 1.5, 0),
    "bv": C(15, 1.5, 1),
    "kx": C(70, 1.5, 0),
    "gɣ": C(70, 1.5, 1),

    // Front vowels
    "i": V(1.0, 0.0, 0),
    "ɪ": V(0.85, 0.0, 0),
    "y": V(1.0, 0.0, 1),
    "ʏ": V(0.85, 0.0, 1),
    "e": V(0.72, 0.0, 0),
    "ø": V(0.72, 0.0, 1),
    "ɛ": V(0.48, 0.0, 0),
    "œ": V(0.48, 0.0, 1),
    "æ": V(0.25, 0.0, 0),
    "ɶ": V(0.0, 0.0, 1),
    "a": V(0.0, 0.0, 0),

    // Central vowels
    "ɨ": V(1.0, 0.5, 0),
    "ʉ": V(1.0, 0.5, 1),
    "ᵻ": V(0.9, 0.5, 0),
    "ᵿ": V(0.9, 0.5, 1),
    "ɘ": V(0.72, 0.5, 0),
    "ɵ": V(0.72, 0.5, 1),
    "ə": V(0.5, 0.5, 0),
    "ɜ": V(0.42, 0.5, 0),
    "ɞ": V(0.42, 0.5, 1),
    "ɐ": V(0.2, 0.5, 0),
    "ä": V(0.0, 0.5, 0),

    // Back vowels
    "ɯ": V(1.0, 1.0, 0),
    "u": V(1.0, 1.0, 1),
    "ʊ": V(0.85, 1.0, 1),
    "ɤ": V(0.72, 1.0, 0),
    "o": V(0.72, 1.0, 1),
    "ʌ": V(0.45, 1.0, 0),
    "ɔ": V(0.48, 1.0, 1),
    "ɑ": V(0.0, 1.0, 0),
    "ɒ": V(0.0, 1.0, 1),

    // Rhotic vowels, mainly English transcriptions
    "ɚ": V(0.5, 0.5, 0, { rhotic: 1 }),
    "ɝ": V(0.42, 0.5, 0, { rhotic: 1 }),

    // Optional diphthong tokens. Disabled by default unless mergeDiphthongs = true.
    "aɪ": V(0.45, 0.25, 0),
    "aʊ": V(0.45, 0.65, 1),
    "ɔɪ": V(0.65, 0.55, 1),
    "eɪ": V(0.82, 0.05, 0),
    "oʊ": V(0.82, 0.85, 1),
    "əʊ": V(0.65, 0.75, 1),
    "ɪə": V(0.65, 0.25, 0),
    "eə": V(0.55, 0.25, 0),
    "ʊə": V(0.65, 0.75, 1),
    "ju": V(1.0, 0.5, 1),
    "jʊ": V(0.9, 0.5, 1)
  };

  /*
   * Normalization aliases.
   */
  const SYMBOL_ALIASES = new Map([
    ["ɡ", "g"],
    ["ʧ", "t͡ʃ"],
    ["ʤ", "d͡ʒ"],
    ["ʦ", "t͡s"],
    ["ʣ", "d͡z"],
    ["ꭧ", "t͡s"],
    ["ꭦ", "d͡z"],
    ["ɚ", "ɚ"],
    ["ɝ", "ɝ"]
  ]);

  /*
   * Combining and modifier marks commonly seen in IPA dictionaries.
   */
  const DIACRITICS = new Set([
    "ː", "ˑ",
    "ʰ", "ʱ",
    "ʲ", "ˠ", "ʷ", "ˤ", "˞",
    "̃", "\u0303",
    "̥", "\u0325",
    "̬", "\u032C",
    "̪", "\u032A",
    "̺", "\u033A",
    "̻", "\u033B",
    "̩", "\u0329",
    "̯", "\u032F",
    "̚", "\u031A",
    "̝", "\u031D",
    "̞", "\u031E",
    "̟", "\u031F",
    "̠", "\u0320",
    "̈", "\u0308",
    "̹", "\u0339",
    "̜", "\u031C"
  ]);

  const STRESS_AND_SEPARATORS = new Set([
    "ˈ", "ˌ", ".", " ", "\t", "\n", "\r",
    "/", "[", "]", "(", ")", "{", "}", "‖", "|"
  ]);

  const AFFRICATES_TIE_ABOVE = [
    "t͡s", "d͡z", "t͡ʃ", "d͡ʒ", "t͡ɕ", "d͡ʑ",
    "ʈ͡ʂ", "ɖ͡ʐ", "p͡f", "b͡v", "k͡x", "g͡ɣ"
  ];

  const AFFRICATES_TIE_BELOW = [
    "t͜s", "d͜z", "t͜ʃ", "d͜ʒ", "t͜ɕ", "d͜ʑ",
    "ʈ͜ʂ", "ɖ͜ʐ", "p͜f", "b͜v", "k͜x", "g͜ɣ"
  ];

  const AFFRICATES_PLAIN = [
    "ts", "dz", "tʃ", "dʒ", "tɕ", "dʑ",
    "ʈʂ", "ɖʐ", "pf", "bv", "kx", "gɣ"
  ];

  const DIPHTHONGS = [
    "aɪ", "aʊ", "ɔɪ", "eɪ", "oʊ", "əʊ",
    "ɪə", "eə", "ʊə", "ju", "jʊ"
  ];

  function mergeOptions(options) {
    return { ...DEFAULT_OPTIONS, ...(options || {}) };
  }

  function normalizeIPA(input) {
    let s = String(input || "")
      .trim()
      .toLowerCase()
      .normalize("NFC");

    /*
     * Normalize frequent compatibility forms and dictionary variants.
     */
    s = s
      .replace(/\u035C/g, "\u0361") // tie below -> tie above
      .replace(/ɡ/g, "g")
      .replace(/ʧ/g, "t͡ʃ")
      .replace(/ʤ/g, "d͡ʒ")
      .replace(/ʦ/g, "t͡s")
      .replace(/ʣ/g, "d͡z")
      .replace(/ꭧ/g, "t͡s")
      .replace(/ꭦ/g, "d͡z")
      .replace(/:/g, "ː")
      .replace(/'/g, "ˈ")
      .replace(/ˁ/g, "ˤ");

    return s;
  }

  function getMultiSegments(options = {}) {
    const opts = mergeOptions(options);
    const segments = [...AFFRICATES_TIE_ABOVE, ...AFFRICATES_TIE_BELOW];

    if (opts.mergePlainAffricates) {
      segments.push(...AFFRICATES_PLAIN);
    }

    if (opts.mergeDiphthongs) {
      segments.push(...DIPHTHONGS);
    }

    return segments.sort((a, b) => b.length - a.length);
  }

  function tokenize(input, options = {}) {
    const opts = mergeOptions(options);
    const s = normalizeIPA(input);
    const tokens = [];
    const multiSegments = getMultiSegments(opts);

    let i = 0;

    while (i < s.length) {
      const ch = s[i];

      if (STRESS_AND_SEPARATORS.has(ch)) {
        i += 1;
        continue;
      }

      let matched = null;

      for (const seg of multiSegments) {
        if (s.startsWith(seg, i)) {
          matched = seg;
          break;
        }
      }

      if (matched) {
        i += matched.length;

        let token = matched;

        while (i < s.length && DIACRITICS.has(s[i])) {
          token += s[i];
          i += 1;
        }

        tokens.push(token);
        continue;
      }

      let token = ch;
      i += 1;

      while (i < s.length && DIACRITICS.has(s[i])) {
        token += s[i];
        i += 1;
      }

      tokens.push(token);
    }

    return tokens;
  }

  function splitBaseAndDiacritics(segment, options = {}) {
    const s = normalizeIPA(segment);
    const multiSegments = getMultiSegments(options);

    for (const seg of multiSegments) {
      if (s.startsWith(seg)) {
        return {
          base: SYMBOL_ALIASES.get(seg) || seg,
          modifiers: s.slice(seg.length)
        };
      }
    }

    const base = s[0] || "";
    return {
      base: SYMBOL_ALIASES.get(base) || base,
      modifiers: s.slice(1)
    };
  }

  function cloneFeatures(f) {
    return { ...f };
  }

  function getFeatures(segment, options = {}) {
    const opts = mergeOptions(options);
    const { base, modifiers } = splitBaseAndDiacritics(segment, opts);

    const canonical = SYMBOL_ALIASES.get(base) || base;
    const source = BASE_FEATURES[canonical];

    if (!source) return null;

    const f = cloneFeatures(source);

    for (const mark of modifiers) {
      applyDiacritic(f, mark, opts);
    }

    return f;
  }

  function applyDiacritic(f, mark, opts) {
    switch (mark) {
      case "ː":
        if (opts.keepLength) f.long = 1;
        break;

      case "ˑ":
        if (opts.keepLength) f.long = Math.max(f.long || 0, 0.5);
        break;

      case "ʰ":
      case "ʱ":
        if (opts.keepAspiration) f.aspirated = 1;
        if (mark === "ʱ") f.voice = 1;
        break;

      case "ʲ":
        if (opts.keepPalatalization) {
          if (f.syllabic === 0) {
            f.place = weightedMove(f.place, 55, 0.35);
            f.height = Math.max(f.height || 0, 0.6);
            f.back = weightedMove(f.back || 0, 0, 0.35);
          } else {
            f.back = weightedMove(f.back, 0, 0.35);
            f.height = Math.min(1, f.height + 0.1);
          }
        }
        break;

      case "ʷ":
        if (opts.keepLabialization) {
          f.round = 1;
          f.back = Math.max(f.back || 0, 0.6);
        }
        break;

      case "ˠ":
        if (opts.keepVelarization) {
          if (f.syllabic === 0) {
            f.place = weightedMove(f.place, 70, 0.3);
            f.back = Math.max(f.back || 0, 0.65);
          } else {
            f.back = weightedMove(f.back, 1, 0.3);
          }
        }
        break;

      case "ˤ":
        if (opts.keepPharyngealization) {
          if (f.syllabic === 0) {
            f.place = weightedMove(f.place, 95, 0.3);
            f.back = Math.max(f.back || 0, 0.75);
          } else {
            f.back = weightedMove(f.back, 1, 0.3);
          }
        }
        break;

      case "̃":
      case "\u0303":
        if (opts.keepNasalization) {
          f.nasal = Math.max(f.nasal || 0, 0.8);
        }
        break;

      case "˞":
        if (opts.keepRhoticity) {
          f.rhotic = 1;
        }
        break;

      case "̥":
      case "\u0325":
        if (opts.keepVoicingDiacritics) {
          f.voice = 0;
        }
        break;

      case "̬":
      case "\u032C":
        if (opts.keepVoicingDiacritics) {
          f.voice = 1;
        }
        break;

      case "̪":
      case "\u032A":
        if (opts.keepPlaceDiacritics) {
          f.place = weightedMove(f.place, 25, 0.55);
        }
        break;

      case "̺":
      case "\u033A":
        if (opts.keepPlaceDiacritics) {
          f.place = weightedMove(f.place, 30, 0.25);
        }
        break;

      case "̻":
      case "\u033B":
        if (opts.keepPlaceDiacritics) {
          f.place = weightedMove(f.place, 30, 0.25);
        }
        break;

      case "̩":
      case "\u0329":
        if (opts.keepSyllabicity) {
          f.syllabic = 1;
          f.sonorant = 1;
        }
        break;

      case "̯":
      case "\u032F":
        if (opts.keepSyllabicity) {
          f.syllabic = 0;
        }
        break;

      case "̚":
      case "\u031A":
        f.manner = 1;
        break;

      case "̝":
      case "\u031D":
        if (f.syllabic === 1) {
          f.height = Math.min(1, f.height + 0.1);
        } else {
          f.manner = Math.max(1, f.manner - 0.15);
        }
        break;

      case "̞":
      case "\u031E":
        if (f.syllabic === 1) {
          f.height = Math.max(0, f.height - 0.1);
        } else {
          f.manner = Math.min(4.5, f.manner + 0.15);
        }
        break;

      case "̟":
      case "\u031F":
        if (opts.keepPlaceDiacritics) {
          f.place = weightedMove(f.place, 0, 0.08);
        }
        break;

      case "̠":
      case "\u0320":
        if (opts.keepPlaceDiacritics) {
          f.place = weightedMove(f.place, 100, 0.08);
        }
        break;

      case "̈":
      case "\u0308":
        if (f.syllabic === 1) {
          f.back = weightedMove(f.back, 0.5, 0.5);
        }
        break;

      case "̹":
      case "\u0339":
        f.round = Math.min(1, (f.round || 0) + 0.3);
        break;

      case "̜":
      case "\u031C":
        f.round = Math.max(0, (f.round || 0) - 0.3);
        break;

      default:
        break;
    }
  }

  function weightedMove(value, target, amount) {
    const v = Number.isFinite(value) ? value : 0;
    return v * (1 - amount) + target * amount;
  }

  function segmentDistance(a, b, options = {}) {
    if (a === b) return 0;

    const fa = getFeatures(a, options);
    const fb = getFeatures(b, options);

    if (!fa || !fb) return 1;

    let totalWeight = 0;
    let weightedDifference = 0;

    for (const feature of FEATURE_NAMES) {
      const weight = FEATURE_WEIGHTS[feature] || 1;
      const range = FEATURE_RANGES[feature] || 1;

      const av = fa[feature] ?? 0;
      const bv = fb[feature] ?? 0;

      const diff = clamp01(Math.abs(av - bv) / range);

      weightedDifference += weight * diff;
      totalWeight += weight;
    }

    if (totalWeight === 0) return 1;

    return clamp01(weightedDifference / totalWeight);
  }

  function segmentSimilarity(a, b, options = {}) {
    return clamp01(1 - segmentDistance(a, b, options));
  }

  function pairScore(a, b, options = {}) {
    return 2 * segmentSimilarity(a, b, options) - 1;
  }

  function combinedSegmentSimilarity(one, partA, partB, options = {}) {
    /*
     * One segment versus two segments.
     * Useful for:
     *   t͡s ~ t + s
     *   d͡ʒ ~ d + ʒ
     *   p͡f ~ p + f
     *   x   ~ k + s, only partially
     */
    const directA = segmentSimilarity(one, partA, options);
    const directB = segmentSimilarity(one, partB, options);

    const avg = (directA + directB) / 2;

    return clamp01(avg);
  }

  function combinedScore(one, partA, partB, options = {}) {
    const opts = mergeOptions(options);
    return 2 * combinedSegmentSimilarity(one, partA, partB, opts) - 1 + opts.expansionPenalty;
  }

  function rawScore(str1, str2, options = {}) {
    const opts = mergeOptions(options);
    const a = tokenize(str1, opts);
    const b = tokenize(str2, opts);

    const n = a.length;
    const m = b.length;

    if (n === 0 && m === 0) return 0;

    const gap = opts.gapPenalty;

    const dp = Array.from({ length: n + 1 }, () =>
      Array(m + 1).fill(-Infinity)
    );

    dp[0][0] = 0;

    for (let i = 1; i <= n; i++) {
      dp[i][0] = dp[i - 1][0] + gap;
    }

    for (let j = 1; j <= m; j++) {
      dp[0][j] = dp[0][j - 1] + gap;
    }

    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        let best = -Infinity;

        best = Math.max(
          best,
          dp[i - 1][j - 1] + pairScore(a[i - 1], b[j - 1], opts)
        );

        best = Math.max(best, dp[i - 1][j] + gap);
        best = Math.max(best, dp[i][j - 1] + gap);

        if (j >= 2) {
          best = Math.max(
            best,
            dp[i - 1][j - 2] +
              combinedScore(a[i - 1], b[j - 2], b[j - 1], opts)
          );
        }

        if (i >= 2) {
          best = Math.max(
            best,
            dp[i - 2][j - 1] +
              combinedScore(b[j - 1], a[i - 2], a[i - 1], opts)
          );
        }

        dp[i][j] = best;
      }
    }

    return dp[n][m];
  }

  function normalizedSimilarity(str1, str2, options = {}) {
    const opts = mergeOptions(options);
    const a = tokenize(str1, opts);
    const b = tokenize(str2, opts);

    if (a.length === 0 && b.length === 0) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    const raw = rawScore(str1, str2, opts);

    const maxLen = Math.max(a.length, b.length);
    const minPossible = -1 * maxLen;
    const maxPossible = 1 * maxLen;

    return clamp01((raw - minPossible) / (maxPossible - minPossible));
  }

  function distance(str1, str2, options = {}) {
    return 1 - normalizedSimilarity(str1, str2, options);
  }

  function computeDPWithBacktrace(str1, str2, options = {}) {
    const opts = mergeOptions(options);
    const a = tokenize(str1, opts);
    const b = tokenize(str2, opts);

    const n = a.length;
    const m = b.length;
    const gap = opts.gapPenalty;

    const dp = Array.from({ length: n + 1 }, () =>
      Array(m + 1).fill(-Infinity)
    );

    const back = Array.from({ length: n + 1 }, () =>
      Array.from({ length: m + 1 }, () => [])
    );

    dp[0][0] = 0;

    for (let i = 1; i <= n; i++) {
      dp[i][0] = dp[i - 1][0] + gap;
      back[i][0].push({
        prevI: i - 1,
        prevJ: 0,
        pair: [a[i - 1], "-"]
      });
    }

    for (let j = 1; j <= m; j++) {
      dp[0][j] = dp[0][j - 1] + gap;
      back[0][j].push({
        prevI: 0,
        prevJ: j - 1,
        pair: ["-", b[j - 1]]
      });
    }

    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        const candidates = [];

        candidates.push({
          score: dp[i - 1][j - 1] + pairScore(a[i - 1], b[j - 1], opts),
          prevI: i - 1,
          prevJ: j - 1,
          pair: [a[i - 1], b[j - 1]]
        });

        candidates.push({
          score: dp[i - 1][j] + gap,
          prevI: i - 1,
          prevJ: j,
          pair: [a[i - 1], "-"]
        });

        candidates.push({
          score: dp[i][j - 1] + gap,
          prevI: i,
          prevJ: j - 1,
          pair: ["-", b[j - 1]]
        });

        if (j >= 2) {
          candidates.push({
            score:
              dp[i - 1][j - 2] +
              combinedScore(a[i - 1], b[j - 2], b[j - 1], opts),
            prevI: i - 1,
            prevJ: j - 2,
            pair: [a[i - 1], b[j - 2] + b[j - 1]]
          });
        }

        if (i >= 2) {
          candidates.push({
            score:
              dp[i - 2][j - 1] +
              combinedScore(b[j - 1], a[i - 2], a[i - 1], opts),
            prevI: i - 2,
            prevJ: j - 1,
            pair: [a[i - 2] + a[i - 1], b[j - 1]]
          });
        }

        const best = Math.max(...candidates.map(c => c.score));
        dp[i][j] = best;
        back[i][j] = candidates.filter(c => almostEqual(c.score, best));
      }
    }

    return {
      dp,
      back,
      tokensA: a,
      tokensB: b
    };
  }

  function align(str1, str2, options = {}) {
    const opts = mergeOptions(options);
    const { dp, back, tokensA, tokensB } = computeDPWithBacktrace(str1, str2, opts);

    const results = [];
    const current = [];

    function trace(i, j) {
      if (results.length >= opts.maxAlignments) return;

      if (i === 0 && j === 0) {
        const alignment = current.slice().reverse();

        if (opts.returnGapsInAlignment) {
          results.push(alignment);
        } else {
          results.push(alignment.filter(p => p[0] !== "-" && p[1] !== "-"));
        }

        return;
      }

      const steps = back[i][j] || [];

      for (const step of steps) {
        if (results.length >= opts.maxAlignments) break;

        current.push(step.pair);
        trace(step.prevI, step.prevJ);
        current.pop();
      }
    }

    trace(tokensA.length, tokensB.length);

    return {
      score: dp[tokensA.length][tokensB.length],
      normalized: normalizedSimilarity(str1, str2, opts),
      tokensA,
      tokensB,
      alignments: results
    };
  }

  function explain(str1, str2, options = {}) {
    const opts = mergeOptions(options);
    const result = align(str1, str2, opts);
    const first = result.alignments[0] || [];

    const pairs = first.map(pair => {
      const a = pair[0];
      const b = pair[1];

      if (a === "-" || b === "-") {
        return {
          a,
          b,
          similarity: 0,
          distance: 1,
          note: "gap"
        };
      }

      return {
        a,
        b,
        similarity: segmentSimilarity(a, b, opts),
        distance: segmentDistance(a, b, opts),
        featuresA: getFeatures(a, opts),
        featuresB: getFeatures(b, opts)
      };
    });

    return {
      ...result,
      pairs,
      unknownA: unknownSegments(str1, opts),
      unknownB: unknownSegments(str2, opts)
    };
  }

  function unknownSegments(input, options = {}) {
    const opts = mergeOptions(options);
    const tokens = tokenize(input, opts);

    const unknown = [];

    for (const token of tokens) {
      if (!getFeatures(token, opts)) {
        unknown.push(token);
      }
    }

    return [...new Set(unknown)];
  }

  function clamp01(x) {
    if (!Number.isFinite(x)) return 0;
    return Math.max(0, Math.min(1, x));
  }

  function almostEqual(a, b, eps = 1e-10) {
    return Math.abs(a - b) <= eps;
  }

  function addFeature(symbol, features) {
    BASE_FEATURES[symbol] = { ...features };
  }

  function addAlias(from, to) {
    SYMBOL_ALIASES.set(from, to);
  }

  const api = {
    normalizeIPA,
    tokenize,
    unknownSegments,

    getFeatures,
    segmentDistance,
    segmentSimilarity,

    rawScore,
    normalizedSimilarity,
    distance,
    align,
    explain,

    addFeature,
    addAlias,

    features: BASE_FEATURES,
    featureWeights: FEATURE_WEIGHTS,
    featureRanges: FEATURE_RANGES,
    defaultOptions: DEFAULT_OPTIONS
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.ALINE = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
