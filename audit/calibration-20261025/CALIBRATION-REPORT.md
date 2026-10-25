# Independent human calibration — Prompt 21

**Status: BLOCKED. No human experiment has been conducted and no human gold has been obtained.**

The engineering work builds on implementation `c567a24cc98653e9eeb5e3be4c1bba0adf3c9324` / draft PR703. It does not certify earlier draft integration or authorize production changes. The original evaluation holdout remains unchanged.

## Prepared immutable reserve

A separate provisional reserve contains **240 real corpus questions, 40 per language**, with **480 separately shuffled blind previews**. They are not released assignments. Every question has an original family/member/shard/ordinal/record-hash locator and actual dictionary context from pinned morphology sources. The final reserve excludes surface-only family placeholders. Its case IDs, question hashes, protocol, instruction hash and dataset manifest are fixed before any human answer.

| Language | Reserve questions | Preview tasks | Real reviewers | Real answers | Human gold |
|---|---:|---:|---:|---:|---:|
| English | 40 | 80 | 0 | 0 | 0 |
| German | 40 | 80 | 0 | 0 | 0 |
| French | 40 | 80 | 0 | 0 | 0 |
| Spanish | 40 | 80 | 0 | 0 | 0 |
| Italian | 40 | 80 | 0 | 0 | 0 |
| Russian | 40 | 80 | 0 | 0 | 0 |

`PREPARATION.json`, `RESERVE-MANIFEST.json` and `ARCHIVE.json` bind the exact private dataset. Coordinator cases, individual questions and original source extracts are kept out of the public Git PR to preserve future blinding. The owner-only archive must not be sent to reviewers as a whole.

## Holdout protection and independence limits

The exact 14,818,311-byte quality archive was reacquired with SHA-256 `07ef8c73370861b40091fb88d13e364310bc27085b38994b25b1fd6e628c8d6f`. All listed archived files were checked. Exclusions cover its **9,762** reserved cases and the **9,600** cases in the original historical study; neither was used as calibration questions.

The exclusion frame contains 16,228 family IDs, 19,276 language/form pairs, 7,673 native candidate containers and 37,715 source-row hashes. Known shared families, lexical IDs/spellings, physical record hashes, family aliases, etymon keys and every native observation reachable from held-out spellings were excluded. The reserve also has no such known cross-case overlaps internally.

An independent verifier imports neither the sampler nor calibration model. It checks all 240 original membership payloads across **105** physical shards, **321** documentary contexts, complete alternative/occurrence inventories, **6,742** actual original morphology rows, holdout exclusions, all packet hashes and the blind-field whitelist. Both previews contain identical question content in different orders, without coordinator risk/category flags, former verdicts, predictions or other answers. `INDEPENDENT-VERIFICATION.json` is **PASS_ENGINEERING_ONLY**.

Unknown cross-version lexical/sense/evidence mappings still prevent a complete transitive independence certificate. A shared source container is not counted as an independent vote. Known zero overlaps do not establish that all hidden dependencies are absent. This is an explicit reason not to release the study yet.

## Coverage and context gaps

All nine requested categories are preregistered. `COVERAGE-REPORT.json` distinguishes weak discovery flags from certified category membership. There are **zero independently certified obvious positives or proven negatives**. Compound coverage is absent even as a discovery flag across all six languages; false-ending and homonymy flags are absent in some language subsets. Multiple POS tags are only possible lexical ambiguity, not proof of homonymy. Multiple historical terms are not automatically a real historical contradiction. Cyrillic/Latin spelling differences are not proof of allomorphy.

Every proposed normative element and exact corpus sense remains uncertified. These gaps must be filled by independently reviewed documentary and identity context under a new frozen round if packets change. No old rejection is used as an expected INVALID label. The current reserve is useful preparation, **not a complete ready-to-run calibration dataset** meeting all substantive category requirements.

## Real humans and blind collection

`QUALIFICATION-AND-ASSIGNMENTS.json` contains **18 unfilled role slots**, not 18 invented people: two reviewer roles plus an arbiter role for each language. A genuinely qualified multilingual person may cover multiple languages; the two reviewers and arbiter for any case must be three distinct verified real people. No names, credentials, ratings or signatures were invented. No invitations, messages or packets were sent.

Before release, verify comprehension of the locked English instruction and approved normative documents, or independently validate translations without changing definitions. Then verify actual identity, language competence, relevant morphology/etymology experience, authority, conflicts and prior exposure. The new collector requires separate content-bound verification of the person, exact assignment, authenticated submission and blind packet delivery. Self-declared `kind=human` and a string authorization reference do not certify a person. Stable verified person keys prevent two accounts of one person from posing as two reviewers. Credential records stay private.

