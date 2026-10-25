# Reproduce / restore the lexical mapping candidate

Use the reviewed implementation checkout and exact input versions in `IMPLEMENTATION.json`. The producer commit `f085ecce623f687b9e50fd9a70f481e6bffa39c6` is retained for data reproduction. Use the final PR implementation for the hardened proof reader and final admission; its schema and configured source/database fingerprints must match. Never treat an archived TEST_ONLY E2E receipt as a production qualification.

1. Acquire the nine private archive parts by the exact IDs in `ARCHIVE.json`. Preserve the listed filenames and order. Do not use expiring transport URLs as archive locators.
2. Verify part size/SHA-256 and the concatenated archive hash against the plan. The existing bounded-space verifier also checks every listed member, safe paths and SQLite integrity:

```bash
python3 -m associativvordes.source_recovery.restore \
  --plan audit/lexical-identity-20261025/ARCHIVE.json \
  --downloads "$DOWNLOADED_PARTS" --cold-root "$FRESH_COLD_DIRECTORY" \
  --output "$RESTORE_RECEIPT"
```

That command verifies members sequentially. To retain a complete working environment, concatenate the parts in manifest order into the archive, verify its full hash, then extract its regular safe members into a new private directory. Recheck all files using the embedded `FILE-HASHES.json` and run SQLite `PRAGMA integrity_check`. This run also physically restored the complete environment simultaneously; see `COLD-RESTORE-REPORT.json`.

3. Restore the original inputs using `RECOVERY-SOURCES.json`: exact baseline parts, the pinned raw morphology ZIP, and exact historical event archive. The morphology ZIP extracts `raw/` and its metadata; pass that `raw/` directory below. Baseline input is `current/associativvordes/family-index-v5`. Verify every source hash; no original assignments or historical Kaikki are recreated.
4. Rebuild into fresh, separate directories (live SQLite outside synchronized folders):

```bash
python3 -m associativvordes.identity_mapping.native \
  --raw "$RAW_ROOT/raw" --lock data/morphology-evidence/sources/source-lock.json \
  --output "$NEW_NATIVE"
python3 -m associativvordes.identity_mapping.dictionary --native "$NEW_NATIVE" --repo "$PWD"
python3 -m associativvordes.identity_mapping.project \
  --source "$BASELINE/current/associativvordes/family-index-v5" --repo "$PWD" \
  --commit 47723611112610945cb09b34e18588b7bd151911 \
  --history "$HISTORY/materialized-events.ndjson.gz" --output "$NEW_PROJECTION"
python3 -m associativvordes.identity_mapping.registry \
  --projection "$NEW_PROJECTION" --native "$NEW_NATIVE" --output "$NEW_REGISTRY"
python3 -m associativvordes.identity_mapping.verify \
  --native "$NEW_NATIVE" --raw "$RAW_ROOT/raw" \
  --lock data/morphology-evidence/sources/source-lock.json --output "$NATIVE_AUDIT"
python3 -m associativvordes.identity_mapping.verify \
  --registry "$NEW_REGISTRY" --source "$BASELINE/current/associativvordes/family-index-v5" \
  --output "$CORPUS_AUDIT"
```

Use pinned Python/SQLite/Unicode versions for byte-sensitive reproduction. Timings and measured RSS are run telemetry, not deterministic identity fields. New receipts must describe the actual new run; do not overwrite historical expected hashes to make an old receipt certify changed code.

5. Inspect all candidates and all evidence without an arbitrary candidate limit:

```bash
python3 -m associativvordes.identity_mapping.query --native "$NATIVE/native.sqlite" --language en --word bank
python3 -m associativvordes.identity_mapping.query --native "$NATIVE/native.sqlite" --evidence-for "$CANDIDATE_ID"
python3 -m associativvordes.identity_mapping.query --registry "$REGISTRY" \
  --language "$LANGUAGE" --family "$FAMILY_ID" --lemma "$ORIGINAL_LEMMA_ID"
```

`MappingReviewer(native_folder, expected_database_sha256, expected_source_lock_sha256)` requires operator-configured verified fingerprints. `proposal(...)` only prepares a finite target. `evaluate(...)` / `binding(...)` require an independently configured verifier receipt over the complete proposal; the proposal cannot authorize itself. A complete source sense without a reviewed corpus/context alignment remains unresolved. All final membership decisions still pass the normative/history/quality/release gates.
