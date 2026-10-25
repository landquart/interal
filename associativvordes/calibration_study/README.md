# Independent human calibration

This package prepares a separate **provisional reserve**, validates independently authenticated human responses, describes agreement and arbitration, and blocks main collection until calibration is independently verified. It does not create people, labels, signatures or production permissions.

The frozen protocol fixes 40 cases for each of EN/DE/FR/ES/IT/RU, two distinct humans per case, and a third independent expert for every scientific disagreement, uncertainty, protocol defect and hash-selected 10% agreement audit. A person can qualify for multiple languages; the roles for a given case must map to different verified real-person keys. No actual assignments are currently available.

## Coordinator workflow

1. Restore the pinned old holdout and historical study and check all original bytes. Never replace sampled holdout rows, change their weights or use their answers for calibration. The sampler excludes known families, language/lemma IDs, spellings, record hashes, family aliases/etymon keys and all native observations reachable from held-out spellings. Unknown cross-version identity and source dependencies remain an explicit blocker; absence of a known overlap is not full independence certification.
2. Review the reserve's contextual completeness and every proposed normative root/lexical/sense binding before releasing a round. Sampling flags are coordinator hypotheses, not known positives, negatives or linguistic categories. Confirm the nine target categories independently and repair the candidate frame if necessary. The current reserve has no certified category coverage or corpus sense bindings; it is **not ready for human assignment**. Preserve the old reserve and freeze a new version when contexts, instructions or cases change.
3. Verify actual identity, language competence and morphological/historical expertise, authorization, conflicts of interest and prior exposure externally. Store sensitive supporting records privately; use pseudonymous actor IDs and stable verified person keys. A self-declared roster, public profile, model claim or filled template is insufficient. The same actor cannot be A and B, and two actor IDs belonging to one person remain one person. A third expert must differ from both. Do not contact anyone without explicit instructions.
4. Bind assignments to exact study/protocol hashes, then deliver only that person's released A or B packet, the locked instructions and unchanged normative documents through separate access controls. Never share the coordinator archive, category hypotheses, source-alternative inventory, other answers, old verdicts, model predictions or risk scores. Two shuffled files alone do not prove blind delivery. Verify neutral source-context fields and report unintended exposure. No packets have been sent.
5. Receive and authenticate each exact original response; retain the original bytes and hash before corrections. The required fields are listed in `INSTRUCTIONS.md` and enforced in `study.py`. A scientific mistake is not silently deleted to improve agreement: complete authenticated responses remain observations, while missing scientific scope/evidence or exposure is flagged for arbitration and blocks protocol acceptance. Calibration does not require agreement with the algorithm or normative model predictions. By contrast, any later production decision still needs the real normative/history/identity/evidence/release checks.
6. Freeze both independent responses before arbitration. Every difference in verdict, lexeme, language, POS, sense, normative root, national correspondence or relation is a referral, as is every uncertainty. Audit the fixed hash-selected agreement subset even when the pair agrees. The third expert references the hashes of both original responses, starts after both are completed and supplies the same scientific fields and source-based grounds. Keep dissent and uncertainty. Arbitration cannot become an initial response or conceal low original agreement.
7. Run `collect.py` with externally configured verifier receipts. It produces null metrics for absent answers, three-class Cohen's kappa with undefined degenerate cases, raw agreement, per-dimension disagreement counts, mean/median active time and instruction issues. Timing is self-reported and is not a measured productivity gain. An unresolved or malformed scientific conclusion cannot become confirmed production gold. Preserve all analysis versions and the original journals.
8. Require the full fixed volume, all necessary arbitrations, meaningful positive/negative coverage per language, inherited .90 raw agreement/.80 kappa overall and per language, certified independent/category/context preflight, and independent protocol signoff. All UNCERTAIN agreement cannot pass. Discuss rule misunderstandings; any substantive clarification requires a new instruction/protocol version and a new calibration round. The current instruction is a pre-study version, not an empirically finalized one. Keep the original evaluation holdout untouched through every iteration.

## Trust boundary

`study.py` accepts review data and a **separate coordinator-configured trust dictionary**. `person_verifications`, `assignment_verifications`, `submission_verifications`, `delivery_verifications`, `study_verifications`, `protocol_signoffs` and `calibration_verifications` contain independently verified receipts keyed by the SHA-256 of their exact payload. Each receipt carries `status=VERIFIED`, `payload_sha256` and a real external `verification_ref`. These are interfaces to actual identity/authentication/review procedures, not a credential-generation service. A response cannot authorize itself. Unit-test receipts are explicitly TEST_ONLY and do not count as people or gold.

`require_main_annotation` additionally requires independent content-bound verification of the complete calibration analysis. Nonempty current and legacy `cleanup_quality.human.compile_gold` requires it before accepting nonempty main-study reviews through `normative_context.calibrationAnalysis` and `normative_context.calibrationTrust`. Existing TEST_ONLY flow fixtures retain their explicitly synthetic scope. Unversioned legacy compilation is also blocked without independently verified calibration; the legacy unit tests supply an explicit TEST_ONLY calibration verifier. Analysis copies the exact original response, arbitration, roster and assignment inputs into its new private snapshot, preserving their byte hashes.

Even `PASS_CALIBRATION_ONLY` opens only the collection prerequisite. It does not certify the old holdout's independence, semantic cleanup precision, historical provenance, corpus bindings or a production release. This component is included in the installed version contract; changing source or protocol invalidates compatibility.

## Reproduction

```bash
python -m associativvordes.calibration_study.prepare \
  --baseline "$BASELINE/associativvordes/family-index-v5" \
  --registry "$RESTORED19/registry" --native "$RESTORED19/native" \
  --holdout "$QUALITY_ARCHIVE_RESTORE" --output "$NEW_RESERVE"
python -m associativvordes.calibration_study.verify \
  --reserve "$NEW_RESERVE" --holdout "$QUALITY_ARCHIVE_RESTORE" \
  --baseline "$BASELINE/associativvordes/family-index-v5" \
  --native "$RESTORED19/native/native.sqlite" --raw "$RAW_MORPHOLOGY" \
  --lock data/morphology-evidence/sources/source-lock.json --output "$NEW_AUDIT"
python -m associativvordes.calibration_study.collect \
  --reserve "$NEW_RESERVE" --output "$NEW_ANALYSIS"
```

The last command intentionally reports BLOCKED with the frozen empty roster and logs. For genuine collection, explicit `--reviews`, `--arbitrations`, `--roster`, `--assignments` and `--trust` point to separately authenticated private inputs. The output directory must be new. Do not fill these inputs with invented evaluations to obtain a passing result.
