# Independent v5 cleanup quality — prospective, human gate BLOCKED

This module never writes production. It separates probability estimation from
adversarial challenges, legacy claims from human gold, and statistical quality
from permission to apply an operation. The current operation manifests are empty.
No precision, recall, false-removal rate, speedup or semantic PASS is inferred
from zero proposed/applied changes.

## Frozen inputs and reproducible run

Start from the exact stage10 commit in protocol.json. Restore its research index
using `associativvordes/family_boundary/README.md`. The original production gzip
buckets must match the certified baseline; v6 files are not copied into production.
Obtain GitHub Actions artifact 10603949468 from run 35509462238 and verify the
historical archive SHA-256 in annotation-input-lock.json. The exact historical
archive is also preserved in this study's research bundle. Old templates are not
human decisions. Stage04–06 research and OWNER_ACCEPTED_AT_RISK are not gold.

```sh
python3 -m associativvordes.cleanup_quality.prepare --index /external/boundary/release --old-kit /external/v5-probability-kit-v2.zip --output /external/q11-first --stop-after 250000
python3 -m associativvordes.cleanup_quality.prepare --index /external/boundary/release --old-kit /external/v5-probability-kit-v2.zip --output /external/q11-first
python3 -m associativvordes.cleanup_quality.prepare --index /external/boundary/release --old-kit /external/v5-probability-kit-v2.zip --output /external/q11-replay
python3 -m associativvordes.cleanup_quality.supplement --source /external/q11-first --output /external/q11-release
python3 -m associativvordes.cleanup_quality.supplement --source /external/q11-replay --output /external/q11-release-replay
python3 -m associativvordes.cleanup_quality.evaluate --release /external/q11-release --output /external/q11-evaluation
python3 -m associativvordes.cleanup_quality.evaluate --release /external/q11-release-replay --output /external/q11-evaluation-replay
python3 -m associativvordes.cleanup_quality.verify --first /external/q11-release --replay /external/q11-release-replay --index /external/boundary/release --eval-first /external/q11-evaluation --eval-replay /external/q11-evaluation-replay --receipt /external/INDEPENDENT-VERIFICATION.json
node tests/associative-cleanup-quality.test.mjs
npm test
```

Checkpoints use exact source/code/protocol identities and atomic replacement.
A completed release is immutable; retries require fresh output directories.
The independent verifier proves all selected cutoffs by scanning the complete
10,078,319-row frame, independently of the selection heap. Resource.json for a
resumed run measures that invocation, not elapsed time before the interruption.
The documentary supplement adds all stage08 correspondence contexts, preserving
their distinct dictionary identities. It never invents corpus lemma/sense IDs.

## Interpretation and leakage

Probability: 1,600 current memberships per language, n_h/N_h inclusion and N_h/n_h
weights. All languages and families remain in the frame, even if exposed before.
Never replace exposed sampled rows; doing so would change the estimand and design.
Challenge: purposive current cases, exact negative historical scopes, and
dictionary-only correspondence contexts. These are NOT weighted as population
observations. A family operation is one correlated operation, not thousands of
independent human labels; exact membership and family-operation metrics differ.

This release has zero training/calibration rows. All new cases are prospective
holdout, reserved against tuning. Statistical clusters join observed shared
families, same-language lemma IDs and identical record evidence; they are NOT
canonical family merges. Documentary identities have no invented corpus bridge.
Historical exposure is recorded, not hidden. Complete cross-version native/sense
and evidence dependency mappings are unavailable, so independent holdout
certification remains BLOCKED. Known token checks are not proof of no semantic
leakage through an unobserved relative. No claim of independent generalization is
made until an authorized audit resolves that limitation.

## Human collection and frozen gold

No registered qualified humans are available. BLIND-A/B contain independently
shuffled tasks with the same content hashes. They hide predictions, risk reasons,
old decisions, confidence and the other answer. Deliver ONLY the assigned role's
tasks (batches of 100) and the locked instruction below through separate access;
never deliver PREDICTIONS, coordinator packets, history labels or the full archive
to a blind reviewer. These files are task preparation, not an access-control
service and not a record of completed review.

Before main collection: conduct the inherited separate 30–50 cases/language
calibration with independently verified, nonoverlapping family/lemma/evidence
groups; discuss disagreements; lock the final protocol. The current holdout must
remain untouched if rules change. Register externally verified authorizations,
language qualifications, role assignments and dates; a self-declared roster or
LLM-generated name cannot create a human. Do not contact reviewers without owner
instructions. No paid model requests are made.

