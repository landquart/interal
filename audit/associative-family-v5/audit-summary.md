# Associative family index v5 corrective audit

Final verdict: **INSUFFICIENT_EVIDENCE**.

The corrective graph passes the available exhaustive structural checks, but this is not a linguistic acceptance decision. The probability sample, dual independent human-involved annotation, independent recall gold, adjudication, preview load matrix, and complete preview-browser matrix required for evidence-based `ACCEPT` do not exist. Do not merge, promote, switch production, or describe v5 as linguistically validated or production-ready.

Owner disposition recorded 2026-09-20: **OWNER_ACCEPTED_AT_RISK WITHOUT HUMAN LINGUISTIC VALIDATION**. This explicit waiver is documented in `owner-risk-acceptance.json`. It changes the operational disposition, not the missing evidence. The owner subsequently gave separate explicit authorization to merge PR #622 and switch production to the exact immutable v5 prefix.

Operational follow-up on 2026-09-22 materialized the immutable artifacts from source run `35647932153` as repository-backed static gzip files and removed the legacy Blob upload/runtime path. PRs `#629`, `#630`, and `#631` completed that migration and added a repeatable production regression. Production audit run `35720424792`, main Tests run `35721002453`, and deployment run `35721001710` passed. A subsequent exhaustive repository-shard audit found 30 runtime memberships for nine already rejected corpus-noise lemmas; the bounded repository repair removed them, deleted one newly empty family, and recalculated all affected support, language_support, aliases, manifest counts and repository provenance. A later *case-by-case assistant review*, documented in `manual-case-decisions.json`, removed 22 additional false memberships from seven families and quarantined the sense-ambiguous `enm:net` family as `split_required`, without deleting families or changing the source run. The resulting static repository has 2,456,621 families, 1,934,051 aliases and 10,426,025 memberships. The preserved `production-regression.json` verifies `family:liber` for all six languages, rejects a working `family:libert`, checks the complete returned sets for listed corpus noise, and exercises cache reuse, shared-loader races, in-flight AbortSignal cancellation, offline, timeout, corrupt-response, and 404 recovery. The new case review does not constitute independent human annotation, a statistical quality estimate, or proof that all other members of these families are correct. The production regression cited here predates this case-by-case change and must be rerun after deployment.

A further word-by-word review of the three English surface families `ofn`, `lpo`, and `ilv` is recorded in `manual-surface-family-decisions.json`. The repository materialization removes their 81 false memberships and three now-empty families, while retaining the corpus lemmas themselves. A second complete review of the English surface families `gup`, `rrt`, and `mef`, documented in `manual-surface-family-decisions-2.json`, removed a further 119 false memberships and three empty families. A third complete review of `surface:es:nnn`, `surface:it:dib`, and `surface:ru:abr` removed 99 more false memberships and three empty families, recorded in `manual-surface-family-decisions-3.json`. After PR #635, repository totals were 2,456,612 families, 1,934,051 aliases, and 10,425,726 memberships. The earlier production regression does not cover this change; it requires a post-deployment rerun. This assistant review does not establish global linguistic precision.

A subsequent follow-up removed three additional short surface families (`surface:fr:nni`, `surface:de:cil`, `surface:ru:esb`) after complete reviews of their 65 member words, locked in `manual-surface-family-decisions-4.json`. A separate family-level decision removed the incoherent `surface:de:ten` family and its 17,618 links. Every `ten` link had only candidate-index morphological evidence, and the complete member set was locked by digest before deletion. This is **not** a claim that all 17,618 words were individually reviewed; the original lemmas and any other memberships remain. At the next interim stage, repository totals were 2,456,608 families, 1,934,051 aliases, and 10,408,043 memberships. The previous production regression predates both changes.

The same family-level test was applied to five more incoherent ending-based surface families: Russian `yj`, `sja`, `skij`, `nie` and German `nen`. Their 70,807 members had only candidate-index morphological evidence, with exact member digests and evidence counts locked in `surface-inflection-decisions.json`. The families and their alias targets were removed; their lemmas remain. These are family-level rejections, not 70,807 individual word annotations. Current repository totals are 2,456,603 families, 1,934,051 aliases, and 10,337,236 memberships.

A further family-level review rejected Spanish `rla`, `ado`, `nos`, `ria`, Italian `are`, and Russian `vat`: the sampled words have unrelated stems, while all 34,010 recorded links have only candidate-index morphological evidence. `surface-ending-decisions.json` locks each complete member list by digest and its evidence counts. The six families were removed from the repository materialization, preserving each lemma and any other family membership. Their alias strings still resolve to other families, so this does not certify those remaining results. Current repository totals are 2,456,597 families, 1,934,051 aliases, and 10,303,226 memberships. This is a family-level decision, not 34,010 individual lexical reviews or evidence that every remaining family has at most 20 correct members.

