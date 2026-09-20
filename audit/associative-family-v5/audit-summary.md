# Associative family index v5 corrective audit

Status: **corrective build, exhaustive structural audit, known-regression audit, runtime benchmark, staging network benchmark and browser regression passed. Semantic acceptance is incomplete.**

Verdict: **NOT PRODUCTION-READY. Do not switch production.**

Production remains on audited v4. This branch does not modify `main`, the production manifest, the production deployment, or existing v4 Blob objects.

## Locked versions and provenance

- Main/protective PR 621 merge: `d9e4f3d3e67d18f3533600deebaffc687f127523`
- PR 621 head: `e215554520a54c047207ecfc62b71d97f56572b7`
- Audited v4 build: run `35346791625`, commit `383bba507cfc0cfdc9f959fd3987ae9a9f21ae8f`
- Corrective v5 build: run `35461412225`, source commit `7a11f43b8115b94e15d4f8524350ed952162236e`
- Independent structural/regression audit: run `35464552349`
- Semantic sample generation: run `35465285032`
- Runtime artifact benchmark: run `35466726037`
- Browser regression: run `35502652097`
- Immutable staging upload: run `35502881404`
- Staging network benchmark: run `35503213959` and refreshed report generated 2026-09-20T09:58:33.883Z
- Candidate tree SHA-256: `2fa23e5690cbdcb80e27708f950a3c3935d87a566030221327c06eabbab0f2f6`
- Candidate manifest SHA-256: `380c6ac273c418b95f9e4cf3713b094ef4ae9538abec0868e1245cb36fd91658`
- Kaikki dump SHA-256: `42e0bfe1669513cb89bd0a12f2e85d1a8f4ebedc70c65ec88c9509d0f5d392f9`
- Build Node: `v22.23.2`; schema/build version: `5`
- Sharding: `fnv1a-modulo-256`, 256 buckets, languages `en,de,fr,es,it,ru`
- v5 `manifest.generated_at`: `2026-09-19T19:18:30.667Z`

Lock-only run `35441277463` restored and hashed the exact v4-scoped candidate and Kaikki cache entries. Candidate indexes and the dump were reused; source frequency indexes were not rebuilt. Failed sibling-scope run `35427527134` was caused by GitHub Actions cache-scope isolation and did not authorize or run generation.

## Why a corrective build was required

The audited v4 graph had 1,020 metadata/member mismatches, 1,096 language-support mismatches, confirmed cross-node false merges, transitive seed-family absorption, stale cross-language members after repair, corpus noise in results, and extreme alias fan-out. These are topology and materialization defects; changing metadata alone could not repair assignments, members, aliases, families and evidence consistently. A clean family-layer rebuild from locked inputs was therefore required.

## Implemented corrections

- Replaced regex/window ancestry extraction with a structured expansion parser. `lang` and `term` bind only within one logical node; evidence retains node path, parent/child, depth, template and role. Malformed or unknown structures are review-only and cannot create equivalence.
- Added an explicit relation policy for direct allomorph/descendant, borrowed, inherited, compound, affix, distant ancestor, proto, homonym and uncertain relations. Unknown or illegal relation types cannot silently become equivalence.
- Replaced transitive seed absorption with exact, language-aware root-node claims and required/forbidden controls.
- Integrated manual overrides before assignment/member materialization; the English-only post-build repair is not used for v5.
- Added deterministic canonical scoring. Canonicals of length at most two require manual verification and an audit reason.
- Added corpus-quality classification; rejected forms cannot reach runtime and suspicious forms are prevented from uncontrolled top-5 placement.
- Added serialized risk statuses used by runtime. `blocked_from_runtime`, `rejected` and `split_required` never become candidate entries.
- Retained PR 621 fail-closed fan-out and status protections.

## Old versus new counts

| Metric | audited v4 | corrective v5 | delta |
|---|---:|---:|---:|
| Families | 2,458,225 | 2,456,627 | -1,598 |
| Aliases | 1,934,061 | 1,934,061 | 0 |
| Lemmas | 4,924,980 | 4,924,980 | 0 |
| Membership/components | 14,918,457 | 9,350,026 | -5,568,431 |

The preserved lemma and alias counts confirm reuse of the locked candidate corpus; the lower component count reflects the removal/blocking of unsafe topology and is not interpreted as a precision/recall verdict by itself.

## Structural and regression results

