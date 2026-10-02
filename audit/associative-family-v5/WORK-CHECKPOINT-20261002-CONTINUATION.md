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

## Six-record application

Preflight is durable in 53102f85a5390234962458192db9014fe53ae1d1.
The six records are now applied additively: observ 298, inform 1,448.
Removed memberships 0, retired families 0, alias delta 0. All 11 targeted tests
passed without skips, including compatibility routes, old action preservation,
complete prior prefixes, original source routes, ambiguous/excluded controls
and repeated-application refusal. The complete npm suite and exhaustive audit
are running; their final results belong to the next separate validation stage.
The 762-record continuation remains 6 accepted/applied, 23 excluded, 3 genuine
uncertain and 730 pending until a later review overlay is saved.

## Runtime validation integration

Six-record runtime stage is durable in 3295d6b3d064a3e6722f4d429921ee9e1030e9d0.
The first broad tests exposed an old whole-shard checksum that necessarily
changed when an unrelated observ record was appended. Historical Italian
proof now reconstructs the exact old gzip shard and still demands the original
checksum, while independently checking every current verb base record. Both
Italian tests pass without skips. The exhaustive audit's total-delta equation
also now includes the independently audited +6. This integration changes no
runtime records or historical ledgers. Full checks were restarted after these
changes; no success is claimed until final logs say pass.

## Further observ/inform lexical review

After applying the six reviewed positives, a separate finite review resolves
143 of the 730 pending records. 129 are excluded phrase fusions or independent
lexical boundaries (including rein + Form and Stein + Form). Every phrase has
an explicit segmentation. Fourteen actually investigated foreign forms retain
context uncertainty: the head is attested in another language, but the source
record cannot distinguish a quotation/title from a genuine lexical use in the
record's language. No spelling-only generalization is used.

Latest composed continuation: 6 accepted/applied, 152 excluded, 17 genuine
uncertain, 587 pending. Total remains 762. The pending queue and source proofs
are `reflex-phrase-boundary-review-20261002`. Two source/conservation and
byte-identical reconstruction tests passed without skips.
Reproduce with `python scripts/review-associative-reflex-phrases-20261002.py`.
Old 730-count notes above are historical. Current runtime supports remain
observ 298 and inform 1,448. All other open queues are unchanged by this stage.

## Compatibility-test composition

The older information repair test also compared compatibility queries against
its immutable original selection. It now composes that selection with the
separately audited extension, and preserves the new records' independent
components rather than demanding inform-only arrays. Both information repair
tests pass without skips. Full npm tests are restarted with every new review
and runtime test included. No further runtime mutation occurred.