The subsequent review of `ety:cf2897b18b16` (`grc:γενεα`) pruned its four language lists: 14,651 German, 108 English, 121 Spanish and 52 Italian false or insufficiently supported memberships were removed. The surviving materialized members are German `gen`, `gens`, `genealogen` and English `gene` (four total). `genea-german-decision.json` and `genea-other-languages-decision.json` lock each original language list and its evidence classes. The family, the corpus lemmas and all their other memberships remain; its alias strings still target other families. This list-level review does not establish global linguistic precision or the requested 20-member condition for other families. Current repository totals are 2,456,597 families, 1,934,051 aliases and 10,288,294 memberships.

A second etymological family, `ety:1e7afcab5044` (`la:sonus`), was reduced from 6,670 to nine explicitly retained members across English, French, Spanish and Italian. The other 6,661 links included `net`/network/planet, surnames on `-son`, ambiguous homographs and noisy fragments. `sonus-language-decisions.json` locks the original lists and evidence classes. It retains sound and sonnet forms while preserving all lemmas and other family memberships. This is a bounded family decision; words excluded solely to keep the family concise may warrant separate sense-level restoration. Current repository totals are 2,456,597 families, 1,934,051 aliases and 10,281,633 memberships.

The next family-level review removed `surface:ru:ka`, whose 5,949 Russian links group unrelated stems by the final sound sequence `-ка` (including `абиссинийка`, `аэрофотосъёмка`, `адвокатишка` and `актрисочка`). All links have candidate-index evidence only. `surface-ru-ka-decision.json` locks the complete member list and evidence counts before deletion. The alias `ka` remains because it also refers to other language-specific families; the source lemmas and their other memberships remain. This is not 5,949 individual lexical annotations, and the remaining `ka` families have not been reviewed here. Current repository totals are 2,456,596 families, 1,934,051 aliases and 10,275,684 memberships.

The following family-level review removed `surface:ru:ija`, `surface:es:elo` and `surface:it:ato`, which had 5,132, 4,840 and 4,377 candidate-only links respectively. Their final sequences span unrelated Russian nominal stems, Spanish verbs with attached pronouns and unrelated nouns, and Italian participles/adjectives. `surface-suffix-decisions-5.json` locks each original list and its evidence classes. The 14,349 links were removed while preserving corpus lemmas and all other memberships; none of these words was individually annotated merely by this batch decision. Current repository totals are 2,456,593 families, 1,934,051 aliases and 10,261,335 memberships.

A further family-level review removed German `surface:de:chen` (4,641 links), English `surface:en:ted` (4,069) and Spanish `surface:es:ela` (4,034). The German family was marked `safe_automatic` despite grouping diminutives, unrelated verbs and names by the same letters; the other two grouped participial endings and attached Spanish pronouns. All their evidence came only from candidate-index morphology. The complete original member sets and evidence counts are locked in `surface-suffix-decisions-6.json`. The 12,744 links were removed without deleting corpus lemmas or their other associations. These are family-level decisions, not word-by-word annotations. Current repository totals are 2,456,590 families, 1,934,051 aliases and 10,248,591 memberships.

The next family-level review removed `surface:de:schen`, `surface:de:ers`, `surface:de:ons` and `surface:it:elo`, deleting 15,721 candidate-only links. German `schen` was another `safe_automatic` surface group that mixed unrelated adjective and verb endings; `ers` and `ons` joined inflections and internal strings, while Italian `elo` commonly joined an object pronoun to unrelated verbs. The locked member sets, evidence classes and reasons are in `surface-suffix-decisions-7.json`. Source lemmas and their other memberships remain. This review does not amount to individual annotation of those 15,721 links. Current repository totals are 2,456,586 families, 1,934,051 aliases and 10,232,870 memberships.

Seven more large surface groups (`surface:fr:ons`, `surface:it:mente`, `surface:de:tes`, `surface:es:ose`, `surface:es:ando`, `surface:en:ers`, `surface:ru:vatsja`) were rejected as incoherent morphological-ending or clitic associations. All 23,558 links were candidate-index-only; three families had nevertheless been marked `safe_automatic`. `surface-suffix-decisions-8.json` locks their original member lists and evidence classes. One alias became empty and was removed. The words and other family memberships remain, and this batch is not individual annotation. Current repository totals are 2,456,579 families, 1,934,050 aliases and 10,209,312 memberships.

Twelve further candidate-only surface groups (`surface:es:arte`, `ias`, `ome`, `rio`, `nes`, `ito`, `ita`; `surface:it:ico`; `surface:de:ken`, `zen`, `sen`; `surface:ru:tyj`) combined unrelated stems through clitics, diminutive endings, inflection or internal letter sequences. `surface-suffix-decisions-9.json` locks the original sets and evidence classes. The family-level decision removed 35,254 links without deleting the underlying words or their other memberships. It is not individual annotation. Current repository totals are 2,456,567 families, 1,934,050 aliases and 10,174,058 memberships.

