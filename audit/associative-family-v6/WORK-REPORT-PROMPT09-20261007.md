# Prompt 09 — shadow queries, independent aliases and original corpus measurements

Baseline **a881152a940986e142fb0577f7a064491499e6de**, read after updating remote. CHECKPOINT, WORK-REPORT-20261003, generated metrics, catalog, normalizer, parallel/shadow runtime and the saved query differential were inspected. Prompt 08 was already complete and was not repeated. PR #652 remains draft above #651; **main → #650 → #651 → #652**, all unmerged. Production remains v5.

## Separate durable stages

Research and the initial explicit query/measurement decision were published separately. The complete research blob is restored and hash-verified at **b5cf9fc92d2b0d1b2b25caa636d0efc228b163ef**; the earlier first upload was truncated by the shell-output transport and is not a valid research certification. The exact corrected SHA is recorded below in CHECKPOINT and validation. Initial decision **65c82a647883f1e029c64cda308832ec8daaacc3**; real JSON-order finding and equality decision **28892e7679ab12a3c1d7ba41a8418e6c4914e538**; application **438f0aba97b818c48ee9d7a75cf3896eb175733e**. Published application tree **4ccde60e141c032aa1d9004ec5044ce101440507** equals the tested local tree. Validation and this report are a separate commit.

Shell push lacked credentials. The GitHub connector published blobs, trees, commits and leased fast-forward ref updates; every final uploaded blob was checked against local Git hashes. No merge or forced update occurred. Initial truncated research is retained as history and corrected before application.

## Query and identity decisions

`v6QueryKey = buildSearchForm` is used on both catalog aliases and incoming queries. Shadow no longer pre-normalizes before a different alias equality function. `normalizeHead` remains unchanged: lexical identity keeps NFC diacritics, Cyrillic distinctions and ß. A search-key collision returns every catalog family target; it never merges heads, canonicals or memberships.

The unchanged lexical alias strings and canonical roots remain in the catalog. Runtime exposes original query, v6 query key, family targets/counts and source-evidence key/routes separately. The existing persisted v5 alias key strips non-alphanumeric punctuation after `buildSearchForm`; that legacy source key is deliberately separate from the v6 catalog key, whose hyphens/apostrophes remain meaningful. No new aliases or linguistic realizations are approved here. Ped/creat and the individually evidenced observ~osserv relation remain unchanged.

Language scope is explicit. Family search filters current accepted generated memberships; a catalog route with zero accepted rows in the selected language reports count zero. Each evidence route is checked against actual member availability in that language, not declared `language_support` or another route's result. Surface route language is respected. Unsupported languages fail explicitly. Evidence-only val retains fifteen unscoped independent routes; scoped EN/DE/FR/ES/IT/RU counts are **9/6/11/4/10/3**, while accepted family results are zero in every language. A separate synthetic collision verifies simultaneous family and evidence routes without suppressing either.

## Actual retrieval and exact differential

All **88 catalog canonical/alias forms** pass original/normalized spelling checks. **106 actual queries and 636 selected-language query checks** are stored with exact membership IDs, corpus IDs, route IDs and source proofs in `prompt09-shadow-20261007/generated/queries.json.gz`. Diacritics, Cyrillic, ё, ъ, ß, hyphen and apostrophe equivalence/boundaries are tested; collision fixtures are synthetic and never enter source/catalog registries.

| Query | Prior shadow memberships, all languages | Current shadow memberships | Current Russian memberships |
|---|---:|---:|---:|
| операция / operacija | 0 | 1,600 | 138 |
| мутация / mutacija | 0 | 569 | 41 |

These are recovered query routes to already accepted rows, **not new memberships**. Other existing catalog alias result sets have no additions or losses against the saved research snapshot. Exact repair IDs are separately stored in `alias-repairs.json.gz`.

**Membership differential against baseline: +0 / −0 / changed 0.** Catalog 19, lexical heads 222, accepted memberships 21,566 and review units 23,232 remain unchanged. All membership/head/edge/catalog bytes remain identical. Only migration `source-lock.json` and `manifest.json` change to track the revised shared runtime hash; other 275 migration artifacts are identical to baseline. V5, source frequencies, lemma IDs, historical evidence and Prompt 06/07 outputs retain exact Git trees.

