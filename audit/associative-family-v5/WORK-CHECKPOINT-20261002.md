# Resumable linguistic cleanup checkpoint

Branch: `fix/associative-component-membership-20261001`, PR #651.
Source run: `35647932153`. No merge has been performed.

## Independently saved stages

| Stage | Commit | Result |
| --- | --- | --- |
| Action lexical review | `0382e80895e600fc2df027fe9da6e631508a86a3` | 52,277 candidate frame preserved; 2,098 reviewed positive selections |
| Action materialization | `da4007c56fa48aff54cbc5e8114013ba2388bd8f` | Additive `family:act` records; original metadata, components and legacy containers retained |
| Italian action exclusions | `63ffcb701b89358ce00ed320159547db46a31620` | 1,536 additional exclusions backed by corpus verb records and bounded lexical analysis |
| Reflex continuation | `7359b8e3c1190aeae15f18ff216f80036c3383c9` | 32 records reviewed: 6 positive selections, 23 exclusions, 3 investigated homonyms; 730 awaiting review |
| Independent action heads | `faf105ccb0ff7c70ed2aad19206511953bcb1f46` | 128 English/French exclusions; original positive selections and source records retained |
| Russian action heads | `85169e0ef262d77aef4fd5720cfbbc82283ea691` | 40 independent Russian heads excluded; prior positive records and source metadata retained |
| Final validation | `52830263e6b62c7647a6724f19bbbc4ac0dd4688` | Full sequential test suite including all new continuation tests passed; complete log, digests and remaining scope saved |
| Positive action extension review | `78cb37158ef845f345414049aa7d6a7e4d0f7385` | 170 additional English/German whole forms reviewed |
| Extension preflight | `3c3e30341faba95ca414254f3305e2b0498dcde2` | Reproducible additive materializer, metadata/source guards, preservation audits and conditional pre-application tests saved |
| Extension runtime application | `afbe740d1d370cf8a2a84cbea64115213dfa1c4e` | All 170 additions applied; support 2,268; six targeted tests passed with no skips |
| Extension validation | This commit | Fresh full sequential npm test and exhaustive repository audit passed for the applied extension |

The reflex continuation is linguistic evidence only: its six positives have not
yet been added to runtime families. Historical checkpoints are immutable inputs.
Its pending queue is the unadjudicated remainder of the old 762-record unresolved
queue, not a claim that the other records have been individually investigated.

## Verified state

The full `npm test` run passed after `npm ci --ignore-scripts`. Its initial log
and digest are under `validation-stage-20261002`. A second full run, including
all three new continuation conservation/source proof tests, also passed for
commit `85169e0ef262d77aef4fd5720cfbbc82283ea691`; its complete log and digests are
under `validation-final-20261002`.

The latest exhaustive repository audit passed for 2,456,540 families and 10,049,737
memberships, including all 170 applied extension records. Its durable result is
`repository-static-integrity.json`. The full sequential test suite also passed
for `afbe740d1d370cf8a2a84cbea64115213dfa1c4e`; its complete log and validation
digests are in `action-positive-extension-20261002`.
These checks establish corpus preservation and software invariants; they do not
certify linguistic completeness of any still-pending family.

## Resume without repeating prior collection

1. Check out this branch and inspect the latest commit before making changes.
2. Read `action-italian-stage-20261002/inventory.json` and the keyed decisions.
   Combine those with `action-continuation-20261002/linguistic-decisions.json.gz`
   and then `action-independent-heads-20261002/decisions.json` and
   `action-russian-heads-20261002/decisions.json` and then
   `action-positive-extension-20261002/decisions.json`, in that order.
   Action remainder: 16,642 pending and 143 genuinely uncertain; reviewed
   positives: 2,268, all currently applied. The separate extension status and
   materialization ledger preserve proof of the additional 170. Old action containers still require careful
   eventual retirement.
3. For `observ/inform`, read `reflex-continuation-20261002/inventory.json`,
   `decisions.json` and `pending-review.json`. The immutable source candidate
   frame and metadata proofs are explicitly hashed. Materialize the six reviewed
   positives only after an additive preflight and a preservation audit.
4. Continue the untouched queues: loc 842, creat 2,389, relat 411, oper 2,111,
   mut 2,833; then the broader nat/loc/inter frame, Russian short elements and val
   routes from the original task. Do not infer membership from matching letters.
