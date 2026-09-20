# Associative family v5 annotation protocol

Status: draft replacement, not yet calibrated or locked. No main-sample answer may be collected until a 30–50-row-per-language pilot is independently completed, disagreements are discussed, and this file's final SHA-256 is recorded in `annotation-input-lock.json`.

## Unit and operational definition

The annotation unit is `(language, lemma_id, family_id)`. Membership means that the identified lemma sense/etymology belongs in the same practical associative family under the locked relation policy. Code compliance is not proof that the policy is linguistically sound: an allowed edge that creates an invalid family is a `policy_error`.

Documented direct inheritance, borrowing and derivation can establish membership. A shared distant proto-ancestor, spelling similarity, an unrelated homonym, or an affix/compound component alone does not establish whole-lemma equivalence. Polysemy may remain together only when the relevant etymological branch is the same. When the source does not identify the relevant sense/etymology, record that identifier as `null` and use `uncertain` if the ambiguity cannot be resolved. Modern semantic identity is not required where documented word formation establishes the allowed relation.

The reviewer must separately judge:

1. membership validity;
2. whether the stored evidence path supports the claimed relation and direction;
3. corpus quality;
4. runtime eligibility for the intended top-5 experience.

Corpus noise cannot be inferred merely from rarity, length, unfamiliarity, name-like appearance, or a previous control list.

## Independent review

Every main-sample row receives two blind reviews from distinct annotators, with at least one competent human. An LLM with fixed model/prompt/settings and verifiable sources may be the second reviewer, never the sole human substitute. Reviewers do not see each other's answers, prior audit labels, risk-stratum reasons, automatic confidence, or aggregate precision.

For each card, check language/form, lemma-versus-inflection/noise, sense and etymological branch, source record, relation direction, intermediate path nodes, language/term alignment, homonym collision, ancestry distance, policy fit, evidence, and runtime eligibility. Insufficient evidence must remain `uncertain`.

Required annotation fields are `sample_id`, `annotator_id`, `annotator_kind`, `protocol_version`, `membership_verdict`, `error_categories`, `evidence_verdict`, `corpus_verdict`, `runtime_eligibility_verdict`, `confidence`, `reason`, `sources`, and `completed_at`. Membership verdicts are `true_positive`, `false_positive`, or `uncertain`. Error categories are `normalization_error`, `morphology_error`, `etymology_error`, `homonymy`, `distant_relation`, `corpus_noise`, `wrong_language`, `wrong_sense`, `unsupported_evidence`, `policy_error`, and `other`.

Evidence verdicts are `supported`, `contradicted`, or `insufficient`; corpus verdicts are `accepted`, `suspicious`, `rejected`, or `requires_manual_review`; runtime verdicts are `eligible`, `ineligible`, or `uncertain`.

## Pilot and main run

The pilot is separate from the acceptance sample and covers clear positive/negative cases, homonyms, borrowing, inheritance, compounds/affixes, distant relations, ambiguous etymologies, corpus noise, and valid membership with invalid evidence. Discuss pilot disagreements, update examples, then lock protocol and thresholds. Discussed pilot answers are excluded from the main result.

Main cards are delivered in independently shuffled batches of 100. Progress may be resumed; reviewers may return to a card; aggregate precision is hidden. Raw A/B files are immutable. Corrections create a new version plus change log.

## Adjudication and analysis

Adjudication includes every disagreement, every `uncertain`, every possible policy error or serious cross-language/homonym merge, and a prespecified random audit of agreements. Original answers are never overwritten. `unresolved_uncertain` is valid.

Agreement is measured before adjudication with raw agreement, confusion matrix, Cohen's kappa, uncertain rates, and language/relation/error/corpus breakdowns. Precision uses design weights and reports resolved, conservative, and optimistic forms. Confidence intervals use a reproducible stratified family-cluster bootstrap; small groups are `insufficient_evidence`. Recall is reported only from a separately sampled, dual-reviewed external gold frame and is split into graph, runtime, retrieval, and top-5 measures.
