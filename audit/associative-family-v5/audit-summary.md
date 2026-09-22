# Associative family index v5 corrective audit

Final verdict: **INSUFFICIENT_EVIDENCE**.

The corrective graph passes the available exhaustive structural checks, but this is not a linguistic acceptance decision. The probability sample, dual independent human-involved annotation, independent recall gold, adjudication, preview load matrix, and complete preview-browser matrix required for evidence-based `ACCEPT` do not exist. Do not merge, promote, switch production, or describe v5 as linguistically validated or production-ready.

Owner disposition recorded 2026-09-20: **OWNER_ACCEPTED_AT_RISK WITHOUT HUMAN LINGUISTIC VALIDATION**. This explicit waiver is documented in `owner-risk-acceptance.json`. It changes the operational disposition, not the missing evidence. The owner subsequently gave separate explicit authorization to merge PR #622 and switch production to the exact immutable v5 prefix.

Operational follow-up on 2026-09-22 materialized the immutable artifacts from source run `35647932153` as repository-backed static gzip files and removed the legacy Blob upload/runtime path. PRs `#629`, `#630`, and `#631` completed that migration and added a repeatable production regression. Production audit run `35720424792`, main Tests run `35721002453`, and deployment run `35721001710` passed. The preserved `production-regression.json` verifies `family:liber` for all six languages, rejects a working `family:libert`, checks the complete returned sets for listed corpus noise, and exercises cache reuse, shared-loader races, in-flight AbortSignal cancellation, offline, timeout, corrupt-response, and 404 recovery. This closes the automatable runtime/browser/storage follow-up; it does not supply human linguistic judgments.

## Object and provenance checked

- PR: `#622`, branch `fix/associative-family-corrective-v5`; base `main` remains unchanged.
- Corrective build: run `35461412225`, source commit `7a11f43b8115b94e15d4f8524350ed952162236e`.
- Structural/regression audit: `35464552349`; semantic sample: `35465285032`; artifact runtime: `35466726037`; browser workflow: `35502652097`; staging upload: `35502881404`.
- Full downloaded semantic ZIP SHA-256: `92397839645a9fd2b5f7c467d97cbbb00f8f8639ae8e9e8e6e9e5b526b52135f` (3,262,125 bytes).
- Probability kit v2: run `35509462238`, artifact `10603949468`, ZIP SHA-256 `0e19c9d40961da7be037a63156576db0d8a5093c2e61134b6c10bb3c7dc593f8` (2,808,130 bytes).
- Metadata/assignments/input-lock/structural/runtime/browser/staging ZIP hashes were independently recomputed and match GitHub artifact digests; see `artifact-checksums.json`.
- The original 667,274,991-byte members ZIP was downloaded and verified as `576b08b2ba90902f64414510504fb7769d690f3835a782b5ee2c5434b904ea3e` by audit-copy run `35508194155`, then split into six 256-shard language artifacts without rebuilding or replacing v5.
- Build environment: Node `v22.23.2`, schema/build `5`; candidate tree `2fa23e5690cbdcb80e27708f950a3c3935d87a566030221327c06eabbab0f2f6`; candidate manifest `380c6ac273c418b95f9e4cf3713b094ef4ae9538abec0868e1245cb36fd91658`; Kaikki `42e0bfe1669513cb89bd0a12f2e85d1a8f4ebedc70c65ec88c9509d0f5d392f9`.

`annotation-input-lock.json` now locks probability sample v2 and its weights. It remains pre-annotation because source-record packet fields and protocol pilot calibration are incomplete.

## Corrected counts

An independent streaming recount of all six locked assignment files established the units:

| Metric | v5 count |
|---|---:|
| Lemma records | 4,924,980 |
| Component evidence records | 9,350,026 |
| Unique `(language, lemma_id, family_id)` memberships | 10,426,189 |
| Expected materialized members | 10,426,189 |
| Memberships with repeated component evidence | 5,097 |
| Excess repeated component→membership links | 6,282 |

`manifest.counts.components` is incremented once per component evidence record. It is not a membership count. The previous v4→v5 report compared v4 memberships (`14,918,457`) with v5 components (`9,350,026`), so its `-5,568,431` delta was invalid. The corrected membership delta is `10,426,189 - 14,918,457 = -4,492,268`; this reduction still proves neither precision nor recall.

## Evidence status by gate

