/*
 * aline.js
 * ALINE-like phonetic similarity calculator for browser use.
 * Public API:
 *   ALINE.normalizeIPA(input)
 *   ALINE.tokenize(input)
 *   ALINE.segmentSimilarity(a, b)
 *   ALINE.rawScore(str1, str2)
 *   ALINE.normalizedSimilarity(str1, str2)
 */

(function (global) {
  "use strict";

  const FEATURE_WEIGHTS = {
    syllabic: 5,
    place: 40,
    stop: 50,
    voice: 10,
    nasal: 10,
    retroflex: 10,
    lateral: 10,
    aspirated: 5,
    long: 1,
    high: 5,
    back: 5,
    round: 5
  };

  const FEATURE_NAMES = Object.keys(FEATURE_WEIGHTS);

  const FEATURES = {
    // Plosives
    "p": { syllabic: 0, place: 10, stop: 1, voice: 0, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "b": { syllabic: 0, place: 10, stop: 1, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "t": { syllabic: 0, place: 30, stop: 1, voice: 0, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "d": { syllabic: 0, place: 30, stop: 1, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "ʈ": { syllabic: 0, place: 35, stop: 1, voice: 0, nasal: 0, retroflex: 1, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "ɖ": { syllabic: 0, place: 35, stop: 1, voice: 1, nasal: 0, retroflex: 1, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "c": { syllabic: 0, place: 55, stop: 1, voice: 0, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "ɟ": { syllabic: 0, place: 55, stop: 1, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "k": { syllabic: 0, place: 70, stop: 1, voice: 0, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "g": { syllabic: 0, place: 70, stop: 1, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "q": { syllabic: 0, place: 85, stop: 1, voice: 0, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "ɢ": { syllabic: 0, place: 85, stop: 1, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "ʔ": { syllabic: 0, place: 100, stop: 1, voice: 0, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },

    // Nasals
    "m": { syllabic: 0, place: 10, stop: 0, voice: 1, nasal: 1, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "ɱ": { syllabic: 0, place: 15, stop: 0, voice: 1, nasal: 1, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "n": { syllabic: 0, place: 30, stop: 0, voice: 1, nasal: 1, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "ɳ": { syllabic: 0, place: 35, stop: 0, voice: 1, nasal: 1, retroflex: 1, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "ɲ": { syllabic: 0, place: 55, stop: 0, voice: 1, nasal: 1, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "ŋ": { syllabic: 0, place: 70, stop: 0, voice: 1, nasal: 1, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },

    // Fricatives
    "ɸ": { syllabic: 0, place: 10, stop: 0, voice: 0, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "β": { syllabic: 0, place: 10, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "f": { syllabic: 0, place: 15, stop: 0, voice: 0, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "v": { syllabic: 0, place: 15, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "θ": { syllabic: 0, place: 25, stop: 0, voice: 0, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "ð": { syllabic: 0, place: 25, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "s": { syllabic: 0, place: 30, stop: 0, voice: 0, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "z": { syllabic: 0, place: 30, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "ʃ": { syllabic: 0, place: 45, stop: 0, voice: 0, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "ʒ": { syllabic: 0, place: 45, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "ʂ": { syllabic: 0, place: 40, stop: 0, voice: 0, nasal: 0, retroflex: 1, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "ʐ": { syllabic: 0, place: 40, stop: 0, voice: 1, nasal: 0, retroflex: 1, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "ç": { syllabic: 0, place: 55, stop: 0, voice: 0, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "ʝ": { syllabic: 0, place: 55, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "x": { syllabic: 0, place: 70, stop: 0, voice: 0, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "ɣ": { syllabic: 0, place: 70, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "χ": { syllabic: 0, place: 85, stop: 0, voice: 0, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "ʁ": { syllabic: 0, place: 85, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "h": { syllabic: 0, place: 100, stop: 0, voice: 0, nasal: 0, retroflex: 0, lateral: 0, aspirated: 1, long: 0, high: 0, back: 0, round: 0 },
    "ɦ": { syllabic: 0, place: 100, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 1, long: 0, high: 0, back: 0, round: 0 },

    // Liquids and glides
    "l": { syllabic: 0, place: 30, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 1, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "ɫ": { syllabic: 0, place: 30, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 1, aspirated: 0, long: 0, high: 0, back: 0.5, round: 0 },
    "ʎ": { syllabic: 0, place: 55, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 1, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "r": { syllabic: 0, place: 30, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "ɾ": { syllabic: 0, place: 30, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "ɹ": { syllabic: 0, place: 30, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "ɻ": { syllabic: 0, place: 35, stop: 0, voice: 1, nasal: 0, retroflex: 1, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "j": { syllabic: 0, place: 55, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 1, back: 0, round: 0 },
    "w": { syllabic: 0, place: 10, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 1, back: 1, round: 1 },

    // Vowels
    "i": { syllabic: 1, place: 0, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 1.0, back: 0.0, round: 0 },
    "ɪ": { syllabic: 1, place: 0, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0.85, back: 0.0, round: 0 },
    "y": { syllabic: 1, place: 0, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 1.0, back: 0.0, round: 1 },
    "ʏ": { syllabic: 1, place: 0, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0.85, back: 0.0, round: 1 },
    "ɨ": { syllabic: 1, place: 0, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 1.0, back: 0.5, round: 0 },
    "ʉ": { syllabic: 1, place: 0, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 1.0, back: 0.5, round: 1 },
    "u": { syllabic: 1, place: 0, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 1.0, back: 1.0, round: 1 },
    "ʊ": { syllabic: 1, place: 0, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0.85, back: 1.0, round: 1 },
    "e": { syllabic: 1, place: 0, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0.7, back: 0.0, round: 0 },
    "ɛ": { syllabic: 1, place: 0, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0.5, back: 0.0, round: 0 },
    "ø": { syllabic: 1, place: 0, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0.7, back: 0.0, round: 1 },
    "œ": { syllabic: 1, place: 0, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0.5, back: 0.0, round: 1 },
    "ə": { syllabic: 1, place: 0, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0.5, back: 0.5, round: 0 },
    "ɐ": { syllabic: 1, place: 0, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0.25, back: 0.5, round: 0 },
    "a": { syllabic: 1, place: 0, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0.0, back: 0.0, round: 0 },
    "ä": { syllabic: 1, place: 0, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0.0, back: 0.5, round: 0 },
    "ɑ": { syllabic: 1, place: 0, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0.0, back: 1.0, round: 0 },
    "ɒ": { syllabic: 1, place: 0, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0.0, back: 1.0, round: 1 },
    "o": { syllabic: 1, place: 0, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0.7, back: 1.0, round: 1 },
    "ɔ": { syllabic: 1, place: 0, stop: 0, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0.5, back: 1.0, round: 1 },

    // Affricates
    "t͡s": { syllabic: 0, place: 30, stop: 0.5, voice: 0, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "d͡z": { syllabic: 0, place: 30, stop: 0.5, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "t͡ʃ": { syllabic: 0, place: 45, stop: 0.5, voice: 0, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "d͡ʒ": { syllabic: 0, place: 45, stop: 0.5, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "ts": { syllabic: 0, place: 30, stop: 0.5, voice: 0, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "dz": { syllabic: 0, place: 30, stop: 0.5, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "tʃ": { syllabic: 0, place: 45, stop: 0.5, voice: 0, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 },
    "dʒ": { syllabic: 0, place: 45, stop: 0.5, voice: 1, nasal: 0, retroflex: 0, lateral: 0, aspirated: 0, long: 0, high: 0, back: 0, round: 0 }
  };

  const MULTI_SEGMENTS = [
    "t͡s", "d͡z", "t͡ʃ", "d͡ʒ",
    "ts", "dz", "tʃ", "dʒ"
  ];

  function normalizeIPA(input) {
    return String(input || "")
      .trim()
      .toLowerCase()
      .replace(/[ˈˌ.ːˑ\s]/g, "")
      .replace(/[\/\[\]\(\)]/g, "");
  }

  function tokenize(input) {
    const s = normalizeIPA(input);
    const out = [];
    let i = 0;

    while (i < s.length) {
      let matched = false;

      for (const seg of MULTI_SEGMENTS) {
        if (s.startsWith(seg, i)) {
          out.push(seg);
          i += seg.length;
          matched = true;
          break;
        }
      }

      if (!matched) {
        out.push(s[i]);
        i += 1;
      }
    }

    return out;
  }

  function getFeatures(seg) {
    return FEATURES[seg] || null;
  }

  function segmentDistance(a, b) {
    const fa = getFeatures(a);
    const fb = getFeatures(b);

    if (!fa || !fb) return 1;

    let weightedDiff = 0;
    let totalWeight = 0;

    for (const feature of FEATURE_NAMES) {
      const weight = FEATURE_WEIGHTS[feature] || 1;
      const av = fa[feature] ?? 0;
      const bv = fb[feature] ?? 0;

      weightedDiff += weight * Math.abs(av - bv);
      totalWeight += weight;
    }

    return totalWeight === 0 ? 1 : clamp01(weightedDiff / totalWeight);
  }

  function segmentSimilarity(a, b) {
    if (a === b) return 1;
    return clamp01(1 - segmentDistance(a, b));
  }

  function pairScore(a, b) {
    return 2 * segmentSimilarity(a, b) - 1;
  }

  function combinedScore(one, partA, partB) {
    const avg =
      (segmentSimilarity(one, partA) + segmentSimilarity(one, partB)) / 2;

    return 2 * avg - 1 - 0.15;
  }

  function rawScore(str1, str2) {
    const seq1 = tokenize(str1);
    const seq2 = tokenize(str2);

    const n = seq1.length;
    const m = seq2.length;
    const gap = -0.5;

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
        const candidates = [];

        candidates.push(
          dp[i - 1][j - 1] + pairScore(seq1[i - 1], seq2[j - 1])
        );

        candidates.push(dp[i - 1][j] + gap);
        candidates.push(dp[i][j - 1] + gap);

        // 1-to-2 expansion
        if (j >= 2) {
          candidates.push(
            dp[i - 1][j - 2] +
              combinedScore(seq1[i - 1], seq2[j - 2], seq2[j - 1])
          );
        }

        // 2-to-1 compression
        if (i >= 2) {
          candidates.push(
            dp[i - 2][j - 1] +
              combinedScore(seq2[j - 1], seq1[i - 2], seq1[i - 1])
          );
        }

        dp[i][j] = Math.max(...candidates);
      }
    }

    return dp[n][m];
  }

  function normalizedSimilarity(str1, str2) {
    const seq1 = tokenize(str1);
    const seq2 = tokenize(str2);

    if (seq1.length === 0 && seq2.length === 0) return 1;
    if (seq1.length === 0 || seq2.length === 0) return 0;

    const raw = rawScore(str1, str2);
    const maxLen = Math.max(seq1.length, seq2.length);

    return clamp01((raw + maxLen) / (2 * maxLen));
  }

  function clamp01(x) {
    return Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
  }

  const api = {
    normalizeIPA,
    tokenize,
    rawScore,
    normalizedSimilarity,
    segmentSimilarity,
    segmentDistance,
    features: FEATURES,
    featureWeights: FEATURE_WEIGHTS
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.ALINE = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
