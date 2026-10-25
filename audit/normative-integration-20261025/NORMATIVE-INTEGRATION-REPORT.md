# Unified normative admission — Prompt 18

The implementation uses one installed source tree, descending from integrated candidate PR #698 through source recovery #699 and historical adjudication #700. Parent: `6fddd712395fd1a9bcd45b78cd25b45cd9511368`. PR #698 is still a draft, unmerged integration candidate; Prompt 15 is not retrospectively declared fully certified. This change must remain a draft until its parent chain and outstanding source/code receipts are independently qualified.

## Mandatory boundary

The installed JavaScript normative validator is the sole membership resolver. Python observation adapters use `normative.resolver.observe`; final decisions use `v5_contract.policy.decision/admit`, which invokes that installed validator and verifies the complete live implementation contract. No executable validator is loaded from another Git commit.

The model remains:

`normative element → finite national correspondence → native lexical identity → sense → morphological/historical relation → family membership`

Separately:

`confirmed family membership → separately verified contemporary associative support → separate root recognition`

A one-language family may have valid members without qualifying its element for associative recognition. An engineering report, model answer, dictionary hit, morphology relation, graph grant, candidate status or `ACCEPT_PROPOSED` answer never creates approved family membership.

`ApprovedRegistry` stores content-addressed, immutable research approvals. Every write and every read repeats admission with an application-configured external trust context. Recomputed JSON checksums do not authorize a changed decision. The decision pipeline requires a persisted approved record before publishing a typed decision, and quality compilation reloads and verifies that record. Human ledger answers remain research proposals. The semantic adjudicator now requires the same normative admission in addition to its native sense binding, independent receipt and history/correspondence preflights.

Nonempty preview and signed apply both call `normative_gate`; omitting the version contract cannot select an older unchecked implementation. Every operation has its own finite normative decision and current provenance locks. Existing history, quality, signatures, namespace, owner and release checks remain additional requirements. Test fixtures cannot certify a production family or apply/publish a production release.

## Review #679 and adversarial cases

The four review findings were already partly corrected in the integrated parent. They are retained and strengthened here:

- Supporting polarity is required for correspondence proofs. Independently verified rebuttals attached only to a correspondence/step participate in contradiction detection. Model/source-dataset claims cannot manufacture a verified conflict.
- Input-declared conflicts have no authority without an external decision authorization or verified contradictory evidence. Association conflicts/support also require a current content-bound assessment.
- A compatible fresh refutation can remain confirmed despite an old engineering exclusion/quarantine. A prior guard alone is not new linguistic proof. Partial or unknown historical scope retains its potential intersection rather than granting a narrower restoration.
- Indirect steps retain full `from_scope` and `to_scope`, including native lemma/lexeme, language, sense and application context. Continuity includes the complete endpoint scope. Each verified step proof additionally carries `relation_step_sha256`, binding the full directed transition except its evidence-ID list. A proof from another step, language or context cannot be borrowed. Historical source languages may be intermediate endpoints without counting toward recognition thresholds.

Old step envelopes remain structurally readable, but missing endpoint scope/binding yields `UNRESOLVED`; no synthetic scope or historical evidence is generated. New optional proof fields do not silently migrate old approvals. Installed schema/code hashes distinguish incompatible contracts even where the normative rules version remains 1.0.0.

## Module compatibility

`MODULE-COMPATIBILITY.json` lists the actual boundary for the adapter, graph, candidate search, semantic review, morphology review, national correspondence guard, human ledger, approved registry, quality pipeline, operation preparation and release application.

Observation-only modules call the installed resolver but cannot confirm membership. Morphology review can confirm a separately scoped **relation fact**; that is explicitly `establishes_membership=False`, with membership unresolved. Graph membership Verdict objects are rejected at insertion; separately reviewed relation facts remain separate. A national guard's `CLEAR` means only that its finite preflight passed. None of these outputs bypasses final membership admission.

## Preserved definitions and calculations

The approved normative definition, membership-policy and national-correspondence documents and `rules.json` retain exactly their parent bytes. The term remains **ассоциативный корень**. Root/preposition thresholds remain ≥3 control languages, ≥2 groups, FAv ≥35; suffix thresholds remain ≥3 languages, ≥2 groups, ≥3 IPM per represented language and FAₐ ≥15. Three languages are a recognition threshold, not a threshold for family existence.

Di, Pr, Sh, SWOW, A, F, P, FAv and FAₐ are not recalculated or modified. Protected calculation files are byte-compared against the parent and original locked Git blobs. Runtime rules/schema are recursively frozen to prevent callers from mutating them in memory. Membership does not assign scores; missing metrics and associative support remain unknown. See `PRESERVED-DEFINITIONS-AND-CALCULATIONS.json`.

## Validation and limits

Adversarial Node assertions exercise the installed JavaScript implementation; Python tests exercise semantic admission and approved registry reads/writes through that implementation. The actual v5 adapter → evidence → candidates → human ledger → decision registry → quality → preview → release gate flow is run with explicit TEST_ONLY fixtures. These tests certify engineering behavior, not source truth or human production gold. See `TEST-REPORT.json` and retained logs.

Signature/atomicity unit fixtures isolate both the history and normative boundaries with test-only mocks. Unmocked normative-admission and end-to-end suites test the actual boundaries. There is no runtime disable flag for either guard.

The parent history remains incomplete, including 310 quarantined sources. Production membership approval and release remain blocked. Original assignments/Kaikki/candidate-generation provenance remain unavailable as documented by #699. The national-correspondence historical CODE-LOCK describes earlier code and is not rewritten to pretend that it certifies this implementation. A new independently reproduced stage receipt is required; the entire repository test suite must not be described as green while that check fails.

The trust context must be supplied by an independently configured verifier. Proposed decisions, request JSON and human answers are not a trust store. The normative resolver checks structured evidence, scope, content binding and authority; it does not independently establish the linguistic truth of a publisher's statement. Direct arbitrary database/filesystem writes are outside this process-level application contract; approved records are revalidated on read. Production directories retain the prior installed write fences.

## Reproduction

```bash
node tests/associative-normative-resolver.test.mjs
node tests/associative-normative-admission.test.mjs
INTERAL_INTEGRATION_RECEIPT=/tmp/interal-normative-e2e.json node tests/associative-v5-integration.test.mjs
node tests/associative-evidence-graph.test.mjs
node tests/associative-morphology-review-v2.test.mjs
node tests/associative-semantic-cleanup.test.mjs
node tests/associative-release-control.test.mjs
node tests/associative-cleanup-quality.test.mjs
node tests/associative-v5-release-readiness.test.mjs
node tests/history-adjudication.test.mjs
npm test
```

Use a fresh private research directory for all produced databases/ledgers. Exact hashes, parent version, execution contract, namespace and preservation checks are recorded beside this report. No production data has changed; no PR is automatically merged.
