# Full production v5 read-only adapter — 2026-10-23

The complete materialized v5 can now be inspected through the existing native evidence graph, human review, auto-annotation and finite mass-dry-run worker. This is a research projection, not an authoritative v6 catalog or a linguistic certification. No production family/member/alias record, prior decision journal, normative formula or frequency calculation was changed.

## Pinned corpus and complete traversal

Actual `main` used: `47723611112610945cb09b34e18588b7bd151911`. Historical guard dependency: PR #681, commit `41d3b59295296ad72a3bed6d54ebcbdb7c93c97e`, snapshot `fe87153c07976f8b4ae02fffee778b5213303cd01d5f8e1f380b08f2d0882374`.

| Object | Count |
|---|---:|
| Buckets | 256 |
| Source gzip files | 2,048 |
| Canonical families | 2,456,543 |
| Alias records | 1,934,050 |
| Memberships | 10,078,319 |
| English memberships | 2,619,261 |
| German memberships | 2,205,038 |
| Spanish memberships | 1,796,516 |
| French memberships | 1,143,061 |
| Italian memberships | 1,187,709 |
| Russian memberships | 1,126,734 |

Every source file was checked against its exact pinned Git blob, SHA-256 and size. A fresh second build reused zero shards and produced **byte-identical manifests and all 256 SQLite databases**. An independent verifier uses stdlib `json.load` on one bucket at a time, rather than the builder's streaming object parser. It compared **every family, alias, membership field and original membership ordinal**, plus all source hashes. No discrepancy was found in that comparison. This supplements the earlier baseline census; it does not replace linguistic adjudication.

Projection version: `8c5fb2096111df99f73984c4dfd754b2ef8d147dbbaf520f4dda4f7e95f58faa`. Full inventory and per-database receipts: [PROJECTION-MANIFEST.json](PROJECTION-MANIFEST.json). Independent result: [INTEGRITY-RECEIPT.json](INTEGRITY-RECEIPT.json). [SOURCE-LOCK.json](SOURCE-LOCK.json) also pins production metadata, the historical snapshot and external source manifests.

The original assignment payloads already recorded as unavailable in baseline PR #680 remain unavailable. This adapter neither invents them nor restores 699 unassigned source lemmas. The projection covers exactly the existing materialized production memberships. These provenance gaps remain blockers to broader baseline certification, not reasons to alter the corpus.

## Identity and relation policy

The raw v5 family and lemma IDs are retained. A separate `family:legacy-v5:<digest>` analysis namespace prevents accidental equivalence with v6 lexical heads. A source `legacy_exact_record` remains an unreviewed corpus identity; POS and sense stay unknown. Native external identities and analyses are retained as alternatives, not substituted for corpus identities. Distinct source IDs are not merged by spelling; homonymy that the old ID cannot distinguish is explicitly unresolved.

Question IDs depend on original family/lemma/language, not output location or global build version. Evidence enrichment and unchanged incremental rebuilds preserve them. Aliases retain their actual fan-out; the five CREAT surface targets are not automatically merged. Original relation types, source labels, full records, hashes, bucket and ordinal remain recoverable. Neither `safe_automatic` nor a legacy review label creates a new confirmed linguistic decision.

Historical checks use the **original** family and lemma scope. The existing historical registry remains fail-closed: its unresolved authority/scope coverage and conflicts prohibit application. The exercise checks a known removed membership against its exact negative and proves that the negative does not spread to another family. No missing legacy link is restored. PR #681 retains 358 source-level conflict/coverage holds; this adapter does not pretend to adjudicate them.

The eight requested review categories coexist and may overlap. They are investigation triggers, never deletion verdicts. Structural invalidity stops publication rather than being silently repaired. There is no universal allomorph rewrite, substring expansion, automatic root recognition or changed methodology weight.

## External evidence and modern infrastructure

The complete pinned UDer, GLeMM and MorphyNet sources were used: **35 artifacts**, six languages, 260,992,004 raw bytes. [EXTERNAL-MANIFEST.json](EXTERNAL-MANIFEST.json) retains exact per-artifact versions, hashes, sizes, licenses, lineage and row-index receipts. The source lock is `0ca240e9c42334e04ff188d329433b8e476d88a54a80da60d54eca9edaa2bbad`.