An individual etymological review removed ten false links from `ety:5bed7c192e10` (`la:actus`): English `abstract`, `intact`, `impractical`; German `kontakt`, `charakter`; French `contact`, `caractère`; Spanish `contacto`; Italian `contatto`, `carattere`. Dictionary etymologies and retained positive controls are recorded in `actus-false-memberships.json`. Each rejected link had compound morphology labelled `manually_verified`, but its actual origin was a different root; the label is not proof of individual review. This case review does not certify the remaining 15,066 members of the family or reduce them to the requested 20.

A full-list structural review of `ety:1e9cc0c12192` (`la:illas`) found that all 7,738 member records carried only candidate-index morphology. The source etymology identifies Spanish `las` and French `elles` as descendants of Latin `illās`; French `lesquelles` and `desquelles` retain the related article `les`. The 7,734 other records matched a clitic or a coincidental substring (for example `abandónalas`, `abrebotellas`, `actuelles`). The exact original lists and evidence distribution are locked in `illas-family-decision.json`. This family-level exclusion does not claim individual etymological review of every excluded word.

The same complete-list review of `la:illos` and `la:illis` retained Spanish `ellos`, `los`, `les`, French `eux`, `les`, and Italian `gli`, `glie`. It removed 14,129 candidate-only links from verb forms with attached clitics or incidental substrings. The ordered original lists, evidence counts, source etymologies and preserved lemma IDs are recorded in `illos-illis-family-decisions.json`. This remains family-level evidence, not 14,129 separate human etymological judgments.

Ten more incoherent `surface:*` groups were rejected after contrasting examples and scans of all original members and evidence classes: Spanish `ote`, `ento`, `amos`, `ras`; Russian `nut`, `nost`, `cheskij`; French `tes`; German `eln`, `eren`. The complete source-list digests and counts in `surface-suffix-decisions-10.json` lock 26,757 removed links. Some had been labelled `safe_automatic` despite joining unrelated stems by a suffix or inflection. These are family-level decisions; they do not certify each excluded word individually. Totals at that historical stage were 2,456,557 families, 1,934,049 aliases and 10,125,428 memberships.

After batches 11 and 12 and PR #648, the main branch had 10,098,935 memberships. The September 29 bounded nitidus and Russian surface corrections reduced this to **10,080,875 memberships, 2,456,543 families, 1,934,050 aliases, 4,924,295 materialized unique lemmas, 685 without a family, and 3,334,263 multi-family lemmas**. The former report value 3,627,982 for the latter was stale; the current value is a complete recount. The source run remains 35647932153. See the nitidus, Russian short-root, and net routing decision ledgers.

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
| Component evidence records | 9,349,982 |
| Repository runtime memberships | 10,080,875 |
| Materialized member records | 10,080,875 |
| Memberships with repeated component evidence | 5,097 |
| Excess repeated component→membership links | 6,282 |

`manifest.counts.components` is incremented once per component evidence record. It is not a membership count. The previous v4→v5 report compared v4 memberships (`14,918,457`) with v5 components (`9,350,026`), so its `-5,568,431` delta was invalid. The current repository-runtime membership delta is `10,080,875 - 14,918,457 = -4,837,582`; this reduction proves neither precision nor recall. The repository is 345,172 memberships below the immutable 10,426,047-member source artifact. This session removed 9,924 nitid and Spanish surface records, added two reviewed records, and removed 8,138 Russian short-root links. Historical counts in the chronology above remain tied to their respective stages. Source-artifact/assignment counts elsewhere in this audit remain historical and must not be reinterpreted as repository-runtime counts.

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

## Repository review batch 12 (2026-09-28)

From the open PR #644, the five families not handled by merged PR #646 were reviewed against their full stored member lists and candidate-index evidence. The four ending-based families `surface:it:ina`, `surface:es:cia`, `surface:en:tes`, and `surface:en:ngs` were removed. The English `surface:en:sky` family was pruned from 2,458 members to eight explicitly listed sky-base forms; surname endings on `-sky` were excluded. The exact original member lists, evidence distribution, and retained lemma IDs are locked in `surface-suffix-decisions-12.json`.

This bounded decision removed 11,782 memberships and four families while preserving source lemmas and all other family memberships. The materialized unique-lemma count is 4,924,331 of 4,924,980, leaving 649 source lemmas with no stored family. The family-level exclusion is not an independent etymological annotation of every removed corpus item. Other sky compounds and the remaining large families need their own review; the global 20-member condition and linguistic precision/recall are not established. Source run 35647932153 was not regenerated.
