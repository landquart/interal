# Historical adjudication — 25 October 2026

Status: **BLOCKED for full historical semantic certification and production mutation**. This is an implementation and documentary audit candidate above source-recovery PR #699. No production data changed. Do not merge it as a completed certificate.

All 358 frozen problem sources are accounted for. 48 are `RESOLVED_INVALID` **as independent linguistic decisions** (45 documentary/report sources and three malformed engineering error reports); their original bytes and observations remain retained. 310 are `QUARANTINED_UNRESOLVED`. This classification does not establish that the underlying reports or lexical claims are false. No linguistic confirmation or proof-backed supersession was invented.

The registry preserves all 545 preceding constraints unchanged: 279 historical engineering deltas and 266 research baseline restrictions. Engineering `RESOLVED_CONFIRMED` means that the exact old operation occurred; linguistic validity remains unresolved. Date ordering and owner-like labels never establish authority. The original immutable snapshot and its incomplete-coverage flag remain unchanged.

## Evidence and independent replay

All 2,578 locked source blobs were physically restored and verified by byte count, SHA-256 and Git object identity. The separate verifier replays all 1,187,041 indexed source observations by JSON pointer and payload hash; these are observations, not 1,187,041 decisions. The producer is not imported by either independent replay program.

The independent SQLite set-difference replay verifies 156 exact affected selectors against original before/after records. It preserves 347,760 removal events as `REMOVED`, with full original rows and ordinal positions. Two addition events certify their historical operation only; none are automatically accepted in the current registry. Expected counts come from the actual release `repository-provenance.json` (SHA-256 `d12de988f95fb50ecc174a93b1275f5771940bbe3b45f6dd34a4b6e71e0d855a`), not a hardcoded historical report total.

A second Git diff traversal covers all 237 changed member/alias files in the 17 provenance revisions: 120 removed alias edges, three added alias edges, and **27 same-identity record edits** omitted by a simple added/removed membership inventory. These edits are retained as additional exact engineering safeguards in the new registry. They do not rewrite the preceding 545 constraints. Family metadata files and commits outside these 17 provenance revisions are not certified by this member/alias replay.

`NEGATIVE-CASE-COVERAGE.json` links the original regul, genea, sonus, nitidus and ending dossiers to native family IDs and historical constraints. This is documentary coverage, not fresh linguistic attestation. A nitidus consolidation does not establish general family equivalence. Removed edges require new independent evidence before restoration. Similar spellings never extend a negative decision to another native ID; unknown sense still retains its potential intersection.

## Scope and remaining blockers

The 310 quarantine entries include 1,542 indexed potential-scope rows, 648 with unknown/global potential. These are indexing rows, not additional independent conflicts. Unknown native identity, corpus mapping, authority and supersession remain explicit. Broad potential holds cannot yet be narrowed safely; they do not declare every neighboring relation linguistically invalid.

Three malformed benchmark objects contain a complete explicit engineering failure object plus a literal trailing escape sequence. Their originals are preserved, not silently repaired. The damaged `prompt09-shadow-20261007/research.json.gz` cannot be decoded, and its scope cannot be inferred from its filename or a neighboring version. It retains an unknown-potential hold. Missing assignments, historical Kaikki and candidate-index generation provenance remain blocked as documented in PR #699.

Every query requires a finite operation, explicit corpus version and native IDs. Merge requires separate source/destination checks and reviewed identity mapping. The overlay is hash-bound to the version contract; it never grants writes or removes the old incomplete-history hold. A clear scope result explicitly means **no authorization**.

## Mutation boundary

The 17 retired legacy repair entrypoints remain unconditionally blocked. Installed Python package imports and 98 standalone writer bootstraps install one process-local fence; 46 JavaScript filesystem writer entrypoints import the corresponding installed fence. It protects the installed v5/v6 data directories, their symlink aliases and destructive ancestor operations. Research outputs outside these directories remain usable. The direct materialization workflow stops before download/write/publication.

This is not an operating-system sandbox. Arbitrary native processes, direct syscalls, previously retained function references and historical code in another checkout are not certified as contained. `WRITER-COVERAGE.json` inventories candidate tracked mutation paths and explicitly retains unclassified paths for review. The complete all-path no-bypass criterion is **not satisfied**; a certified production materializer and an externally enforced write boundary are still required. Do not use this candidate to permit production changes.

Old source/code locks are preserved as historical receipts. Code changed by the fence must be independently rerun and receive new receipts before those stages can be certified on this implementation. A failed old code lock is not fixed by editing its expected hash.

## Reproduction

Obtain the private original-source archive through `audit/associative-history-registry/SOURCE-ARCHIVE.json` and verify its pinned SHA-256 before using the existing source restore procedure. Work in a fresh output directory outside the checkout; keep live SQLite outside any synchronized folder.

```bash
python3 -m associativvordes.history_adjudication.build --repo "$PWD" --restored "$RESTORED" --output "$NEW_BUILD"
python3 -m associativvordes.history_adjudication.verify --repo "$PWD" --restored "$RESTORED" --output "$NEW_BUILD"
python3 -m associativvordes.history_adjudication.diff_audit --repo "$PWD" --restored "$RESTORED" --output "$NEW_BUILD"
python3 -m associativvordes.history_adjudication.finalize --build "$NEW_BUILD" --output "$REPORT_OUTPUT"
python3 -m unittest associativvordes.history_adjudication.test_guards associativvordes.history_adjudication.test_scope associativvordes.history_registry.test_registry -v
node tests/history-adjudication.test.mjs
python3 -m associativvordes.history_adjudication.coverage --repo "$PWD" --restored "$RESTORED" --output "$REPORT_OUTPUT"
```

The private archive retains the materialized SQLite database, exact event stream, initial producer registry, independent replay reports and final registry. Public metadata and code do not authorize redistribution of underlying source corpora. Archive locator/hash and backup state are in `ARCHIVE.json`; a locator alone is not a successful cold restore.

## Validation result

53 Python regression checks pass, including native scope separation, unknown-scope quarantine, no last-write-wins, retained record edits, SQLite/open/dir-fd writes, JavaScript handles/streams/symlinks and ancestor deletion. Seven targeted Node suites pass (history, release control, v5 integration, quality, semantics, readiness and new guards). Finalization reproduces identical registry bytes. The whole `npm test` run stopped at the national-correspondence historical code-lock mismatch; the full suite is not green. See `TEST-REPORT.json` and retained logs.
