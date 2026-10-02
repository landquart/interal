# Current continuation checkpoint

Branch: fix/associative-component-membership-20261001; PR #651 depends on #650.
No merge. Source run 35647932153.

Read `continuation-task-20261002.txt` for the complete authorized task and
`WORK-CHECKPOINT-20261002.md` for immutable earlier stages.

Baseline 970cf1009d11242fe1c8a913a1bf0c74309c631e was rechecked remotely.
Both GitHub Tests (37019725894) and exhaustive audit (37019726892) succeeded.

## Observ/inform preflight

Six existing reviewed positives are prepared, not yet applied in this commit.
`reflex-continuation-materialization-20261002/materialization-ledger.json`
contains exact selections, immutable source hashes, complete prior prefix
hashes, original families, every independent source route record, unchanged
file digest, and guarded metadata hashes. No aliases or containers change.

Prepare: `node scripts/materialize-associative-reflex-continuation-20261002.mjs --expected-head <current 40-character HEAD>`.
Apply once, after the preflight commit is durable: same command plus `--apply`.
The expected HEAD must match; source records, runtime tree and the complete
preflight must still match. The materializer refuses repeated application.

The pre-application tests passed 4, failed 0, and skipped the single application
audit. Application tests must later pass with no skips.

## Open queues

- act: 2,268 applied, 33,224 excluded, 143 investigated uncertain, 16,642 pending;
  actio/acti legacy containers intentionally retained.
- observ/inform continuation: 6 positive awaiting application, 23 excluded,
  3 investigated uncertain, 730 pending.
- creat/relat/oper/mut: 574/487/1,595/569 applied; pending 2,356/409/2,082/2,662.
- loc: 1,218 applied and 842 unresolved reflex records.
- nat/loc/inter: reconcile old 6,911 accepted, 10,688 literal-absence screens
  and 38,087 old pending with newer decisions, not an independent modern count.
- Russian short kh/nl/lo/ca/um remain; val has 15 retained, uncertified routes.
- Further high-risk scan remains after known queues.

Continue immediately with additive application, targeted tests, then review
of the saved 730-record observ/inform queue while complete runtime checks run.
Preserve pending versus investigated uncertainty. Save every stage separately.
