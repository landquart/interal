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
| Independent action heads | This commit | 128 English/French exclusions; original positive selections and source records retained |

The reflex continuation is linguistic evidence only: its six positives have not
yet been added to runtime families. Historical checkpoints are immutable inputs.
Its pending queue is the unadjudicated remainder of the old 762-record unresolved
queue, not a claim that the other records have been individually investigated.

## Verified state

The full `npm test` run passed after `npm ci --ignore-scripts`. The separately
saved log and its digest are under `validation-stage-20261002`. The new reflex
continuation conservation/source proof test also passed separately.

The exhaustive repository audit passed for 2,456,540 families and 10,049,567
memberships. Its durable result is `repository-static-integrity.json`.
These checks establish corpus preservation and software invariants; they do not
certify linguistic completeness of any still-pending family.

## Resume without repeating prior collection

1. Check out this branch and inspect the latest commit before making changes.
2. Read `action-italian-stage-20261002/inventory.json` and the keyed decisions.
   Combine those with `action-continuation-20261002/linguistic-decisions.json.gz`
   and then `action-independent-heads-20261002/decisions.json`, in that order.
   Action remainder: 16,852 pending and 143 genuinely uncertain; runtime applied
   positives: 2,098. Old action containers still require careful eventual retirement.
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
```

Runtime verification commands (after a runtime change):

```sh
npm ci --ignore-scripts
npm test
node scripts/audit-repository-associative-family-v5.mjs
```

Do not reapply the action materializer to the current corpus: its guard correctly
rejects an already-applied stage. Use its saved application ledger for the source
preservation proof instead.