The index read 9,404,068 original rows: 9,404,044 accepted and 24 quarantined empty Spanish inflection rows, all preserved. The existing extractor yielded 3,750,624 claims and 4,915,497 inflection records. Original line bytes, direction, language, native identity, provenance and alternate analyses remain available. GLeMM's possible dependency on MorphyNet is explicit; three resources do not become three independent votes. A spelling lookup is an alignment candidate and never establishes membership.

A real **31-question, six-language** exercise covers MANU/manicure/маникюр, REGUL/регламент, OCUL, INTER, all five CREAT alias targets, a singleton and a long base. It imports into the existing review ledger, feeds the existing graph ingester, runs the existing annotation/mass-dry-run worker, kills it with SIGKILL, resumes, repeats idempotently, and exports through the existing mass-dry-run handoff. It preserves 95 original external rows, 57 graph claims and 34 graph inflections. All 31 proposals abstain; accepted memberships, new lexical heads, paid requests, human decision events and production writes are all zero. See [E2E-REPORT.json](E2E-REPORT.json).

The whole-v6 coordinator has not been relabeled as a full-v5 linguistic annotation run. The adapter instead exposes all v5 memberships through bounded finite windows. The loader verifies actual projection and external-index bytes, original rows and the current historical snapshot; rehashing a forged queue cannot manufacture a verified sense.

## Scale, recovery and resources

| Run | Seconds | Recorded peak RSS, KiB | Output bytes |
|---|---:|---:|---:|
| Full projection, two workers | 357.605 | 58,604 per worker | 6,749,650,944 |
| Independent fresh projection | 354.931 | 58,612 per worker | 6,749,650,944 |
| Independent complete comparison | 504.063 | 253,060 | receipt only |
| All external row indexes | 266.129 | 28,460 | 1,078,005,760 |

Worker RSS is the measured maximum of one worker, **not an aggregate process-tree peak**. Family streaming retains at most one family value; reader cache holds at most two shards. Verification intentionally uses one complete source bucket. No complete multi-million-family graph is loaded in RAM.

Independent bucket locks, SQLite transactions, fsync/atomic publication and content-addressed receipts support checkpoint/resume and incremental reuse. The actual full build resumed after injected exit 75 inside bucket 00. Unit tests reproduce this interruption, corrupt checksums, pin mismatch, changed-bucket rebuild and stable question IDs. Annotation recovery was additionally exercised by actual SIGKILL and idempotent replay.

Queues have a 10,000-question and 32 MiB JSON ceiling. Scope/version-bound cursors traverse successive windows without lost or duplicated IDs. Explicit membership selections must fit their finite budget or fail before publication. Raw corpus databases and full graphs stay outside Git and outside the authoritative v6 catalog. Only small manifests, reports and code are committed.

The 92,453,026-byte originals cache was independently restored and checked against every source pin, then saved outside Git for future recovery. Its SHA-256 is `b0b27f47a7fe28d799eebb0c54525921e6e68522cadf41fa46a318d228b9054b`. Source licenses and attribution apply. Indexes can be rebuilt from exact Git inputs and that cache after loss of a temporary execution directory.

## Reproduction and validation

Commands for full build, independent verification, external index, cursor windows, existing workers and the real interruption exercise are in [the adapter README](../../associativvordes/v5_adapter/README.md). [RESOURCE-BENCHMARK.json](RESOURCE-BENCHMARK.json), [REPLAY-RECEIPT.json](REPLAY-RECEIPT.json), [RECOVERY-RECEIPT.json](RECOVERY-RECEIPT.json) and [VALIDATION.json](VALIDATION.json) record the actual runs.

This PR is stacked on historical registry PR #681. Read-only investigation can proceed while historical adjudication and unavailable original assignment artifacts remain explicit blockers to automatic cleanup. Structural preservation supplies reproducibility, not linguistic gold.