The differential compares uncapped persisted v5 source alias arrays separately from real `FamilyIndexLoader.candidateEntries` results. Production fan-out guards remain in force and are saved as explicit blocked results rather than fake empty output. Every raw-route difference is classified as intentional technical demotion, previously approved finite membership addition/correction, alias-only routing or unexpected loss; **unexpected differential is zero**. For example: ped stays 1,556→1,556; val candidate retrieval 5,516→0 accepted family rows preserves research routes; act 19,341 candidate IDs→3,826 accepted IDs includes 386 earlier approved additions and 15,901 technical demotions. Those technical demotions are not fresh linguistic exclusions. System and atom finite promotions remain their previously approved frames.

The old query-differential file remains unchanged and addressable. The new `production-v5-differential.json.gz` saves actual production results independently; neither table is a screenshot or an inferred display count.

## Original frequency and source preservation

Hydration returns original measured fields without deriving frequency from family size. **21,566 accepted memberships map to 21,371 unique language/corpus-ID records; 195 IDs have multiple accepted components.** Deduplication keeps one measured row per language and original ID and retains all accepted head/family/version/source-proof links in `accepted_memberships`. Different languages stay distinct. Frequency is aggregate corpus measurement; no token, POS or sense allocation is invented. Every accepted hydration is checked against the exact original member record and available record hash. Complete measured rows and proof links are saved in `hydrated-accepted-corpus-rows.json.gz`.

The initial global equality check caught one shared German ID, **lemma:3b7890b5d782866cb765**, Aktionärsinformationen, in act and inform. Its source measurements are semantically identical, but JSON object keys have different order. The documented decision canonicalizes object keys only for the internal equality signature, preserves array order and returns the original objects unchanged. A regression test uses both real source records. A genuinely conflicting measurement value still fails rather than being silently summed or selected.

All **829 zero-v5 source records** are retrieved by original language/ID and through a separate evidence-only normalized word lookup. Their exact source measurements, ranks/IPM and original source references are saved in `zero-membership-retrieval.json.gz`; they remain absent from accepted family memberships. No aggregate score is synthesized. Candidate/evidence nodes remain independently addressable. The shadow cache is bounded and failed reads are retryable.

Revision/correction fixtures regenerate the current accepted snapshot and reload search: an excluded/uncertain edge disappears while another accepted component of the same record survives. There are no real approved correction dossiers in this snapshot; the test does not pretend a synthetic fixture is a real correction. Static runtime snapshots must be reloaded after regenerated materialized data changes.

## Validation and limits

Eight new targeted shadow tests, existing normalization/architecture tests and **full npm test on 135 files** pass. The actual shadow audit passes; independent repeat produces **seven byte-identical artifacts**. Migration replay produces **277 byte-identical artifacts** against current generated output. Frozen Prompt 03/04/oper-relat checks and the independent v6 integrity audit pass. Exact final-SHA CI outcomes are checked/reported separately; local results do not replace CI. Code/output/log hashes are in `prompt09-shadow-20261007/validation/validation.json`.

Application CI: [Tests](https://github.com/landquart/interal/actions/runs/37621279180) and [v6 Audit](https://github.com/landquart/interal/actions/runs/37621279292). CI of the final validation/documentation SHA must be checked independently after publishing that commit; no success is inferred from an earlier SHA. Normal v6 CI also independently checks corpus enumeration, planning/history/coverage/contamination and all their deterministic replays, plus the new shadow audit/replay step.

No new linguistic evidence blocker was introduced by this runtime repair. Existing atom national/derivational and Russian borrowing-mediator gaps, turr boundaries and zero-v5 aggregate binding gaps remain. The evidence-only word lookup added here covers the conserved 829 zero-v5 records; it is not a newly invented exhaustive word index for all materialized candidate records. Evidence nodes/source locators provide the existing candidate access path. The next stage is further finite head/family validation and supported extensions through existing mechanisms. **This completes the shadow block, not the dictionary; production switching and merge remain separate decisions.**
