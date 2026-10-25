# Completion gate follow-up

Date: 2026-10-24. Parent: `2395e9f6ce2b424089759b67193559c8cea6a929` (PR #692).

Review found that `checks.run` could publish `PASS_EMPTY_PLAN_INTEGRITY_ONLY`
after an interrupted exercise, without completed independent-copy, rollback or
backup/restore evidence. The previously recorded full run has these receipts,
but their presence was not a mandatory finalizer precondition. Its existing
receipts and code locks remain historical records of that exact execution.

## Change

`completion.py` checks the actual source, shadow, independent replay, rollback
and restored snapshot bytes, the certified archive hash, all five layer views
and CURRENT pointers, store identities, SIGKILL/recovery, idempotency and each
completion receipt before issuing a version 2 COPY-PHASE receipt. That receipt
binds the exact plan, source snapshot, inventory, source lock, evidence bytes
and completion/store implementation hashes. Checksums detect inconsistent or
stale inputs; they do not constitute independent approval signatures.

The finalizer requires and revalidates that evidence before loading censuses or
writing success. It removes a previous RUN receipt before attempting a new
finalization, so failed retries do not leave stale success. A successful RUN
binds COPY-PHASE and SOURCE-LOCK hashes. The bundle command independently
revalidates completion and requires those exact RUN bindings before creating
an archive. Missing, incomplete, changed or legacy unbound completion records
fail closed.

## Validation and limits

Command:

```sh
node --test tests/associative-full-v5-completion.test.mjs tests/associative-full-v5-dry-run.test.mjs
```

Six tests passed locally. New tests cover successful completion on independent
two-record byte copies, every missing or mutated prerequisite receipt,
incomplete restore, wrong identities in each store, corrupt restored bytes,
changed source locks, early finalizer failure, stale RUN removal, and rejection
of bundling a stale PASS without completion. These are TEST_ONLY engineering
fixtures, not linguistic evidence or a substitute for the full-corpus run.

No fresh full-corpus execution of this patched version is claimed. Existing
SOURCE-LOCK/CODE-LOCK, metrics and durable archive describe the parent code.
A fresh work directory, exercise, full censuses, raw/runtime replay and
finalization are required to certify this version using the existing README
commands. Legacy COPY-PHASE and RUN receipts cannot be silently upgraded by
the bundler. This patch adds full byte verification at completion and each
consumer; its full-corpus time and peak RAM have not been measured.

The qualified operation set remains empty, semantic gate BLOCKED and
nonempty_cleanup_validated false. Human gold, holdout independence, incomplete
history, original assignments and missing calculator semantic inputs remain
unresolved. Production data, historical reports, source lexemes, normative
roots and calculator formulas are unchanged. No merge or deployment is made.