The required response preserves lexeme/language/POS/sense/root/national correspondence/relation, verdict VALID/INVALID/UNCERTAIN, grounds, precise versioned source locators, exact question/study/protocol hashes, dates, actor, time and rule issues. Insufficient support remains UNCERTAIN. Complete authenticated scientific mistakes remain visible as procedure defects rather than being deleted to improve measured agreement. The procedure does not force calibration answers to agree with model predictions. Exact original review/arbitration/roster/assignment bytes are copied into each new analysis snapshot.

## Arbitration and acceptance

Every disagreement in verdict, lexeme, language, POS, sense, root, correspondence or relation is referred, together with every uncertain pair, detected scientific scope defect and instruction issue. A fixed Bernoulli 10% hash rule, locked before labels, preselects **19 of the 240** questions for the agreement audit. This realized count is not represented as exactly 24; only agreeing pairs among those preselected questions form the random agreement audit, while other referral rules still apply.

The third expert must be distinct from both initial reviewers, start after both completed responses and reference their exact hashes. Arbitration never replaces either initial response. Initial agreement is calculated before arbitration. Original dissent and uncertainty remain preserved.

The pre-study protocol retains inherited .90 raw agreement and .80 Cohen's kappa thresholds, applied overall and by language, and requires the fixed completed volume, all necessary arbitrations, meaningful independently resolved positive/negative coverage, certified context/category/independence preflight and independent final instruction signoff. No all-UNCERTAIN result or degenerate kappa can pass. Any substantive instruction clarification requires a new protocol/instruction/dataset version and a new calibration round before main collection; the old holdout remains reserved.

`cleanup_quality.human.compile_gold` now blocks nonempty current **and unversioned legacy** main-study input unless independent calibration is supplied and content-bound verified. Explicit TEST_ONLY flow fixtures stay synthetic. The unified version contract includes the calibration component, protocol and instruction bytes; quality declares its calibration dependency. Completing calibration would open only a collection prerequisite, not production writes or a certified cleanup release. An independently signed stale calibration is rejected after a protocol, instruction or scientific implementation/normative change.

## Actual results

`AGREEMENT-REPORT.json`: accepted human responses **0**, arbitrations **0**, paired cases **0**; raw agreement, kappa, mean/median initial-review time and arbiter time are **null**. `HUMAN-GOLD.ndjson` and `ARBITRATION-LEDGER.ndjson` are genuinely empty. No missing score is reported as zero error or perfect agreement. There is no measured linguistic accuracy, timing benefit or finalized empirical procedure.

Contract tests use explicitly synthetic TEST_ONLY fixtures and cannot count as human gold. The new tests cover forged rosters/submissions, language competence, duplicate slots, two accounts of one person, premature or same-person arbitration, exact original hashes, each scientific disagreement dimension, uncertainty, blinding exposure, missing evidence, rule revisions, degenerate kappa, hand-computed statistics and both live and legacy main-study gates. The existing quality, evidence, identity and full real-module E2E tests remain separate engineering checks. Full npm is not newly declared green; earlier sparse-data and inherited national CODE-LOCK blockers remain.

## Archive and completion blockers

The **1,213,609-byte** private archive has SHA-256 `01b53591c686cbdda40f3a4270c6041fe786beba90cb4334e07d1018d0a48682`. It contains the frozen reserve, two previews, real empty journals, empty roster/assignments/gold, original-source extracts and input/document locks. The saved archive was reacquired and all **24 listed objects / 25 ZIP members** were physically restored and verified, including every one of the 6,742 exact extracted source rows. The archive contains no real reviewer personal data, credentials or secrets. Deterministic preparation was repeated from the locked inputs: all 12 reserve files, including the manifest, were byte-identical. The updated empty analysis was also replayed from the reacquired archive with identical output. An independently verified second storage provider is not established.

Completion remains blocked by: missing qualified human assignments; incomplete source/sense/normative context and category coverage; unknown transitive holdout/evidence dependencies; no independently verified blind delivery; no real initial responses, arbitration or final protocol signoff. `INSTRUCTIONS.md` is a frozen **pre-study** version, not an empirically finalized instruction. Main annotation remains disabled. Production v5/v6 data, approved definitions, association formulas and calculation files are unchanged. No merge or data release has occurred.
