# Recovery and replay

Completed partitions receive atomic, fsynced receipts only after input/output checksum checks and the independent source-row audit. Restart rechecks every completed manifest and output. Failed partitions are reported separately; successful receipts survive another partition's failure. A fresh release root is required for independent replay.

The disk source index commits progress and rows in the same SQLite transaction every 1,000 source rows. Interruption rolls back the uncommitted batch; restart skips already committed input rows. Source/manifest/code identities are checked before reuse. Compressed payload checksums and lexical identity checks protect random access. A completed index has an external database checksum.

`certify_corpus.publish` verifies immutable catalog products before atomically replacing `CURRENT.json`, retaining `PREVIOUS.json` and version receipts. Re-publishing the previous verified path restores the prior catalog. A failed promotion leaves the selected release intact.

Mutable SQLite databases use host-local `/tmp`. The replicated workspace created conflict copies in an abandoned earlier attempt; that attempt is not certification evidence. Immutable outputs alone are copied for publication. An automated workspace cleanup also removed earlier unfinished experiments; they are not counted as completed measurements.

The original sources and temporary products stay outside Git. Small input/output manifests, performance/recovery receipts and code are published in this repository. A private offline archive preserves all 35 originals and license metadata; restore validates the trusted lock before exposing any files. Its durable upload is currently blocked by the artifact service (HTTP 403 before upload initialization); the verified older GLeMM cache remains recoverable. Rebuilding UDer and MorphyNet from their pinned official endpoints was verified in this run. Do not describe an unpersisted local archive as durable storage.

Status: full replay and actual large-checkpoint recovery receipts pending; fixture recovery/publication regressions already exist in `test_certification.py`.
