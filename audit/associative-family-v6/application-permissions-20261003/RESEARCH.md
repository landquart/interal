# Research checkpoint — explicit application permissions

Inspected source: 2d84b206c694b395620bef6ba83db1977cfced7c, draft PR #652; chain main → #650 → #651 → #652. Read current CHECKPOINT, WORK-REPORT and generated metrics. No later linguistic stage repeated. Baseline: 17 families, 21,548 accepted memberships, 210 lexical heads, 18,857 legacy exact units; 23,240 active records.

| Entry point | Existing guard | Defect / disposition |
|---|---|---|
| reviewed-stage integrator | rejects binding_authorized === false only | missing/null/wrong types pass; accepted permission absent; no exact queue inclusion; non-atomic write |
| prepare-head-review | structural/version/finite link checks | require explicit binding and status-specific edge authorization before preparation |
| prepare-family-promotion | strict two positive flags, catalog, controls, immutable v5 locator and hashes | preserve strict flags; use temporary files and replace after full validation |
| promotion loader/materializer | strict two flags, accepted identity and edge statuses | preserve and reject any contradictory group overrides |
| lexical review loader | proof hash + recursive lemma/word presence | add finite reviewed authorization, exact queue scope and real immutable corpus locator |
| builder / independent audit | call loaders; source corpus scan / replay | loader rejection must occur before generated writes; source-lock new code and decision |
| pure applyHeadReview | structural, version, exact affected links | authorization belongs to persisted research/application boundaries; pure operation creates no durable state |

| Action / status | Identity permission | Required edge permission | Research-only/deferred/rejected/unknown |
|---|---|---|---|
| accepted | binding_authorized === true | accepted_membership_authorized === true | cannot apply |
| excluded | binding_authorized === true | excluded_membership_authorized === true | cannot apply |
| uncertain | binding_authorized === true | uncertain_membership_authorized === true | cannot apply |
| representation of already accepted finite IDs | binding_authorized === true | no new edge; exact existing scope only | cannot apply |
| save research | none | none | permitted as research only |

Each group is checked independently. Stage-level grants may cover groups of the corresponding mode; an explicit group denial/wrong type cannot be overridden. Missing, null, false and string true are never grants. Unknown group/application statuses are rejected. Full validation precedes all writes.

Legacy proofs remain byte-identical. Missing flags are reported honestly, not inferred as historical authorization. A separate prospective reviewed decision will permit replay of the exact current 2,837 bindings (872 representation, 1,965 reviewed records) and 36 decisions, frozen by complete binding/decision hashes. It cannot authorize an unlisted stage or future corpus record. Research-only actin, anis and tower remain withheld; accepted oper research not yet applied remains outside migration.

Source membership requires language/lemma_id/word/root in the frozen queue, plus a real immutable v5 member locator, file hash and record hash. A self-authored research dossier is not a source frame. Existing historical representation proofs require separate exact authorization and immutable corpus verification. No word, frequency, lemma ID, canonical or historical proof changes.