Each answer supplies actor_id, role A/B, action independent_review, case_id,
case_sha256, protocol_sha256, blind_to_predictions=true,
blind_to_other_review=true, verdict VALID/INVALID/UNCERTAIN, pos, exact sense,
relation, reason, sources [{publisher, locator, finding}] and timezone-aware
reviewed_at. Source lemma IDs do not resolve homonyms. Keep unknown meaning/POS
unresolved; dictionary evidence for a different sense does not establish scope.
Check membership separately from evidence direction/type and association strength.

Both reviews must be distinct qualified humans; this is stricter than the old v5
minimum of one human plus a possible second model. Every sense/POS/relation
disagreement and uncertainty, plus the preregistered 10% hash-selected agreement
audit, requires a third person. Arbitration action is arbitrate and references the
two exact original review hashes via review_sha256. It is never an independent
review witness. Raw inputs are copied unchanged into a new evaluation release:

```sh
python3 -m associativvordes.cleanup_quality.evaluate --release /external/q11-release --reviews /external/raw-human.ndjson --adjudications /external/raw-arbiters.ndjson --roster /external/verified-roster.json --output /external/new-evaluation
```

FROZEN-GOLD.json binds every case and original decision hash; unannotated rows have
null gold. Empty raw logs mean no decisions, not unanimous agreement. All new
evaluations remain non-authoritative until calibration, holdout, history, exact
operation proofs and inherited release approvals are independently established.

## Metrics and gates

Exclusion precision = erroneous links proposed for removal / reviewed proposed
removals. False-removal rate = valid links proposed for removal / all reviewed
valid links. Detection recall = erroneous existing links proposed for removal /
all reviewed erroneous links in this existing-membership frame. This is not
recall of missing valid memberships outside v5. Missing gold gets explicit
denominators, bounds and no safety PASS. Challenge statistics stay separate.
Relation/family-class labels in subgroup tables are legacy claims, not human
confirmation of morphology.

Weighted point estimates and linked-cluster bootstrap CIs are descriptive.
Cross-language clusters are resampled jointly with original language weights,
not falsely split into independent strata. Fewer than 30 labeled clusters yield
no bootstrap interval. A degenerate zero-error interval cannot certify rare risk.
Exact one-sided binomial bounds are available only for verified independent,
unweighted Bernoulli units; family memberships are not expanded into such units.
The v5 thresholds and v6 0.99 precision / 0.001 false-merge thresholds are retained
as separate contracts. New semantic removal safety also requires false-removal
upper bound <=0.001 and Bonferroni alpha .05/150 across prespecified comparisons;
this extra endpoint does not rename the inherited false-merge metric.

QUALIFIED_FOR_EXACT_SCOPE applies only to an explicit deterministic structural
operation with an independent full-scope invariance/provenance/rollback receipt.
It supplies no production capability. No current scope qualifies. Semantic and
high-risk scopes remain HUMAN_REVIEW_REQUIRED or INSUFFICIENT_EVIDENCE;
model-confidence-only, substring-only and absence-of-evidence rejection is
REJECTED_POLICY. Approval of a technical rule cannot authorize semantic cleanup.

## Research archive and cold restore

`interal-v5-cleanup-quality-20261024.zip` is a coordinator bundle, not a blind
reviewer delivery. Its exact inventory contains the frozen release/evaluation,
the original historical kit, pinned normative inputs and independent verification.
The code remains versioned separately in Git. Restore only to a fresh directory:

```sh
python3 -m associativvordes.family_boundary.archive restore --archive /external/interal-v5-cleanup-quality-20261024.zip --destination /external/q11-restored --expected a84dfb2ea305ded0cc43b3df17221c5aaaaa563bfd5cbe120e100a44fa77a654
python3 -m associativvordes.cleanup_quality.evaluate --release /external/q11-restored/release --output /external/q11-replayed-evaluation
```

To create an equivalent bundle from a newly verified run:

```sh
python3 -m associativvordes.cleanup_quality.bundle --archive /external/new-study.zip --release /external/q11-release --evaluation /external/q11-evaluation --normative /external/pinned-normative --old-kit /external/v5-probability-kit-v2.zip --verification /external/INDEPENDENT-VERIFICATION.json
```

The normative files are extracted, without checkout changes, from commit
`ad32277ab9bc4fc8cd28ba82f08eaba2ab130f05`, paths under
`associativvordes/normative/`: NORMATIVE-DEFINITIONS.md, FAMILY-MEMBERSHIP-POLICY.md,
NATIONAL-CORRESPONDENCES.md, rules.json and decision.schema.json. Verify against
NORMATIVE-SOURCE-LOCK.json. Their absence from the stage10 working branch is an
explicit semantic-release integration blocker, not permission to use older rules.