| Gate | Status | Evidence and limitation |
|---|---|---|
| Structural consistency | `verified` | Full audit reports 2,456,627 families, 1,934,061 aliases, 10,426,189 memberships, zero assignment/member mismatches and zero listed structural violations. |
| Known regression controls | `verified_for_listed_controls` | Listed false merges/noise controls pass; this does not establish global linguistic precision or recall. |
| Legacy 9,600 rows | `challenge_only` | Exactly 9,600 unique memberships, 1,600/language, all found in assignments, but no design probabilities. |
| Probability sample v2 | `preflight_verified` | New fixed-size language-stratified sample: 9,600 unique assignment-backed memberships, 1,600/language; all rows contain `N_h`, `n_h`, `n_h/N_h`, and `N_h/n_h`. |
| Sampling design | `verified_for_language_stratified_estimator` | Seed and membership frame are fixed before labels; rare-risk cases remain a separate challenge set. |
| Evidence packets | `partial` | Assignment evidence paths and shard locators are present; unavailable sense/etymology, template direction and source-record hash/path fields are explicitly `null` and must be completed where required. |
| Pilot/calibration | `not_started` | No independent 30–50-row-per-language pilot or finalized protocol hash. |
| Dual annotation | `not_started` | A/B files contain null templates, not answers; 0/9,600 rows have two reviews or human participation. |
| Agreement/adjudication | `not_started` | No valid annotations; kappa, confusion matrix and adjudication cannot be computed. |
| Recall | `not_verified` | The seven `seed_only` rows are challenge controls, not an independently sampled recall gold frame. |
| Local artifact runtime | `verified_for_local_handler` | 42 cases; local Node handler only. Transfer is a `deflateRaw` estimate, not network bytes. |
| Repository storage | `verified` | Production serves the immutable v5 dataset as static Git-backed gzip files. Provenance locks source run `35647932153`; legacy associative-family Blob workflow and uploader were removed in PR `#630`. |
| Runtime concurrency and cache | `verified_for_production_controls` | The production regression verifies shared-loader concurrent requests, exact race results, family-index-only cache reuse, and bounded alias fan-out. This is functional regression evidence, not a full capacity benchmark. |
| Browser and transport regression | `verified_for_automated_matrix` | Production Chromium desktop/mobile checks cover six-language positive controls, `liber`/`libert`, in-flight cancellation, offline, timeout, corrupt JSON and 404 cache eviction. The preserved report records latency and network resources. |

## Published sample audit

The old sample uses seed `associative-family-v5-semantic-audit-2026-09-19`: lowest 24,000 hashes per language are enriched, then realized strata are visited round-robin until 1,600 rows. Independent QA found 9,600 unique assignment-backed tuples but zero rows with the five design fields. It is retained only as a challenge/regression set.

Probability sample v2 uses seed `associative-family-v5-probability-sample-2026-09-20`. For every language, the 1,600 lowest uniformly hashed membership keys are selected from the complete locked membership frame. Population sizes are `en 2,646,264`, `de 2,279,256`, `fr 1,155,666`, `es 1,892,812`, `it 1,215,120`, `ru 1,237,071`. Every row records stratum population/sample size, inclusion probability and inverse-probability weight. Its sample SHA-256 is `5ef0a53f257878acc6c65c04ff943dc9a3699f9499e4f7a59b3ebeab5037ede8`.

Before main annotation, complete source-record evidence packets and conduct the pilot, then freeze the final protocol hash. Do not transfer answers between graph/policy generations without a documented applicability decision.

## Annotation and statistical pipeline

Protocol v2 separates membership, evidence, corpus quality and runtime eligibility. The scorer now rejects incomplete schemas, shared annotators and rows without a human; preserves `uncertain`; computes raw agreement, confusion matrix and Cohen's kappa; reports resolved/conservative/optimistic design-weighted precision; and uses a reproducible stratified family-cluster bootstrap. Small groups remain `insufficient_evidence`. Tests cover agreement and weighted precision.

No values are reported for TP/FP/U, precision, confidence intervals, recall, agreement or adjudication because doing so would require fabricating missing human judgments.

## What is required from people

1. Recruit pseudonymous competent reviewers covering all six languages; each membership needs two blind reviews from distinct evaluators and at least one human.
2. Independently annotate and discuss a 30–50-item pilot per language; then freeze protocol and thresholds.
3. Annotate the replacement 9,600-row probability sample in blind batches; preserve raw A/B answers.
4. Adjudicate every disagreement/uncertain/policy error plus the prespecified agreement audit.
5. Independently sample, dual-review and adjudicate an external recall frame before comparing it with v5.

The automated production browser/transport matrix is now complete for the accepted-at-risk repository-backed release. The human precision/recall work above remains deferred and must not be represented as completed. Any graph or policy correction requires a new immutable generation and fresh acceptance evidence/holdout.

## Reproduction

```bash
npm ci
node --test tests/associative-family-annotation-scoring.test.mjs tests/associative-family-semantic-sampling.test.mjs
node scripts/audit-associative-family-semantic-sample.mjs \
  gold-sample.jsonl assignments-directory optional-members-directory
node scripts/score-associative-family-annotations.mjs \
  annotation-a.jsonl annotation-b.jsonl adjudication.jsonl precision-recall-report.json
git diff --check
```

## Decision

- Structural integrity: **PASS within the recorded structural requirements**
- Linguistic precision: **NOT ESTABLISHED**
- False-negative recall: **NOT ESTABLISHED**
- Production runtime/browser/storage gates: **PASS for the automated regression matrix**
- Evidence-based audit verdict: **INSUFFICIENT_EVIDENCE**
- Owner disposition: **OWNER_ACCEPTED_AT_RISK**
- Merge/production authorization: **YES — explicit owner risk acceptance; exact immutable v5 prefix only**
