# Modern translation audit — 2026-10-07

## Scope

Full review of all 198 entries in `indoeuropanvordes/pie_vordes`.

The `word` field is input to lookup and semantic comparison. It must therefore contain a direct contemporary equivalent of the row meaning in the control language. A historically related cognate, learned archaism, narrower species/term, different part of speech, or merely associated word must not replace the ordinary modern equivalent just because it increases graphic or phonetic similarity.

Historical cognates may be recorded in `pie`, `note`, or separate etymological evidence, but they do not substitute for `word` in PI.

## Rules applied

- Prefer an ordinary contemporary semantic equivalent.
- Keep the same part of speech and the same lexical sense across languages where the language permits it.
- Do not select an archaic or literary cognate over the ordinary modern word merely to preserve the PIE family.
- Do not substitute a hyponym/hypernym or related object (for example snowflake for snow, honey for mead, lake for sea, bed for lie).
- When a language normally uses a multiword expression, store that expression rather than a semantically broader one-word verb.
- `root`, `root_romanization`, and `root_ipa` remain curated comparison fields and are preserved by `scripts/add-pie-roots.mjs` once present.

## Corrected rows

The audit corrected 40 rows: 4, 5, 29, 30, 32, 34, 36, 37, 40, 41, 42, 43, 44, 45, 48, 49, 51, 52, 54, 57, 58, 60, 61, 71, 78, 93, 100, 104, 108, 114, 128, 129, 132, 138, 140, 142, 143, 162, 187, 196.

Representative fixes include:

- English `mere` → `sea`.
- Russian `пир` → `огонь`.
- Greek `ύδωρ` → `νερό`.
- Greek `νιφάδα` “snowflake” → `χιόνι` “snow”.
- Russian `юный` → neutral `молодой`.
- Russian `иго` → literal `ярмо`.
- French/Spanish/Italian bed nouns in the “lie” row → current verbs.
- `port / puerto / порог / πόρος` in the “ford” row → direct modern “ford” equivalents.
- Honey words in the “mead” row → names of the beverage.
- Spanish `musaraña` “shrew” → `ratón` “mouse”.
- Greek `πυρ` → `φωτιά`.
- German `Korn` in the “wheat” row → `Weizen`.
- English archaic `thee` → current `you`.
- Spanish/Italian bare `estar/stare` in the physical “stand” row → `estar de pie / stare in piedi`.
- Persian `عصاره` “extract/essence” → `آب‌میوه` “juice”.
- Hindi `भोज` “Himalayan birch” → generic `भूर्ज` “birch”.
- English `great` in the size row → `big`.

## Deliberate exceptions and sense limits

- Row 18 keeps Russian `матерь` because that comparison form was explicitly selected for the Interal procedure; it is not an accidental cognate substitution.
- Some meanings do not have one perfectly scope-neutral equivalent in every language (for example “old”, “nephew”, “beast”). A valid direct modern translation is retained rather than fabricating a one-word equivalent that the language does not have.
- Synonyms that are genuinely current and semantically direct are not rejected merely because another synonym is more frequent.

## Regression protection

`tests/indoeuropan-hindi-persian.test.mjs` now asserts major corrected forms and explicitly rejects several former cognate-biased substitutions. `scripts/add-pie-roots.mjs` preserves already curated root fields, so rerunning the root helper no longer overwrites reviewed roots.
