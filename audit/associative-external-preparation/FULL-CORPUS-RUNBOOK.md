# Reproduce stage 01 in isolated storage

Use the runtime recorded in `certification01/INPUTS.json` (Ubuntu 24.04, `/usr/bin/python3` 3.12.3). The existing partition plan intentionally rejects a different importer/runtime identity. Do not edit source pins to make a mismatch disappear.

Provision at least 40 GiB free disk for two fresh release roots, both disk indexes and temporary summaries. This is a conservative budget, not a measured minimum. Source indexing uses an explicit 64 MiB SQLite cache, and v5 decoding rejects shards over 64 MiB. The 32 GiB test host required a controlled pause and reclamation of disposable replay staging only after its full verification.

Run from the repository root. Replace `/external/interal-stage01` with a directory outside the checkout. Mutable SQLite should use host-local storage rather than a synchronized workspace.

```sh
# Restore the trusted offline archive when available, or acquire official pins.
/usr/bin/python3 associativvordes/importers/corpus_cache.py restore \
  --archive /external/Pinned-morphology-sources-20261020.zip \
  --raw-root /external/interal-stage01/raw
/usr/bin/python3 associativvordes/importers/fetch_sources.py \
  --lock data/morphology-evidence/sources/source-lock.json \
  --raw-root /external/interal-stage01/raw

/usr/bin/python3 associativvordes/importers/certify_corpus.py \
  --raw-root /external/interal-stage01/raw \
  --release /external/interal-stage01/first --workers 2
/usr/bin/python3 associativvordes/importers/certify_corpus.py \
  --raw-root /external/interal-stage01/raw \
  --release /external/interal-stage01/replay --workers 2

# Run before timing checkpoint reuse or reclaiming either replay staging tree.
/usr/bin/python3 associativvordes/importers/verify_replay.py \
  --first /external/interal-stage01/first \
  --replay /external/interal-stage01/replay \
  --receipt /external/interal-stage01/REPLAY-VERIFIED.json
/usr/bin/python3 associativvordes/importers/audit_identity.py \
  --release /external/interal-stage01/first \
  --registry data/morphology-evidence/sources/source-lock.json \
  --receipt /external/interal-stage01/IDENTITIES.json

/usr/bin/python3 associativvordes/importers/index_watch.py \
  --release /external/interal-stage01/first \
  --registry data/morphology-evidence/sources/source-lock.json \
  --destination /tmp/interal-stage01-index --cache-kib 65536 --follow
/usr/bin/python3 associativvordes/importers/audit_scale_index.py \
  --database /tmp/interal-stage01-index/index.sqlite \
  --release /external/interal-stage01/first \
  --receipt /external/interal-stage01/INDEX-AUDIT.json

/usr/bin/python3 associativvordes/candidate_search/project_store.py \
  --repo . --revision a3afb7dad56ba951cc9044591f0236731d35dbbe \
  --destination /tmp/interal-stage01-project
/usr/bin/python3 associativvordes/candidate_search/benchmark_scale.py \
  --index /tmp/interal-stage01-index/index.sqlite \
  --project /tmp/interal-stage01-project/project.sqlite \
  --output /tmp/interal-stage01-benchmark
```

Repeat the same certification/index command after process interruption: completed partitions or committed row batches are checked and reused. Use a fresh release root for independent replay. `--stop-after 1` on certification and `--stop-after 1` on the project projection provide controlled checkpoint probes. Do not use those limited probes as full-corpus receipts.

The scale benchmark includes aggregate full-inventory SQL counts and separate actual path/frequency/queue batches for 10, 100 and 1,000 inventory families, using at most one bounded source query per eligible family. Benchmark questions are ineligible for operational annotation. It does not export every possible path for millions of v5 families. Changed inputs require a new versioned source index; unchanged partitions/shards are reused. Preserve first-build receipts before collecting reuse measurements, which replace mutable LAST-RUN/INDEX/PROJECT timing receipts.

Use `project_store.py` as the project projection entrypoint for both first build and resume. It takes an exclusive process lock and verifies the completed database checksum before calling the low-level `scale_project.build` constructor. Calling that constructor directly is not the certified completed-database reuse path.

The full source projection retains unknown-direction GLeMM arcs, but productive traversal excludes them by default. No spelling identity is inserted to connect separate source analyses. MorphyNet cross-record indirect chains therefore remain conservative/unresolved until there is separate lexical identity evidence.

For the guarded queue pilot, prepare the approved v6 snapshot with `evidence_graph/prepare_registry.py`, then run `candidate_search/index_pilot.py` with `--index`, `--project`, `--projection`, `--projection-lock`, `--registry`, `--repo`, and external `--output`. The existing seven-family guard is retained. The complete v6 catalog contains only 19 families; the million-family v5 inventory benchmark is a different workload.

After `certify_corpus.audit_catalog` and independent replay comparison succeed, use `catalog_store.py publish --store EXTERNAL --catalog VERIFIED_CATALOG`. `catalog_store.py rollback --store EXTERNAL` checks `PREVIOUS.json` and can recover from a damaged current pointer. Publication here selects isolated research data; it does not change website production.

Keep raw corpora and complete products outside Git. Persist small `INPUTS`, both `CHECKPOINT`, both `LAST-RUN`, `CATALOG`, replay/audit, index/project, benchmark and recovery receipts with the code. Preserve the verified GLeMM offline cache and each source's original attribution/license. Do not publish the combined raw archive without checking the intended use against each resource license.
