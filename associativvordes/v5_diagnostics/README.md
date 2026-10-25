# Full v5 observational diagnostics

This module classifies **every existing materialized family and membership** without changing production or issuing linguistic verdicts. One primary origin category partitions families; independent risk flags overlap. Neither category names nor experimental priority scores establish membership, associative recognition, valid national correspondences or permission to delete.

The complete research SQLite registry is the full category register and exact affected-ID index. Large databases, full pattern streams and priority queues stay outside Git. Committed manifests and receipts pin their exact bytes; recovery needs no particular temporary directory. The full report is in `audit/associative-v5-diagnostics/GLOBAL-V5-DIAGNOSTICS.md`.

## Classification contract

The primary category describes observed generation provenance. `surface_singleton` gives `SURFACE_FRAGMENT`, even if the resulting family has many members or some membership evidence says morphology. The name does **not** mean every surface family is false. Wiktionary non-proto etymology with only `borrowed_form` gives `BORROWING_FAMILY`; inherited/descendant claims give `HISTORICAL_ETYMON`. Remaining explicit morphology, compound, inflection and mixed signatures map to their named categories; missing mechanisms give `UNCLASSIFIED`. `EXACT_MORPHOLOGICAL` is an origin hypothesis based on recorded parse labels, not confirmed exact morphology.

Every membership retains its original family/language/lemma ID, ordinal, observed relation types, flags and canonical original-record hash. The pinned projection supplies the lossless source object. Legacy corpus lexical identity and sense remain unresolved. Confirmed membership/lexical identity/correspondence counts are zero **within the bindings supplied to this diagnostic run**; this does not assert that none can be established linguistically. Unknown semantic conflict count is null, not a fabricated zero. External native identities are not silently joined to v5 senses.

`policy.json` fixes the short-base, size and ending-proxy thresholds and priority components. Ending diversity counts different remaining prefixes; it cannot establish that those prefixes are linguistically unrelated. Likewise exact duplicate member sets are verified by SQL set difference after hashing, but do not prove that the two families have the same meaning. Shared legacy IDs are overlap observations, not proven transitive homonym paths. Allomorph overgeneralization needs finite correspondence bindings absent from this input; failure to observe an explicit allomorph label is not a clean bill of health.

`members.types` preserves actual source labels. Many v5 relations use only broad parse/compound labels, so absent explicit inflection labels cannot prove that inflection contamination is absent. Individual source claims and family-level Wiktionary relation claims remain separately available. Legacy manual labels and confidence values never become independent linguistic gold.

Risk scores prioritize **investigation**, with separate components for systematic signals, membership impact, exact history constraints, ambiguity, checking complexity and consequences of false exclusion. Components are bounded to 40/20/10/10/10/10 points. A high consequence score means greater need for careful review. Scores are not probabilities and do not enter Di/Pr/Sh/SWOW/A/F/P/FAv/FAₐ or any existing methodology calculation.

## Reproduce the complete runs

Use Python 3.12 (stdlib only). Use the exact v5 projection certified in PR #682; its source main is `47723611112610945cb09b34e18588b7bd151911`, projection version `8c5fb2096111df99f73984c4dfd754b2ef8d147dbbaf520f4dda4f7e95f58faa`. The full Git history is needed for finite historical selectors.

```sh
python associativvordes/v5_diagnostics/run.py \
  --adapter /external/v5-projection --output /external/v5-diagnostics
python associativvordes/v5_diagnostics/run.py \
  --adapter /external/v5-projection --output /external/v5-diagnostics-replay
python associativvordes/v5_diagnostics/tools/finalize.py \
  --first /external/v5-diagnostics --replay /external/v5-diagnostics-replay
```

Fresh replay uses the same immutable inputs and deterministic rules in a separate database. It independently reads and classifies all 256 shards. It does not copy first-run classification outputs. Complete logical tables, exact ID coverage and summary bytes must agree. Physical SQLite file hashes are also recorded; logical equality is the required comparison because recovered transactions may allocate physical pages differently.

The builder first checks projection database checksums, pins all diagnostic code and the history snapshot, then commits each entire bucket. Source identity changes require a fresh output directory. Repeating the command resumes completed buckets; unfinished transactions roll back. `--crash-after 10` exits 75 inside an uncommitted bucket for reproducible fault injection. Complete manifests appear only after all buckets, disk-based cross-family analysis, source/code rechecks and integrity checks. A single exclusive lock prevents concurrent writers to one output.

The SQLite cache is 8 MiB and sorts use disk. Processing retains at most one source family and its finite historical constraints. Cross-family joins and exact set comparisons use disk indexes rather than a complete in-memory graph. Benchmarks state process RSS and disk separately; interrupted and resumed segments must not be confused with an uninterrupted end-to-end time.

## Recover any affected set

