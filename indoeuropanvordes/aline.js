(function (global) {
  "use strict";

  const DEFAULT_OPTIONS = {
    mergePlainAffricates: false,
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

    insertionCost: 1,
    deletionCost: 1
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
    // ALINE salience weights (Kondrak), rescaled proportionally so the total is 100.
    // Internal key "height" corresponds to ALINE High.
    syllabic: 3.2051282051282053,
    place: 25.641025641025642,
    manner: 32.05128205128205,
    voice: 6.410256410256411,
    nasal: 6.410256410256411,
    lateral: 6.410256410256411,
    retroflex: 6.410256410256411,
    aspirated: 3.2051282051282053,
    height: 3.2051282051282053,
    back: 3.2051282051282053,
    round: 3.2051282051282053,
    long: 0.641025641025641
  };

  // ALINE Csub=35 and effective vowel substitution range=15,
  // rescaled by the same factor 100/156 as FEATURE_WEIGHTS.
  const CONSONANT_SUBSTITUTION_SCALE = 22.435897435897434;
  const VOWEL_SUBSTITUTION_SCALE = 9.615384615384615;

  const FEATURE_RANGES = {
    syllabic: 1,
    place: 1,
    manner: 1,
    voice: 1,
    nasal: 1,
    lateral: 1,
    retroflex: 1,
    aspirated: 1,
    long: 1,
    height: 1,
    back: 1,
    round: 1
  };

  const PLACE_SCALE = new Map([
    [10, 1.00], // bilabial
    [15, 0.95], // labiodental
    [25, 0.90], // dental
    [30, 0.85], // alveolar
    [38, 0.80], // retroflex
    [45, 0.75], // postalveolar
    [55, 0.70], // palatal
    [70, 0.60], // velar
    [85, 0.50], // uvular
    [95, 0.30], // pharyngeal
    [100, 0.10] // glottal
  ]);

  const MANNER_SCALE = new Map([
    [1, 1.00],   // stop
    [1.5, 0.90], // affricate
    [2, 0.80],   // fricative
    [3, 0.60],   // nasal: approximant-like manner + Nasal
    [4, 0.60],   // approximant
    [4.2, 0.70], // trill/rhotic (taps overridden below)
    [4.5, 0.60]  // lateral: approximant-like manner + Lateral
  ]);

  function C(place, manner, voice, extra = {}) {
    const sonorant =
      manner === 3 || manner === 4 || manner === 4.2 || manner === 4.5
        ? 1
        : 0;

    const mappedPlace = PLACE_SCALE.has(place) ? PLACE_SCALE.get(place) : place;
    const mappedManner = MANNER_SCALE.has(manner) ? MANNER_SCALE.get(manner) : manner;

    return {
      syllabic: 0,
      sonorant,
      place: mappedPlace,
      manner: mappedManner,
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
   * Core segment inventory for the 9 control languages used by the
   * common Indo-European word procedure.
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
   *
   * Standard Hindi and Iranian Persian use the same extended IPA feature
   * inventory below, including retroflex/dental consonants, aspiration,
   * vowel length and nasalization.
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
    const opts = { ...mergeOptions(options), mergePlainAffricates: false, mergeDiphthongs: false };
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
    const opts = { ...mergeOptions(options), mergePlainAffricates: false, mergeDiphthongs: false };
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

const clip=x=>Math.max(0,Math.min(1,x));
const featureKeys = Object.keys(BASE_FEATURES).sort((a,b)=>b.length-a.length);
const CONSONANT_FEATURES = ['place','manner','voice','nasal','lateral','retroflex','aspirated','long','round'];
const VOWEL_FEATURES = ['height','back','round','nasal','retroflex','long'];
const GLIDES = new Set(['j','w','ɥ','ɰ']);
const EPSILON = 1e-12;

// ALINE distinguishes trills from taps/flaps. The legacy inventory used one code.
if (BASE_FEATURES['ɾ']) BASE_FEATURES['ɾ'].manner = 0.65;
if (BASE_FEATURES['ɽ']) BASE_FEATURES['ɽ'].manner = 0.65;

// R-coloured vowels use the ALINE Retroflex dimension rather than a custom rhotic weight.
if (BASE_FEATURES['ɚ']) BASE_FEATURES['ɚ'].retroflex = 1;
if (BASE_FEATURES['ɝ']) BASE_FEATURES['ɝ'].retroflex = 1;

function features(input){
  let t=normalizeIPA(input).normalize('NFC');
  let base=featureKeys.find(k=>t.startsWith(k));

  if(!base){
    t=t.normalize('NFD');
    base=featureKeys.find(k=>t.startsWith(k));
  }

  if(!base) throw Error('unknown '+input);

  const f={...BASE_FEATURES[base]};
  const cls=f.syllabic ? 'V' : 'C';

  // ALINE High is a three-level high/mid/low dimension.
  if(cls==='V') f.height=f.height>=.8 ? 1 : (f.height<=.25 ? 0 : .5);

  const rest=t.slice(base.length);
  const move=(key,target,k)=>{f[key]+=k*(target-f[key]);};

  for(const m of rest){
    switch(m){
      case 'ː': f.long=1; break;
      case 'ˑ': f.long=Math.max(f.long,.5); break;
      case 'ʰ': f.aspirated=1; break;
      case 'ʱ': f.aspirated=1; f.voice=1; break;
      case '̃': f.nasal=1; break;
      case '˞': f.retroflex=1; break;
      case '̥': f.voice=0; break;
      case '̬': f.voice=1; break;
      case '̪': if(cls==='C') f.place=.90; break;
      case 'ʲ':
        if(cls==='C') move('place',.70,.35);
        else { move('back',0,.35); f.height=clip(f.height+.1); }
        break;
      case 'ʷ':
        f.round=1;
        if(cls==='V') f.back=Math.max(f.back,.6);
        break;
      case 'ˠ':
        if(cls==='C') move('place',.60,.3);
        else move('back',1,.3);
        break;
      case 'ˤ':
        if(cls==='C') move('place',.30,.3);
        else move('back',1,.3);
        break;
      case '̺':
      case '̻': if(cls==='C') move('place',.85,.25); break;
      case '̝':
        if(cls==='V') f.height=clip(f.height+.1);
        else f.manner=clip(f.manner+.05);
        break;
      case '̞':
        if(cls==='V') f.height=clip(f.height-.1);
        else f.manner=clip(f.manner-.05);
        break;
      case '̟': if(cls==='C') move('place',1,.08); break;
      case '̠': if(cls==='C') move('place',.10,.08); break;
      case '̈': if(cls==='V') move('back',.5,.5); break;
      case '̹': f.round=clip(f.round+.3); break;
      case '̜': f.round=clip(f.round-.3); break;
      case '̚': f.manner=1; break;
      // Syllabic consonants stay in the consonant class; non-syllabic
      // vowel marks likewise do not move a segment into the other class.
      case '̩':
      case '̯': break;
      default: throw Error('unknown modifier '+m+' in '+input);
    }
  }

  f._type=cls;
  f._base=base;
  return f;
}

function weightedDelta(x,y,keys){
  return keys.reduce((sum,key)=>{
    const weight=FEATURE_WEIGHTS[key] || 0;
    const range=FEATURE_RANGES[key] || 1;
    return sum + weight*Math.abs((x[key]??0)-(y[key]??0))/range;
  },0);
}

function isHighVowel(f){
  return f._type==='V' && f.height>=.85;
}

function glideVowelDistance(x,y){
  let glide=x, vowel=y;

  if(glide._type==='V'){
    glide=y;
    vowel=x;
  }

  if(glide._type!=='C' || vowel._type!=='V') return Infinity;
  if(!GLIDES.has(glide._base) || !isHighVowel(vowel)) return Infinity;

  const delta =
    FEATURE_WEIGHTS.syllabic +
    FEATURE_WEIGHTS.height*Math.abs((glide.height??0)-(vowel.height??0)) +
    FEATURE_WEIGHTS.back*Math.abs((glide.back??0)-(vowel.back??0)) +
    FEATURE_WEIGHTS.round*Math.abs((glide.round??0)-(vowel.round??0)) +
    FEATURE_WEIGHTS.nasal*Math.abs((glide.nasal??0)-(vowel.nasal??0)) +
    FEATURE_WEIGHTS.long*Math.abs((glide.long??0)-(vowel.long??0));

  return clip(delta/VOWEL_SUBSTITUTION_SCALE);
}

function featureDistance(x,y){
  if(x._type!==y._type) return glideVowelDistance(x,y);

  const keys=x._type==='V' ? VOWEL_FEATURES : CONSONANT_FEATURES;
  const scale=x._type==='V' ? VOWEL_SUBSTITUTION_SCALE : CONSONANT_SUBSTITUTION_SCALE;

  return clip(weightedDelta(x,y,keys)/scale);
}

function sub(a,b){
  return featureDistance(features(a),features(b));
}

function betterCandidate(candidate,best){
  if(!best) return true;
  if(candidate.cost < best.cost-EPSILON) return true;
  if(Math.abs(candidate.cost-best.cost)<=EPSILON && candidate.length>best.length) return true;
  return false;
}

function explain(a,b) {
  const x=tokenize(a), y=tokenize(b);

  if(!x.length||!y.length) {
    return {
      tokensA:x,tokensB:y,score:null,distance:null,normalized:null,
      alignmentLength:null,pairs:[],methodologyVersion:'2026-10-06-phonetic-v2'
    };
  }

  const fx=x.map(features), fy=y.map(features);
  const dp=Array.from({length:x.length+1},()=>Array(y.length+1).fill(null));
  const path=Array.from({length:x.length+1},()=>Array(y.length+1).fill(null));

  dp[0][0]={cost:0,length:0};

  for(let i=1;i<=x.length;i++){
    dp[i][0]={cost:i,length:i};
    path[i][0]=1;
  }

  for(let j=1;j<=y.length;j++){
    dp[0][j]={cost:j,length:j};
    path[0][j]=2;
  }

  for(let i=1;i<=x.length;i++){
    for(let j=1;j<=y.length;j++){
      let best=null, bestPath=null;
      const sd=featureDistance(fx[i-1],fy[j-1]);

      // Ordinary vowel-consonant substitutions are forbidden (Infinity).
      // High-vowel/glide correspondences are the only cross-class exception.
      if(Number.isFinite(sd)){
        const candidate={
          cost:dp[i-1][j-1].cost+sd,
          length:dp[i-1][j-1].length+1
        };
        if(betterCandidate(candidate,best)){
          best=candidate;
          bestPath=0;
        }
      }

      const deletion={
        cost:dp[i-1][j].cost+1,
        length:dp[i-1][j].length+1
      };
      if(betterCandidate(deletion,best)){
        best=deletion;
        bestPath=1;
      }

      const insertion={
        cost:dp[i][j-1].cost+1,
        length:dp[i][j-1].length+1
      };
      if(betterCandidate(insertion,best)){
        best=insertion;
        bestPath=2;
      }

      dp[i][j]=best;
      path[i][j]=bestPath;
    }
  }

  const pairs=[];
  let i=x.length,j=y.length;

  while(i||j){
    const k=!i ? 2 : !j ? 1 : path[i][j];

    if(k===0){
      const aa=x[i-1], bb=y[j-1];
      const distance=featureDistance(fx[i-1],fy[j-1]);
      pairs.push({a:aa,b:bb,distance,similarity:1-distance,note:''});
      i--;
      j--;
    } else if(k===1){
      pairs.push({a:x[i-1],b:'—',distance:1,similarity:0,note:'gap'});
      i--;
    } else {
      pairs.push({a:'—',b:y[j-1],distance:1,similarity:0,note:'gap'});
      j--;
    }
  }

  pairs.reverse();

  const distance=dp[x.length][y.length].cost;
  const alignmentLength=dp[x.length][y.length].length;
  const normalized=alignmentLength ? clip(1-distance/alignmentLength) : null;

  return {
    tokensA:x,tokensB:y,
    score:distance,distance,normalized,similarity:normalized,
    alignmentLength,pairs,
    methodologyVersion:'2026-10-06-phonetic-v2'
  };
}

function unknownSegments(input){
  return tokenize(input).filter(seg=>{
    try{
      features(seg);
      return false;
    }catch{
      return true;
    }
  });
}

const api={
  normalizeIPA,
  tokenize,
  unknownSegments,
  getFeatures:features,
  segmentDistance:sub,
  segmentSimilarity:(a,b)=>{
    const d=sub(a,b);
    return Number.isFinite(d) ? 1-d : 0;
  },
  explain,
  align:explain,
  rawScore:(a,b)=>explain(a,b).distance,
  normalizedSimilarity:(a,b)=>explain(a,b).normalized,
  distance:(a,b)=>{
    const n=explain(a,b).normalized;
    return n==null ? null : 1-n;
  },
  features:BASE_FEATURES,
  featureWeights:FEATURE_WEIGHTS,
  featureRanges:FEATURE_RANGES,
  consonantSubstitutionScale:CONSONANT_SUBSTITUTION_SCALE,
  vowelSubstitutionScale:VOWEL_SUBSTITUTION_SCALE,
  defaultOptions:DEFAULT_OPTIONS,
  methodologyVersion:'2026-10-06-phonetic-v2'
};

if(typeof module!=='undefined'&&module.exports)module.exports=api;else global.ALINE=api;
})(typeof window!=='undefined'?window:globalThis);
