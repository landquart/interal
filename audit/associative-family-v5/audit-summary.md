# Associative family index v5 corrective audit

Final verdict: **INSUFFICIENT_EVIDENCE**.

The corrective graph passes the available exhaustive structural checks, but this is not a linguistic acceptance decision. The probability sample, dual independent human-involved annotation, independent recall gold, adjudication, preview load matrix, and complete preview-browser matrix required for `ACCEPT` do not exist. Do not merge, promote, switch production, or describe v5 as production-ready.

## Object and provenance checked

- PR: `#622`, branch `fix/associative-family-corrective-v5`; base `main` remains unchanged.
- Corrective build: run `35461412225`, source commit `7a11f43b8115b94e15d4f8524350ed952162236e`.
- Structural/regression audit: `35464552349`; semantic sample: `35465285032`; artifact runtime: `35466726037`; browser workflow: `35502652097`; staging upload: `35502881404`.
- Full downloaded semantic ZIP SHA-256: `92397839645a9fd2b5f7c467d97cbbb00f8f8639ae8e9e8e6e9e5b526b52135f` (3,262,125 bytes).
- Metadata/assignments/input-lock/structural/runtime/browser/staging ZIP hashes were independently recomputed and match GitHub artifact digests; see `artifact-checksums.json`.
- The original 667,274,991-byte members ZIP was downloaded and verified as `576b08b2ba90902f64414510504fb7769d690f3835a782b5ee2c5434b904ea3e` by audit-copy run `35508194155`, then split into six 256-shard language artifacts without rebuilding or replacing v5.
- Build environment: Node `v22.23.2`, schema/build `5`; candidate tree `2fa23e5690cbdcb80e27708f950a3c3935d87a566030221327c06eabbab0f2f6`; candidate manifest `380c6ac273c418b95f9e4cf3713b094ef4ae9538abec0868e1245cb36fd91658`; Kaikki `42e0bfe1669513cb89bd0a12f2e85d1a8f4ebedc70c65ec88c9509d0f5d392f9`.

`annotation-input-lock.json` is deliberately marked provisional: the old sample cannot be locked as a population-precision sample, and protocol v2 still requires pilot calibration.

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
| Published 9,600 rows | `partial` | Exactly 9,600 unique memberships, 1,600/language, all found in assignments. Full members cross-check remains dependent on retrieving the split audit copies locally. |
| Sampling design | `not_verified` | No row has `stratum_population`, `stratum_sample_size`, `inclusion_probability`, or `sampling_weight`. The deterministic two-stage round-robin allocation does not support a population estimate as published. |
| Evidence packets | `not_verified` | Rows omit sense/etymology ID, claimed direction/path, source record/hash/path, assignment/member/family shard, and locked source excerpt. |
| Pilot/calibration | `not_started` | No independent 30–50-row-per-language pilot or finalized protocol hash. |
| Dual annotation | `not_started` | A/B files contain null templates, not answers; 0/9,600 rows have two reviews or human participation. |
| Agreement/adjudication | `not_started` | No valid annotations; kappa, confusion matrix and adjudication cannot be computed. |
| Recall | `not_verified` | The seven `seed_only` rows are challenge controls, not an independently sampled recall gold frame. |
| Local artifact runtime | `verified_for_local_handler` | 42 cases; local Node handler only. Transfer is a `deflateRaw` estimate, not network bytes. |
| Staging Blob handler | `partial` | Private Blob/Range data was read through a locally invoked API handler; Vercel edge/browser end-to-end latency, CPU, memory and cost are absent. |
| Concurrency 1/10/50/100 | `not_verified` | Existing artifact concurrency measures local work and estimated bytes, not approved preview network load. |
| Browser regression | `partial` | Chromium desktop/mobile controls ran against a local fixture server. Required real-preview, all-language positive, offline/timeout/corrupt transport, trace/waterfall and full ZIP matrix are not demonstrated. |

## Published sample audit

The old sample uses seed `associative-family-v5-semantic-audit-2026-09-19`: lowest 24,000 hashes per language are enriched, then realized strata are visited round-robin until 1,600 rows. Independent QA found 9,600 rows, 9,600 unique membership tuples, no duplicates, 1,600 per language, and all 9,600 in assignments. It found zero rows with the five required design fields. Therefore the sample may be retained as a challenge/regression set, but must not yield whole-index precision.

Before main annotation, generate a probability sample with known inclusion probabilities and separate non-probability challenge cases. Build blinded evidence packets, conduct the pilot, then record final hashes. Do not transfer answers between graph/policy generations without a documented applicability decision.

## Annotation and statistical pipeline

Protocol v2 separates membership, evidence, corpus quality and runtime eligibility. The scorer now rejects incomplete schemas, shared annotators and rows without a human; preserves `uncertain`; computes raw agreement, confusion matrix and Cohen's kappa; reports resolved/conservative/optimistic design-weighted precision; and uses a reproducible stratified family-cluster bootstrap. Small groups remain `insufficient_evidence`. Tests cover agreement and weighted precision.

No values are reported for TP/FP/U, precision, confidence intervals, recall, agreement or adjudication because doing so would require fabricating missing human judgments.

## What is required from people

1. Recruit pseudonymous competent reviewers covering all six languages; each membership needs two blind reviews from distinct evaluators and at least one human.
2. Independently annotate and discuss a 30–50-item pilot per language; then freeze protocol and thresholds.
3. Annotate the replacement 9,600-row probability sample in blind batches; preserve raw A/B answers.
4. Adjudicate every disagreement/uncertain/policy error plus the prespecified agreement audit.
5. Independently sample, dual-review and adjudicate an external recall frame before comparing it with v5.

Only after those tasks pass the locked thresholds should an approved non-production preview receive the prespecified network load and complete browser/transport matrix. Any graph or policy correction requires a new immutable generation and fresh acceptance evidence/holdout.

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
- Preview load/browser release gates: **NOT ESTABLISHED**
- Final verdict: **INSUFFICIENT_EVIDENCE**
- Merge/production authorization: **NO**