The full registry includes tables `families`, `members`, `history`, `history_ids`, `flags`, `patterns`, `priority`, `alias_targets` and bucket checkpoints. `families.body` contains local classification; complete global flags and priority are separate indexed tables and are combined by the query tool. Original historical POS/sense scopes remain in `history.scope`. A history coverage hold is global application blocking, not a blanket negative; exact historical overlaps are flagged for adjudication and never executed.

```sh
python associativvordes/v5_diagnostics/tools/query.py \
  --registry /external/v5-diagnostics --family family:manu --members
python associativvordes/v5_diagnostics/tools/query.py \
  --registry /external/v5-diagnostics --flag ENDING_PREFIX_DIVERSITY_PROXY --members
python associativvordes/v5_diagnostics/tools/query.py \
  --registry /external/v5-diagnostics --category HISTORICAL_ETYMON
python associativvordes/v5_diagnostics/tools/query.py \
  --registry /external/v5-diagnostics --pattern ALIAS_FANOUT manu --members
```

`--cohort cohort:<digest>` recovers the full family/member set of any mechanism cohort recorded in `MECHANISM-COHORTS.json`.

The query reader verifies the complete database SHA-256 before opening read-only. It streams all matching IDs, without a top-N cap. Full cross-family pattern streams preserve every group and every affected family ID. Flags map to exact family IDs; joining those IDs to `members` recovers the full family envelope. Pattern-specific shared-identity edges are distinguished from all memberships in affected families.

Four priority-band gzip queues partition all family IDs. Mechanism cohorts partition families by source, recorded relation-type signature and base length bin. They aggregate initial investigations rather than generating millions of LLM prompts. The theoretical reduction in initial task count is **not** a measured reduction in human review time or a license for batch corrections. Scoped exceptions still require finite evidence.

```sh
python -m unittest discover -s associativvordes/v5_diagnostics -p 'test_*.py'
node tests/associative-v5-diagnostics.test.mjs
```

No command in this module deletes production memberships or restores historically rejected links.

## Immutable portable backup

After finalization, archive and actually restore the complete registry and all full queues/pattern streams:

```sh
python associativvordes/v5_diagnostics/tools/backup.py \
  --registry /external/v5-diagnostics \
  --archive /external/interal-v5-diagnostics.zip \
  --restore-target /external/restored-v5-diagnostics \
  --receipt /external/BACKUP-RESTORE-REPORT.json
```

The restore checks every exact file hash and byte count, opens SQLite read-only, runs a quick integrity check after exact byte verification (the original full checks are already certified) and recounts families/memberships. Keep the versioned archive and its externally pinned SHA-256 away from mutable execution directories. Source/projection inputs remain separately pinned; the archive contains research observations, not authoritative replacement v6 data.

Standalone recovery needs only the archive, the pinned SHA-256 and this code:

```sh
python associativvordes/v5_diagnostics/tools/backup.py \
  --restore-archive /external/interal-v5-diagnostics-20261023.zip \
  --expected-sha256 3194e13cab335863a9d5df8d471b5de15e9aa6971948636aaed6222a8fb9c634 \
  --restore-target /external/recovered-v5-diagnostics \
  --receipt /external/RESTORE-REPORT.json
```

The portable archive is also split into five independently valid ZIP volumes, each below 400 MiB plus ZIP metadata. Download all five files named in `audit/associative-v5-diagnostics/ARCHIVE-VOLUMES.json`, then reconstruct the exact original archive:

```sh
python associativvordes/v5_diagnostics/tools/join_volumes.py \
  --manifest audit/associative-v5-diagnostics/ARCHIVE-VOLUMES.json \
  --directory /external/downloads \
  --output /external/interal-v5-diagnostics-20261023.zip
```

Supplementary complete configured-tail exposure, including long endings, is reproducible without changing the core registry:

```sh
python associativvordes/v5_diagnostics/tools/suffix_exposure.py \
  --registry /external/v5-diagnostics --output /external/SUFFIX-EXPOSURE.json
```

The 252 configured tokens are joined by exact legacy surface-family routing over the entire registry. The resulting 131 families/34,251 memberships are exposure observations, not confirmed inflection or deletion scopes. This result was repeated byte-for-byte against the real restored registry. Its finite manifest is committed alongside the archive receipt; it resolves all members through the same immutable core registry.

## Retrieved archive locations (audit 2026-10-25)

The five original volumes were retrieved, their complete SHA-256 and inner chunk
hashes checked, and their concatenation matched the pinned archive hash. Exact
Library identifiers and resolvable owner-access URLs are in
[`ARCHIVE-AVAILABILITY.json`](../../audit/pr-review-679-694/ARCHIVE-AVAILABILITY.json).
These authenticated owner-access locations do not claim anonymous public access.
The old diagnostics remain historical; code changes require new full verification.