5. Save every new review/materialization stage as a separate commit on this
   branch, verify the remote commit exists, and update this checkpoint with the
   remaining queue and validation result. Do not merge the PR.

Reproduction commands for the review stages:

```sh
python scripts/review-associative-reflex-continuation-20261002.py
node tests/associative-reflex-continuation.test.mjs
python scripts/review-associative-action-italian-20261002.py
node tests/associative-action-italian-stage.test.mjs
python scripts/review-associative-action-independent-heads-20261002.py
node tests/associative-action-independent-heads.test.mjs
python scripts/review-associative-action-russian-heads-20261002.py
node tests/associative-action-russian-heads.test.mjs
python scripts/review-associative-action-positive-extension-20261002.py
```

Runtime verification commands (after a runtime change):

```sh
npm ci --ignore-scripts
npm test
node scripts/audit-repository-associative-family-v5.mjs
```

Do not reapply either action materializer to the current corpus: their guards
correctly reject an already-applied stage. Use the saved application ledgers for
the source preservation proof instead.

The 170-record extension passed the six targeted runtime/source/conservation
tests without skips, then the fresh full `npm test` and exhaustive repository
audit. The saved `application-checkpoint.json` is the historical application-time
snapshot when those final checks were pending; current successful results are
recorded separately in `full-test-validation.json` and `validation.json`.

## Overall review continuation: creation and relation

Saved as a separate review stage in `creation-relation-independent-heads-20261002`.
35 historical uncertain records now have explicit exclusion decisions: 33 creat
forms (independent creak/crease/creed/creel/acreage heads) and two relat forms
(cancrelat and prelazione). Decisions are finite whole-form reviews supported by
primary dictionary heads and stated morphological inferences. Complete original
candidate records and historical decisions are archived with hashes. Runtime
files and historical ledgers are unchanged. Remaining queues: creat 2,356;
relat 409. Validation is pending in the next separate stage.

Reproduce with `python scripts/review-associative-multiple-roots-20261002.py creation-relation`.

## Overall review continuation: operation and mutation

Creation/relation review is durable in commit df43c75392c170b3cfffda6ae4b635581d9613c8.
The separate `operation-mutation-independent-heads-20261002` stage reviews
200 additional old uncertain records: 29 oper exclusions (16 blooper/trooper
occurrences across four languages and 13 Russian compounds with an о + пере-
boundary); 171 mut exclusions (163 German Mütze forms plus six Anmut forms
and two Edelmut forms). Dictionary heads and reviewer inferences are distinguished.

The four-root continuation conserves every prior accepted record and all
archived source metadata/components/routes. Runtime remains unchanged.
Four targeted source/conservation/reproduction tests passed with no skips.
Full sequential test suite is running and will be saved in a separate validation
stage. Reproduce with `python scripts/review-associative-multiple-roots-20261002.py operation-mutation`;
verify with `node --test tests/associative-multiple-roots-continuation.test.mjs`.

Latest overall remaining queues after this continuation:
- creat: 2,356 pending (33 reviewed exclusions).
- relat: 409 pending (2 reviewed exclusions).
- oper: 2,082 pending (29 reviewed exclusions).
- mut: 2,662 pending (171 reviewed exclusions).
- loc: 842 old uncertain, not reviewed in this continuation.
- observ/inform: 730 pending; six reviewed positives awaiting materialization;
  three investigated uncertain.
- act: 16,642 pending and 143 investigated uncertain; 2,268 applied positives.

Resume from the newest validation checkpoint, compose these deltas over the
immutable old ledgers, and review remaining exact forms. The broader nat/loc/inter,
Russian short-key and fifteen-val-route frames still require work. Do not treat
this multi-root review as linguistic completion and do not reapply act materializers.

## Final validation of this four-root continuation

Both reviews are durable: df43c75392c170b3cfffda6ae4b635581d9613c8 and
e8645e8001e62af1198b7408860f8b5f9fe86cd2. The full sequential `npm test`
passed, including the four new complete-frame, exact source-record and
byte-identical reproduction checks. All 27,861 original candidate IDs are
conserved. The 235 new exclusions leave 7,509 pending across these four roots.
The latest machine-readable status, tested-code hashes and compressed full
test log are in `multiple-roots-validation-20261002/validation.json`. Runtime
files are unchanged from c48c37a9; the existing exhaustive runtime audit remains
applicable. Read this section and the machine status when resuming; earlier
application-time validation-pending notes are historical snapshots.