The independent exhaustive audit ran over every shard and completed successfully. Reported build invariants are:

- processed/source lemmas: `4,924,980 / 4,924,980`
- zero-family lemmas: `0`
- families with zero members: `0`
- members without evidence: `0`
- fuzzy memberships: `0`
- Levenshtein memberships: `0`
- untyped family edges: `0`
- untyped or illegal equivalence edges: `0`
- compound edges used as equivalence: `0`
- unreviewed high-risk families: `0`

Run `35464552349` independently verified metadata/member and assignment/member consistency and the known false-merge regressions. The cases `val + remove/remover`, `net + geomagnetic`, `alter + Wasser`, `banc + alter`, `val + walkure`, forbidden `family:alter` branches and known corpus-noise top-5 entries did not recur.

## Runtime, performance and browser validation

Artifact benchmark (42 cases):

- cold p50/p95/p99: `149.34 / 231.51 / 376.56 ms`
- warm p50/p95/p99: `0.070 / 0.223 / 0.323 ms`
- normal lookup: 4 object reads
- maximum compressed transfer estimate: 1,099,724 bytes
- alias `net` fan-out 28: rejected before family/member reads

Immutable staging namespace:

`associative-family/v5-staging/run-35461412225-68b305f48e4b-576b08b2ba90/`

No v4 pathname or digest was overwritten. The refreshed private Blob/Range benchmark passed 42 cases with p50/p95/p99 `193.72 / 320.46 / 668.37 ms`; its local serverless-handler measurement excludes Vercel edge-routing overhead.

Chromium desktop and mobile regression passed 84 control combinations. Repeat-cache, AbortSignal, race and fan-out scenarios passed; page/console errors were zero; successful scenarios had `fuzzyCandidateIds=0`, `approximateCandidateIds=0`, and empty `validationErrors`.

These measurements pass the tested latency/read/transfer gates. They do not replace production-scale 1/10/50/100 concurrency and cost measurements, which remain a release requirement if the architecture or deployment environment changes.

## Statistical linguistic validation

A deterministic stratified sample of 9,600 memberships was generated (1,600 per language) with fixed seed and artifact digest `923978...`. Acceptance thresholds were fixed before annotation. Annotation protocol, scorer, disagreement/adjudication handling and confidence-interval calculations are implemented and tested.

The following mandatory evidence does **not** yet exist:

- two completed independent annotation files for all 9,600 rows;
- adjudication for every disagreement;
- an independently constructed false-negative gold set;
- valid precision and recall estimates by language, source, family size, relation type and risk status.

`false-negative-gold.jsonl` contains only seven explicit seed rows marked `seed_only` and `independently_verified:false`; it is not a recall audit. Empty/template annotations must not be scored as acceptance evidence.

## Remaining issues

- **P0 release gate:** independent annotator A and annotator B must label the 9,600-row sample; disagreements require adjudication.
- **P0 release gate:** an independent false-negative gold set must be built and reviewed before recall can be reported.
- **P1:** run the requested production-representative 1/10/50/100 concurrency, CPU, peak-memory and traffic-cost matrix on an approved preview environment.
- **P2:** preserve the staging namespace until the semantic review is complete; do not promote it implicitly.
- **P3:** expand linguistic gold coverage beyond known controls after the first accepted release.

## Reproduction

```bash
npm ci
npm test
git diff --check
node scripts/score-associative-family-annotations.mjs \
  --sample gold-sample.jsonl \
  --annotation-a annotation-a.jsonl \
  --annotation-b annotation-b.jsonl \
  --adjudication adjudication.jsonl \
  --false-negative-gold false-negative-gold.jsonl \
  --output audit/associative-family-v5/precision-recall-report.json
```

The build, audit, benchmark, browser and upload workflows are manually dispatchable and require the locked artifact/run identifiers documented in `input-lock.json` and the versioned staging prefix. Re-running the family build with different input hashes is prohibited; the workflow fails closed.

## Final decision

- Structural integrity: **PASS**
- Known false-merge regressions: **PASS**
- Runtime/browser checks performed here: **PASS**
- Statistical precision: **NOT ESTABLISHED**
- Statistical recall/false negatives: **NOT ESTABLISHED**
- Production-ready: **NO**
- Production switch authorized: **NO**

A draft PR may be reviewed, but it must not be merged or promoted until both P0 semantic gates and the remaining required performance matrix are complete.
