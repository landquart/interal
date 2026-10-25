# Read-only production v5 research adapter

The adapter projects every materialized v5 membership into an inspectable legacy observation. It never creates an accepted membership, lexical head, normative root or authoritative v6 catalog. The original family ID, lemma ID, language, complete source object and original bucket/ordinal remain recoverable. Aliases are routing observations, not family equivalences. A v5 `safe_automatic` or `manually_verified` field remains a historical source label, not a new linguistic verdict.

The full current corpus contains 2,456,543 families, 10,078,319 memberships and 1,934,050 aliases. Two complete builds produced byte-identical databases and manifests. A separate decoder compared every source family, alias and membership, including every field and membership ordinal. See the completed [report](../../audit/associative-v5-adapter/V5-ADAPTER-REPORT.md).

## Identity and evidence

`family:legacy-v5:<digest>` is an isolated **analysis namespace**, never an authoritative v6 family ID. `source_family_id` always retains the exact original ID. Question identity hashes the analysis namespace, language and original source lemma ID. It is independent of output directory, global snapshot version, alias changes and newly attached evidence. Distinct legacy IDs remain distinct even when casefold lookup matches; a legacy ID that already conflates homonyms retains unknown sense scope.

An old corpus lemma is exposed as `legacy_exact_record`, with unverified POS/sense and `establishes_lexical_head=false`. Native UDer/GLeMM/MorphyNet identities remain separate alternatives. A same-language spelling lookup proposes an alignment; it never establishes that the corpus row is that native lexeme or sense. External POS does not become corpus POS. No substring/allomorph expansion or universal stem rewrite exists.

The external row index reuses the exact existing stage-03 extractor. It retains original bytes, native identities, directions, alternatives, artifact/line hashes and source lineage. All 35 pinned files, all six languages and the 24 quarantined originals are preserved. GLeMM's possible MorphyNet dependency is retained. Source count is never treated as an independent-vote count. Inflections remain inflections. Finite graph windows reuse the existing `evidence_graph.build_graph.ingest`; missing UDer parents remain unresolved, with their original claims still available in the source rows. There is no invented intermediate node or accepted corpus binding.

## Scale and recovery

Build workers process independent buckets and publish one SQLite database per bucket. Each source hash is checked against its exact Git object. Family/alias and language transactions are checkpointed independently; a crash rolls back an unfinished language. Completed databases are atomically renamed and checksummed before their receipts appear. The complete manifest appears only after all selected shards and a final source/code recheck succeed. Reuse verifies database bytes. Changed source buckets rebuild independently under new versioned filenames; unchanged buckets are reused. Reuse does not mean permission to mutate production.

Memory is bounded by the largest source family during streaming, the SQLite cache, and at most two open reader shards. The independent verifier intentionally uses another JSON decoder on one complete bucket at a time. It does not load millions of families simultaneously. Mutable indexes belong on host-local external disk, not a replicated workspace. The commands accept any suitable external directory; the source Git commits, code and receipts permit rebuilding after loss of a temporary environment.

Queues are finite: at most 10,000 questions and 32 MiB of question JSON per export. A version-bound cursor permits successive windows without loss or duplicates. Explicit lists of `(source family, language, source lemma ID)` can also be exported. Original records remain in the projection even when an evidence window is truncated; omitted source-row counts are explicit. Cursor scope/version mismatches fail closed.

Categories overlap: `STRUCTURAL_DEFECT`, `SURFACE_ONLY_FAMILY`, `MORPHOLOGY_CONFLICT`, `SENSE_IDENTITY_UNRESOLVED`, `ALLOMORPH_REVIEW`, `FAMILY_BOUNDARY_CONFLICT`, `HISTORY_CONFLICT`, `EVIDENCE_MISSING`. They are research triggers, not deletion verdicts. Malformed or orphaned source input stops publication instead of silently repairing it.

## Full build and independent verification

From a full clone containing the pinned main and historical decisions:

```sh
python associativvordes/v5_adapter/build.py --repo . \
  --source associativvordes/family-index-v5 --output /external/v5-projection \
  --commit 47723611112610945cb09b34e18588b7bd151911 --workers 2
python associativvordes/v5_adapter/verify.py --adapter /external/v5-projection
```

Repeat the build in another fresh external directory and compare `MANIFEST.json` and the database hashes. Rerun against the same directory for checkpoint/reuse; `--buckets 00 01` selects independent partitions. Only a 256-bucket manifest is marked complete. `--crash-after 10` intentionally exits 75 inside an uncommitted membership transaction and is a fault-injection option, not a production change.

## Pinned external rows

Use the existing exact `data/morphology-evidence/sources/source-lock.json`. Acquire the original files with `importers/fetch_sources.py`, or restore the private checksum-verified originals cache with `importers/corpus_cache.py restore`. Original attribution and per-resource licenses continue to apply; raw datasets stay outside Git.

```sh
python associativvordes/v5_adapter/external.py --raw /external/raw \
  --lock data/morphology-evidence/sources/source-lock.json --output /external/native-rows
```

The default requires every pinned artifact. `--allow-unavailable` is an explicit research fallback: missing pins are retained as unavailable, never replaced with other versions. Readers reject incomplete external indexes by default. The completed audited run used **all 35 files**, without that fallback.

## Existing graph, review, annotation and dry-run workers

```sh
python associativvordes/v5_adapter/bridge.py --adapter /external/v5-projection \
  --external /external/native-rows --family family:manu --language ru --limit 100 \
  --output /external/window-001 --review-ledger /external/review-window-001 \
  --graph /external/window-001/graph.sqlite
python associativvordes/mass_dry_run/worker.py --input /external/window-001 \
  --registry /external/v5-projection --v5-external /external/native-rows \
  --store /external/window-001-annotation \
  --config associativvordes/auto_annotation/config.offline.json
```

The bridge attaches lossless source rows to the existing review ledger; its blind-view allowlist continues to hide historical decisions and algorithm hints. `--cursor` reads the previous manifest's `next_cursor` object saved as a JSON file, using the same family/language scope. Empty `next_cursor` means that scope is exhausted. The low-level `Adapter.rows` iterator exposes any exact legacy membership without generating a queue or a graph.

The annotation loader verifies the actual projection, original row, history snapshot and native index. Rehashing a forged queue cannot turn an unverified sense into a verified one. Cards carry the **original** family scope for historical checks and an explicit legacy-head risk. No implicit v6 index alignment is allowed. The existing mass-dry-run worker supports finite v5 windows; its whole-v6 coordinator is not represented as a full v5 semantic annotation run. History conflicts and absent independent gold continue to block semantic application.

A real 31-question, six-language exercise covers MANU, REGUL, OCUL, INTER, the separate CREAT surface targets, a singleton and a long base. It runs the existing graph/review/annotation worker, kills and resumes annotation, repeats idempotently, and exports through the existing mass-dry-run handoff:

```sh
python associativvordes/v5_adapter/exercise.py --adapter /external/v5-projection \
  --external /external/native-rows --output /external/v5-exercise
python -m unittest discover -s associativvordes/v5_adapter -p 'test_*.py'
```

Historical removed rows remain tombstones in the decision registry, not memberships reintroduced into this current projection. The unavailable original assignment artifacts recorded by baseline PR #680 are not fabricated. Current materialized records are investigated as their own pinned source state; their structural preservation does not certify linguistic correctness.
